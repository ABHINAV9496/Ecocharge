"""Check which cities are outside the India polygon."""
import os, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()

from stations.indian_cities import CITIES
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

outside_cities = []
for name, lat, lng, state, tier in CITIES:
    in_main = point_in_polygon(lat, lng, INDIA_BOUNDARY)
    in_andaman = point_in_polygon(lat, lng, ANDAMAN_BOUNDARY)
    in_lakshadweep = point_in_polygon(lat, lng, LAKSHADWEEP_BOUNDARY)
    in_diu = point_in_polygon(lat, lng, DIU_BOUNDARY)
    on_land = in_main or in_andaman or in_lakshadweep or in_diu
    if not on_land:
        outside_cities.append((name, lat, lng, state, tier))

print(f'Cities outside India polygon: {len(outside_cities)}')
for name, lat, lng, state, tier in outside_cities:
    print(f'  {name:25s} ({lat:.4f}, {lng:.4f}) {state} tier={tier}')
