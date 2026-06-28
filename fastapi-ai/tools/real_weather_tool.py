import logging

import httpx

from tools.base import BaseTool
from tools.context import auth_token_var

logger = logging.getLogger(__name__)

DJANGO_BASE = 'http://django:8000'
DJANGO_TIMEOUT = 15


class RealWeatherTool(BaseTool):
    name = 'weather_tool'
    description = (
        'Get current weather or forecast for a city. '
        'Returns temperature, conditions, wind, rain probability, '
        'and humidity. Use this for ANY weather-related question.'
    )
    parameters = {
        'type': 'object',
        'properties': {
            'location': {
                'type': 'string',
                'description': 'City or location name (e.g. "Kochi", "Bangalore", "Delhi")',
            },
            'type': {
                'type': 'string',
                'enum': ['current', 'forecast', '7day'],
                'description': (
                    '"current" — current conditions only. '
                    '"forecast" — next 24 hours hourly. '
                    '"7day" — 7-day daily summary.'
                ),
            },
        },
        'required': ['location'],
    }

    async def execute(self, **kwargs) -> dict:
        location = kwargs.get('location', '').strip()
        weather_type = kwargs.get('type', 'current')

        if not location:
            return {'error': True, 'message': 'Please tell me which city you want weather for.'}

        token = auth_token_var.get()
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        # Get city weather first (provides coords + current conditions)
        logger.info('WeatherTool: fetching city weather for "%s"', location)
        city_data = await self._call_city_api(location, headers)
        if city_data is None:
            return {
                'error': True,
                'message': f"I couldn't find weather data for '{location}'. Please check the spelling and try again.",
            }

        if weather_type == 'current':
            return city_data

        lat = city_data.get('latitude')
        lng = city_data.get('longitude')
        if lat is None or lng is None:
            return {
                'error': True,
                'message': f"I couldn't determine the coordinates for '{location}'.",
            }

        if weather_type == 'forecast':
            logger.info('WeatherTool: fetching 24h forecast for %s', location)
            forecast = await self._call_forecast_api(lat, lng, headers)
            if forecast is None:
                return {**city_data, 'forecast_error': True}
            return {**city_data, 'forecast': forecast}

        if weather_type == '7day':
            logger.info('WeatherTool: fetching 7-day forecast for %s', location)
            forecast = await self._call_7day_api(lat, lng, headers)
            if forecast is None:
                return {**city_data, 'forecast_error': True}
            return {**city_data, 'forecast': forecast}

        return city_data

    async def _call_city_api(self, location: str, headers: dict) -> dict | None:
        try:
            async with httpx.AsyncClient(timeout=DJANGO_TIMEOUT) as client:
                resp = await client.get(
                    f'{DJANGO_BASE}/api/weather/city/',
                    params={'city': location},
                    headers=headers,
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as e:
            logger.error('City weather API error (%s): %s', e.response.status_code, e.response.text[:200])
            if e.response.status_code == 502:
                return None
            return None
        except Exception as e:
            logger.error('City weather request failed: %s', str(e))
            return None

    async def _call_forecast_api(self, lat: float, lng: float, headers: dict) -> list | None:
        try:
            async with httpx.AsyncClient(timeout=DJANGO_TIMEOUT) as client:
                resp = await client.get(
                    f'{DJANGO_BASE}/api/weather/forecast/',
                    params={'latitude': lat, 'longitude': lng},
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get('hourly', [])
        except Exception as e:
            logger.error('Forecast API request failed: %s', str(e))
            return None

    async def _call_7day_api(self, lat: float, lng: float, headers: dict) -> list | None:
        try:
            async with httpx.AsyncClient(timeout=DJANGO_TIMEOUT) as client:
                resp = await client.get(
                    f'{DJANGO_BASE}/api/weather/forecast/7-day/',
                    params={'latitude': lat, 'longitude': lng},
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get('daily', [])
        except Exception as e:
            logger.error('7-day API request failed: %s', str(e))
            return None
