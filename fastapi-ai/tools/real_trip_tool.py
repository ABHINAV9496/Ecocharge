import json
import logging
import time

import httpx

from tools.base import BaseTool
from tools.context import auth_token_var

logger = logging.getLogger(__name__)

DJANGO_BASE = 'http://django:8000'
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
            'vehicle_query': {
                'type': 'string',
                'description': (
                    'Vehicle description the user provided, '
                    'e.g. "Tata Nexon EV" or "My car"'
                ),
            },
            'battery_percent': {
                'type': 'number',
                'description': 'Current battery percentage (0–100)',
            },
            'strategy': {
                'type': 'string',
                'enum': ['fastest', 'cheapest'],
                'description': 'Preferred charging strategy',
            },
        },
        'required': ['origin', 'destination', 'vehicle_query', 'battery_percent'],
    }

    async def execute(self, **kwargs) -> dict:
        origin = kwargs.get('origin', '').strip()
        destination = kwargs.get('destination', '').strip()
        vehicle_query = kwargs.get('vehicle_query', '').strip()
        battery_percent = kwargs.get('battery_percent')
        strategy = kwargs.get('strategy', 'fastest')
        token = auth_token_var.get()

        if not origin or not destination:
            return {'error': True, 'message': 'Both origin and destination are required.'}
        if not vehicle_query:
            return {'error': True, 'message': 'Please tell me which vehicle you will be using.'}
        if battery_percent is None:
            return {'error': True, 'message': 'What is your current battery percentage?'}

        strategy_map = {'fastest': 'fastest_time', 'cheapest': 'cheapest_cost'}
        planner_strategy = strategy_map.get(strategy, 'fastest_time')

        # Step 1 — Geocode origin
        logger.info('Geocoding origin: %s', origin)
        origin_coords = await self._geocode(origin)
        if not origin_coords:
            return {'error': True, 'message': f"I couldn't find the location '{origin}'. Please check the spelling and try again."}

        # Step 2 — Geocode destination
        logger.info('Geocoding destination: %s', destination)
        dest_coords = await self._geocode(destination)
        if not dest_coords:
            return {'error': True, 'message': f"I couldn't find the location '{destination}'. Please check the spelling and try again."}

        # Step 3 — OSRM routing
        logger.info('Fetching OSRM route: %s → %s', origin, destination)
        osrm_data = await self._osrm_route(origin_coords, dest_coords)
        if osrm_data is None:
            return {'error': True, 'message': "I couldn't find a driving route between those locations. Please try different cities."}

        route_coords, total_distance_m, total_duration_s = osrm_data

        # Step 4 — Look up vehicle
        logger.info('Looking up vehicle: %s', vehicle_query)
        vehicle_id = await self._resolve_vehicle(vehicle_query, token)
        if vehicle_id is None:
            return {
                'error': True,
                'message': (
                    f"I couldn't find a vehicle matching '{vehicle_query}'. "
                    "Please tell me the exact make and model of your EV."
                ),
            }

        # Step 5 — Call Django Trip Planner
        logger.info('Calling Django Trip Planner: origin=%s dest=%s vehicle=%s', origin, destination, vehicle_id)
        plan = await self._call_planner(
            token=token,
            route_coords=route_coords,
            total_distance_m=total_distance_m,
            total_duration_s=total_duration_s,
            vehicle_id=vehicle_id,
            battery_start_percent=battery_percent,
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

        # Step 6 — Enrich with vehicle info
        plan['vehicle_query'] = vehicle_query
        plan['origin'] = origin
        plan['destination'] = destination

        return plan

    async def _geocode(self, location: str) -> list[float] | None:
        try:
            async with httpx.AsyncClient(timeout=GEOCODING_TIMEOUT) as client:
                resp = await client.get(GEOCODING_URL, params={
                    'name': location,
                    'count': 1,
                    'language': 'en',
                    'format': 'json',
                })
                resp.raise_for_status()
                data = resp.json()
                results = data.get('results', [])
                if not results:
                    return None
                return [results[0]['latitude'], results[0]['longitude']]
        except Exception as e:
            logger.error('Geocoding failed for %s: %s', location, str(e))
            return None

    async def _osrm_route(
        self, origin: list[float], destination: list[float],
    ) -> tuple[list[list[float]], float, float] | None:
        try:
            url = (
                f'{OSRM_BASE}/{origin[1]},{origin[0]};'
                f'{destination[1]},{destination[0]}'
                '?geometries=geojson&overview=full&steps=true'
            )
            async with httpx.AsyncClient(timeout=OSRM_TIMEOUT) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()

            if not data.get('routes'):
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

            return coordinates, distance_m, duration_s
        except Exception as e:
            logger.error('OSRM routing failed: %s', str(e))
            return None

    async def _resolve_vehicle(self, query: str, token: str) -> str | None:
        query_lower = query.lower().strip()

        try:
            headers = {'Authorization': f'Bearer {token}'}
            async with httpx.AsyncClient(timeout=DJANGO_TIMEOUT) as client:
                resp = await client.get(
                    f'{DJANGO_BASE}/api/vehicles/',
                    headers=headers,
                )
                if resp.status_code == 401:
                    logger.warning('Auth failed resolving vehicle')
                    return await self._fallback_vehicle_lookup(query_lower)
                resp.raise_for_status()
                vehicles = resp.json()

            if not vehicles:
                return None

            # Best-effort match: check make, model, or combined
            for v in vehicles:
                make_model = f"{v.get('make', '')} {v.get('model', '')}".lower()
                make = v.get('make', '').lower()
                model = v.get('model', '').lower()
                vid = v.get('id', '')
                if query_lower in make_model or query_lower in make or query_lower in model:
                    return vid

            # No match — return first vehicle as fallback
            logger.warning('No vehicle match for "%s", returning first available', query)
            return vehicles[0].get('id')
        except Exception as e:
            logger.error('Vehicle lookup failed: %s', str(e))
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
            'dest_name': destination,
        }
        logger.info('Planner request: vehicle=%s battery=%s%% strategy=%s', vehicle_id, battery_start_percent, 'fastest_time')

        try:
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json',
            }
            start = time.monotonic()
            async with httpx.AsyncClient(timeout=DJANGO_TIMEOUT) as client:
                resp = await client.post(
                    f'{DJANGO_BASE}/api/trips/plan/',
                    json=body,
                    headers=headers,
                )
            elapsed = time.monotonic() - start
            logger.info('Planner responded in %.2fs with status %s', elapsed, resp.status_code)

            if resp.status_code == 401:
                return {'error': True, 'message': 'Your session has expired. Please log in again to plan a trip.'}
            if resp.status_code == 400:
                detail = resp.json()
                logger.warning('Planner validation error: %s', detail)
                return {'error': True, 'message': f'The trip planner returned an error: {detail}'}
            if resp.status_code == 404:
                return {'error': True, 'message': "I couldn't find the selected vehicle in your profile. Please check your vehicles in the dashboard."}

            resp.raise_for_status()
            return resp.json()
        except httpx.TimeoutException:
            logger.error('Planner request timed out')
            return None
        except Exception as e:
            logger.error('Planner request failed: %s', str(e))
            return None

    async def _fallback_vehicle_lookup(self, query: str) -> str | None:
        """Return a best-effort vehicle ID from a built-in dictionary."""
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
                return vid
        return None
