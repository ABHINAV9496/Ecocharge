"""
Energy-aware multi-stop route planner.

Algorithm:
  1. Split route into segments (between consecutive coordinates).
  2. Track battery SoC along each segment using vehicle consumption model.
  3. When SoC drops below threshold, search for stations ahead along
     the route (using route-projected cumulative distances).
  4. Score candidates by drive time (Fast) or cost (Optimised).
  5. Use OSRM table endpoint to compute actual road distances for scoring.
  6. After all stops, call OSRM route endpoint for through-stations geometry.

Usage:
    planner = EnergyAwareRoutePlanner(
        consumption_wh_per_km=150.0,
        battery_kwh=40.0,
        battery_start_percent=80,
        mode='fast',
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


logger = logging.getLogger(__name__)

CHARGER_POWER = {
    'DC_ULTRA': 150.0,
    'DC_FAST': 50.0,
    'AC_FAST': 7.4,
    'AC_SLOW': 3.3,
}

SAFETY_BUFFER = 0.15
SEARCH_RADIUS_KM = 30.0
MAX_ALTERNATIVES = 5
MAX_STOPS = 20
AVG_SPEED_KMPH = 80.0
OSRM_REQ_PER_SEC = 5
OSRM_TABLE_TIMEOUT = 20
OSRM_ROUTE_TIMEOUT = 30
OSRM_MAX_COORDS = 100
DEFAULT_RATE_PER_KWH = 10.0


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
    origin_name: str = 'Origin'
    dest_name: str = 'Destination'
    note: str = ''
    waypoint_geometry: list = field(default_factory=list)


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

    def __init__(self, consumption_wh_per_km, battery_kwh, battery_start_percent, mode='optimised'):
        self.consumption_wh_per_km = consumption_wh_per_km
        self.battery_kwh = battery_kwh
        self.battery_start_percent = battery_start_percent
        self.mode = mode
        self._usable_kwh = battery_kwh * 0.9
        self._usable_start = battery_kwh * (battery_start_percent / 100.0) * 0.9

    def _segment_energy_kwh(self, distance_km):
        return distance_km * (self.consumption_wh_per_km / 1000.0)

    def _soc_from_kwh(self, kwh):
        if self._usable_kwh <= 0:
            return 0.0
        return max(0.0, min(100.0, (kwh / self._usable_kwh) * 100.0))

    def _kwh_from_soc(self, soc):
        return self._usable_kwh * (soc / 100.0)

    def _get_best_slot(self, station):
        slots = station.get('slots') or []
        available = [s for s in slots if s.get('status') == 'AVAILABLE']
        if not available:
            return None
        def sort_key(s):
            type_rank = {'DC_ULTRA': 4, 'DC_FAST': 3, 'AC_FAST': 2, 'AC_SLOW': 1}
            return (type_rank.get(s.get('slot_type', ''), 0),
                    CHARGER_POWER.get(s.get('slot_type', ''), 0))
        available.sort(key=sort_key, reverse=True)
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

    def _calc_charge(self, arrival_kwh, km_after, power, rate):
        next_max = min(km_after, 250)
        need_range = next_max + 30
        need_kwh = (need_range / 1000) * self.consumption_wh_per_km
        need_kwh = max(0, need_kwh - arrival_kwh)
        arrival_soc = (arrival_kwh / self._usable_kwh) * 100 if self._usable_kwh > 0 else 0
        min_charge_kwh = self._usable_kwh * 0.10
        charge_kwh = max(min_charge_kwh, need_kwh)
        max_charge_kwh = self._usable_kwh * 0.9 - arrival_kwh
        charge_kwh = min(charge_kwh, max_charge_kwh)
        charge_kwh = max(0, charge_kwh)
        if charge_kwh <= 0 or arrival_soc > 85:
            charge_kwh = 0
        dep_kwh = arrival_kwh + charge_kwh
        charge_s = (charge_kwh / power * 3600) if power > 0 else 1800
        cost = charge_kwh * rate
        return charge_kwh, charge_s, cost, dep_kwh

    def plan_route(self, route_coords, total_distance_m, stations,
                   origin_name='Origin', dest_name='Destination'):
        if self.mode == 'fast':
            search_radius = 50.0
            safety_buffer = 0.10
        else:
            search_radius = SEARCH_RADIUS_KM
            safety_buffer = SAFETY_BUFFER

        total_km = total_distance_m / 1000.0
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

        dest_lat, dest_lng = route_coords[-1][0], route_coords[-1][1]
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

        while True:
            logger.info("Planning iteration %d — %d stops found so far, %.1f km left, %.1f kWh remaining",
                        len(legs), len(stops), total_km - cum_km[last_stop_idx], remaining_kwh)
            km_left = total_km - cum_km[last_stop_idx]
            range_left = (remaining_kwh / self.consumption_wh_per_km) * 1000 if self.consumption_wh_per_km > 0 else 0

            if range_left >= km_left * (1 + safety_buffer):
                waypoints.append((dest_lat, dest_lng))
                break

            look_km = max(5, range_left * (1 - safety_buffer))
            target_cum = cum_km[last_stop_idx] + look_km
            target_idx = last_stop_idx
            for i in range(last_stop_idx, n):
                if cum_km[i] >= target_cum:
                    target_idx = i
                    break
            if target_idx >= n - 1:
                target_idx = n - 2

            avg_seg_km = total_km / max(1, n - 1)
            window_fwd = max(int(look_km * 2 / avg_seg_km), int(search_radius * 5 / avg_seg_km), 100) if avg_seg_km > 0 else 5000
            window_bwd = max(int(search_radius / avg_seg_km), 10) if avg_seg_km > 0 else 50
            search_start = max(0, target_idx - window_bwd)
            search_end = min(n, target_idx + window_fwd)
            search_coords = route_coords[search_start:search_end]

            # Pre-filter stations near search corridor (with progressive expansion)
            candidates = []
            for st in stations:
                lat = st.get('latitude')
                lng = st.get('longitude')
                if lat is None or lng is None:
                    continue
                d = _min_dist_to_route(lat, lng, search_coords)
                if d > search_radius:
                    continue
                slot = self._get_best_slot(st)
                if not slot:
                    continue
                power = CHARGER_POWER.get(slot.get('slot_type', ''), 7.4)
                rate = float(slot.get('rate_per_kwh', 10) or 10)
                candidates.append((
                    st, slot, round(d, 2), power, rate,
                ))

            if not candidates:
                expanded = False
                for mult in [2, 3, 4, 5, 6, 8, 10]:
                    r = search_radius * mult
                    for st in stations:
                        lat = st.get('latitude')
                        lng = st.get('longitude')
                        if lat is None or lng is None:
                            continue
                        d = _min_dist_to_route(lat, lng, search_coords)
                        if d > r:
                            continue
                        slot = self._get_best_slot(st)
                        if not slot:
                            continue
                        power = CHARGER_POWER.get(slot.get('slot_type', ''), 7.4)
                        rate = float(slot.get('rate_per_kwh', 10) or 10)
                        candidates.append((
                            st, slot, round(d, 2), power, rate,
                        ))
                    if candidates:
                        expanded = True
                        break
                if not expanded:
                    _search_fail_count += 1
                    if _search_fail_count >= 10:
                        waypoints.append((dest_lat, dest_lng))
                        break
                    target_idx = min(n - 2, target_idx + int(30 / avg_seg_km)) if avg_seg_km > 0 else target_idx + 500
                    window_fwd = min(n - search_start - 1, int(window_fwd * 1.5))
                    continue

            if len(candidates) > OSRM_MAX_COORDS - 1:
                candidates = candidates[:OSRM_MAX_COORDS - 1]

            # Get OSRM road distances for scoring
            road_data = self._osrm_table(current_lat, current_lng, [c[0] for c in candidates])

            # Score candidates
            scored = []
            for i, (st, slot, detour, power, rate) in enumerate(candidates):
                st_lat = float(st['latitude'])
                st_lng = float(st['longitude'])

                # Battery check uses route-projected distance
                _, stop_cum = self._project_to_route(st_lat, st_lng, route_coords, cum_km)
                route_dist_km = max(0.1, stop_cum - last_stop_cum)
                arrival_kwh = remaining_kwh - self._segment_energy_kwh(route_dist_km)

                if road_data and i < len(road_data) and road_data[i] is not None:
                    road_dist_m, drive_time_s = road_data[i]
                    road_dist_km = road_dist_m / 1000.0
                else:
                    road_dist_km = route_dist_km
                    drive_time_s = (route_dist_km / AVG_SPEED_KMPH) * 3600

                if arrival_kwh < safety_buffer * self._usable_kwh:
                    continue

                arrival_soc = self._soc_from_kwh(arrival_kwh)
                hav_st_to_dest = _haversine_km(st_lat, st_lng, dest_lat, dest_lng)
                charge_kwh, charge_s, cost_stop, dep_kwh = self._calc_charge(
                    arrival_kwh, hav_st_to_dest, power, rate
                )

                if self.mode == 'fast':
                    score = -(drive_time_s + charge_s)
                else:
                    drive_cost = road_dist_km * (self.consumption_wh_per_km / 1000.0) * DEFAULT_RATE_PER_KWH
                    charge_cost = cost_stop
                    score = -(drive_cost + charge_cost)

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
                    'hav_st_to_dest': hav_st_to_dest,
                    'stop_cum': stop_cum,
                })

            if not scored:
                _search_fail_count += 1
                if _search_fail_count >= 10:
                    waypoints.append((dest_lat, dest_lng))
                    break
                target_idx = min(n - 2, target_idx + int(30 / avg_seg_km)) if avg_seg_km > 0 else target_idx + 500
                window_fwd = min(n - search_start - 1, int(window_fwd * 1.5))
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
            hav_st_to_dest = best['hav_st_to_dest']
            road_detour_km = round(max(0, road_dist_km - _haversine_km(current_lat, current_lng, st_lat, st_lng)), 2)

            drive_km = stop_cum - last_stop_cum

            if drive_km > 0:
                legs.append(TripLeg(
                    leg_index=len(legs),
                    start_name=last_leg_start,
                    end_name=(st.get('name', '') or st.get('address', '')) + ' #' + str(len(stops) + 1),
                    distance_km=round(drive_km, 1),
                    drive_time_seconds=round(drive_time_s),
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

            cum_dist = sum(l.distance_km for l in legs)
            stops.append(ChargingStop(
                stop_index=len(stops) + 1,
                station_id=st['id'],
                station_name=st.get('name', '') or st.get('address', ''),
                address=st.get('address', ''),
                lat=st_lat, lng=st_lng,
                distance_from_start_km=round(cum_dist, 1),
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

            # Use station's projected route index (not target_idx) so next
            # search window starts from the station's position, not from
            # the look-ahead point.
            stop_route_idx, _ = self._project_to_route(st_lat, st_lng, route_coords, cum_km)
            waypoints.append((st_lat, st_lng))
            current_lat, current_lng = st_lat, st_lng
            _search_fail_count = 0
            total_charge_s += charge_s
            total_cost += cost_stop
            remaining_kwh = dep_kwh
            last_stop_cum = stop_cum
            last_stop_idx = stop_route_idx

            if len(stops) >= MAX_STOPS:
                waypoints.append((dest_lat, dest_lng))
                break

        if waypoints and waypoints[-1] != (dest_lat, dest_lng):
            waypoints.append((dest_lat, dest_lng))

        # Final leg to destination
        final_km = total_km - last_stop_cum
        if final_km > 0:
            final_s = (final_km / AVG_SPEED_KMPH) * 3600
            final_kwh = remaining_kwh - self._segment_energy_kwh(final_km)
            final_soc = self._soc_from_kwh(final_kwh)
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

        if legs:
            final_soc = legs[-1].end_soc_percent if legs else self.battery_start_percent

        total_drive = sum(l.drive_time_seconds for l in legs)
        total_energy = sum(self._segment_energy_kwh(l.distance_km) for l in legs)

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
        if _search_fail_count > 0 and not stops:
            note = 'Insufficient range and no suitable charging stations found on route.'
        elif _search_fail_count > 0 and stops:
            note = 'Some segments may not have optimal station coverage.'

        return RoutePlan(
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
            waypoint_geometry=waypoint_geometry,
        )
