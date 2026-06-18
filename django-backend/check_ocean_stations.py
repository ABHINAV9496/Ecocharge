"""
Find stations that are in the ocean (outside India's main land polygon
but slipped through due to the 50 km city-proximity fallback).
"""
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
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

all_stations = ChargingStation.objects.all().only('id', 'name', 'location', 'status', 'address')
print(f'Total stations: {all_stations.count()}\n')

in_main = 0
in_andaman = 0
in_lakshadweep = 0
in_diu = 0
not_in_any = 0

ocean_stations = []

for s in all_stations:
    lat = s.location.y
    lng = s.location.x
    in_main_ = point_in_polygon(lat, lng, INDIA_BOUNDARY)
    in_andaman_ = point_in_polygon(lat, lng, ANDAMAN_BOUNDARY)
    in_lakshadweep_ = point_in_polygon(lat, lng, LAKSHADWEEP_BOUNDARY)
    in_diu_ = point_in_polygon(lat, lng, DIU_BOUNDARY)
    
    if in_main_: in_main += 1
    elif in_andaman_: in_andaman += 1
    elif in_lakshadweep_: in_lakshadweep += 1
    elif in_diu_: in_diu += 1
    else: 
        not_in_any += 1
        ocean_stations.append((s.id, s.name, lat, lng, s.status, s.address))

print(f'Within main India polygon: {in_main}')
print(f'Within Andaman polygon: {in_andaman}')
print(f'Within Lakshadweep polygon: {in_lakshadweep}')
print(f'Within Diu polygon: {in_diu}')
print(f'Outside all (likely ocean): {not_in_any}\n')

# Group by approximate area to understand clusters
from collections import Counter
areas = Counter()
for sid, name, lat, lng, status, addr in ocean_stations:
    area_key = f'{round(lat, 0):.0f}N, {round(lng, 0):.0f}E'
    areas[area_key] += 1

print('Clusters of ocean stations:')
for area, count in sorted(areas.items(), key=lambda x: -x[1]):
    print(f'  {area}: {count}')

print(f'\n=== All {len(ocean_stations)} ocean stations ===')
for sid, name, lat, lng, status, addr in ocean_stations:
    print(f'  #{sid}: {name} @ ({lat:.4f}, {lng:.4f}) [{addr}] status={status}')
