from django.core.management.base import BaseCommand
from stations.models import CachedOCMStation
import requests
from datetime import datetime

INDIA_CENTERS = [
    {'lat': 28.6139, 'lng': 77.2090},
    {'lat': 26.8467, 'lng': 80.9462},
    {'lat': 25.4358, 'lng': 81.8463},
    {'lat': 27.1751, 'lng': 78.0421},
    {'lat': 25.3176, 'lng': 82.9739},
    {'lat': 26.4499, 'lng': 74.6399},
    {'lat': 26.2389, 'lng': 73.0243},
    {'lat': 24.5854, 'lng': 73.7125},
    {'lat': 30.7333, 'lng': 76.7794},
    {'lat': 31.6340, 'lng': 74.8723},
    {'lat': 30.9009, 'lng': 75.8573},
    {'lat': 28.4089, 'lng': 77.3178},
    {'lat': 30.3165, 'lng': 78.0322},
    {'lat': 34.0837, 'lng': 74.7973},
    {'lat': 32.7266, 'lng': 74.8570},
    {'lat': 31.1048, 'lng': 77.1734},
    {'lat': 22.5726, 'lng': 88.3639},
    {'lat': 25.5941, 'lng': 85.1376},
    {'lat': 23.2599, 'lng': 87.8585},
    {'lat': 20.2961, 'lng': 85.8245},
    {'lat': 23.3441, 'lng': 85.3096},
    {'lat': 22.8046, 'lng': 86.2029},
    {'lat': 26.1445, 'lng': 91.7362},
    {'lat': 19.0760, 'lng': 72.8777},
    {'lat': 18.5204, 'lng': 73.8567},
    {'lat': 21.1458, 'lng': 79.0882},
    {'lat': 19.9975, 'lng': 73.7898},
    {'lat': 20.5937, 'lng': 78.9629},
    {'lat': 23.0225, 'lng': 72.5714},
    {'lat': 21.1702, 'lng': 72.8311},
    {'lat': 22.3072, 'lng': 73.1812},
    {'lat': 22.3039, 'lng': 70.8022},
    {'lat': 15.4909, 'lng': 73.8278},
    {'lat': 23.1815, 'lng': 75.7795},
    {'lat': 23.2599, 'lng': 77.4126},
    {'lat': 21.4679, 'lng': 70.9587},
    {'lat': 12.9716, 'lng': 77.5946},
    {'lat': 13.0827, 'lng': 80.2707},
    {'lat': 17.3850, 'lng': 78.4867},
    {'lat': 9.9312, 'lng': 76.2673},
    {'lat': 8.5241, 'lng': 76.9366},
    {'lat': 11.2588, 'lng': 75.7804},
    {'lat': 10.5276, 'lng': 76.2144},
    {'lat': 11.0055, 'lng': 76.9610},
    {'lat': 9.9252, 'lng': 78.1198},
    {'lat': 11.6643, 'lng': 78.1460},
    {'lat': 10.7905, 'lng': 78.7047},
    {'lat': 8.7139, 'lng': 77.7567},
    {'lat': 12.2958, 'lng': 76.6394},
    {'lat': 12.9141, 'lng': 74.8560},
    {'lat': 15.3647, 'lng': 75.1240},
    {'lat': 17.6868, 'lng': 83.2185},
    {'lat': 16.5062, 'lng': 80.6480},
    {'lat': 14.4426, 'lng': 79.9865},
    {'lat': 16.4419, 'lng': 81.0598},
    {'lat': 13.6288, 'lng': 79.4192},
    {'lat': 9.4981, 'lng': 76.3388},
    {'lat': 10.0889, 'lng': 77.0598},
]

OCM_API_BASE = 'https://api.openchargemap.io/v3/poi/'
PAGE_SIZE = 100
MAX_PAGES = 2


def fetch_center_stations(lat, lng, api_key):
    results = []
    for page in range(MAX_PAGES):
        try:
            params = {
                'output': 'json',
                'countrycode': 'IN',
                'latitude': lat,
                'longitude': lng,
                'distance': 500,
                'distanceunit': 'km',
                'maxresults': PAGE_SIZE,
                'offset': page * PAGE_SIZE,
                'key': api_key,
            }
            resp = requests.get(OCM_API_BASE, params=params, timeout=15)
            if resp.status_code != 200:
                break
            data = resp.json()
            if not data or len(data) == 0:
                break
            results.extend(data)
            if len(data) < PAGE_SIZE:
                break
        except requests.RequestException:
            break
    return results


class Command(BaseCommand):
    help = 'Fetch all EV charging stations from Open Charge Map and cache them locally'

    def add_arguments(self, parser):
        parser.add_argument('--api-key', type=str, help='OCM API key (or set OCM_API_KEY env var)')

    def handle(self, *args, **options):
        api_key = options.get('api_key')

        if not api_key:
            from django.conf import settings
            api_key = getattr(settings, 'OCM_API_KEY', None)

        if not api_key:
            self.stderr.write('OCM_API_KEY not provided. Set via --api-key or OCM_API_KEY in settings.')
            return

        self.stdout.write('Fetching OCM stations from all India centers...')

        all_stations = {}
        total_fetched = 0

        for center in INDIA_CENTERS:
            stations = fetch_center_stations(center['lat'], center['lng'], api_key)
            for s in stations:
                ocm_id = s.get('ID')
                if ocm_id and ocm_id not in all_stations:
                    all_stations[ocm_id] = s
            total_fetched += len(stations)
            self.stdout.write(f'  {center["lat"]:.1f}, {center["lng"]:.1f} → {len(stations)} stations')

        self.stdout.write(f'\nTotal fetched: {total_fetched}, Unique: {len(all_stations)}')

        created = 0
        updated = 0

        for ocm_id, s in all_stations.items():
            info = s.get('AddressInfo', {})
            connections = s.get('Connections', [])
            connector_types = []
            for c in connections:
                ct = c.get('ConnectionType', {})
                if ct.get('Title'):
                    connector_types.append(ct['Title'])

            status_title = ''
            st = s.get('StatusType')
            if st:
                status_title = st.get('Title', '')

            our_status = 'ACTIVE'
            if 'inactive' in status_title.lower() or 'removed' in status_title.lower():
                our_status = 'INACTIVE'
            elif 'planned' in status_title.lower() or 'coming' in status_title.lower():
                our_status = 'MAINTENANCE'

            defaults = {
                'name': info.get('Title') or 'Unknown Station',
                'address': ', '.join(filter(None, [
                    info.get('AddressLine1'),
                    info.get('Town'),
                    info.get('StateOrProvince'),
                ])),
                'latitude': info.get('Latitude') or 0,
                'longitude': info.get('Longitude') or 0,
                'city': info.get('Town') or '',
                'state': info.get('StateOrProvince') or '',
                'connector_types': connector_types,
                'status': our_status,
            }

            obj, was_created = CachedOCMStation.objects.update_or_create(
                ocm_id=ocm_id,
                defaults=defaults,
            )
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nDone! Created: {created}, Updated: {updated}, Total: {CachedOCMStation.objects.count()}'
        ))
