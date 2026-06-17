import math
import random
from stations.indian_cities import CITIES
from stations.india_boundary import is_within_india

BRANDS = [
    "Tata Power EZ Charge",
    "ChargeZone",
    "Statiq",
    "Ather Grid",
    "Zeon Charging",
    "BPCL Energy Station",
    "HPCL EV",
    "Jio-bp Pulse",
    "BOLT",
    "EcoCharge Hub",
]

AMENITY_COMBOS = [
    ["WiFi", "Cafe", "Parking"],
    ["Restroom", "Parking"],
    ["WiFi", "Restroom", "Parking", "Lounge"],
    ["Restroom", "Cafe", "Parking"],
    ["Restroom", "Cafe", "ATM", "Parking"],
    ["WiFi", "Restroom", "Cafe", "Parking", "Convenience Store"],
    ["Restroom", "Parking", "Convenience Store"],
    ["Cafe", "Parking"],
    ["WiFi", "Restroom", "Cafe", "ATM", "Parking", "EV Spare Parts"],
    ["Restroom", "ATM", "Parking"],
    ["WiFi", "Cafe", "Parking", "Lounge"],
    ["Restroom", "Cafe", "Parking", "Convenience Store"],
    ["Restroom", "Parking", "Lounge"],
    ["WiFi", "Restroom", "Parking"],
    ["Restroom", "Cafe", "Parking", "ATM"],
]

CITY_SLOT_PATTERNS = [
    ["DC_FAST", "DC_FAST", "AC_FAST", "AC_SLOW"],
    ["AC_FAST", "AC_SLOW", "AC_SLOW"],
    ["DC_FAST", "DC_FAST", "DC_ULTRA", "AC_FAST"],
    ["DC_FAST", "AC_FAST", "AC_FAST", "AC_SLOW"],
    ["DC_FAST", "DC_FAST", "DC_FAST", "AC_FAST"],
    ["DC_FAST", "DC_FAST", "AC_FAST", "AC_FAST", "AC_SLOW"],
    ["AC_FAST", "AC_FAST", "AC_SLOW"],
    ["DC_ULTRA", "DC_FAST", "DC_FAST", "AC_FAST"],
]

HIGHWAY_SLOT_PATTERNS = [
    ["DC_FAST", "DC_FAST", "DC_ULTRA", "AC_FAST"],
    ["DC_FAST", "DC_FAST", "DC_FAST", "DC_ULTRA", "AC_FAST"],
    ["DC_FAST", "DC_ULTRA", "AC_FAST", "AC_FAST"],
    ["DC_FAST", "DC_FAST", "DC_FAST", "AC_FAST"],
    ["DC_ULTRA", "DC_ULTRA", "DC_FAST", "AC_FAST"],
    ["DC_FAST", "DC_FAST", "DC_FAST", "DC_FAST", "DC_ULTRA"],
    ["DC_FAST", "DC_FAST", "AC_FAST", "AC_FAST", "AC_SLOW"],
]

SUFFIXES = ["Hub", "Station", "Point", "Plaza", "Charger", "Lounge", "Pavilion"]


def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _interpolate(lat1, lon1, lat2, lon2, fraction):
    return (lat1 + (lat2 - lat1) * fraction, lon1 + (lon2 - lon1) * fraction)


def _offset(lat, lng, radius_km):
    angle = random.uniform(0, 2 * math.pi)
    dist = random.uniform(0.3, radius_km)
    dlat = dist / 111.0
    dlng = dist / (111.0 * abs(math.cos(math.radians(lat))) + 0.01)
    return lat + dlat * math.cos(angle), lng + dlng * math.sin(angle)


def _station_meta(city_name, state, tier):
    brand = random.choice(BRANDS)
    suffix = random.choice(SUFFIXES)
    name = f"{brand} - {city_name} {suffix}"
    slot_pool = CITY_SLOT_PATTERNS if tier <= 2 else HIGHWAY_SLOT_PATTERNS
    return name, slot_pool


def generate_city_clusters():
    random.seed(42)
    stations = []

    cfg = {
        1: {"n": (14, 18), "radius": 8.0},
        2: {"n": (8, 12), "radius": 5.0},
        3: {"n": (4, 7), "radius": 3.0},
        4: {"n": (2, 4), "radius": 2.0},
    }

    for city_name, lat, lng, state, tier in CITIES:
        n_stations = random.randint(*cfg[tier]["n"])
        radius = cfg[tier]["radius"]
        for _ in range(n_stations):
            olat, olng = _offset(lat, lng, radius)
            if not is_within_india(olat, olng):
                continue
            name, slot_pool = _station_meta(city_name, state, tier)
            stations.append({
                "name": name,
                "lat": round(olat, 5),
                "lng": round(olng, 5),
                "address": f"{city_name}, {state}",
                "amenities": random.choice(AMENITY_COMBOS),
                "status": "MAINTENANCE" if random.random() < 0.05 else "ACTIVE",
                "slot_types": random.choice(slot_pool),
                "city": city_name,
                "state": state,
                "tier": tier,
            })
    return stations


def generate_connectors():
    random.seed(43)
    stations = []

    INTERVAL_KM = 50
    MAX_KM = 300
    MIN_KM = 40
    connected = set()

    for i, (n1, lt1, ln1, s1, t1) in enumerate(CITIES):
        max_nbrs = 3 if t1 <= 2 else 2 if t1 == 3 else 0
        neighbors = []
        for j, (n2, lt2, ln2, s2, t2) in enumerate(CITIES):
            if i >= j:
                continue
            if (min(i, j), max(i, j)) in connected:
                continue
            d = _haversine(lt1, ln1, lt2, ln2)
            if MIN_KM <= d <= MAX_KM:
                neighbors.append((d, j, n2, lt2, ln2, s2))
        neighbors.sort()
        for d, j, n2, lt2, ln2, s2 in neighbors[:max_nbrs]:
            pk = (min(i, j), max(i, j))
            if pk in connected:
                continue
            connected.add(pk)

            n_wp = max(1, int(d / INTERVAL_KM))
            for wp in range(n_wp):
                frac = (wp + 1) / (n_wp + 1)
                wlat, wlng = _interpolate(lt1, ln1, lt2, ln2, frac)
                wlat += random.uniform(-0.025, 0.025)
                wlng += random.uniform(-0.025, 0.025)

                if not is_within_india(wlat, wlng):
                    continue
                brand = random.choice(BRANDS)
                suffix = random.choice(SUFFIXES)
                name = f"{brand} - {n1}-{n2} {suffix}"
                stations.append({
                    "name": name,
                    "lat": round(wlat, 5),
                    "lng": round(wlng, 5),
                    "address": f"Corridor {n1} - {n2}",
                    "amenities": random.choice(AMENITY_COMBOS),
                    "status": "MAINTENANCE" if random.random() < 0.05 else "ACTIVE",
                    "slot_types": random.choice(HIGHWAY_SLOT_PATTERNS),
                    "road": f"{n1}>{n2}",
                })
    return stations


def generate_sparse_grid():
    random.seed(44)
    stations = []

    lats = [c[1] for c in CITIES]
    lngs = [c[2] for c in CITIES]
    min_lat, max_lat = min(lats), max(lats)
    min_lng, max_lng = min(lngs), max(lngs)

    step = 0.5
    grid_lat = min_lat
    while grid_lat <= max_lat:
        grid_lng = min_lng
        while grid_lng <= max_lng:
            dists = [_haversine(grid_lat, grid_lng, clat, clng) for _, clat, clng, _, _ in CITIES]
            nearest = min(dists)
            if 30 <= nearest <= 70 and random.random() < 0.3:
                if not is_within_india(grid_lat, grid_lng):
                    continue
                brand = random.choice(BRANDS)
                suffix = random.choice(SUFFIXES)
                name = f"{brand} - Rural {suffix}"
                stations.append({
                    "name": name,
                    "lat": round(grid_lat, 4),
                    "lng": round(grid_lng, 4),
                    "address": f"Grid point {grid_lat:.2f},{grid_lng:.2f}",
                    "amenities": random.choice(AMENITY_COMBOS),
                    "status": "MAINTENANCE" if random.random() < 0.05 else "ACTIVE",
                    "slot_types": random.choice(HIGHWAY_SLOT_PATTERNS),
                })
            grid_lng += step
        grid_lat += step

    return stations


def generate_all_stations():
    return generate_city_clusters() + generate_connectors() + generate_sparse_grid()
