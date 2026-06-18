"""Verify API still works and check station count."""
import requests, json

# Check stations through nginx proxy
r = requests.get('http://localhost:3000/api/stations/?limit=5')
print(f'Stations API status: {r.status_code}')
data = r.json()
if isinstance(data, dict):
    print(f'Count: {data.get("count", "N/A")}')
    results = data.get('results', data.get('data', []))
elif isinstance(data, list):
    print(f'Count: {len(data)}')
    results = data
else:
    results = []

print('Sample stations:')
for s in results[:3]:
    print(f'  #{s.get("id")}: {s.get("name", "?")} @ ({s.get("lat", "?"):.4f}, {s.get("lng", "?"):.4f})')
