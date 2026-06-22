import math
import random
import time
from collections import defaultdict

import requests
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from stations.models import ChargingStation, ChargingSlot
from users.models import CustomUser

OSRM_BASE = "https://router.project-osrm.org"
STATION_INTERVAL_KM = 40
PROXIMITY_DUP_KM = 1.0
SLOT_TYPE_RATES = {
    "AC_SLOW": (6.0, 9.0),
    "AC_FAST": (9.0, 13.0),
    "DC_FAST": (13.0, 17.0),
    "DC_ULTRA": (17.0, 22.0),
}

HIGHWAY_ROUTES = [
    ("NH-44 Srinagar→Jammu", (34.0837, 74.7973), (32.7266, 74.8570)),
    ("NH-44 Jammu→Delhi", (32.7266, 74.8570), (28.6139, 77.2090)),
    ("NH-44 Delhi→Agra", (28.6139, 77.2090), (27.1767, 78.0081)),
    ("NH-44 Agra→Jhansi", (27.1767, 78.0081), (25.4484, 78.5685)),
    ("NH-44 Jhansi→Nagpur", (25.4484, 78.5685), (21.1458, 79.0882)),
    ("NH-44 Nagpur→Hyderabad", (21.1458, 79.0882), (17.3850, 78.4867)),
    ("NH-44 Hyderabad→Bangalore", (17.3850, 78.4867), (12.9716, 77.5946)),
    ("NH-44 Bangalore→Salem", (12.9716, 77.5946), (11.6643, 78.1460)),
    ("NH-44 Salem→Madurai", (11.6643, 78.1460), (9.9252, 78.1198)),
    ("NH-44 Madurai→Kanyakumari", (9.9252, 78.1198), (8.0883, 77.5385)),
    ("NH-48 Delhi→Jaipur", (28.6139, 77.2090), (26.9124, 75.7873)),
    ("NH-48 Jaipur→Udaipur", (26.9124, 75.7873), (24.5854, 73.7125)),
    ("NH-48 Udaipur→Ahmedabad", (24.5854, 73.7125), (23.0225, 72.5714)),
    ("NH-48 Ahmedabad→Vadodara", (23.0225, 72.5714), (22.3072, 73.1812)),
    ("NH-48 Vadodara→Mumbai", (22.3072, 73.1812), (19.0760, 72.8777)),
    ("NH-48 Mumbai→Pune", (19.0760, 72.8777), (18.5204, 73.8567)),
    ("NH-48 Pune→Bangalore", (18.5204, 73.8567), (12.9716, 77.5946)),
    ("NH-48 Bangalore→Chennai", (12.9716, 77.5946), (13.0827, 80.2707)),
    ("NH-19 Delhi→Kanpur", (28.6139, 77.2090), (26.4499, 80.3319)),
    ("NH-19 Kanpur→Allahabad", (26.4499, 80.3319), (25.4358, 81.8463)),
    ("NH-19 Allahabad→Varanasi", (25.4358, 81.8463), (25.3176, 82.9739)),
    ("NH-19 Varanasi→Kolkata", (25.3176, 82.9739), (22.5726, 88.3639)),
    ("NH-16 Kolkata→Bhubaneswar", (22.5726, 88.3639), (20.2961, 85.8245)),
    ("NH-16 Bhubaneswar→Visakhapatnam", (20.2961, 85.8245), (17.6868, 83.2185)),
    ("NH-16 Visakhapatnam→Vijayawada", (17.6868, 83.2185), (16.5062, 80.6480)),
    ("NH-16 Vijayawada→Chennai", (16.5062, 80.6480), (13.0827, 80.2707)),
    ("NH-66 Mumbai→Panaji", (19.0760, 72.8777), (15.4909, 73.8278)),
    ("NH-66 Panaji→Mangalore", (15.4909, 73.8278), (12.9141, 74.8560)),
    ("NH-66 Mangalore→Kochi", (12.9141, 74.8560), (9.9312, 76.2673)),
    ("NH-66 Kochi→Kanyakumari", (9.9312, 76.2673), (8.0883, 77.5385)),
    ("NH-44 Pune→Hyderabad", (18.5204, 73.8567), (17.3850, 78.4867)),
    ("NH-65 Hyderabad→Vijayawada", (17.3850, 78.4867), (16.5062, 80.6480)),
    ("NH-47 Indore→Nagpur", (22.7196, 75.8577), (21.1458, 79.0882)),
    ("NH-46 Bhopal→Indore", (23.2599, 77.4126), (22.7196, 75.8577)),
    ("NH-27 Lucknow→Patna", (26.8467, 80.9462), (25.5941, 85.1376)),
    ("NH-27 Patna→Kolkata", (25.5941, 85.1376), (22.5726, 88.3639)),
    ("NH-154 Chandigarh→Leh", (30.7333, 76.7794), (34.1526, 77.5770)),
    ("NH-47 Ahmedabad→Indore", (23.0225, 72.5714), (22.7196, 75.8577)),
    ("NH-53 Nagpur→Raipur", (21.1458, 79.0882), (21.2514, 81.6296)),
    ("NH-27 Guwahati→Shillong", (26.1445, 91.7362), (25.5788, 91.8933)),
    ("NH-27 Guwahati→Silchar", (26.1445, 91.7362), (24.8274, 92.8007)),
    ("NH-62 Jodhpur→Bikaner", (26.2389, 73.0243), (28.0229, 73.3119)),
    ("NH-54 Amritsar→Chandigarh", (31.6340, 74.8723), (30.7333, 76.7794)),
    ("NH-44 Delhi→Chandigarh", (28.6139, 77.2090), (30.7333, 76.7794)),
    ("NH-19 Kolkata→Siliguri", (22.5726, 88.3639), (26.7271, 88.3953)),
    ("NH-66 Surat→Mumbai", (21.1702, 72.8311), (19.0760, 72.8777)),
    ("NH-27 Ahmedabad→Surat", (23.0225, 72.5714), (21.1702, 72.8311)),
    ("NH-30 Ranchi→Jamshedpur", (23.3441, 85.3096), (22.8046, 86.2029)),
    ("NH-77 Patna→Gorakhpur", (25.5941, 85.1376), (26.7606, 83.3732)),
    ("NH-31 Siliguri→Guwahati", (26.7271, 88.3953), (26.1445, 91.7362)),
    ("NH-44 Delhi→Dehradun", (28.6139, 77.2090), (30.3165, 78.0322)),
    ("NH-48 Jaipur→Jodhpur", (26.9124, 75.7873), (26.2389, 73.0243)),
    ("NH-65 Pune→Solapur", (18.5204, 73.8567), (17.6599, 75.9064)),
    ("NH-65 Solapur→Hyderabad", (17.6599, 75.9064), (17.3850, 78.4867)),
    ("NH-44 Bangalore→Mysore", (12.9716, 77.5946), (12.2958, 76.6394)),
    ("NH-544 Salem→Kochi", (11.6643, 78.1460), (9.9312, 76.2673)),
    ("NH-66 Mangalore→Bangalore", (12.9141, 74.8560), (12.9716, 77.5946)),
    ("NH-160 Mumbai→Aurangabad", (19.0760, 72.8777), (19.8762, 75.3433)),
]


def _random_rate(slot_type):
    lo, hi = SLOT_TYPE_RATES[slot_type]
    return round(random.uniform(lo, hi), 2)


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(
        dlng / 2
    ) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _fetch_osrm_route(lat1, lng1, lat2, lng2):
    url = f"{OSRM_BASE}/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?geometries=geojson&overview=full"
    try:
        resp = requests.get(url, timeout=60)
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("code") != "Ok":
            return None
        route = data["routes"][0]
        coords = route["geometry"]["coordinates"]
        distance_km = route["distance"] / 1000.0
        return [(c[1], c[0]) for c in coords], distance_km
    except Exception:
        return None


def _is_duplicate(lat, lng, existing):
    for elat, elng in existing:
        if _haversine_km(lat, lng, elat, elng) < PROXIMITY_DUP_KM:
            return True
    return False


def _extract_highway_number(name):
    parts = name.split()
    if parts:
        return parts[0]
    return "Highway"


class Command(BaseCommand):
    help = "Generates synthetic charging stations along major Indian highway corridors"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear", action="store_true", help="Delete existing highway-generated stations before generating"
        )
        parser.add_argument(
            "--interval",
            type=float,
            default=STATION_INTERVAL_KM,
            help=f"Distance between stations in km (default: {STATION_INTERVAL_KM})",
        )
        parser.add_argument(
            "--rate-limit",
            type=float,
            default=1.0,
            help="Seconds between OSRM API calls (default: 1.0)",
        )

    def handle(self, *args, **options):
        interval = options["interval"]
        rate_limit = options["rate_limit"]

        system_user, created = CustomUser.objects.get_or_create(
            username="kaggle_network",
            defaults={
                "role": "STATION_OWNER",
                "email": "kaggle-network@ecocharge.in",
                "phone_number": "1800-KAGGLE-01",
            },
        )
        if created:
            system_user.set_unusable_password()
            system_user.save()
            self.stdout.write(self.style.SUCCESS("Created system user: kaggle_network"))

        if options["clear"]:
            self.stdout.write("Deleting existing KAGGLE stations...")
            deleted, _ = ChargingStation.objects.filter(source="KAGGLE").delete()
            self.stdout.write(self.style.WARNING(f"Deleted {deleted} KAGGLE stations"))

        existing = [(cs.location.y, cs.location.x) for cs in ChargingStation.objects.only("location").iterator()]
        self.stdout.write(f"Loaded {len(existing)} existing stations for dedup")

        random.seed(42)
        total_created = 0
        total_skipped_dup = 0
        total_segments = 0
        route_counts = defaultdict(int)

        for route_name, (lat1, lng1), (lat2, lng2) in HIGHWAY_ROUTES:
            total_segments += 1
            self.stdout.write(f"\n[{total_segments}/{len(HIGHWAY_ROUTES)}] {route_name}...", ending=" ")
            self.stdout.flush()

            result = _fetch_osrm_route(lat1, lng1, lat2, lng2)
            if result is None:
                self.stdout.write(self.style.WARNING("OSRM FAILED"))
                if rate_limit > 0:
                    time.sleep(rate_limit)
                continue

            coords, distance_km = result
            self.stdout.write(f"{distance_km:.0f} km", ending=" ")

            if not coords or distance_km < 5:
                self.stdout.write(self.style.WARNING("too short"))
                continue

            cum_dist = 0.0
            prev_lat, prev_lng = coords[0]
            next_target = interval
            segment_created = 0
            segment_skipped = 0

            for i in range(1, len(coords)):
                clat, clng = coords[i]
                seg_dist = _haversine_km(prev_lat, prev_lng, clat, clng)
                cum_dist += seg_dist
                prev_lat, prev_lng = clat, clng

                while cum_dist >= next_target:
                    fraction = 1.0 - (cum_dist - next_target) / seg_dist if seg_dist > 0 else 0.5
                    f = max(0.0, min(1.0, fraction))
                    plat = prev_lat + f * (clat - prev_lat)
                    plng = prev_lng + f * (clng - prev_lng)

                    if _is_duplicate(plat, plng, existing):
                        segment_skipped += 1
                    else:
                        station_km = int(next_target)
                        highway = _extract_highway_number(route_name)
                        name = f"{highway} Highway Charger - Km {station_km}"[:200]
                        address = f"{highway} Highway, near Km {station_km}, India"

                        slot_type = "DC_FAST"
                        if station_km % 120 < 40:
                            slot_type = random.choice(["DC_FAST", "DC_ULTRA"])
                        elif station_km % 120 >= 80:
                            slot_type = random.choice(["AC_FAST", "DC_FAST"])

                        station = ChargingStation(
                            name=name,
                            owner=system_user,
                            location=Point(plng, plat, srid=4326),
                            address=address,
                            amenities=[],
                            status="ACTIVE",
                            source="KAGGLE",
                            ocm_id=None,
                        )
                        station.save()
                        rate = _random_rate(slot_type)
                        ChargingSlot.objects.create(
                            station=station,
                            slot_type=slot_type,
                            status="AVAILABLE",
                            rate_per_kwh=rate,
                            off_peak_rate=round(rate * 0.7, 2),
                        )
                        existing.append((plat, plng))
                        segment_created += 1

                    next_target += interval

            total_created += segment_created
            total_skipped_dup += segment_skipped
            route_counts[route_name.split()[0]] += segment_created

            self.stdout.write(
                f"→ {segment_created} created, {segment_skipped} skipped (dup)"
            )

            if rate_limit > 0:
                time.sleep(rate_limit)

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("HIGHWAY STATION GENERATION COMPLETE"))
        self.stdout.write(f"  Segments processed:     {total_segments}")
        self.stdout.write(f"  Stations created:       {total_created}")
        self.stdout.write(f"  Skipped (duplicate):    {total_skipped_dup}")
        self.stdout.write(f"\n  By highway:")
        for hwy, cnt in sorted(route_counts.items(), key=lambda x: -x[1]):
            self.stdout.write(f"    {hwy}: {cnt}")
        total_kaggle = ChargingStation.objects.filter(source="KAGGLE").count()
        total_ocm = ChargingStation.objects.filter(source="OCM").count()
        self.stdout.write(f"\n  Total KAGGLE stations:  {total_kaggle}")
        self.stdout.write(f"  Total OCM stations:     {total_ocm}")
        self.stdout.write(f"  Total all:              {total_kaggle + total_ocm}")
        self.stdout.write("=" * 60)
