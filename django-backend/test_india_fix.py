from stations.india_boundary import is_within_india

# Test: ocean stations that were deleted should now return False
ocean_samples = [
    (9.9573, 76.2079, 'Kochi sea'),
    (21.6377, 69.6331, 'Porbandar sea'),
    (19.0275, 72.8569, 'Mumbai sea'),
    (13.0266, 80.2869, 'Chennai sea'),
    (8.5376, 76.8975, 'Trivandrum sea'),
    (23.8324, 91.3101, 'Agartala land'),
    (27.5887, 91.8771, 'Tawang land'),
    (34.5568, 76.1240, 'Kargil land'),
]
for lat, lng, label in ocean_samples:
    result = "WITHIN" if is_within_india(lat, lng) else "OUTSIDE"
    print(f'  {label} ({lat:.4f}, {lng:.4f}): {result}')

# Test known good stations
print(f'  Kochi city center (9.9312, 76.2673): {"WITHIN" if is_within_india(9.9312, 76.2673) else "OUTSIDE"}')
print(f'  Bangalore (12.97, 77.59): {"WITHIN" if is_within_india(12.97, 77.59) else "OUTSIDE"}')
