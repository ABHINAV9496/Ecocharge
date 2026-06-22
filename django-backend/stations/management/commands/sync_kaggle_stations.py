import csv
import io
import math
import os
import random
import tempfile
from collections import defaultdict

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from stations.models import ChargingStation, ChargingSlot
from users.models import CustomUser

try:
    import kagglehub
except ImportError:
    kagglehub = None

DATASETS = [
    ("saketpradhan/electric-vehicle-charging-stations-in-india", "ev-charging-stations-india.csv"),
    ("pranjal9091/ev-charging-stations-in-india-simplified-2025", "Indian_EV_Stations_Simplified.csv"),
]

SLOT_TYPE_RATES = {
    "AC_SLOW": (6.0, 9.0),
    "AC_FAST": (9.0, 13.0),
    "DC_FAST": (13.0, 17.0),
    "DC_ULTRA": (17.0, 22.0),
}

CONNECTOR_TYPE_MAP = {
    "ccs": "DC_FAST",
    "ccs2": "DC_FAST",
    "type 2": "AC_FAST",
    "type2": "AC_FAST",
    "type-2": "AC_FAST",
    "chademo": "DC_FAST",
    "gb/t": "DC_FAST",
    "gbt": "DC_FAST",
    "type 1": "AC_SLOW",
    "type1": "AC_SLOW",
    "type-1": "AC_SLOW",
    "ac 001": "AC_SLOW",
    "ac 003": "AC_SLOW",
    "ac 007": "AC_FAST",
    "ac 050": "DC_FAST",
    "dc 001": "DC_FAST",
    "dc 002": "DC_FAST",
    "dc 050": "DC_FAST",
    "dc 100": "DC_ULTRA",
}


def _random_rate(slot_type):
    lo, hi = SLOT_TYPE_RATES[slot_type]
    return round(random.uniform(lo, hi), 2)


def _map_slot_type(connector_type_str, power_kw=None):
    if not connector_type_str:
        if power_kw:
            pw = float(power_kw)
            if pw >= 100:
                return "DC_ULTRA"
            if pw >= 50:
                return "DC_FAST"
            if pw >= 7:
                return "AC_FAST"
            if pw > 0:
                return "AC_SLOW"
        return "AC_FAST"

    ct = connector_type_str.lower().strip()
    for key, slot_type in CONNECTOR_TYPE_MAP.items():
        if key in ct:
            return slot_type
    if power_kw:
        pw = float(power_kw)
        if pw >= 100:
            return "DC_ULTRA"
        if pw >= 50:
            return "DC_FAST"
        if pw >= 7:
            return "AC_FAST"
        if pw > 0:
            return "AC_SLOW"
    return "AC_FAST"


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(
        dlng / 2
    ) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _flex_get(row, *keys):
    for key in keys:
        if key in row:
            val = (row[key] or "").strip()
            if val:
                return val
    for k, v in row.items():
        kl = k.lower().strip()
        for search in keys:
            if search.lower() in kl:
                val = (v or "").strip()
                if val:
                    return val
    return ""


def _is_duplicate(lat, lng, existing_stations):
    for existing_lat, existing_lng, _ in existing_stations["by_location"]:
        if _haversine_km(lat, lng, existing_lat, existing_lng) < 0.5:
            return True
    return False


class Command(BaseCommand):
    help = "Imports EV charging stations from Kaggle datasets"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear", action="store_true", help="Delete existing KAGGLE-source stations before importing"
        )

    def handle(self, *args, **options):
        if kagglehub is None:
            raise CommandError("kagglehub not installed. Run: pip install kagglehub")

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
            self.stdout.write("Deleting existing KAGGLE-source stations...")
            deleted, _ = ChargingStation.objects.filter(source="KAGGLE").delete()
            self.stdout.write(self.style.WARNING(f"Deleted {deleted} KAGGLE stations"))

        existing_locations = [
            (cs.location.y, cs.location.x, cs.source)
            for cs in ChargingStation.objects.only("location", "source").iterator()
        ]

        existing_stations = {"by_location": existing_locations}

        total_created = 0
        total_skipped_dup = 0
        total_skipped_no_coords = 0
        total_skipped_error = 0
        total_slots = 0
        slot_type_counts = defaultdict(int)

        random.seed(42)

        for dataset_id, csv_filename in DATASETS:
            self.stdout.write(f"\nDownloading {dataset_id}...")
            self.stdout.flush()

            try:
                download_path = kagglehub.dataset_download(dataset_id)
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"  Failed to download {dataset_id}: {e}"))
                continue

            csv_path = os.path.join(download_path, csv_filename)
            if not os.path.exists(csv_path):
                self.stdout.write(self.style.WARNING(f"  CSV not found at {csv_path}, searching..."))
                for root, _dirs, files in os.walk(download_path):
                    for f in files:
                        if f.endswith(".csv"):
                            csv_path = os.path.join(root, f)
                            self.stdout.write(f"  Found: {csv_path}")
                            break
                    if os.path.exists(csv_path):
                        break

            if not os.path.exists(csv_path):
                self.stdout.write(self.style.WARNING(f"  No CSV found for {dataset_id}"))
                continue

            with open(csv_path, encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                rows = list(reader)

            self.stdout.write(f"  Loaded {len(rows)} rows from {csv_filename}")

            batch = []
            batch_size = 200
            dataset_created = 0
            dataset_skipped_dup = 0
            dataset_skipped_no_coords = 0
            dataset_skipped_error = 0

            for i, row in enumerate(rows):
                lat_str = _flex_get(row, "latitude", "Latitude", "lattitude", "lat")
                lng_str = _flex_get(row, "longitude", "Longitude", "lon", "lng")
                if not lat_str or not lng_str:
                    dataset_skipped_no_coords += 1
                    continue

                try:
                    lat = float(lat_str)
                    lng = float(lng_str)
                except (ValueError, TypeError):
                    dataset_skipped_no_coords += 1
                    continue

                if _is_duplicate(lat, lng, existing_stations):
                    dataset_skipped_dup += 1
                    continue

                name = _flex_get(row, "Station Name", "name", "Name")[:200] or "Charging Station"
                city = _flex_get(row, "city", "City")
                state = _flex_get(row, "state", "State")
                address = _flex_get(row, "address", "Address")

                if not address:
                    address_parts = [p for p in [city, state] if p]
                    address = ", ".join(address_parts) if address_parts else "India"
                if not address:
                    address = "India"

                connector_type = _flex_get(row, "Connector Type", "type", "connector_type", "ConnectionType")
                power_kw_str = _flex_get(row, "Power (kW)", "power", "power_kw", "PowerKW")

                try:
                    power_kw = float(power_kw_str) if power_kw_str else None
                except (ValueError, TypeError):
                    power_kw = None

                slot_type = _map_slot_type(connector_type, power_kw)

                station_data = {
                    "name": name,
                    "owner": system_user,
                    "location": Point(float(lng), float(lat), srid=4326),
                    "address": address,
                    "amenities": [],
                    "status": "ACTIVE",
                    "source": "KAGGLE",
                    "ocm_id": None,
                }

                station = ChargingStation(**station_data)
                batch.append((station, slot_type))
                existing_stations["by_location"].append((lat, lng, "KAGGLE"))

                if len(batch) >= batch_size:
                    created, slots = self._flush_batch(batch, slot_type_counts)
                    dataset_created += created
                    total_slots += slots
                    batch = []

            if batch:
                created, slots = self._flush_batch(batch, slot_type_counts)
                dataset_created += created
                total_slots += slots

            total_created += dataset_created
            total_skipped_dup += dataset_skipped_dup
            total_skipped_no_coords += dataset_skipped_no_coords
            total_skipped_error += dataset_skipped_error

            self.stdout.write(
                f"  → Created {dataset_created}, Skipped {dataset_skipped_dup} dup + "
                f"{dataset_skipped_no_coords} no-coords + {dataset_skipped_error} error"
            )

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("KAGGLE IMPORT COMPLETE"))
        self.stdout.write(f"  Stations imported:      {total_created}")
        self.stdout.write(f"  Slots created:          {total_slots}")
        self.stdout.write(f"  Skipped (duplicate):    {total_skipped_dup}")
        self.stdout.write(f"  Skipped (no coords):    {total_skipped_no_coords}")
        self.stdout.write(f"  Skipped (error):        {total_skipped_error}")
        self.stdout.write(f"  Slot type breakdown:")
        for st, cnt in sorted(slot_type_counts.items(), key=lambda x: -x[1]):
            self.stdout.write(f"    {st}: {cnt}")
        total_kaggle = ChargingStation.objects.filter(source="KAGGLE").count()
        total_ocm = ChargingStation.objects.filter(source="OCM").count()
        total_eco = ChargingStation.objects.filter(source="ECOCHARGE").count()
        self.stdout.write(f"\n  Total KAGGLE stations:  {total_kaggle}")
        self.stdout.write(f"  Total OCM stations:     {total_ocm}")
        self.stdout.write(f"  Total ECOCHARGE:        {total_eco}")
        self.stdout.write(f"  Total all:              {total_kaggle + total_ocm + total_eco}")
        self.stdout.write("=" * 60)

    def _flush_batch(self, batch, slot_type_counts):
        with transaction.atomic():
            for station, slot_type in batch:
                station.save()
                rate = _random_rate(slot_type)
                ChargingSlot.objects.create(
                    station=station,
                    slot_type=slot_type,
                    status="AVAILABLE",
                    rate_per_kwh=rate,
                    off_peak_rate=round(rate * 0.7, 2),
                )
                slot_type_counts[slot_type] += 1
        return len(batch), len(batch)
