import logging
import math
import time

import httpx

from config import settings
from tools.base import BaseTool
from tools.context import auth_token_var

logger = logging.getLogger(__name__)

DJANGO_BASE = settings.DJANGO_BASE
DJANGO_TIMEOUT = 15
GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
GEOCODING_TIMEOUT = 10
DEFAULT_RADIUS = 30


class RealStationTool(BaseTool):
    name = 'station_tool'
    description = (
        'Find EV charging stations near a city or along a planned route. '
        'Use this for ANY question about charging stations, chargers, '
        'connectors, availability, or where to charge your EV. '
        'Returns station names, addresses, distances, charger types '
        '(DC fast / AC), connector types (CCS2 / CHAdeMO / Type 2 AC), '
        'slot availability, pricing, and amenities. '
        'Never answer charging station questions without using this tool.'
    )
    parameters = {
        'type': 'object',
        'properties': {
            'location': {
                'type': 'string',
                'description': (
                    'City or area name (e.g. "Kochi", "Bangalore") or '
                    '"latitude,longitude" (e.g. "12.97,77.59"). '
                    'Use this for finding stations near a place.'
                ),
            },
            'charger_type': {
                'type': 'string',
                'enum': ['DC', 'AC', 'DC_FAST', 'DC_ULTRA', 'AC_FAST', 'AC_SLOW', 'any'],
                'description': 'DC = DC_FAST (50kW) + DC_ULTRA (150kW+). AC = AC_SLOW + AC_FAST. Default: any.',
            },
            'connector_type': {
                'type': 'string',
                'enum': ['CCS2', 'CHAdeMO', 'Type 2 AC', 'any'],
                'description': 'CCS2 = DC fast (common in India). CHAdeMO = older DC. Type 2 AC = AC. Default: any.',
            },
            'available_only': {
                'type': 'boolean',
                'description': 'Only show stations with at least one available slot. Default: false.',
            },
            'route_waypoints': {
                'type': 'array',
                'items': {
                    'type': 'array',
                    'items': {'type': 'number'},
                    'minItems': 2,
                    'maxItems': 2,
                },
                'description': 'List of [lat, lng] waypoints along a route. Finds stations within 20km corridor.',
            },
            'limit': {
                'type': 'integer',
                'description': 'Maximum results (1–50). Default: 10.',
            },
        },
        'required': ['location'],
    }

    async def execute(self, **kwargs) -> dict:
        logger.info('StationTool kwargs received: %s', kwargs)
        location = kwargs.get('location', '').strip()
        charger_type = kwargs.get('charger_type', 'any')
        connector_type = kwargs.get('connector_type', 'any')
        available_only = bool(kwargs.get('available_only', False))
        route_waypoints = kwargs.get('route_waypoints')
        limit = max(1, min(kwargs.get('limit', 10), 50))

        logger.info('StationTool DJANGO_BASE=%s', DJANGO_BASE)
        logger.info('StationTool location=%s charger=%s connector=%s', location, charger_type, connector_type)

        token = auth_token_var.get()
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        start = time.monotonic()

        stations = await self._fetch_stations(location, route_waypoints, headers)
        if stations is None:
            elapsed = time.monotonic() - start
            logger.error('StationTool: all API calls failed after %.2fs', elapsed)
            return {
                'error': True,
                'message': 'I could not retrieve charging station information right now. Please try again later.',
            }

        elapsed = time.monotonic() - start
        logger.info('StationTool: fetched %d raw stations in %.2fs', len(stations), elapsed)

        if not stations:
            return {
                'error': True,
                'message': f'I couldn\'t find any charging stations{" near " + location if location else " along that route"}.',
            }

        user_lat, user_lng = None, None
        if route_waypoints and len(route_waypoints) >= 2:
            user_lat, user_lng = route_waypoints[0]
        elif location:
            coords = await self._resolve_location(location)
            if coords:
                user_lat, user_lng = coords

        for s in stations:
            slat = s.get('latitude')
            slng = s.get('longitude')
            if user_lat is not None and user_lng is not None and slat is not None and slng is not None:
                s['distance_km'] = round(self._haversine(user_lat, user_lng, slat, slng), 1)
            else:
                s['distance_km'] = None

        stations = self._apply_filters(stations, charger_type, connector_type, available_only)

        if not stations:
            msg = 'I could not find any charging stations'
            if charger_type not in ('any', ''):
                msg += f' with {charger_type} charging'
            if connector_type not in ('any', ''):
                msg += f' supporting {connector_type}'
            if available_only:
                msg += ' with available slots'
            msg += f' near {location}.' if location else '.'
            return {'error': True, 'message': msg}

        stations.sort(key=lambda s: self._sort_score(s, charger_type))
        stations = stations[:limit]
        stations[0]['recommended'] = True

        logger.info('StationTool: returning %d stations', len(stations))

        return {
            'location': location or 'Along route',
            'total_stations': len(stations),
            'stations': [
                {
                    'name': s['name'],
                    'address': s.get('address', ''),
                    'latitude': s.get('latitude'),
                    'longitude': s.get('longitude'),
                    'distance_km': s.get('distance_km'),
                    'status': s.get('status', ''),
                    'amenities': s.get('amenities', []),
                    'connector_types': s.get('_connector_types', []),
                    'available_slots': s.get('_available_slots', 0),
                    'total_slots': len(s.get('slots', [])),
                    'rate_per_kwh_min': s.get('_min_rate'),
                    'recommended': s.get('recommended', False),
                }
                for s in stations
            ],
        }

    async def _fetch_stations(
        self, location: str, route_waypoints: list | None, headers: dict,
    ) -> list[dict] | None:
        if route_waypoints and len(route_waypoints) >= 2:
            logger.info('StationTool: route search with %d waypoints', len(route_waypoints))
            return await self._search_by_route(route_waypoints, headers)

        if not location:
            return None

        coords = await self._resolve_location(location)
        if coords is None:
            logger.warning('StationTool: could not resolve location "%s"', location)
            return []

        lat, lng = coords
        logger.info('StationTool: location search at %.4f,%.4f radius=%dkm', lat, lng, DEFAULT_RADIUS)
        return await self._search_by_location(lat, lng, headers)

    async def _resolve_location(self, location: str) -> tuple[float, float] | None:
        if self._is_coordinates(location):
            return self._parse_coordinates(location)
        return await self._geocode(location)

    @staticmethod
    def _is_coordinates(location: str) -> bool:
        parts = location.split(',')
        if len(parts) != 2:
            return False
        try:
            float(parts[0].strip())
            float(parts[1].strip())
            return True
        except ValueError:
            return False

    @staticmethod
    def _parse_coordinates(location: str) -> tuple[float, float] | None:
        parts = location.split(',')
        try:
            return float(parts[0].strip()), float(parts[1].strip())
        except (ValueError, IndexError):
            return None

    async def _geocode(self, location: str) -> tuple[float, float] | None:
        url = GEOCODING_URL
        params = {'name': location, 'count': 1, 'language': 'en', 'format': 'json'}
        logger.info('StationTool geocode GET %s params=%s', url, params)
        try:
            async with httpx.AsyncClient(timeout=GEOCODING_TIMEOUT) as client:
                resp = await client.get(url, params=params)
                logger.info('StationTool geocode HTTP status: %s', resp.status_code)
                resp.raise_for_status()
                data = resp.json()
                logger.info('StationTool geocode response: %s', data)
                results = data.get('results', [])
                if not results:
                    return None
                lat, lng = results[0]['latitude'], results[0]['longitude']
                logger.info('StationTool geocode result: %.4f, %.4f', lat, lng)
                return lat, lng
        except Exception:
            logger.exception('StationTool geocode failed for %s', location)
            return None

    async def _search_by_location(self, lat: float, lng: float, headers: dict) -> list[dict] | None:
        url = f'{DJANGO_BASE}/api/stations/'
        params = {'lat': lat, 'lng': lng, 'radius': DEFAULT_RADIUS}
        logger.info('StationTool HTTP GET %s params=%s', url, params)
        try:
            async with httpx.AsyncClient(timeout=DJANGO_TIMEOUT) as client:
                resp = await client.get(url, params=params, headers=headers)
                logger.info('StationTool HTTP status: %s', resp.status_code)
                logger.info('StationTool HTTP response: %s', resp.text[:2000])
                resp.raise_for_status()
                data = resp.json()
                if isinstance(data, list):
                    return data
                if isinstance(data, dict) and 'results' in data:
                    return data['results']
                logger.warning('StationTool: unexpected response shape: %s', type(data).__name__)
                return []
        except Exception:
            logger.exception('StationTool list API failed')
            return None

    async def _search_by_route(self, waypoints: list, headers: dict) -> list[dict] | None:
        url = f'{DJANGO_BASE}/api/stations/by_route/'
        body = {'waypoints': waypoints, 'radius': 20}
        logger.info('StationTool HTTP POST %s body=%s', url, body)
        try:
            async with httpx.AsyncClient(timeout=DJANGO_TIMEOUT) as client:
                resp = await client.post(url, json=body, headers=headers)
                logger.info('StationTool HTTP status: %s', resp.status_code)
                resp.raise_for_status()
                data = resp.json()
                return data.get('stations', [])
        except Exception:
            logger.exception('StationTool by-route API failed')
            return None

    @staticmethod
    def _apply_filters(stations: list[dict], charger_type: str, connector_type: str, available_only: bool) -> list[dict]:
        result = []
        for s in stations:
            if s.get('status', '').upper() != 'ACTIVE':
                continue
            slots = s.get('slots', [])
            if not slots:
                continue

            matching = slots

            if charger_type not in ('any', ''):
                permitted = _CHARGER_SLOT_MAP.get(charger_type, [])
                if permitted:
                    matching = [sl for sl in matching if sl.get('slot_type', '').upper() in permitted]

            if connector_type not in ('any', ''):
                permitted = _CONNECTOR_SLOT_MAP.get(connector_type, [])
                if permitted:
                    matching = [sl for sl in matching if sl.get('slot_type', '').upper() in permitted]

            filtered_by_connector = matching

            if available_only:
                matching = [sl for sl in matching if sl.get('status', '').upper() == 'AVAILABLE']

            if not matching:
                continue

            available = sum(1 for sl in matching if sl.get('status', '').upper() == 'AVAILABLE')
            rates = [float(sl['rate_per_kwh']) for sl in matching if sl.get('rate_per_kwh')]
            conn_types = list(set(
                _SLOT_TO_CONNECTOR.get(sl.get('slot_type', '').upper(), 'Unknown')
                for sl in filtered_by_connector
            ))

            s['_matching_slots'] = matching
            s['_available_slots'] = available
            s['_min_rate'] = min(rates) if rates else None
            s['_connector_types'] = conn_types
            result.append(s)

        return result

    @staticmethod
    def _sort_score(station: dict, preferred_type: str) -> tuple:
        has_available = station.get('_available_slots', 0) > 0
        has_dc = any(
            sl.get('slot_type', '').upper().startswith('DC')
            for sl in station.get('_matching_slots', [])
        )
        distance = station.get('distance_km') or 99999
        available = station.get('_available_slots', 0)
        return (
            0 if has_available and has_dc else 1 if has_available else 2,
            -available if has_available else 0,
            distance,
        )

    @staticmethod
    def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlng / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


_CHARGER_SLOT_MAP = {
    'DC': ['DC_FAST', 'DC_ULTRA'],
    'AC': ['AC_SLOW', 'AC_FAST'],
    'DC_FAST': ['DC_FAST'],
    'DC_ULTRA': ['DC_ULTRA'],
    'AC_FAST': ['AC_FAST'],
    'AC_SLOW': ['AC_SLOW'],
}

_CONNECTOR_SLOT_MAP = {
    'CCS2': ['DC_FAST', 'DC_ULTRA'],
    'CHAdeMO': ['DC_FAST', 'DC_ULTRA'],
    'Type 2 AC': ['AC_SLOW', 'AC_FAST'],
}

_SLOT_TO_CONNECTOR = {
    'DC_FAST': 'CCS2',
    'DC_ULTRA': 'CCS2',
    'AC_SLOW': 'Type 2 AC',
    'AC_FAST': 'Type 2 AC',
}
