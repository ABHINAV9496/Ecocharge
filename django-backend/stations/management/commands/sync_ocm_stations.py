import json
import math
import os
import random
import time
from collections import defaultdict
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError

from stations.india_boundary import is_on_indian_landmass
from stations.models import ChargingSlot, ChargingStation
from users.models import CustomUser

OCM_BASE_URL = 'https://api.openchargemap.io/v3/poi/'

CITIES = [
    ("Kochi", 9.9312, 76.2673),
    ("Kozhikode", 11.2588, 75.7804),
    ("Thiruvananthapuram", 8.5241, 76.9366),
    ("Thrissur", 10.5276, 76.2144),
    ("Kollam", 8.8932, 76.6141),
    ("Kannur", 11.8745, 75.3704),
    ("Palakkad", 10.7707, 76.6498),
    ("Malappuram", 11.0510, 76.0711),
    ("Wayanad", 11.6854, 76.1320),
    ("Idukki", 9.9189, 77.1025),
    ("Bangalore", 12.9716, 77.5946),
    ("Mysore", 12.2958, 76.6394),
    ("Mangalore", 12.9141, 74.8560),
    ("Hubli", 15.3647, 75.1240),
    ("Belgaum", 15.8497, 74.4977),
    ("Shimoga", 13.9299, 75.5681),
    ("Hassan", 13.0067, 76.0960),
    ("Tumkur", 13.3392, 77.1010),
    ("Udupi", 13.3409, 74.7421),
    ("Chennai", 13.0827, 80.2707),
    ("Coimbatore", 11.0168, 76.9558),
    ("Madurai", 9.9252, 78.1198),
    ("Salem", 11.6643, 78.1460),
    ("Trichy", 10.7905, 78.7047),
    ("Vellore", 12.9165, 79.1325),
    ("Tirunelveli", 8.7139, 77.7567),
    ("Erode", 11.3410, 77.7172),
    ("Tiruppur", 11.1085, 77.3411),
    ("Mumbai", 19.0760, 72.8777),
    ("Pune", 18.5204, 73.8567),
    ("Nagpur", 21.1458, 79.0882),
    ("Nashik", 19.9975, 73.7898),
    ("Aurangabad", 19.8762, 75.3433),
    ("Solapur", 17.6599, 75.9064),
    ("Kolhapur", 16.7050, 74.2433),
    ("Thane", 19.2183, 72.9781),
    ("Navi Mumbai", 19.0330, 73.0297),
    ("New Delhi", 28.6139, 77.2090),
    ("Noida", 28.5355, 77.3910),
    ("Gurugram", 28.4595, 77.0266),
    ("Faridabad", 28.4089, 77.3178),
    ("Ghaziabad", 28.6692, 77.4538),
    ("Hyderabad", 17.3850, 78.4867),
    ("Visakhapatnam", 17.6868, 83.2185),
    ("Vijayawada", 16.5062, 80.6480),
    ("Tirupati", 13.6288, 79.4192),
    ("Guntur", 16.3067, 80.4365),
    ("Ahmedabad", 23.0225, 72.5714),
    ("Surat", 21.1702, 72.8311),
    ("Vadodara", 22.3072, 73.1812),
    ("Rajkot", 22.3039, 70.8022),
    ("Gandhinagar", 23.2156, 72.6369),
    ("Jaipur", 26.9124, 75.7873),
    ("Jodhpur", 26.2389, 73.0243),
    ("Udaipur", 24.5854, 73.7125),
    ("Kota", 25.2138, 75.8648),
    ("Ajmer", 26.4499, 74.6399),
    ("Kolkata", 22.5726, 88.3639),
    ("Howrah", 22.5958, 88.2636),
    ("Durgapur", 23.5204, 87.3119),
    ("Siliguri", 26.7271, 88.3953),
    ("Lucknow", 26.8467, 80.9462),
    ("Kanpur", 26.4499, 80.3319),
    ("Agra", 27.1767, 78.0081),
    ("Varanasi", 25.3176, 82.9739),
    ("Allahabad", 25.4358, 81.8463),
    ("Chandigarh", 30.7333, 76.7794),
    ("Ludhiana", 30.9010, 75.8573),
    ("Amritsar", 31.6340, 74.8723),
    ("Jalandhar", 31.3260, 75.5762),
    ("Indore", 22.7196, 75.8577),
    ("Bhopal", 23.2599, 77.4126),
    ("Jabalpur", 23.1815, 79.9864),
    ("Gwalior", 26.2183, 78.1828),
    ("Bhubaneswar", 20.2961, 85.8245),
    ("Cuttack", 20.4625, 85.8830),
    ("Guwahati", 26.1445, 91.7362),
    ("Warangal", 17.9784, 79.5941),
    ("Karimnagar", 18.4386, 79.1288),
    ("Panaji", 15.4909, 73.8278),
    ("Margao", 15.2832, 73.9862),
    ("Vasco da Gama", 15.3960, 73.8159),
]

CONNECTION_TYPE_MAP = {
    1: "AC_SLOW",
    2: "AC_SLOW",
    3: "DC_FAST",
    25: "AC_FAST",
    26: "DC_FAST",
    27: "DC_ULTRA",
    30: "DC_FAST",
    32: "DC_FAST",
    33: "DC_FAST",
    1036: "DC_FAST",
    1037: "DC_FAST",
}

SLOT_TYPE_RATES = {
    "AC_SLOW": (8.0, 12.0),
    "AC_FAST": (12.0, 18.0),
    "DC_FAST": (20.0, 30.0),
    "DC_ULTRA": (25.0, 35.0),
}


def _random_rate(slot_type):
    lo, hi = SLOT_TYPE_RATES[slot_type]
    return round(random.uniform(lo, hi), 2)


def _map_slot_type(connection_type_id, power_kw):
    if power_kw and power_kw >= 100:
        return "DC_ULTRA"
    if connection_type_id in CONNECTION_TYPE_MAP:
        return CONNECTION_TYPE_MAP[connection_type_id]
    if power_kw:
        if power_kw >= 100:
            return "DC_ULTRA"
        if power_kw >= 30:
            return "DC_FAST"
        if power_kw >= 7:
            return "AC_FAST"
        return "AC_SLOW"
    return "AC_FAST"


def _map_status(status_type_id):
    if status_type_id in (50, 75, 100):
        return "ACTIVE"
    if status_type_id == 200:
        return "MAINTENANCE"
    return "ACTIVE"


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(
        dlng / 2
    ) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _fetch_ocm_city(api_key, city_name, lat, lng):
    params = (
        f"output=json"
        f"&countrycode=IN"
        f"&latitude={lat}"
        f"&longitude={lng}"
        f"&distance=30"
        f"&distanceunit=km"
        f"&maxresults=100"
        f"&compact=true"
        f"&verbose=false"
        f"&key={api_key}"
    )
    url = OCM_BASE_URL + "?" + params
    req = Request(url, headers={"User-Agent": "EcoCharge/1.0"})
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except HTTPError as e:
        print(f"  HTTP error for {city_name}: {e.code} {e.reason}")
        return None
    except URLError as e:
        print(f"  Network error for {city_name}: {e.reason}")
        return None
    except json.JSONDecodeError:
        print(f"  Invalid JSON response for {city_name}")
        return None


class Command(BaseCommand):
    help = "Syncs EV charging station data from Open Charge Map (OCM) API"

    def add_arguments(self, parser):
        parser.add_argument("--api-key", type=str, help="OCM API key (defaults to OCM_API_KEY env/setting)")
        parser.add_argument("--clear", action="store_true", help="Delete existing OCM stations before re-syncing")
        parser.add_argument(
            "--cities",
            type=str,
            help="Comma-separated list of city names to sync (default: all configured cities)",
        )

    def handle(self, *args, **options):
        api_key = options["api_key"] or getattr(settings, "OCM_API_KEY", None) or os.environ.get("OCM_API_KEY")
        if not api_key:
            raise CommandError("OCM API key required. Provide --api-key or set OCM_API_KEY in .env")

        system_user, created = CustomUser.objects.get_or_create(
            username="ocm_network",
            defaults={
                "role": "STATION_OWNER",
                "email": "ocm-network@ecocharge.in",
                "phone_number": "1800-OCM-0001",
            },
        )
        if created:
            system_user.set_unusable_password()
            system_user.save()
            self.stdout.write(self.style.SUCCESS("Created system user: ocm_network"))

        if options["clear"]:
            self.stdout.write("Deleting existing OCM stations...")
            deleted, _ = ChargingStation.objects.filter(source="OCM").delete()
            self.stdout.write(self.style.WARNING(f"Deleted {deleted} OCM stations"))

        city_filter = None
        if options["cities"]:
            city_filter = {c.strip().lower() for c in options["cities"].split(",")}

        cities_to_sync = [(n, la, lo) for n, la, lo in CITIES if not city_filter or n.lower() in city_filter]
        self.stdout.write(f"Syncing {len(cities_to_sync)} cities...\n")

        random.seed(42)
        total_created = 0
        total_updated = 0
        total_skipped_dup = 0
        total_skipped_bounds = 0
        total_ocm_slots = 0
        city_counts = defaultdict(int)
        slot_type_counts = defaultdict(int)
        api_calls = 0

        for city_name, lat, lng in cities_to_sync:
            self.stdout.write(f"Fetching stations for {city_name}...", ending=" ")
            self.stdout.flush()

            if api_calls > 0:
                time.sleep(0.5)
            data = _fetch_ocm_city(api_key, city_name, lat, lng)
            api_calls += 1

            if data is None:
                self.stdout.write(self.style.WARNING("SKIPPED (API error)"))
                continue

            if not isinstance(data, list):
                self.stdout.write(self.style.WARNING(f"SKIPPED (unexpected response type: {type(data).__name__})"))
                continue

            self.stdout.write(f"found {len(data)} stations")
            city_created = 0
            city_updated = 0
            city_skipped_dup = 0
            city_skipped_bounds = 0

            for raw in data:
                addr_info = raw.get("AddressInfo", {}) or {}
                station_name = addr_info.get("Title") or f"Charging Station - {city_name}"
                station_lat = addr_info.get("Latitude")
                station_lng = addr_info.get("Longitude")
                if not station_lat or not station_lng:
                    city_skipped_dup += 1
                    continue

                if not is_on_indian_landmass(station_lat, station_lng):
                    city_skipped_bounds += 1
                    continue

                address = ", ".join(
                    filter(
                        None,
                        [
                            addr_info.get("AddressLine1") or "",
                            addr_info.get("Town") or "",
                            addr_info.get("StateOrProvince") or "",
                        ],
                    )
                ) or f"{city_name}, India"

                status = _map_status(raw.get("StatusTypeID"))
                ocm_id = raw.get("ID")

                connections = raw.get("Connections") or []
                if not isinstance(connections, list):
                    connections = []

                station_data = {
                    "name": station_name[:200],
                    "owner": system_user,
                    "location": Point(float(station_lng), float(station_lat), srid=4326),
                    "address": address,
                    "amenities": [],
                    "status": status,
                    "source": "OCM",
                    "ocm_id": ocm_id,
                }

                try:
                    existing = None
                    if ocm_id:
                        existing = ChargingStation.objects.filter(ocm_id=ocm_id).first()

                    if not existing:
                        close_stations = ChargingStation.objects.filter(
                            location__distance_lte=(Point(float(station_lng), float(station_lat), srid=4326), 0.12)
                        )
                        if close_stations.exists():
                            existing = close_stations.first()

                    if existing:
                        for attr, val in station_data.items():
                            if attr != "ocm_id":
                                setattr(existing, attr, val)
                        existing.save()
                        station_obj = existing
                        city_updated += 1
                    else:
                        station_obj = ChargingStation.objects.create(**station_data)
                        city_created += 1

                    existing_slot_types = set(
                        ChargingSlot.objects.filter(station=station_obj).values_list("slot_type", flat=True)
                    )

                    for conn in connections:
                        conn_type_id = conn.get("ConnectionTypeID")
                        power_kw = conn.get("PowerKW")
                        slot_type = _map_slot_type(conn_type_id, power_kw)
                        if slot_type not in existing_slot_types:
                            rate = _random_rate(slot_type)
                            ChargingSlot.objects.create(
                                station=station_obj,
                                slot_type=slot_type,
                                status="AVAILABLE",
                                rate_per_kwh=rate,
                                off_peak_rate=round(rate * 0.7, 2),
                            )
                            total_ocm_slots += 1
                            slot_type_counts[slot_type] += 1

                    if not connections:
                        if "AC_FAST" not in existing_slot_types:
                            rate = _random_rate("AC_FAST")
                            ChargingSlot.objects.create(
                                station=station_obj,
                                slot_type="AC_FAST",
                                status="AVAILABLE",
                                rate_per_kwh=rate,
                                off_peak_rate=round(rate * 0.7, 2),
                            )
                            total_ocm_slots += 1
                            slot_type_counts["AC_FAST"] += 1

                    city_counts[city_name] += 1

                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"  Error processing station '{station_name}': {e}"))
                    continue

            total_created += city_created
            total_updated += city_updated
            total_skipped_dup += city_skipped_dup
            total_skipped_bounds += city_skipped_bounds
            self.stdout.write(
                f"  → Created {city_created}, Updated {city_updated}, "
                f"Skipped {city_skipped_dup} (no coords) + {city_skipped_bounds} (out of bounds)"
            )

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("OCM SYNC COMPLETE"))
        self.stdout.write(f"  API calls made:         {api_calls}")
        self.stdout.write(f"  Cities synced:          {len(cities_to_sync)}")
        self.stdout.write(f"  Stations created:       {total_created}")
        self.stdout.write(f"  Stations updated:       {total_updated}")
        self.stdout.write(f"  Skipped (no coords):    {total_skipped_dup}")
        self.stdout.write(f"  Skipped (out of bounds): {total_skipped_bounds}")
        self.stdout.write(f"  Slots created:          {total_ocm_slots}")
        self.stdout.write("\n  Top cities:")
        for city, cnt in sorted(city_counts.items(), key=lambda x: -x[1])[:10]:
            self.stdout.write(f"    {city}: {cnt}")
        self.stdout.write("\n  Slot type breakdown:")
        for st, cnt in sorted(slot_type_counts.items(), key=lambda x: -x[1]):
            self.stdout.write(f"    {st}: {cnt}")
        total_ocm = ChargingStation.objects.filter(source="OCM").count()
        total_eco = ChargingStation.objects.filter(source="ECOCHARGE").count()
        self.stdout.write(f"\n  Total OCM stations:     {total_ocm}")
        self.stdout.write(f"  Total ECOCHARGE:        {total_eco}")
        self.stdout.write("=" * 60)
