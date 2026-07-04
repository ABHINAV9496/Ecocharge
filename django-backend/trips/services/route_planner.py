"""
Energy-aware multi-stop route planner.

Algorithm:
  1. Pre-compute route geometry (segments, cumulative distances) once.
  2. Preprocess ALL corridor stations: project onto route, sort by
     cumulative distance, pre-filter by slot availability.
  3. During battery simulation, walk the sorted station list.
  4. Score candidates by drive time + charge time (fastest) or
     cost + time value (cheapest).
  5. After all stops, call OSRM route endpoint for display geometry.
"""

from dataclasses import dataclass, field
from typing import List
import math
import threading
import time
import logging
import requests
import concurrent.futures
from django.core.cache import cache


logger = logging.getLogger(__name__)

CHARGER_POWER = {
    'DC_ULTRA': 150.0,
    'DC_FAST': 50.0,
    'AC_FAST': 7.4,
    'AC_SLOW': 3.3,
}

SAFETY_BUFFER = 0.15
SEARCH_TRIGGER_BUFFER = 0.50
SEARCH_RADIUS_KM = 30.0
AVG_SPEED_KMPH = 80.0
TIME_VALUE_PER_HOUR = 200
GST_RATE = 0.18
OSRM_REQ_PER_SEC = 5
OSRM_TABLE_TIMEOUT = 5
OSRM_ROUTE_TIMEOUT = 10
OSRM_MAX_COORDS = 20


@dataclass
class ChargingStop:
    stop_index: int
    station_id: int
    station_name: str
    address: str
    lat: float
    lng: float
    distance_from_start_km: float
    arrival_soc_percent: float
    departure_soc_percent: float
    charge_kwh: float
    charge_time_seconds: float
    slot_type: str
    charger_power_kw: float
    cost: float
    detour_km: float
    alternatives: List[dict] = field(default_factory=list)


@dataclass
class TripLeg:
    leg_index: int
    start_name: str
    end_name: str
    distance_km: float
    drive_time_seconds: float
    start_soc_percent: float
    end_soc_percent: float


@dataclass
class RoutePlan:
    total_distance_km: float
    total_drive_time_seconds: float
    total_charge_time_seconds: float
    total_cost: float
    total_energy_consumed_kwh: float
    legs: List[TripLeg]
    stops: List[ChargingStop]
    final_soc_percent: float
    origin_name: str = 'Origin'
    dest_name: str = 'Destination'
    note: str = ''
    strategy: str = 'fastest_time'
    waypoint_geometry: list = field(default_factory=list)
    battery_profile: list = field(default_factory=list)

    @property
    def total_trip_time_seconds(self):
        return self.total_drive_time_seconds + self.total_charge_time_seconds


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _point_to_segment_dist(px, py, ax, ay, bx, by):
    abx = bx - ax
    aby = by - ay
    apx = px - ax
    apy = py - ay
    t = (apx * abx + apy * aby) / (abx * abx + aby * aby + 1e-10)
    t = max(0.0, min(1.0, t))
    return _haversine_km(px, py, ax + t * abx, ay + t * aby)


def _min_dist_to_route(lat, lng, route_coords):
    best_i = 0
    best_d = float('inf')
    for i, (rlat, rlng) in enumerate(route_coords):
        d = _haversine_km(lat, lng, rlat, rlng)
        if d < best_d:
            best_d = d
            best_i = i

    best = best_d
    for i in (best_i - 1, best_i, best_i + 1):
        if 0 <= i < len(route_coords) - 1:
            d = _point_to_segment_dist(lat, lng,
                                       route_coords[i][0], route_coords[i][1],
                                       route_coords[i + 1][0], route_coords[i + 1][1])
            if d < best:
                best = d
    return best


class EnergyAwareRoutePlanner:
    OSRM_BASE = 'https://router.project-osrm.org'
    _lock = threading.Lock()
    _last_req_time = 0.0

    def __init__(self, consumption_wh_per_km, battery_kwh, battery_start_percent, **kwargs):
        self.consumption_wh_per_km = consumption_wh_per_km
        self.battery_kwh = battery_kwh
        self.battery_start_percent = battery_start_percent
        self._usable_kwh = battery_kwh
        self._usable_start = battery_kwh * (battery_start_percent / 100.0)
        self.max_charge_pct = 0.80
        self.max_detour_km = 100.0
        self.safety_buffer = SAFETY_BUFFER
        self.search_radius = 80.0
        self._consumption_kwh_per_km = self.consumption_wh_per_km / 1000.0

        self._osrm_table_cache = {}
        self._osrm_table_cache_lock = threading.Lock()

    def _avg_speed(self, strategy):
        if strategy == 'cheapest':
            return 76.0
        return AVG_SPEED_KMPH

    def _segment_energy_kwh(self, distance_km):
        return distance_km * self._consumption_kwh_per_km

    def _soc_from_kwh(self, kwh):
        if self.battery_kwh <= 0:
            return 0.0
        return max(0.0, min(100.0, (kwh / self.battery_kwh) * 100.0))

    def _kwh_from_soc(self, soc):
        return self.battery_kwh * (soc / 100.0)

    def _get_best_slot(self, station):
        slots = station.get('slots') or []
        available = [s for s in slots if s.get('status') == 'AVAILABLE']
        if not available:
            return None
        available.sort(key=lambda s: (
            {'DC_ULTRA': 4, 'DC_FAST': 3, 'AC_FAST': 2, 'AC_SLOW': 1}.get(s.get('slot_type', ''), 0),
            CHARGER_POWER.get(s.get('slot_type', ''), 0)
        ), reverse=True)
        return available[0]

    def _rate_limit(self):
        with self._lock:
            elapsed = time.time() - self._last_req_time
            min_gap = 1.0 / OSRM_REQ_PER_SEC
            if elapsed < min_gap:
                time.sleep(min_gap - elapsed)
            self._last_req_time = time.time()

    def _osrm_table(self, src_lat, src_lng, candidates):
        if not candidates:
            return []

        src_key = (round(src_lat, 3), round(src_lng, 3))
        redis_key_prefix = f"osrm:d:{src_key[0]}:{src_key[1]}"

        results = [None] * len(candidates)
        uncached = []
        uncached_indices = []

        with self._osrm_table_cache_lock:
            for i, c in enumerate(candidates):
                dest_id = c['id']
                cache_key = (src_key[0], src_key[1], dest_id)
                if cache_key in self._osrm_table_cache:
                    results[i] = self._osrm_table_cache[cache_key]
                else:
                    redis_key = f"{redis_key_prefix}:{dest_id}"
                    cached_val = cache.get(redis_key)
                    if cached_val is not None:
                        results[i] = cached_val
                        self._osrm_table_cache[cache_key] = cached_val
                    else:
                        uncached.append(c)
                        uncached_indices.append(i)

        if not uncached:
            return results

        with self._osrm_table_cache_lock:
            still_uncached = []
            still_indices = []
            for i in range(len(uncached)):
                dest_id = uncached[i]['id']
                cache_key = (src_key[0], src_key[1], dest_id)
                if cache_key in self._osrm_table_cache:
                    orig_idx = uncached_indices[i]
                    results[orig_idx] = self._osrm_table_cache[cache_key]
                else:
                    redis_key = f"{redis_key_prefix}:{dest_id}"
                    cached_val = cache.get(redis_key)
                    if cached_val is not None:
                        self._osrm_table_cache[cache_key] = cached_val
                        orig_idx = uncached_indices[i]
                        results[orig_idx] = cached_val
                    else:
                        still_uncached.append(uncached[i])
                        still_indices.append(uncached_indices[i])

            if not still_uncached:
                return results
            uncached = still_uncached
            uncached_indices = still_indices

        coords_parts = [f"{src_lng},{src_lat}"]
        for c in uncached:
            clng = c.get('longitude')
            clat = c.get('latitude')
            if clng is not None and clat is not None:
                coords_parts.append(f"{clng},{clat}")
        if len(coords_parts) < 2:
            return results

        n_uncached = len(coords_parts) - 1
        if n_uncached + 1 > OSRM_MAX_COORDS:
            coords_parts = coords_parts[:OSRM_MAX_COORDS]
            n_uncached = len(coords_parts) - 1
            uncached_indices = uncached_indices[:n_uncached]
            uncached = uncached[:n_uncached]

        coords_str = ";".join(coords_parts)
        dest_indices = ";".join(str(i) for i in range(1, n_uncached + 1))
        url = f"{self.OSRM_BASE}/table/v1/driving/{coords_str}?sources=0&destinations={dest_indices}"

        try:
            self._rate_limit()
            resp = requests.get(url, timeout=OSRM_TABLE_TIMEOUT)

            if resp.status_code != 200:
                return results
            data = resp.json()
            if data.get('code') != 'Ok' or 'distances' not in data:
                return results

            with self._osrm_table_cache_lock:
                for i in range(n_uncached):
                    try:
                        d = data['distances'][0][i]
                        dur = data['durations'][0][i]
                        if d is None or dur is None:
                            result = None
                        else:
                            result = (float(d), float(dur))
                    except (IndexError, TypeError, ValueError):
                        result = None

                    dest_id = uncached[i]['id']
                    cache_key = (src_key[0], src_key[1], dest_id)
                    self._osrm_table_cache[cache_key] = result
                    if result is not None:
                        redis_key = f"{redis_key_prefix}:{dest_id}"
                        cache.set(redis_key, result, timeout=86400 * 7)

                    orig_idx = uncached_indices[i]
                    results[orig_idx] = result

            return results
        except Exception as e:
            logger.warning("OSRM table request failed: %s", e)
            return results

    def _osrm_route_waypoints(self, waypoints):
        if len(waypoints) < 2:
            return []
        coords_str = ";".join(f"{lng},{lat}" for lat, lng in waypoints)
        url = f"{self.OSRM_BASE}/route/v1/driving/{coords_str}?geometries=geojson&overview=full&steps=true"
        try:
            self._rate_limit()
            resp = requests.get(url, timeout=OSRM_ROUTE_TIMEOUT)
            if resp.status_code != 200:
                logger.warning("OSRM route returned %s", resp.status_code)
                return []
            data = resp.json()
            if not data.get('routes'):
                logger.warning("OSRM route no routes: %s", data.get('message', ''))
                return []
            route = data['routes'][0]
            coords = route['geometry']['coordinates']
            return [[c[1], c[0]] for c in coords]
        except requests.RequestException as e:
            logger.warning("OSRM route request failed: %s", e)
            return []
        except Exception as e:
            logger.warning("OSRM route parse error: %s", e)
            return []

    def _project_to_route(self, lat, lng, route_coords, cum_km):
        best_d = float('inf')
        best_i = 0
        for i, (rlat, rlng) in enumerate(route_coords):
            d = (rlat - lat) ** 2 + (rlng - lng) ** 2
            if d < best_d:
                best_d = d
                best_i = i
        return best_i, cum_km[best_i]

    def _calc_charge_time(self, charge_kwh, power_kw):
        if power_kw <= 0:
            return 1800
        eff_power = min(power_kw, 350.0)
        return (charge_kwh / eff_power) * 3600

    def _compute_route_geometry(self, route_coords, total_distance_m):
        n = len(route_coords)
        total_km = total_distance_m / 1000.0
        seg_dists = []
        for i in range(n - 1):
            d = _haversine_km(route_coords[i][0], route_coords[i][1],
                              route_coords[i + 1][0], route_coords[i + 1][1])
            seg_dists.append(d)
        raw_total = sum(seg_dists)
        if raw_total > 0:
            scale = total_km / raw_total
            seg_dists = [d * scale for d in seg_dists]
        cum_km = [0.0]
        for d in seg_dists:
            cum_km.append(cum_km[-1] + d)
        return seg_dists, cum_km, total_km, n

    def plan_routes(self, route_coords, total_distance_m, stations,
                    origin_name='Origin', dest_name='Destination'):
        strategies = ['fastest_time', 'cheapest']
        plans = []

        seg_dists, cum_km, total_km, n = self._compute_route_geometry(route_coords, total_distance_m)

        _pre_ts = time.time()
        max_r = self.search_radius * 10
        _route_lats = [c[0] for c in route_coords]
        _route_lngs = [c[1] for c in route_coords]
        mid_lat_pre = (min(_route_lats) + max(_route_lats)) / 2.0
        llr_pre = 1.0 / math.cos(math.radians(mid_lat_pre))
        min_clat_pre = min(_route_lats) - (max_r / 110.0)
        max_clat_pre = max(_route_lats) + (max_r / 110.0)
        min_clng_pre = min(_route_lngs) - (max_r / 110.0 * llr_pre)
        max_clng_pre = max(_route_lngs) + (max_r / 110.0 * llr_pre)

        precomputed = []
        for st in stations:
            lat = st.get('latitude')
            lng = st.get('longitude')
            if lat is None or lng is None:
                continue
            if not (min_clat_pre <= lat <= max_clat_pre and min_clng_pre <= lng <= max_clng_pre):
                continue
            slot = self._get_best_slot(st)
            if not slot:
                continue
            power = CHARGER_POWER.get(slot.get('slot_type', ''), 7.4)
            rate = float(slot.get('rate_per_kwh', 10) or 10)
            route_idx, cum_dist = self._project_to_route(lat, lng, route_coords, cum_km)
            detour = _min_dist_to_route(lat, lng, route_coords)
            precomputed.append({
                'st': st, 'slot': slot, 'st_lat': lat, 'st_lng': lng,
                'cum_dist': cum_dist, 'detour_km': round(detour, 2),
                'power': power, 'rate': rate, 'route_idx': route_idx,
            })

        precomputed.sort(key=lambda x: x['cum_dist'])
        pc_lookup = {p['st']['id']: p for p in precomputed}
        _pre_time = time.time() - _pre_ts
        logger.info("========== ROUTE PREPROCESS ========")
        logger.info("  Corridor stations:  %d", len(precomputed))
        logger.info("  Project + sort:     %.3f sec", _pre_time)
        logger.info("====================================")

        def _run_strat(s):
            p = self.plan_route(
                route_coords, total_distance_m, stations,
                origin_name=origin_name, dest_name=dest_name,
                strategy=s, max_charge_pct=0.80,
                seg_dists=seg_dists, cum_km=cum_km,
                precomputed_stations=precomputed,
                precomputed_lookup=pc_lookup,
            )
            return p

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futures = {pool.submit(_run_strat, s): s for s in strategies}
            for f in concurrent.futures.as_completed(futures):
                plans.append(f.result())

        plan_map = {p.strategy: p for p in plans}
        fastest_plan = plan_map.get('fastest_time')
        cheapest_plan = plan_map.get('cheapest')

        selected = fastest_plan

        waypoints = [(route_coords[0][0], route_coords[0][1])]
        for stop in selected.stops:
            waypoints.append((stop.lat, stop.lng))
        waypoints.append((route_coords[-1][0], route_coords[-1][1]))
        wg = self._osrm_route_waypoints(waypoints)
        if wg:
            selected.waypoint_geometry = wg

        alternatives = []
        p = cheapest_plan
        if p and id(p) != id(selected):
            alternatives.append({
                'label': 'Cheapest',
                'strategy': p.strategy,
                'total_drive_time_seconds': p.total_drive_time_seconds,
                'total_charge_time_seconds': p.total_charge_time_seconds,
                'total_trip_time_seconds': p.total_trip_time_seconds,
                'total_cost': p.total_cost,
                'stop_count': len(p.stops),
                'final_soc_percent': p.final_soc_percent,
                'total_distance_km': p.total_distance_km,
                'stops': p.stops,
                'legs': p.legs,
                'total_energy_consumed_kwh': p.total_energy_consumed_kwh,
                'note': p.note,
            })
        return {
            'selected': selected,
            'alternatives': alternatives,
        }

    def plan_route(self, route_coords, total_distance_m, stations,
                   origin_name='Origin', dest_name='Destination',
                   strategy='fastest_time', max_charge_pct=0.80,
                   seg_dists=None, cum_km=None,
                   precomputed_stations=None, precomputed_lookup=None):

        total_km = total_distance_m / 1000.0
        usable_km = (self.battery_kwh * (max_charge_pct - SAFETY_BUFFER)) / self._consumption_kwh_per_km
        max_stops = min(30, max(15, math.ceil(total_km / (usable_km * 0.75)) + 3))
        logger.info("[%s] total_distance_m=%.1f total_km=%.1f max_charge_pct=%.2f max_stops=%d usable_km=%.1f",
                     strategy, total_distance_m, total_km, max_charge_pct, max_stops, usable_km)
        n = len(route_coords)
        if n < 2:
            return RoutePlan(total_km, 0, 0, 0, 0, [], [], self.battery_start_percent,
                             origin_name, dest_name, 'Route too short')

        dest_lat, dest_lng = route_coords[-1][0], route_coords[-1][1]

        if precomputed_stations is None:
            raise ValueError("plan_route requires precomputed_stations (call plan_routes instead)")

        if seg_dists is None or cum_km is None:
            seg_dists = []
            for i in range(n - 1):
                d = _haversine_km(route_coords[i][0], route_coords[i][1],
                                  route_coords[i + 1][0], route_coords[i + 1][1])
                seg_dists.append(d)
            raw_total = sum(seg_dists)
            if raw_total > 0:
                scale = total_km / raw_total
                seg_dists = [d * scale for d in seg_dists]

            cum_km = [0.0]
            for d in seg_dists:
                cum_km.append(cum_km[-1] + d)

        remaining_kwh = self._usable_start
        stops = []
        legs = []
        last_stop_idx = 0
        last_stop_cum = 0.0
        last_leg_start = origin_name
        last_leg_soc = self.battery_start_percent
        total_charge_s = 0.0
        total_cost = 0.0
        waypoints = [(route_coords[0][0], route_coords[0][1])]
        current_lat, current_lng = route_coords[0][0], route_coords[0][1]
        _hit_max_stops = False
        _dead_end = False

        pc_ptr = 0
        _total_iterations = 0
        while True:
            _total_iterations += 1
            if _total_iterations > max_stops:
                waypoints.append((dest_lat, dest_lng))
                _hit_max_stops = True
                break
            logger.info("Planning iteration %d — %d stops found so far, %.1f km left, %.1f kWh remaining",
                        len(legs), len(stops), total_km - cum_km[last_stop_idx], remaining_kwh)
            km_left = total_km - cum_km[last_stop_idx]

            need_for_dest = self._segment_energy_kwh(km_left) * (1 + self.safety_buffer)
            if remaining_kwh >= need_for_dest:
                waypoints.append((dest_lat, dest_lng))
                break

            trigger_kwh = self._usable_kwh * SEARCH_TRIGGER_BUFFER
            sim_battery = remaining_kwh
            found_charge = False

            for idx in range(last_stop_idx, n - 1):
                seg_energy = self._segment_energy_kwh(seg_dists[idx])
                next_cum = cum_km[idx + 1]
                projected_battery = sim_battery - seg_energy

                km_from_here = total_km - next_cum
                need_here = self._segment_energy_kwh(km_from_here) * (1 + self.safety_buffer)
                if sim_battery >= need_here:
                    remaining_kwh = sim_battery - seg_energy
                    last_stop_idx = idx + 1
                    last_stop_cum = next_cum
                    break

                if projected_battery <= trigger_kwh:
                    if projected_battery <= 0:
                        remaining_kwh = max(0, sim_battery)
                        last_stop_cum = cum_km[idx]
                        waypoints.append((dest_lat, dest_lng))
                        found_charge = True
                        _dead_end = True
                        break

                    current_cum = cum_km[idx]
                    remaining_kwh = sim_battery
                    range_left = (remaining_kwh / self.consumption_wh_per_km) * 1000

                    look_km = max(150, range_left * 1.5)
                    search_end_cum = min(total_km, current_cum + look_km)

                    while pc_ptr < len(precomputed_stations) and precomputed_stations[pc_ptr]['cum_dist'] <= current_cum:
                        pc_ptr += 1

                    candidates = []
                    j = pc_ptr
                    while j < len(precomputed_stations) and precomputed_stations[j]['cum_dist'] <= search_end_cum:
                        ps = precomputed_stations[j]
                        if ps['detour_km'] <= self.search_radius:
                            candidates.append((ps['st'], ps['slot'], ps['detour_km'], ps['power'], ps['rate']))
                        j += 1

                    if not candidates:
                        sim_battery = max(0, projected_battery)
                        last_stop_idx = idx + 1
                        last_stop_cum = cum_km[last_stop_idx]
                        break

                    cand_data = []
                    for c in candidates:
                        ps = precomputed_lookup[c[0]['id']]
                        stop_cum = ps['cum_dist']
                        if stop_cum <= current_cum:
                            continue
                        route_dist_km = max(0.1, stop_cum - current_cum)
                        cand_data.append((c, stop_cum, route_dist_km, route_dist_km))

                    cand_data = [x for x in cand_data if x[1] > current_cum]
                    if not cand_data:
                        sim_battery = max(0, projected_battery)
                        last_stop_idx = idx + 1
                        last_stop_cum = cum_km[last_stop_idx]
                        break
                    cand_data.sort(key=lambda x: x[1])

                    scored = []
                    for c_tuple, stop_cum, route_dist_km, leg_dist_km in cand_data:
                        st, slot, detour, power, rate = c_tuple
                        st_lat = float(st['latitude'])
                        st_lng = float(st['longitude'])

                        drive_time_s = (leg_dist_km / self._avg_speed(strategy)) * 3600

                        detour_actual = max(0, leg_dist_km - _haversine_km(current_lat, current_lng, st_lat, st_lng))
                        if detour_actual > self.max_detour_km:
                            continue

                        arrival_kwh = remaining_kwh - self._segment_energy_kwh(route_dist_km)
                        if arrival_kwh <= -0.05:
                            continue
                        min_arrival_at_station = self.battery_kwh * 0.03
                        if arrival_kwh < min_arrival_at_station:
                            continue

                        arrival_soc = self._soc_from_kwh(arrival_kwh)
                        km_after = total_km - stop_cum

                        max_dep_kwh = self.battery_kwh * max_charge_pct
                        energy_needed_for_leg = self._segment_energy_kwh(km_after) * (1 + self.safety_buffer)
                        target_dep_kwh = min(energy_needed_for_leg, max_dep_kwh)
                        target_dep_kwh = max(target_dep_kwh, self.battery_kwh * (max_charge_pct - 0.10))
                        charge_kwh = max(0.0, target_dep_kwh - arrival_kwh)

                        if charge_kwh < 2.0:
                            continue

                        charge_s = self._calc_charge_time(charge_kwh, power)
                        cost_stop = charge_kwh * rate * (1 + GST_RATE)
                        dep_kwh = arrival_kwh + charge_kwh
                        dep_soc = self._soc_from_kwh(dep_kwh)

                        if strategy == 'fastest_time':
                            score = -(drive_time_s + charge_s)
                        else:
                            effective_cost = cost_stop + ((drive_time_s + charge_s) / 3600) * TIME_VALUE_PER_HOUR
                            score = -effective_cost

                        scored.append({
                            'score': score,
                            'st': st,
                            'slot': slot,
                            'detour': detour,
                            'power': power,
                            'rate': rate,
                            'drive_time_s': drive_time_s,
                            'arrival_kwh': arrival_kwh,
                            'arrival_soc': arrival_soc,
                            'charge_kwh': charge_kwh,
                            'charge_s': charge_s,
                            'cost_stop': cost_stop,
                            'dep_kwh': dep_kwh,
                            'dep_soc': dep_soc,
                            'stop_cum': stop_cum,
                        })

                    if not scored:
                        sim_battery = max(0, projected_battery)
                        last_stop_idx = idx + 1
                        last_stop_cum = cum_km[last_stop_idx]
                        break

                    scored.sort(key=lambda x: x['score'], reverse=True)
                    best = scored[0]

                    st = best['st']
                    slot = best['slot']
                    detour = best['detour']
                    power = best['power']
                    rate = best['rate']
                    drive_time_s = best['drive_time_s']
                    arrival_kwh = best['arrival_kwh']
                    arrival_soc = best['arrival_soc']
                    charge_kwh = best['charge_kwh']
                    charge_s = best['charge_s']
                    cost_stop = best['cost_stop']
                    dep_kwh = best['dep_kwh']
                    dep_soc = best['dep_soc']
                    st_lat = float(st['latitude'])
                    st_lng = float(st['longitude'])
                    stop_cum = best['stop_cum']

                    drive_km = stop_cum - last_stop_cum

                    if drive_km > 0:
                        leg_drive_s = (drive_km / self._avg_speed(strategy)) * 3600
                        legs.append(TripLeg(
                            leg_index=len(legs),
                            start_name=last_leg_start,
                            end_name=(st.get('name', '') or st.get('address', '')) + ' #' + str(len(stops) + 1),
                            distance_km=round(drive_km, 1),
                            drive_time_seconds=round(leg_drive_s),
                            start_soc_percent=round(last_leg_soc, 1),
                            end_soc_percent=round(arrival_soc, 1),
                        ))
                    stop_label = (st.get('name', '') or st.get('address', '')) + ' #' + str(len(stops) + 1)
                    last_leg_start = stop_label
                    last_leg_soc = dep_soc

                    stops.append(ChargingStop(
                        stop_index=len(stops) + 1,
                        station_id=st['id'],
                        station_name=st.get('name', '') or st.get('address', ''),
                        address=st.get('address', ''),
                        lat=st_lat, lng=st_lng,
                        distance_from_start_km=round(stop_cum, 1),
                        arrival_soc_percent=round(arrival_soc, 1),
                        departure_soc_percent=round(dep_soc, 1),
                        charge_kwh=round(charge_kwh, 2),
                        charge_time_seconds=round(charge_s),
                        slot_type=slot.get('slot_type', ''),
                        charger_power_kw=power,
                        cost=round(cost_stop, 2),
                        detour_km=detour,
                    ))

                    stop_route_idx = 0
                    for i, c in enumerate(cum_km):
                        if c >= stop_cum - 0.1:
                            stop_route_idx = i
                            break
                    if stop_route_idx <= last_stop_idx:
                        stop_route_idx = last_stop_idx + 1
                    waypoints.append((st_lat, st_lng))
                    current_lat, current_lng = st_lat, st_lng
                    total_charge_s += charge_s
                    total_cost += cost_stop
                    remaining_kwh = dep_kwh
                    next_idx = max(stop_route_idx, idx)
                    if next_idx <= last_stop_idx:
                        next_idx = last_stop_idx + 1
                    last_stop_cum = stop_cum
                    last_stop_idx = next_idx
                    logger.info("[%s] Stop#%d: arrival_kwh=%.1f arrival_soc=%.1f%% charge_kwh=%.1f dep_kwh=%.1f dep_soc=%.1f%% dist=%.1fkm strategy=%s",
                                strategy, len(stops), arrival_kwh, arrival_soc, charge_kwh, dep_kwh, dep_soc, stop_cum, strategy)
                    found_charge = True
                    break

                else:
                    sim_battery = projected_battery

            if found_charge:
                if len(stops) >= max_stops or _dead_end:
                    waypoints.append((dest_lat, dest_lng))
                    if len(stops) >= max_stops:
                        _hit_max_stops = True
                    break
                continue

            remaining_kwh = sim_battery
            if last_stop_idx >= n - 2:
                waypoints.append((dest_lat, dest_lng))
                break

        if waypoints and waypoints[-1] != (dest_lat, dest_lng):
            waypoints.append((dest_lat, dest_lng))

        final_km = total_km - last_stop_cum
        final_kwh = max(0, remaining_kwh - self._segment_energy_kwh(final_km)) if final_km > 0 else remaining_kwh
        if final_km > 0:
            final_s = (final_km / self._avg_speed(strategy)) * 3600
            final_soc = self._soc_from_kwh(final_kwh)
            logger.info("[%s] Final leg: remaining_kwh=%.1f final_km=%.1f final_kwh=%.1f final_soc=%.1f%% n_stops=%d",
                        strategy, remaining_kwh, final_km, final_kwh, final_soc, len(stops))
            min_arrival_soc = SAFETY_BUFFER * 100.0
            if final_soc < min_arrival_soc and len(stops) > 0 and not _dead_end:
                logger.warning(
                    "Final SoC %.2f%% below minimum %.0f%%. "
                    "remaining_kwh=%.2f, final_km=%.2f, enforcing floor",
                    final_soc, min_arrival_soc, remaining_kwh, final_km
                )
                final_soc = min_arrival_soc
                final_kwh = min_arrival_soc / 100.0 * self.battery_kwh
            legs.append(TripLeg(
                leg_index=len(legs),
                start_name=last_leg_start,
                end_name=dest_name,
                distance_km=round(final_km, 1),
                drive_time_seconds=round(final_s),
                start_soc_percent=round(last_leg_soc, 1),
                end_soc_percent=round(final_soc, 1),
            ))
        else:
            final_soc = self._soc_from_kwh(remaining_kwh)

        total_drive = sum(l.drive_time_seconds for l in legs)
        total_charge_kwh = sum(s.charge_kwh for s in stops)
        total_energy = self._usable_start + total_charge_kwh - final_kwh

        note = ''
        if _hit_max_stops:
            note = f'Trip requires more charging stops than supported ({max_stops}). Route may not be fully feasible with available charging infrastructure.'
        elif _dead_end and stops:
            last_km = max(s.distance_from_start_km for s in stops)
            note = f'No charging station found between km {last_km:.0f} and the destination - trip not feasible with current vehicle'

        plan = RoutePlan(
            total_distance_km=round(max(sum(l.distance_km for l in legs), total_km), 1),
            total_drive_time_seconds=round(total_drive),
            total_charge_time_seconds=round(total_charge_s),
            total_cost=round(total_cost, 2),
            total_energy_consumed_kwh=round(total_energy, 2),
            legs=legs,
            stops=stops,
            final_soc_percent=round(final_soc, 1),
            origin_name=origin_name,
            dest_name=dest_name,
            note=note,
            strategy=strategy,
        )

        return plan
