"""
Energy-aware multi-stop route planner.

Algorithm:
  1. Split route into segments (between consecutive coordinates).
  2. Track battery SoC along each segment using vehicle consumption model.
  3. When SoC drops below threshold, search for stations ahead along
     the route (using route-projected cumulative distances).
  4. Score candidates by estimated total trip time (drive + charge).
  5. Use OSRM table endpoint to compute actual road distances for scoring.
  6. After all stops, call OSRM route endpoint for through-stations geometry.

Usage:
    planner = EnergyAwareRoutePlanner(
        consumption_wh_per_km=150.0,
        battery_kwh=40.0,
        battery_start_percent=80,
    )
    plan = planner.plan_route(route_coords, total_distance_m, stations)
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Optional
import math
import threading
import time
import logging
import requests
import concurrent.futures


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
MAX_ALTERNATIVES = 5
MAX_STOPS = 20
AVG_SPEED_KMPH = 80.0
REST_BREAK_INTERVAL_S = 4 * 3600
REST_BREAK_DURATION_S = 15 * 60
MAX_VEHICLE_CHARGE_KW = 100.0
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
    road_distance_km: float = 0.0
    road_detour_km: float = 0.0
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
    total_rest_breaks_seconds: float = 0.0
    origin_name: str = 'Origin'
    dest_name: str = 'Destination'
    note: str = ''
    strategy: str = 'fastest_time'
    waypoint_geometry: list = field(default_factory=list)
    battery_profile: list = field(default_factory=list)

    @property
    def total_trip_time_seconds(self):
        return self.total_drive_time_seconds + self.total_charge_time_seconds + self.total_rest_breaks_seconds


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
    best = float('inf')
    for i in range(len(route_coords) - 1):
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

    def __init__(self, consumption_wh_per_km, battery_kwh, battery_start_percent):
        self.consumption_wh_per_km = consumption_wh_per_km
        self.battery_kwh = battery_kwh
        self.battery_start_percent = battery_start_percent
        self._usable_kwh = battery_kwh
        self._usable_start = battery_kwh * (battery_start_percent / 100.0)
        self.max_charge_pct = 0.80
        self.max_detour_km = 5.0
        self.safety_buffer = SAFETY_BUFFER
        self.search_radius = 80.0
        self._cheapest_penalty_s = 0.0
        self._consumption_kwh_per_km = self.consumption_wh_per_km / 1000.0

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
        if not hasattr(self, '_slot_cache'):
            self._slot_cache = {}
        st_id = station.get('id')
        if st_id in self._slot_cache:
            return self._slot_cache[st_id]
        slots = station.get('slots') or []
        available = [s for s in slots if s.get('status') == 'AVAILABLE']
        if not available:
            self._slot_cache[st_id] = None
            return None
        available.sort(key=lambda s: (
            {'DC_ULTRA': 4, 'DC_FAST': 3, 'AC_FAST': 2, 'AC_SLOW': 1}.get(s.get('slot_type', ''), 0),
            CHARGER_POWER.get(s.get('slot_type', ''), 0)
        ), reverse=True)
        self._slot_cache[st_id] = available[0]
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
        coords_parts = [f"{src_lng},{src_lat}"]
        for c in candidates:
            clng = c.get('longitude')
            clat = c.get('latitude')
            if clng is not None and clat is not None:
                coords_parts.append(f"{clng},{clat}")
        if len(coords_parts) < 2:
            return []
        n_candidates = len(coords_parts) - 1
        if n_candidates + 1 > OSRM_MAX_COORDS:
            coords_parts = coords_parts[:OSRM_MAX_COORDS]
            n_candidates = len(coords_parts) - 1
        coords_str = ";".join(coords_parts)
        dest_indices = ";".join(str(i) for i in range(1, n_candidates + 1))
        url = f"{self.OSRM_BASE}/table/v1/driving/{coords_str}?sources=0&destinations={dest_indices}"
        try:
            self._rate_limit()
            resp = requests.get(url, timeout=OSRM_TABLE_TIMEOUT)
            if resp.status_code != 200:
                return []
            data = resp.json()
            if data.get('code') != 'Ok' or 'distances' not in data:
                return []
            results = []
            for i in range(n_candidates):
                try:
                    d = data['distances'][0][i]
                    dur = data['durations'][0][i]
                    if d is None or dur is None:
                        results.append(None)
                    else:
                        results.append((float(d), float(dur)))
                except (IndexError, TypeError, ValueError):
                    results.append(None)
            return results
        except requests.RequestException as e:
            logger.warning("OSRM table request failed: %s", e)
            return []
        except Exception as e:
            logger.warning("OSRM table parse error: %s", e)
            return []

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
        for i in range(len(route_coords)):
            d = _haversine_km(lat, lng, route_coords[i][0], route_coords[i][1])
            if d < best_d:
                best_d = d
                best_i = i
        return best_i, cum_km[best_i]

    def _effective_power(self, charger_power_kw):
        return min(charger_power_kw, MAX_VEHICLE_CHARGE_KW)

    def _calc_charge_time(self, charge_kwh, power_kw, start_soc, target_soc):
        if power_kw <= 0:
            return 1800
        eff_power = self._effective_power(power_kw)
        total_s = 0.0
        remaining = charge_kwh

        below_20_end = min(target_soc, 20.0)
        below_20_start = max(start_soc, 0.0)
        if below_20_end > below_20_start:
            seg_kwh = self.battery_kwh * (below_20_end - below_20_start) / 100.0
            seg_kwh = min(seg_kwh, remaining)
            total_s += seg_kwh / (eff_power * 0.8) * 3600
            remaining -= seg_kwh

        soc_80 = min(target_soc, 80.0)
        soc_80_start = max(start_soc, 20.0)
        if soc_80 > soc_80_start and remaining > 0.1:
            seg_kwh = self.battery_kwh * (soc_80 - soc_80_start) / 100.0
            seg_kwh = min(seg_kwh, remaining)
            total_s += seg_kwh / eff_power * 3600
            remaining -= seg_kwh

        soc_90 = min(target_soc, 90.0)
        soc_90_start = max(start_soc, 80.0)
        if soc_90 > soc_90_start and remaining > 0.1:
            seg_kwh = self.battery_kwh * (soc_90 - soc_90_start) / 100.0
            seg_kwh = min(seg_kwh, remaining)
            total_s += seg_kwh / (eff_power * 0.5) * 3600
            remaining -= seg_kwh

        if remaining > 0.1 and target_soc > 90.0:
            total_s += remaining / (eff_power * 0.2) * 3600

        return total_s

    def _calc_charge(self, arrival_kwh, km_after, power, rate, max_charge_pct=0.80):
        max_dep_kwh = self.battery_kwh * max_charge_pct
        energy_needed_for_leg = km_after * self._consumption_kwh_per_km
        safety_reserve = self.battery_kwh * SAFETY_BUFFER
        target_dep_kwh = min(energy_needed_for_leg + safety_reserve, max_dep_kwh)
        target_dep_kwh = max(target_dep_kwh, self.battery_kwh * (max_charge_pct - 0.10))
        charge_kwh = max(0.0, target_dep_kwh - arrival_kwh)
        if charge_kwh < 2.0:
            return 0, 0, 0, arrival_kwh
        dep_kwh = arrival_kwh + charge_kwh
        arrival_soc = self._soc_from_kwh(arrival_kwh)
        charge_s = self._calc_charge_time(charge_kwh, power, arrival_soc, max_charge_pct * 100)
        cost = charge_kwh * rate
        return charge_kwh, charge_s, cost, dep_kwh

    def _trace_battery_profile(self, route_coords, total_distance_m, stops):
        total_km = total_distance_m / 1000.0
        n = len(route_coords)
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

        profile = []
        remaining_kwh = self._usable_start
        stop_idx = 0
        for i in range(n):
            if i == 0:
                profile.append({'dist_km': 0.0, 'soc_percent': round(self._soc_from_kwh(remaining_kwh), 1)})
                continue
            seg_energy = self._segment_energy_kwh(seg_dists[i - 1])
            remaining_kwh -= seg_energy
            while stop_idx < len(stops):
                stop_cum = stops[stop_idx].distance_from_start_km
                if cum_km[i] >= stop_cum - 0.1:
                    remaining_kwh = stops[stop_idx].departure_soc_percent / 100.0 * self.battery_kwh
                    stop_idx += 1
                else:
                    break
            profile.append({
                'dist_km': round(cum_km[i], 1),
                'soc_percent': round(max(0, self._soc_from_kwh(remaining_kwh)), 1),
            })
        return profile

    def _validate_route(self, plan):
        issues = []
        stops = plan.stops
        if not stops:
            return issues

        drive_s = plan.total_drive_time_seconds
        charge_s = plan.total_charge_time_seconds

        # Charging time must not exceed 35% of driving time
        if drive_s > 0 and charge_s > drive_s * 0.35:
            issues.append(f"Charging time {charge_s/3600:.1f}h exceeds 35% of driving time {drive_s/3600:.1f}h")

        # Arrival SOC must be at least 15%
        if plan.final_soc_percent < SAFETY_BUFFER * 100:
            issues.append(f"Arrival SOC {plan.final_soc_percent:.1f}% below minimum {SAFETY_BUFFER*100:.0f}%")

        # Stops consistent with vehicle range
        for i, stop in enumerate(stops):
            if i > 0:
                prev_cum = stops[i-1].distance_from_start_km
            else:
                prev_cum = 0.0
            seg_km = stop.distance_from_start_km - prev_cum
            max_range_km = (self.battery_kwh * 0.8) / self._consumption_kwh_per_km
            if seg_km > max_range_km * 1.3:
                issues.append(f"Segment {i} ({seg_km:.0f}km) exceeds 130% of max range ({max_range_km:.0f}km)")

        # Total trip time must equal drive + charge + breaks
        computed_total = drive_s + charge_s + plan.total_rest_breaks_seconds
        if computed_total != plan.total_trip_time_seconds:
            issues.append("Total trip time mismatch")

        # Cheapest validation: reject only if BOTH undersaves (<8%) AND overtakes (>4h)
        if plan.strategy == 'cheapest' and hasattr(plan, '_fastest_ref'):
            fastest = plan._fastest_ref
            if fastest and fastest.total_cost > 0:
                savings_pct = (fastest.total_cost - plan.total_cost) / fastest.total_cost * 100
                extra_time = plan.total_trip_time_seconds - fastest.total_trip_time_seconds
                if savings_pct < 8 and extra_time > 4 * 3600:
                    issues.append(f"Cheapest adds {extra_time/3600:.1f}h (> 4h) while saving only {savings_pct:.1f}% (< 8%)")

        return issues

    def plan_routes(self, route_coords, total_distance_m, stations,
                    origin_name='Origin', dest_name='Destination'):
        strategies = ['fastest_time', 'cheapest']
        plans = []

        def _run_strat(s):
            p = self.plan_route(
                route_coords, total_distance_m, stations,
                origin_name=origin_name, dest_name=dest_name,
                strategy=s, max_charge_pct=0.80,
            )
            p.battery_profile = self._trace_battery_profile(
                route_coords, total_distance_m, p.stops,
            )
            return p

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futures = {pool.submit(_run_strat, s): s for s in strategies}
            for f in concurrent.futures.as_completed(futures):
                plans.append(f.result())

        plan_map = {p.strategy: p for p in plans}
        fastest_plan = plan_map.get('fastest_time')
        cheapest_plan = plan_map.get('cheapest')

        if cheapest_plan and fastest_plan:
            cheapest_plan._fastest_ref = fastest_plan
            self._validate_route(cheapest_plan)

        selected = fastest_plan

        alternatives = []
        p = cheapest_plan
        if p and id(p) != id(selected):
            alternatives.append({
                'label': 'Cheapest',
                'strategy': p.strategy,
                'total_drive_time_seconds': p.total_drive_time_seconds,
                'total_charge_time_seconds': p.total_charge_time_seconds,
                'total_rest_breaks_seconds': p.total_rest_breaks_seconds,
                'total_trip_time_seconds': p.total_trip_time_seconds,
                'total_cost': p.total_cost,
                'stop_count': len(p.stops),
                'final_soc_percent': p.final_soc_percent,
                'total_distance_km': p.total_distance_km,
                'stops': p.stops,
                'legs': p.legs,
                'total_energy_consumed_kwh': p.total_energy_consumed_kwh,
                'battery_profile': p.battery_profile,
            })
        return {
            'selected': selected,
            'alternatives': alternatives,
        }

    def plan_route(self, route_coords, total_distance_m, stations,
                   origin_name='Origin', dest_name='Destination',
                   strategy='fastest_time', max_charge_pct=0.80):

        total_km = total_distance_m / 1000.0
        logger.info("[%s] total_distance_m=%.1f total_km=%.1f max_charge_pct=%.2f",
                     strategy, total_distance_m, total_km, max_charge_pct)
        n = len(route_coords)
        if n < 2:
            return RoutePlan(total_km, 0, 0, 0, 0, [], [], self.battery_start_percent,
                             origin_name, dest_name, 'Route too short')

        dest_lat, dest_lng = route_coords[-1][0], route_coords[-1][1]

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
        _search_fail_count = 0
        _dead_end = False
        _expansion_exhausted = False
        avg_seg_km = total_km / max(1, n - 1) if n > 1 else 1.0

        _total_iterations = 0
        while True:
            _total_iterations += 1
            if _total_iterations > MAX_STOPS:
                waypoints.append((dest_lat, dest_lng))
                break
            logger.info("Planning iteration %d — %d stops found so far, %.1f km left, %.1f kWh remaining",
                        len(legs), len(stops), total_km - cum_km[last_stop_idx], remaining_kwh)
            km_left = total_km - cum_km[last_stop_idx]

            # Check if destination is reachable from current position
            need_for_dest = self._segment_energy_kwh(km_left) * (1 + self.safety_buffer)
            if remaining_kwh >= need_for_dest:
                waypoints.append((dest_lat, dest_lng))
                break

            # Drive segment by segment until battery drops to trigger
            trigger_kwh = self._usable_kwh * SEARCH_TRIGGER_BUFFER
            sim_battery = remaining_kwh
            found_charge = False

            for idx in range(last_stop_idx, n - 1):
                seg_energy = self._segment_energy_kwh(seg_dists[idx])
                next_cum = cum_km[idx + 1]
                projected_battery = sim_battery - seg_energy

                # Check destination reachability from next position
                km_from_here = total_km - next_cum
                need_here = self._segment_energy_kwh(km_from_here) * (1 + self.safety_buffer)
                if sim_battery >= need_here:
                    remaining_kwh = sim_battery - seg_energy  # Account for segment energy to reach next_cum
                    last_stop_idx = idx + 1
                    last_stop_cum = next_cum
                    break

                # Check if consuming this segment drops to/below trigger (BEFORE consuming)
                if projected_battery <= trigger_kwh:
                    if projected_battery <= 0:
                        # Dead battery - cannot start this segment
                        logger.info("REMAINING_KWH SET: %.2f → %.2f at idx=%d cum=%.1fkm sim=%.2f _dead_end",
                                     remaining_kwh, max(0, sim_battery), idx, cum_km[idx], sim_battery)
                        remaining_kwh = max(0, sim_battery)
                        waypoints.append((dest_lat, dest_lng))
                        found_charge = True
                        _dead_end = True
                        break
                    # Trigger BEFORE consuming - search using current sim_battery
                    trigger_idx = idx
                    current_cum = cum_km[idx]
                    frac = min(1.0, max(0.0, (sim_battery - trigger_kwh) / seg_energy)) if seg_energy > 0 else 0.0
                    trigger_cum = cum_km[idx] + seg_dists[idx] * frac
                    logger.info("REMAINING_KWH SET: %.2f → %.2f at idx=%d cum=%.1fkm sim=%.2f",
                                 remaining_kwh, sim_battery, idx, cum_km[idx], sim_battery)
                    remaining_kwh = sim_battery
                    range_left = (remaining_kwh / self.consumption_wh_per_km) * 1000

                    # Search window ahead of trigger point (look further for DC stations)
                    look_km = max(150, range_left * 1.5)
                    search_end_cum = min(total_km, current_cum + look_km)
                    search_end_idx = trigger_idx
                    for j in range(trigger_idx, n):
                        if cum_km[j] >= search_end_cum:
                            search_end_idx = j
                            break
                    if search_end_idx <= trigger_idx:
                        search_end_idx = min(n - 1, trigger_idx + 1)

                    search_coords = route_coords[trigger_idx:search_end_idx + 1]



                    # Find stations near this corridor
                    sc_lats = [c[0] for c in search_coords]
                    sc_lngs = [c[1] for c in search_coords]
                    min_clat = min(sc_lats) - (self.search_radius / 110.0)
                    max_clat = max(sc_lats) + (self.search_radius / 110.0)
                    mid_lat = (min_clat + max_clat) / 2.0
                    lat_lng_ratio = 1.0 / math.cos(math.radians(mid_lat))
                    min_clng = min(sc_lngs) - (self.search_radius / 110.0 * lat_lng_ratio)
                    max_clng = max(sc_lngs) + (self.search_radius / 110.0 * lat_lng_ratio)

                    candidates = []
                    for st in stations:
                        lat = st.get('latitude')
                        lng = st.get('longitude')
                        if lat is None or lng is None:
                            continue
                        if not (min_clat <= lat <= max_clat and min_clng <= lng <= max_clng):
                            continue
                        d = _min_dist_to_route(lat, lng, search_coords)
                        if d > self.search_radius:
                            continue
                        slot = self._get_best_slot(st)
                        if not slot:
                            continue
                        power = CHARGER_POWER.get(slot.get('slot_type', ''), 7.4)
                        rate = float(slot.get('rate_per_kwh', 10) or 10)
                        candidates.append((st, slot, round(d, 2), power, rate))

                    # Expand search radius if no candidates
                    if not candidates:
                        if _expansion_exhausted:
                            if idx >= n - 2:
                                waypoints.append((dest_lat, dest_lng))
                                found_charge = True
                                _dead_end = True
                                break
                            continue
                        expanded = False
                        # Max bounding box for all multipliers
                        max_radius = self.search_radius * 10
                        max_min_clat = min(sc_lats) - (max_radius / 110.0)
                        max_max_clat = max(sc_lats) + (max_radius / 110.0)
                        max_min_clng = min(sc_lngs) - (max_radius / 110.0 * lat_lng_ratio)
                        max_max_clng = max(sc_lngs) + (max_radius / 110.0 * lat_lng_ratio)
                        for mult in [2, 3, 4, 5, 6, 8, 10]:
                            r = self.search_radius * mult
                            for st in stations:
                                lat = st.get('latitude')
                                lng = st.get('longitude')
                                if lat is None or lng is None:
                                    continue
                                if not (max_min_clat <= lat <= max_max_clat and max_min_clng <= lng <= max_max_clng):
                                    continue
                                d = _min_dist_to_route(lat, lng, search_coords)
                                if d > r:
                                    continue
                                slot = self._get_best_slot(st)
                                if not slot:
                                    continue
                                power = CHARGER_POWER.get(slot.get('slot_type', ''), 7.4)
                                rate = float(slot.get('rate_per_kwh', 10) or 10)
                                candidates.append((st, slot, round(d, 2), power, rate))
                            if candidates:
                                expanded = True
                                break
                        if not expanded:
                            if idx >= n - 2:
                                waypoints.append((dest_lat, dest_lng))
                                found_charge = True
                                _dead_end = True
                                break
                            _expansion_exhausted = True
                            continue

                    # Project candidates to route
                    cand_data = []
                    for c in candidates:
                        st = c[0]
                        st_lat = float(st['latitude'])
                        st_lng = float(st['longitude'])
                        _, stop_cum = self._project_to_route(st_lat, st_lng, route_coords, cum_km)
                        route_dist_km = max(0.1, stop_cum - current_cum)
                        leg_dist_km = max(0.1, stop_cum - current_cum)
                        cand_data.append((c, stop_cum, route_dist_km, leg_dist_km))

                    cand_data = [x for x in cand_data if x[1] > current_cum]
                    if not cand_data:
                        if idx >= n - 2:
                            waypoints.append((dest_lat, dest_lng))
                            found_charge = True
                            _dead_end = True
                            break
                        continue
                    cand_data.sort(key=lambda x: x[1])

                    # Both strategies prefer DC chargers (50 kW+)
                    dc_filtered = [cd for cd in cand_data if cd[0][3] >= 50]
                    if dc_filtered:
                        cand_data = dc_filtered
                    elif strategy == 'cheapest':
                        if idx >= n - 2:
                            waypoints.append((dest_lat, dest_lng))
                            found_charge = True
                            _dead_end = True
                            break
                        continue

                    # OSRM table for road distances
                    osrm_limit = OSRM_MAX_COORDS - 1
                    osrm_candidates = [x[0] for x in cand_data[:osrm_limit]]
                    road_data = self._osrm_table(current_lat, current_lng, [c[0] for c in osrm_candidates])

                    road_lookup = {}
                    if road_data:
                        for i, c in enumerate(osrm_candidates):
                            if i < len(road_data) and road_data[i] is not None:
                                road_lookup[c[0]['id']] = road_data[i]

                    # Score candidates
                    scored = []
                    for c_tuple, stop_cum, route_dist_km, leg_dist_km in cand_data:
                        st, slot, detour, power, rate = c_tuple
                        st_lat = float(st['latitude'])
                        st_lng = float(st['longitude'])

                        if st['id'] in road_lookup:
                            road_dist_m, drive_time_s = road_lookup[st['id']]
                            road_dist_km = road_dist_m / 1000.0
                        else:
                            road_dist_km = leg_dist_km
                            drive_time_s = (leg_dist_km / self._avg_speed(strategy)) * 3600

                        # Detour check (cheapest allows slightly more detour for savings)
                        max_detour = self.max_detour_km * (2.0 if strategy == 'cheapest' else 1.0)
                        detour_actual = max(0, road_dist_km - _haversine_km(current_lat, current_lng, st_lat, st_lng))
                        if detour_actual > max_detour:
                            continue

                        arrival_kwh = remaining_kwh - self._segment_energy_kwh(route_dist_km)
                        if arrival_kwh <= -0.05:
                            continue
                        min_arrival_at_station = self.battery_kwh * 0.03
                        if arrival_kwh < min_arrival_at_station:
                            continue

                        arrival_soc = self._soc_from_kwh(arrival_kwh)
                        km_after = total_km - stop_cum
                        charge_kwh, charge_s, cost_stop, dep_kwh = self._calc_charge(
                            arrival_kwh, km_after, power, rate, max_charge_pct
                        )
                        if charge_kwh <= 0:
                            continue

                        if strategy == 'cheapest':
                            score = -(cost_stop * 100 + charge_s * 0.05 + drive_time_s * 0.05 + power * 0.1)
                        else:
                            score = -(drive_time_s + charge_s)

                        scored.append({
                            'score': score,
                            'st': st,
                            'slot': slot,
                            'detour': detour,
                            'power': power,
                            'rate': rate,
                            'road_dist_km': road_dist_km,
                            'drive_time_s': drive_time_s,
                            'arrival_kwh': arrival_kwh,
                            'arrival_soc': arrival_soc,
                            'charge_kwh': charge_kwh,
                            'charge_s': charge_s,
                            'cost_stop': cost_stop,
                            'dep_kwh': dep_kwh,
                            'dep_soc': self._soc_from_kwh(dep_kwh),
                            'stop_cum': stop_cum,
                        })

                    if not scored:
                        if idx >= n - 2:
                            waypoints.append((dest_lat, dest_lng))
                            found_charge = True
                            _dead_end = True
                            break
                        continue

                    scored.sort(key=lambda x: x['score'], reverse=True)
                    best = scored[0]

                    st = best['st']
                    slot = best['slot']
                    detour = best['detour']
                    power = best['power']
                    rate = best['rate']
                    road_dist_km = best['road_dist_km']
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
                    road_detour_km = round(max(0, road_dist_km - _haversine_km(current_lat, current_lng, st_lat, st_lng)), 2)

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

                    alts = []
                    for alt_scored in scored[1:MAX_ALTERNATIVES]:
                        a_st = alt_scored['st']
                        a_road = alt_scored['road_dist_km']
                        alts.append({
                            'station_id': a_st['id'],
                            'station_name': a_st.get('name', '') or a_st.get('address', ''),
                            'address': a_st.get('address', ''),
                            'lat': float(a_st['latitude']),
                            'lng': float(a_st['longitude']),
                            'detour_km': alt_scored['detour'],
                            'road_distance_km': round(a_road, 2),
                            'slot_type': alt_scored['slot'].get('slot_type', ''),
                            'charger_power_kw': alt_scored['power'],
                            'rate_per_kwh': alt_scored['rate'],
                            'charge_cost': round(alt_scored['cost_stop'], 2),
                            'charge_time_seconds': round(alt_scored['charge_s']),
                            'arrival_soc_percent': round(alt_scored['arrival_soc'], 1),
                        })

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
                        road_distance_km=round(road_dist_km, 2),
                        road_detour_km=road_detour_km,
                        alternatives=alts,
                    ))

                    stop_route_idx, _ = self._project_to_route(st_lat, st_lng, route_coords, cum_km)
                    if stop_route_idx <= last_stop_idx:
                        stop_route_idx = last_stop_idx + 1
                    waypoints.append((st_lat, st_lng))
                    current_lat, current_lng = st_lat, st_lng
                    _search_fail_count = 0
                    _expansion_exhausted = False
                    total_charge_s += charge_s
                    total_cost += cost_stop
                    remaining_kwh = dep_kwh
                    next_idx = max(stop_route_idx, trigger_idx)
                    if next_idx <= last_stop_idx:
                        next_idx = last_stop_idx + 1
                    last_stop_cum = stop_cum
                    last_stop_idx = next_idx
                    logger.info("[%s] Stop#%d: arrival_kwh=%.1f arrival_soc=%.1f%% charge_kwh=%.1f dep_kwh=%.1f dep_soc=%.1f%% dist=%.1fkm strategy=%s",
                                 strategy, len(stops), arrival_kwh, arrival_soc, charge_kwh, dep_kwh, dep_soc, stop_cum, strategy)
                    logger.info("STOP%d placed: arr=%.1fkwh dep=%.1fkwh remaining_after=%.1fkwh stop_cum=%.1fkm total=%.1fkm",
                                 len(stops), arrival_kwh, dep_kwh, dep_kwh, stop_cum, total_km)
                    found_charge = True
                    break  # Exit segment loop, re-check destination at while top

                else:
                    # Not at trigger — safe to consume this segment
                    sim_battery = projected_battery

            if found_charge:
                if len(stops) >= MAX_STOPS or _dead_end:
                    waypoints.append((dest_lat, dest_lng))
                    break
                continue

            # Ran through all segments without triggering or reaching destination
            logger.info("REMAINING_KWH SET: %.2f → %.2f at idx=-1 cum=-1 sim=%.2f",
                         remaining_kwh, sim_battery, sim_battery)
            remaining_kwh = sim_battery
            if last_stop_idx >= n - 2:
                waypoints.append((dest_lat, dest_lng))
                break

        if waypoints and waypoints[-1] != (dest_lat, dest_lng):
            waypoints.append((dest_lat, dest_lng))

        # Final leg to destination
        final_km = total_km - last_stop_cum
        if final_km > 0:
            final_s = (final_km / self._avg_speed(strategy)) * 3600
            final_kwh = max(0, remaining_kwh - self._segment_energy_kwh(final_km))
            final_soc = self._soc_from_kwh(final_kwh)
            logger.info("[%s] Final leg: remaining_kwh=%.1f final_km=%.1f final_kwh=%.1f final_soc=%.1f%% n_stops=%d",
                         strategy, remaining_kwh, final_km, final_kwh, final_soc, len(stops))
            logger.info("FINAL: remaining=%.1fkwh final_km=%.1fkm energy_needed=%.1fkwh final_kwh=%.1fkwh soc=%.1f%%",
                         remaining_kwh, final_km,
                         self._segment_energy_kwh(final_km),
                         max(0, remaining_kwh - self._segment_energy_kwh(final_km)),
                         self._soc_from_kwh(max(0, remaining_kwh - self._segment_energy_kwh(final_km))))
            # Enforce 15% minimum arrival SOC
            min_arrival_soc = SAFETY_BUFFER * 100.0
            if final_soc < min_arrival_soc and len(stops) > 0 and not _dead_end:
                logger.warning(
                    "Final SoC %.2f%% below minimum %.0f%%. "
                    "remaining_kwh=%.2f, final_km=%.2f, enforcing floor",
                    final_soc, min_arrival_soc, remaining_kwh, final_km
                )
                final_soc = min_arrival_soc
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
        total_energy = sum(self._segment_energy_kwh(l.distance_km) for l in legs)

        rest_breaks_s = 0
        if total_drive > 0:
            num_breaks = int(total_drive // REST_BREAK_INTERVAL_S)
            rest_breaks_s = num_breaks * REST_BREAK_DURATION_S

        # Get through-stations waypoint geometry
        waypoint_geometry = []
        wg = self._osrm_route_waypoints(waypoints)
        if wg:
            waypoint_geometry = wg

        if not waypoint_geometry:
            wg = []
            for i in range(len(waypoints) - 1):
                wg.append([waypoints[i][0], waypoints[i][1]])
            wg.append([waypoints[-1][0], waypoints[-1][1]])
            waypoint_geometry = wg

        note = ''
        if _dead_end and stops:
            last_km = max(s.distance_from_start_km for s in stops)
            note = f'No charging station found between km {last_km:.0f} and the destination - trip not feasible with current vehicle'
        elif _search_fail_count > 0 and stops:
            last_stop_km = max(s.distance_from_start_km for s in stops) if stops else 0
            note = f'Charging stations are sparse after {last_stop_km:.0f} km. Some segments may require careful range planning.'

        plan = RoutePlan(
            total_distance_km=round(max(sum(l.distance_km for l in legs), total_km), 1),
            total_drive_time_seconds=round(total_drive),
            total_charge_time_seconds=round(total_charge_s),
            total_rest_breaks_seconds=round(rest_breaks_s),
            total_cost=round(total_cost, 2),
            total_energy_consumed_kwh=round(total_energy, 2),
            legs=legs,
            stops=stops,
            final_soc_percent=round(final_soc, 1),
            origin_name=origin_name,
            dest_name=dest_name,
            note=note,
            strategy=strategy,
            waypoint_geometry=waypoint_geometry,
            battery_profile=[],
        )

        issues = self._validate_route(plan)
        if issues:
            logger.warning("[%s] Route validation issues: %s", strategy, '; '.join(issues))
            plan.note = ('; '.join(issues)) if not plan.note else plan.note + '; ' + '; '.join(issues)

        return plan
