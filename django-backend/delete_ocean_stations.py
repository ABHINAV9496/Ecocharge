"""
Delete stations that are in the ocean (outside India's main land polygon).
Keeps stations near international borders that are on land.
"""
import os, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()

from stations.models import ChargingStation
from stations.india_boundary import INDIA_BOUNDARY, ANDAMAN_BOUNDARY, LAKSHADWEEP_BOUNDARY, DIU_BOUNDARY

def point_in_polygon(lat, lng, poly):
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        yi, xi = poly[i]
        yj, xj = poly[j]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

# States that are on land but may be outside the polygon (northeast borders)
BORDER_STATES = [
    'Arunachal Pradesh', 'Mizoram', 'Tripura', 'Nagaland',
    'Manipur', 'Meghalaya', 'Assam', 'Sikkim', 'Ladakh',
    'Jammu and Kashmir', 'Jammu & Kashmir',
]

def is_border_station(s):
    """Check if station is in a border state (likely on land)"""
    if s.address:
        for state in BORDER_STATES:
            if state in s.address:
                return True
    return False

all_stations = ChargingStation.objects.all()
total = all_stations.count()

to_delete = []
for s in all_stations:
    lat = s.location.y
    lng = s.location.x
    
    in_main = point_in_polygon(lat, lng, INDIA_BOUNDARY)
    in_andaman = point_in_polygon(lat, lng, ANDAMAN_BOUNDARY)
    in_lakshadweep = point_in_polygon(lat, lng, LAKSHADWEEP_BOUNDARY)
    in_diu = point_in_polygon(lat, lng, DIU_BOUNDARY)
    
    on_land = in_main or in_andaman or in_lakshadweep or in_diu
    
    if not on_land and not is_border_station(s):
        to_delete.append(s)

print(f'Total stations: {total}')
print(f'To delete (outside India polygon, not border): {len(to_delete)}')
print()

# Group by approximate area
from collections import Counter
areas = Counter()
for s in to_delete:
    areas[f'{round(s.location.y, 0):.0f}N, {round(s.location.x, 0):.0f}E'] += 1

print('Clusters to delete:')
for area, count in sorted(areas.items(), key=lambda x: -x[1]):
    print(f'  {area}: {count}')

print('\nStations to keep near borders:')
border_kept = [s for s in all_stations if not point_in_polygon(s.location.y, s.location.x, INDIA_BOUNDARY) and is_border_station(s)]
print(f'  Count: {len(border_kept)}')
for s in border_kept:
    print(f'  #{s.id}: {s.name} @ ({s.location.y:.4f}, {s.location.x:.4f}) [{s.address}]')

print()
if to_delete:
    confirm = os.environ.get('CONFIRM_DELETE', '')
    if confirm == 'yes':
        ids = [s.id for s in to_delete]
        ChargingStation.objects.filter(id__in=ids).delete()
        remaining = ChargingStation.objects.count()
        print(f'DELETED {len(ids)} stations. Remaining: {remaining}')
    else:
        print('Dry run. Set CONFIRM_DELETE=yes to actually delete.')
