import os, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()
from trips.views import TripPlanView
from rest_framework.test import APIRequestFactory
from users.models import CustomUser
from rest_framework.test import force_authenticate
import json

factory = APIRequestFactory()
user = CustomUser.objects.get(username='testdriver')
data = {
    'route_coords': [[9.93,76.27],[10.50,76.50],[11.00,76.50],[11.50,76.50],[12.00,76.80],[12.50,77.20],[12.90,77.60]],
    'total_distance_m': 450000,
    'total_duration_s': 27000,
    'vehicle_id': 'tata-nexon-ev',
    'battery_start_percent': 80,
    'origin_name': 'Kochi',
    'dest_name': 'Bangalore',
}
request = factory.post('/api/trips/plan/', data, format='json')
force_authenticate(request, user)
view = TripPlanView.as_view()
response = view(request)
plan = json.loads(json.dumps(response.data))
print('Legs:', len(plan['legs']))
for l in plan['legs']:
    print(f'  #{l["leg_index"]}: {l["start_name"]} -> {l["end_name"]}, {l["distance_km"]}km, {l["start_soc_percent"]}% -> {l["end_soc_percent"]}%')
print('Stops:', len(plan['stops']))
for s in plan['stops']:
    print(f'  Stop {s["stop_index"]}: {s["station_name"]} at {s["distance_from_start_km"]}km, arrive {s["arrival_soc_percent"]}%, depart {s["departure_soc_percent"]}%')
print('Final:', plan.get('final_soc_percent'))
print('Note:', plan.get('note'))
