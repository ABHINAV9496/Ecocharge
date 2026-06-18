"""
Energy-aware multi-stop route planner.

Algorithm:
  1. Split route into segments (between consecutive coordinates).
  2. Track battery SoC along each segment using vehicle consumption model.
  3. When SoC drops below threshold (15% + buffer), search for stations ahead.
  4. Score stations by: detour distance, charger power, availability, cost.
  5. Calculate minimum charge to reach next stop/destination + buffer.
  6. Return structured RoutePlan with legs, stops, alternatives.

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


CHARGER_POWER = {
    'DC_ULTRA': 150.0,
    'DC_FAST': 50.0,
    'AC_FAST': 7.4,
    'AC_SLOW': 3.3,
}

SAFETY_BUFFER = 0.15
SEARCH_RADIUS_KM = 15.0
MAX_ALTERNATIVES = 3
MAX_STOPS = 8
AVG_SPEED_KMPH = 80.0


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

    def __init__(self, consumption_wh_per_km, battery_kwh, battery_start_percent):
        self.consumption_wh_per_km = consumption_wh_per_km
        self.battery_kwh = battery_kwh
        self.battery_start_percent = battery_start_percent
        self._usable_kwh = battery_kwh * 0.9
        self._usable_start = battery_kwh * (battery_start_percent / 100.0) * 0.9

    def _segment_energy_kwh(self, distance_km):
        return distance_km * (self.consumption_wh_per_km / 1000.0)

    def _soc_from_kwh(self, kwh):
        if self._usable_kwh <= 0:
            return 0.0
        return (kwh / self._usable_kwh) * 100.0

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

    def _score_station(self, station, slot, detour_km):
        power = CHARGER_POWER.get(slot.get('slot_type', ''), 7.4)
        rate = float(slot.get('rate_per_kwh', 10) or 10)
        detour_score = max(0, 1 - detour_km / SEARCH_RADIUS_KM)
        power_score = (power - 3.3) / (150 - 3.3) if power > 3.3 else 0
        cost_score = max(0, 1 - rate / 20)
        avail_score = 1.0
        return (-0.4 * detour_score + 0.3 * power_score +
                -0.2 * cost_score + 0.1 * avail_score)

    def _find_stations(self, coords, stations):
        candidates = []
        for st in stations:
            lat = st.get('latitude')
            lng = st.get('longitude')
            if lat is None or lng is None:
                continue
            d = _min_dist_to_route(lat, lng, coords)
            if d > SEARCH_RADIUS_KM:
                continue
            slot = self._get_best_slot(st)
            if not slot:
                continue
            score = self._score_station(st, slot, d)
            candidates.append({
                'station': st,
                'slot': slot,
                'detour_km': round(d, 2),
                'score': score,
                'power_kw': CHARGER_POWER.get(slot.get('slot_type', ''), 7.4),
                'rate': float(slot.get('rate_per_kwh', 10) or 10),
            })
        candidates.sort(key=lambda c: c['score'], reverse=True)
        return candidates

    def plan_route(self, route_coords, total_distance_m, stations,
                   origin_name='Origin', dest_name='Destination'):
        total_km = total_distance_m / 1000.0
        n = len(route_coords)
        if n < 2:
            return RoutePlan(total_km, 0, 0, 0, 0, [], [], self.battery_start_percent,
                           origin_name, dest_name, 'Route too short')

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
        _search_failed = False

        while True:
            km_left = total_km - cum_km[last_stop_idx]
            range_left = (remaining_kwh / self.consumption_wh_per_km) * 1000 if self.consumption_wh_per_km > 0 else 0

            if range_left >= km_left + 20:
                break

            look_km = max(5, range_left - 20)
            target_cum = cum_km[last_stop_idx] + look_km
            target_idx = last_stop_idx
            for i in range(last_stop_idx, n):
                if cum_km[i] >= target_cum:
                    target_idx = i
                    break
            if target_idx >= n - 1:
                target_idx = n - 2

            search_start = max(0, target_idx - 3)
            search_end = min(n, target_idx + 6)
            search_coords = route_coords[search_start:search_end]

            candidates = self._find_stations(search_coords, stations)
            if not candidates:
                _search_failed = True
                remaining_kwh += self._usable_kwh * 0.1
                if remaining_kwh > self._usable_kwh:
                    break
                continue

            top = candidates[:MAX_ALTERNATIVES]
            best = top[0]
            st = best['station']
            slot = best['slot']
            detour = best['detour_km']
            power = best['power_kw']
            rate = best['rate']
            st_lat = float(st['latitude'])
            st_lng = float(st['longitude'])

            stop_cum = cum_km[target_idx]
            drive_km = stop_cum - cum_km[last_stop_idx]
            arrival_kwh = remaining_kwh - self._segment_energy_kwh(drive_km)
            arrival_soc = self._soc_from_kwh(arrival_kwh)

            if arrival_soc < SAFETY_BUFFER * 100:
                for fi in range(target_idx - 1, last_stop_idx, -1):
                    fd = cum_km[fi] - cum_km[last_stop_idx]
                    fa = remaining_kwh - self._segment_energy_kwh(fd)
                    fs = self._soc_from_kwh(fa)
                    if fs >= SAFETY_BUFFER * 100:
                        target_idx = fi
                        stop_cum = cum_km[fi]
                        arrival_kwh = fa
                        arrival_soc = fs
                        break
                else:
                    remaining_kwh += self._usable_kwh * 0.05
                    if remaining_kwh > self._usable_kwh:
                        break
                    continue

            leg_km = stop_cum - last_stop_cum
            if leg_km > 0:
                leg_s = (leg_km / AVG_SPEED_KMPH) * 3600
                legs.append(TripLeg(len(legs), last_leg_start,
                                    st.get('name', 'Charging Stop'),
                                    round(leg_km, 1), round(leg_s),
                                    round(last_leg_soc, 1), round(arrival_soc, 1)))
            stop_name = st.get('name', 'Charging Stop')
            stop_label = stop_name + ' #' + str(len(stops) + 1) if stop_name == last_leg_start else stop_name
            last_leg_start = stop_label

            km_after = total_km - stop_cum
            next_max = min(km_after, 250)
            need_range = next_max + 30
            need_kwh = (need_range / 1000) * self.consumption_wh_per_km
            need_kwh = max(0, need_kwh - arrival_kwh)
            min_charge_kwh = self._usable_kwh * 0.10
            charge_kwh = max(min_charge_kwh, need_kwh)
            max_charge_kwh = self._usable_kwh * 0.9 - arrival_kwh
            charge_kwh = min(charge_kwh, max_charge_kwh)
            charge_kwh = max(0, charge_kwh)
            if charge_kwh <= 0:
                charge_kwh = min_charge_kwh

            dep_kwh = arrival_kwh + charge_kwh
            dep_soc = self._soc_from_kwh(dep_kwh)
            charge_s = (charge_kwh / power * 3600) if power > 0 else 1800
            cost_stop = charge_kwh * rate

            alts = []
            for alt in top[1:]:
                a_st = alt['station']
                alts.append({
                    'station_id': a_st['id'],
                    'station_name': a_st.get('name', '') or a_st.get('address', ''),
                    'address': a_st.get('address', ''),
                    'lat': float(a_st['latitude']),
                    'lng': float(a_st['longitude']),
                    'detour_km': alt['detour_km'],
                    'slot_type': alt['slot'].get('slot_type', ''),
                    'charger_power_kw': alt['power_kw'],
                    'rate_per_kwh': alt['rate'],
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
                alternatives=alts,
            ))
            total_charge_s += charge_s
            total_cost += cost_stop

            remaining_kwh = dep_kwh
            last_leg_soc = self._soc_from_kwh(dep_kwh)
            last_stop_cum = stop_cum
            last_stop_idx = target_idx

            if len(stops) >= MAX_STOPS:
                break

        final_km = total_km - last_stop_cum
        if final_km > 0:
            final_s = (final_km / AVG_SPEED_KMPH) * 3600
            final_kwh = remaining_kwh - self._segment_energy_kwh(final_km)
            final_soc = self._soc_from_kwh(final_kwh)
            legs.append(TripLeg(len(legs), last_leg_start, dest_name,
                                round(final_km, 1), round(final_s),
                                round(last_leg_soc, 1), round(final_soc, 1)))
        else:
            final_soc = self._soc_from_kwh(remaining_kwh)

        total_drive = sum(l.drive_time_seconds for l in legs)
        total_energy = sum(self._segment_energy_kwh(d) for d in seg_dists)

        note = ''
        if _search_failed and not stops:
            note = 'Insufficient range and no suitable charging stations found on route.'
        elif _search_failed and stops:
            note = 'Some segments may not have optimal station coverage.'

        return RoutePlan(
            total_distance_km=round(total_km, 1),
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
        )
