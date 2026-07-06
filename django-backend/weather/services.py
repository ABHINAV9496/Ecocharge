import logging
import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

OPEN_METEO_BASE = 'https://api.open-meteo.com/v1'
GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1'
CACHE_TTL = 60 * 15
REQUEST_TIMEOUT = 10

WMO_CODES = {
    0: ('clear', 'Clear Sky'),
    1: ('mainly_clear', 'Mainly Clear'),
    2: ('partly_cloudy', 'Partly Cloudy'),
    3: ('overcast', 'Overcast'),
    45: ('foggy', 'Foggy'),
    48: ('foggy', 'Depositing Rime Fog'),
    51: ('drizzle', 'Light Drizzle'),
    53: ('drizzle', 'Moderate Drizzle'),
    55: ('drizzle', 'Dense Drizzle'),
    56: ('freezing_drizzle', 'Light Freezing Drizzle'),
    57: ('freezing_drizzle', 'Dense Freezing Drizzle'),
    61: ('rain', 'Slight Rain'),
    63: ('rain', 'Moderate Rain'),
    65: ('rain', 'Heavy Rain'),
    66: ('freezing_rain', 'Light Freezing Rain'),
    67: ('freezing_rain', 'Heavy Freezing Rain'),
    71: ('snow', 'Slight Snow'),
    73: ('snow', 'Moderate Snow'),
    75: ('snow', 'Heavy Snow'),
    77: ('snow', 'Snow Grains'),
    80: ('rain', 'Slight Rain Showers'),
    81: ('rain', 'Moderate Rain Showers'),
    82: ('rain', 'Violent Rain Showers'),
    85: ('snow', 'Slight Snow Showers'),
    86: ('snow', 'Heavy Snow Showers'),
    95: ('thunderstorm', 'Thunderstorm'),
    96: ('thunderstorm', 'Thunderstorm with Slight Hail'),
    99: ('thunderstorm', 'Thunderstorm with Heavy Hail'),
}

WMO_ICON_MAP = {
    'clear': 'sun',
    'mainly_clear': 'sun',
    'partly_cloudy': 'cloud-sun',
    'overcast': 'cloud',
    'foggy': 'fog',
    'drizzle': 'cloud-drizzle',
    'rain': 'cloud-rain',
    'freezing_rain': 'cloud-rain',
    'snow': 'cloud-snow',
    'freezing_drizzle': 'cloud-drizzle',
    'thunderstorm': 'cloud-lightning',
}


def _wmo_description(code):
    return WMO_CODES.get(code, ('unknown', 'Unknown'))[1]


def _wmo_icon(code):
    key = WMO_CODES.get(code, ('unknown', 'Unknown'))[0]
    return WMO_ICON_MAP.get(key, 'cloud')


class WeatherServiceError(Exception):
    pass


class WeatherService:

    @staticmethod
    def _cache_key(prefix, *args):
        return f'weather:{prefix}:{"|".join(str(a) for a in args)}'

    @staticmethod
    def _get(url, params):
        try:
            resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except requests.Timeout:
            raise WeatherServiceError('Weather API timed out')
        except requests.RequestException as e:
            raise WeatherServiceError(f'Weather API error: {e}')

    @classmethod
    def get_current_weather(cls, latitude, longitude):
        ck = cls._cache_key('current', latitude, longitude)
        cached = cache.get(ck)
        if cached:
            return cached

        data = cls._get(f'{OPEN_METEO_BASE}/forecast', {
            'latitude': latitude,
            'longitude': longitude,
            'current': ','.join([
                'temperature_2m', 'relative_humidity_2m',
                'apparent_temperature', 'precipitation',
                'weather_code', 'wind_speed_10m',
                'surface_pressure',
            ]),
            'timezone': 'auto',
        })

        current = data.get('current', {})
        code = current.get('weather_code', 0)
        result = {
            'temperature': current.get('temperature_2m'),
            'feels_like': current.get('apparent_temperature'),
            'humidity': current.get('relative_humidity_2m'),
            'precipitation': current.get('precipitation'),
            'wind_speed': current.get('wind_speed_10m'),
            'pressure': current.get('surface_pressure'),
            'weather_code': code,
            'description': _wmo_description(code),
            'icon': _wmo_icon(code),
            'units': data.get('current_units', {}),
        }

        cache.set(ck, result, CACHE_TTL)
        return result

    @classmethod
    def get_forecast(cls, latitude, longitude):
        ck = cls._cache_key('forecast', latitude, longitude)
        cached = cache.get(ck)
        if cached:
            return cached

        data = cls._get(f'{OPEN_METEO_BASE}/forecast', {
            'latitude': latitude,
            'longitude': longitude,
            'hourly': ','.join([
                'temperature_2m', 'precipitation_probability',
                'precipitation', 'weather_code',
                'wind_speed_10m', 'relative_humidity_2m',
            ]),
            'timezone': 'auto',
            'forecast_hours': 24,
        })

        hourly = data.get('hourly', {})
        times = hourly.get('time', [])
        result = {
            'hourly': [
                {
                    'time': times[i],
                    'temperature': hourly['temperature_2m'][i],
                    'precipitation_probability': hourly['precipitation_probability'][i],
                    'precipitation': hourly['precipitation'][i],
                    'weather_code': hourly['weather_code'][i],
                    'description': _wmo_description(hourly['weather_code'][i]),
                    'icon': _wmo_icon(hourly['weather_code'][i]),
                    'wind_speed': hourly['wind_speed_10m'][i],
                    'humidity': hourly['relative_humidity_2m'][i],
                }
                for i in range(len(times))
            ],
            'units': data.get('hourly_units', {}),
        }

        cache.set(ck, result, CACHE_TTL)
        return result

    @classmethod
    def get_7day_forecast(cls, latitude, longitude):
        ck = cls._cache_key('7day', latitude, longitude)
        cached = cache.get(ck)
        if cached:
            return cached

        data = cls._get(f'{OPEN_METEO_BASE}/forecast', {
            'latitude': latitude,
            'longitude': longitude,
            'daily': ','.join([
                'temperature_2m_max', 'temperature_2m_min',
                'precipitation_sum', 'precipitation_probability_max',
                'weather_code', 'wind_speed_10m_max',
            ]),
            'timezone': 'auto',
            'forecast_days': 7,
        })

        daily = data.get('daily', {})
        dates = daily.get('time', [])
        result = {
            'daily': [
                {
                    'date': dates[i],
                    'temp_max': daily['temperature_2m_max'][i],
                    'temp_min': daily['temperature_2m_min'][i],
                    'precipitation_sum': daily['precipitation_sum'][i],
                    'precipitation_probability_max': daily['precipitation_probability_max'][i],
                    'weather_code': daily['weather_code'][i],
                    'description': _wmo_description(daily['weather_code'][i]),
                    'icon': _wmo_icon(daily['weather_code'][i]),
                    'wind_speed_max': daily['wind_speed_10m_max'][i],
                }
                for i in range(len(dates))
            ],
            'units': data.get('daily_units', {}),
        }

        cache.set(ck, result, CACHE_TTL)
        return result

    @classmethod
    def get_weather_by_city(cls, city):
        """
        Resolve a city name to coordinates using Open-Meteo geocoding..3

        Priority:
        1. Exact city match in India
        2. Any Indian city
        3. Exact city match anywhere
        4. First result
        """

        city = city.strip()

        ck = cls._cache_key("city", city.lower())
        cached = cache.get(ck)
        if cached:
            return cached

        geo = cls._get(
            f"{GEOCODING_BASE}/search",
            {
                "name": city,
                "count": 10,
                "language": "en",
                "format": "json",
            },
        )

        results = geo.get("results", [])

        if not results:
            raise WeatherServiceError(f"City not found: {city}")

        city_lower = city.lower()

        preferred = None

        # --------------------------------------------------------
        # Priority 1 : Exact city name in India
        # --------------------------------------------------------
        for place in results:
            if (
                place.get("country", "").lower() == "india"
                and place.get("name", "").lower() == city_lower
            ):
                preferred = place
                break

        # --------------------------------------------------------
        # Priority 2 : Any Indian location
        # --------------------------------------------------------
        if preferred is None:
            for place in results:
                if place.get("country", "").lower() == "india":
                    preferred = place
                    break

        # --------------------------------------------------------
        # Priority 3 : Exact city anywhere
        # --------------------------------------------------------
        if preferred is None:
            for place in results:
                if place.get("name", "").lower() == city_lower:
                    preferred = place
                    break

        # --------------------------------------------------------
        # Priority 4 : First result
        # --------------------------------------------------------
        if preferred is None:
            preferred = results[0]

        logger.info(
            "Weather geocoder selected: %s, %s",
            preferred.get("name"),
            preferred.get("country"),
        )

        weather = cls.get_current_weather(
            preferred["latitude"],
            preferred["longitude"],
        )

        weather["city"] = preferred.get("name")
        weather["country"] = preferred.get("country")
        weather["state"] = preferred.get("admin1", "")
        weather["latitude"] = preferred["latitude"]
        weather["longitude"] = preferred["longitude"]

        cache.set(ck, weather, CACHE_TTL)

        return weather

    @classmethod
    def get_route_weather(cls, route_coords):
        if not route_coords:
            return {'samples': [], 'units': {}}

        SAMPLE_SIZE = 8
        step = max(1, len(route_coords) // SAMPLE_SIZE)
        indices = list(range(0, len(route_coords), step))
        if indices[-1] != len(route_coords) - 1:
            indices.append(len(route_coords) - 1)

        samples = []
        current_weather = None

        for idx in indices:
            coord = route_coords[idx]
            lat, lng = coord[0], coord[1]
            if current_weather is None:
                current_weather = cls.get_current_weather(lat, lng)
            else:
                try:
                    current_weather = cls.get_current_weather(lat, lng)
                except WeatherServiceError:
                    pass

            samples.append({
                'index': idx,
                'latitude': lat,
                'longitude': lng,
                'temperature': current_weather.get('temperature'),
                'description': current_weather.get('description'),
                'icon': current_weather.get('icon'),
                'precipitation_probability': cls._get_precip_prob(lat, lng),
                'wind_speed': current_weather.get('wind_speed'),
                'weather_code': current_weather.get('weather_code'),
            })

        return {'samples': samples}

    @classmethod
    def _get_precip_prob(cls, latitude, longitude):
        try:
            data = cls._get(f'{OPEN_METEO_BASE}/forecast', {
                'latitude': latitude,
                'longitude': longitude,
                'hourly': 'precipitation_probability',
                'forecast_hours': 1,
                'timezone': 'auto',
            })
            hourly = data.get('hourly', {})
            probs = hourly.get('precipitation_probability', [])
            return probs[0] if probs else 0
        except WeatherServiceError:
            return 0
