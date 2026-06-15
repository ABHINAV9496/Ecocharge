import time
import requests
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema

_cache = {}
_CACHE_TTL = 3600
_LAST_REQUEST = 0
_MIN_INTERVAL = 1.1


@extend_schema(tags=['Geocoding'])
class GeocodeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        q = request.query_params.get('q', '').strip().lower()
        limit = request.query_params.get('limit', '5')
        if not q:
            return Response([])

        cache_key = q + '|' + str(limit)
        cached = _cache.get(cache_key)
        if cached:
            age = time.time() - cached['ts']
            if age < _CACHE_TTL:
                return Response(cached['data'])

        data = self._fetch(q, limit)
        if data is not None:
            _cache[cache_key] = {'data': data, 'ts': time.time()}
            return Response(data)

        if cached:
            return Response(cached['data'])

        return Response([])

    def _fetch(self, q, limit):
        global _LAST_REQUEST
        elapsed = time.time() - _LAST_REQUEST
        if elapsed < _MIN_INTERVAL:
            time.sleep(_MIN_INTERVAL - elapsed)

        urls = [
            'https://nominatim.openstreetmap.org/search',
            'https://nominatim.openstreetmap.org/search.php',
        ]

        for url in urls:
            try:
                params = {
                    'q': q,
                    'format': 'jsonv2',
                    'limit': limit,
                    'countrycodes': 'IN',
                }
                headers = {
                    'User-Agent': 'EcoChargeBackend/1.0 (ecocharge.app)',
                    'Referer': 'https://ecocharge.app',
                }
                _LAST_REQUEST = time.time()
                resp = requests.get(url, params=params, headers=headers, timeout=8)
                if resp.status_code == 429:
                    continue
                resp.raise_for_status()
                return resp.json()
            except Exception:
                continue

        return None
