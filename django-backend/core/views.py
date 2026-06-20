import time
import requests
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema

_cache = {}
_CACHE_TTL = 3600


@extend_schema(tags=['Geocoding'])
class GeocodeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        limit_raw = request.query_params.get('limit', '5')
        try:
            limit = int(limit_raw)
        except (ValueError, TypeError):
            limit = 5
        if not q:
            return Response([])

        cache_key = q + '|' + str(limit)
        cached = _cache.get(cache_key)
        if cached:
            age = time.time() - cached['ts']
            if age < _CACHE_TTL:
                return Response(cached['data'])

        data = self._fetch_photon(q, limit)
        if data is not None:
            _cache[cache_key] = {'data': data, 'ts': time.time()}
            return Response(data)

        if cached:
            return Response(cached['data'])

        return Response([])

    def _fetch_photon(self, q, limit):
        url = 'https://photon.komoot.io/api/'
        params = {
            'q': q,
            'limit': limit,
            'lang': 'en',
            'bbox': '68,6,98,37',
        }
        headers = {
            'User-Agent': 'EcoCharge/1.0',
        }
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=6)
            resp.raise_for_status()
            raw = resp.json()
        except Exception:
            return None

        features = raw.get('features') or []
        results = []
        for f in features:
            props = f.get('properties') or {}
            geom = f.get('geometry') or {}
            coords = geom.get('coordinates') or [None, None]
            lat = coords[1]
            lon = coords[0]
            if lat is None or lon is None:
                continue

            parts = []
            if props.get('name'):
                parts.append(props['name'])
            if props.get('street'):
                parts.append(props['street'])
            if props.get('housenumber'):
                parts.append(props['housenumber'])
            if props.get('city'):
                parts.append(props['city'])
            if props.get('state'):
                parts.append(props['state'])
            if props.get('country'):
                parts.append(props['country'])
            display_name = ', '.join(parts)

            osm_type = props.get('osm_type', '')
            osm_type_map = {'N': 'node', 'W': 'way', 'R': 'relation'}
            osm_type_full = osm_type_map.get(osm_type, 'node')

            results.append({
                'display_name': display_name or props.get('name', q),
                'lat': str(lat),
                'lon': str(lon),
                'place_id': str(props.get('osm_id', 0)),
                'osm_type': osm_type_full,
                'osm_id': props.get('osm_id', 0),
                'name': props.get('name', ''),
            })

        results = [r for r in results if 6 <= float(r['lat']) <= 37 and 68 <= float(r['lon']) <= 98]

        return results
