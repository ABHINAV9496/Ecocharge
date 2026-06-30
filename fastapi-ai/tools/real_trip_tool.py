import json
import logging
import time

import httpx

from config import settings
from tools.base import BaseTool
from tools.context import auth_token_var

logger = logging.getLogger(__name__)

DJANGO_BASE = settings.DJANGO_BASE
OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'
GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
GEOCODING_TIMEOUT = 10
OSRM_TIMEOUT = 30
DJANGO_TIMEOUT = 60


class RealTripTool(BaseTool):
    name = 'trip_planner'
    description = (
        'Plan an EV road trip between two cities. '
        'Returns route distance, charging stops, costs, '
        'battery estimates, and driving/charging times. '
        'Use this tool for any trip planning request.'
    )
    parameters = {
        'type': 'object',
        'properties': {
            'origin': {
                'type': 'string',
                'description': 'Starting city or location name',
            },
            'destination': {
                'type': 'string',
                'description': 'Destination city or location name',
            },
            'vehicle': {
                'type': 'string',
                'description': (
                    'Vehicle description the user provided, '
                    'e.g. "Tata Nexon EV" or "My car"'
                ),
            },
            'battery': {
                'type': 'number',
                'description': 'Current battery percentage (0–100). Default: 80.',
            },
            'strategy': {
                'type': 'string',
                'enum': ['fastest', 'cheapest'],
                'description': 'Preferred charging strategy. Default: fastest.',
            },
        },
        'required': ['origin', 'destination'],
    }

    async def execute(self, **kwargs) -> dict:
        logger.info('TripTool kwargs received: %s', kwargs)

        origin = kwargs.get('origin', '').strip()
        destination = kwargs.get('destination', '').strip()
        vehicle = kwargs.get('vehicle', '').strip()
        battery = kwargs.get('battery')
        strategy = kwargs.get('strategy', 'fastest')
        token = auth_token_var.get()

        logger.info('TripTool DJANGO_BASE=%s', DJANGO_BASE)
        logger.info('TripTool origin=%s destination=%s vehicle=%s battery=%s strategy=%s', origin, destination, vehicle, battery, strategy)

        if not origin or not destination:
            return {'error': True, 'message': 'Both origin and destination are required.'}

        strategy_map = {'fastest': 'fastest_time', 'cheapest': 'cheapest_cost'}
        planner_strategy = strategy_map.get(strategy, 'fastest_time')

        logger.info('TripTool: geocoding origin=%s', origin)
        origin_coords = await self._geocode(origin)
        if not origin_coords:
            return {'error': True, 'message': f"I couldn't find the location '{origin}'. Please check the spelling and try again."}

        logger.info('TripTool: geocoding destination=%s', destination)
        dest_coords = await self._geocode(destination)
        if not dest_coords:
            return {'error': True, 'message': f"I couldn't find the location '{destination}'. Please check the spelling and try again."}

        logger.info('TripTool: OSRM route %s -> %s', origin, destination)
        osrm_data = await self._osrm_route(origin_coords, dest_coords)
        if osrm_data is None:
            return {'error': True, 'message': "I couldn't find a driving route between those locations. Please try different cities."}

        route_coords, total_distance_m, total_duration_s = osrm_data

        logger.info('TripTool: OSRM route: distance=%.2fkm duration=%.1fmin', total_distance_m / 1000, total_duration_s / 60)

        vehicle_id = await self._resolve_vehicle(vehicle, token)
        if vehicle_id is None:
            return {
                'error': True,
                'message': (
                    f"I couldn't determine your vehicle. "
                    "Please tell me the exact make and model of your EV."
                ),
            }

        logger.info('TripTool: calling planner vehicle=%s battery=%s', vehicle_id, battery)
        plan = await self._call_planner(
            token=token,
            route_coords=route_coords,
            total_distance_m=total_distance_m,
            total_duration_s=total_duration_s,
            vehicle_id=vehicle_id,
            battery_start_percent=battery or 80,
            origin_name=origin,
            dest_name=destination,
        )
        if plan is None:
            return {
                'error': True,
                'message': (
                    "I'm unable to reach the trip planner service at the moment. "
                    "Please try again in a few seconds."
                ),
            }
        if 'error' in plan:
            return plan

        plan['vehicle_query'] = vehicle
        plan['origin'] = origin
        plan['destination'] = destination
        plan['strategy'] = strategy

        return plan

    async def _geocode(self, location: str) -> list[float] | None:
        url = GEOCODING_URL
        params = {'name': location, 'count': 1, 'language': 'en', 'format': 'json'}
        logger.info('TripTool geocode GET %s params=%s', url, params)
        try:
            async with httpx.AsyncClient(timeout=GEOCODING_TIMEOUT) as client:
                resp = await client.get(url, params=params)
                logger.info('TripTool geocode HTTP status: %s', resp.status_code)
                resp.raise_for_status()
                data = resp.json()
                logger.info('TripTool geocode response: %s', data)
                results = data.get('results', [])
                if not results:
                    logger.warning('TripTool geocode no results for %s', location)
                    return None
                lat, lng = results[0]['latitude'], results[0]['longitude']
                logger.info('TripTool geocode result: %.4f, %.4f', lat, lng)
                return [lat, lng]
        except Exception as e:
            logger.exception('TripTool geocode failed for %s', location)
            return None

    async def _osrm_route(
        self, origin: list[float], destination: list[float],
    ) -> tuple[list[list[float]], float, float] | None:
        url = (
            f'{OSRM_BASE}/{origin[1]},{origin[0]};'
            f'{destination[1]},{destination[0]}'
            '?geometries=geojson&overview=full&steps=true'
        )
        logger.info('TripTool OSRM GET %s', url)
        try:
            async with httpx.AsyncClient(timeout=OSRM_TIMEOUT) as client:
                resp = await client.get(url)
                logger.info('TripTool OSRM HTTP status: %s', resp.status_code)
                resp.raise_for_status()
                data = resp.json()
                logger.info('TripTool OSRM response code: %s', data.get('code'))

            if not data.get('routes'):
                logger.warning('TripTool OSRM no routes found')
                return None

            route = data['routes'][0]
            coordinates = [
                [c[1], c[0]] for c in route['geometry']['coordinates']
            ]
            distance_m = route['distance']
            duration_s = route['duration']

            MAX_PLANNER_POINTS = 1000
            if len(coordinates) > MAX_PLANNER_POINTS:
                step = len(coordinates) / MAX_PLANNER_POINTS
                coordinates = [
                    c for i, c in enumerate(coordinates)
                    if i == 0 or i == len(coordinates) - 1
                    or int(i % step) == 0
                ]

            logger.info('TripTool OSRM result: %d points, %.2fkm, %.1fmin', len(coordinates), distance_m / 1000, duration_s / 60)
            return coordinates, distance_m, duration_s
        except Exception as e:
            logger.exception('TripTool OSRM routing failed')
            return None

    async def _resolve_vehicle(self, query: str, token: str) -> str | None:
        if not query:
            logger.warning('TripTool no vehicle query provided')
            return None

        query_lower = query.lower().strip()

        try:
            headers = {'Authorization': f'Bearer {token}'}
            url = f'{DJANGO_BASE}/api/vehicles/'
            logger.info('TripTool vehicle lookup GET %s', url)
            async with httpx.AsyncClient(timeout=DJANGO_TIMEOUT) as client:
                resp = await client.get(url, headers=headers)
                logger.info('TripTool vehicle lookup HTTP status: %s', resp.status_code)
                if resp.status_code == 401:
                    logger.warning('Auth failed resolving vehicle')
                    return await self._fallback_vehicle_lookup(query_lower)
                resp.raise_for_status()
                vehicles = resp.json()
                logger.info('TripTool vehicles response: %d vehicles', len(vehicles) if isinstance(vehicles, list) else 0)

            if not vehicles:
                return None

            for v in vehicles:
                make_model = f"{v.get('make', '')} {v.get('model', '')}".lower()
                make = v.get('make', '').lower()
                model = v.get('model', '').lower()
                vid = v.get('id', '')
                if query_lower in make_model or query_lower in make or query_lower in model:
                    logger.info('TripTool matched vehicle: %s -> %s', query_lower, vid)
                    return vid

            logger.warning('TripTool no vehicle match for "%s", returning first', query)
            return vehicles[0].get('id')
        except Exception as e:
            logger.exception('TripTool vehicle lookup failed')
            return await self._fallback_vehicle_lookup(query_lower)

    async def _call_planner(
        self,
        token: str,
        route_coords: list[list[float]],
        total_distance_m: float,
        total_duration_s: float,
        vehicle_id: str,
        battery_start_percent: float,
        origin_name: str,
        dest_name: str,
    ) -> dict | None:
        body = {
            'route_coords': route_coords,
            'total_distance_m': total_distance_m,
            'total_duration_s': total_duration_s,
            'vehicle_id': vehicle_id,
            'battery_start_percent': battery_start_percent,
            'origin_name': origin_name,
            'dest_name': dest_name,
        }
        url = f'{DJANGO_BASE}/api/trips/plan/'
        logger.info('TripTool planner POST %s body=%s', url, json.dumps(body, default=str)[:1000])

        try:
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json',
            }
            start = time.monotonic()
            async with httpx.AsyncClient(timeout=DJANGO_TIMEOUT) as client:
                resp = await client.post(url, json=body, headers=headers)
            elapsed = time.monotonic() - start
            logger.info('TripTool planner HTTP status: %s (%.2fs)', resp.status_code, elapsed)
            logger.info('TripTool planner response: %s', resp.text[:2000])

            if resp.status_code == 401:
                return {'error': True, 'message': 'Your session has expired. Please log in again to plan a trip.'}
            if resp.status_code == 400:
                detail = resp.json()
                logger.warning('Planner validation error: %s', detail)
                return {'error': True, 'message': f'The trip planner returned an error: {detail}'}
            if resp.status_code == 404:
                return {'error': True, 'message': "I couldn't find the selected vehicle in your profile."}

            resp.raise_for_status()
            return resp.json()
        except httpx.TimeoutException:
            logger.exception('TripTool planner request timed out')
            return None
        except Exception as e:
            logger.exception('TripTool planner request failed')
            return None

    async def _fallback_vehicle_lookup(self, query: str) -> str | None:
        common = {
            'tata nexon': 'tata-nexon-ev-2023',
            'nexon': 'tata-nexon-ev-2023',
            'mg zs': 'mg-zs-ev-2023',
            'mg': 'mg-zs-ev-2023',
            'hyundai kona': 'hyundai-kona-electric-2023',
            'kona': 'hyundai-kona-electric-2023',
            'tata tiago': 'tata-tiago-ev-2023',
            'tiago': 'tata-tiago-ev-2023',
            'tata tigor': 'tata-tigor-ev-2023',
            'tigor': 'tata-tigor-ev-2023',
            'tata punch': 'tata-punch-ev-2023',
            'punch': 'tata-punch-ev-2023',
            'mg comet': 'mg-comet-ev-2023',
            'comet': 'mg-comet-ev-2023',
            'citroen ec3': 'citroen-ec3-2023',
            'ec3': 'citroen-ec3-2023',
            'hyundai ioniq': 'hyundai-ioniq-5-2023',
            'ioniq': 'hyundai-ioniq-5-2023',
            'kia ev6': 'kia-ev6-2023',
            'ev6': 'kia-ev6-2023',
            'bmw i4': 'bmw-i4-2023',
            'bmw ix': 'bmw-ix-2023',
            'mercedes eq': 'mercedes-benz-eqe-2023',
            'porsche taycan': 'porsche-taycan-2023',
            'taycan': 'porsche-taycan-2023',
            'tesla model 3': 'tesla-model-3-2023',
            'tesla model y': 'tesla-model-y-2023',
            'tesla': 'tesla-model-3-2023',
        }
        for key, vid in common.items():
            if key in query:
                logger.info('TripTool fallback vehicle match: %s -> %s', query, vid)
                return vid
        return None
