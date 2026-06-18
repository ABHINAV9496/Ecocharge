import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from stations.models import ChargingStation

all_stations = ChargingStation.objects.all()
print('Total:', all_stations.count())

suspicious = []
for s in all_stations:
    lat = s.location.y
    lng = s.location.x
    issues = []
    if lat > 20 or lat < 5:
        issues.append(f'lat={lat:.4f}')
    if lng > 80 or lng < 68:
        issues.append(f'lng={lng:.4f}')
    if issues:
        suspicious.append((s.id, s.name, lat, lng, issues, s.status))

print(f'\nSuspicious: {len(suspicious)}')
for sid, name, lat, lng, issues, status in suspicious[:30]:
    print(f'  #{sid}: {name[:40]} @ ({lat:.4f}, {lng:.4f}) issues={issues} status={status}')

print(f'\nLat range: {min(s.location.y for s in all_stations):.4f} - {max(s.location.y for s in all_stations):.4f}')
print(f'Lng range: {min(s.location.x for s in all_stations):.4f} - {max(s.location.x for s in all_stations):.4f}')
