import csv
import io
import math
import random
import urllib.request
from collections import defaultdict

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from stations.models import ChargingSlot, ChargingStation
from users.models import CustomUser

HF_URL = (
    "https://huggingface.co/datasets/sickboy06/global-ev-infra-dataset"
    "/resolve/main/data/charging_station.csv"
)

POWER_CLASS_MAP = {
    "DC_FAST_(50-149kW)": "DC_FAST",
    "DC_ULTRA_(>=150kW)": "DC_ULTRA",
    "AC_L2_(7.5-21kW)": "AC_FAST",
    "AC_HIGH_(22-49kW)": "AC_FAST",
    "AC_L1_(<7.5kW)": "AC_SLOW",
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


def _map_slot_type(power_class, power_kw):
    if power_class in POWER_CLASS_MAP:
        return POWER_CLASS_MAP[power_class]
    if power_kw:
        power = float(power_kw)
        if power >= 100:
            return "DC_ULTRA"
        if power >= 50:
            return "DC_FAST"
        if power >= 7:
            return "AC_FAST"
        if power > 0:
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


def _download_csv(url):
    req = urllib.request.Request(url, headers={"User-Agent": "EcoCharge/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        content = resp.read()
    return content.decode("utf-8")


def _is_duplicate(lat, lng, ocm_id, existing_stations):
    if ocm_id:
        if ocm_id in existing_stations["by_ocm_id"]:
            return True
    for existing_lat, existing_lng, _ in existing_stations["by_location"]:
        if _haversine_km(lat, lng, existing_lat, existing_lng) < 0.5:
            return True
    return False


class Command(BaseCommand):
    help = "Imports EV charging stations from Hugging Face Global EV Infrastructure Dataset"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear", action="store_true", help="Delete existing KAGGLE-source stations before importing"
        )

    def handle(self, *args, **options):
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

        self.stdout.write("Downloading HuggingFace EV dataset...")
        self.stdout.flush()

        try:
            csv_content = _download_csv(HF_URL)
        except Exception as e:
            raise CommandError(f"Failed to download dataset: {e}")

        reader = csv.DictReader(io.StringIO(csv_content))
        india_rows = []
        for row in reader:
            if row.get("country_code", "").strip() == "IN":
                india_rows.append(row)

        self.stdout.write(f"Found {len(india_rows)} India stations in dataset")
        self.stdout.write("")

        random.seed(42)
        created_count = 0
        skipped_dup = 0
        skipped_no_coords = 0
        skipped_error = 0
        slot_count = 0
        slot_type_counts = defaultdict(int)

        existing_ocm_ids = set(
            ChargingStation.objects.filter(ocm_id__isnull=False).values_list("ocm_id", flat=True)
        )
        existing_locations = []
        for cs in ChargingStation.objects.only("location", "source").iterator():
            existing_locations.append((cs.location.y, cs.location.x, cs.source))

        existing_stations = {
            "by_ocm_id": existing_ocm_ids,
            "by_location": existing_locations,
        }

        batch = []
        batch_size = 200

        for i, row in enumerate(india_rows):
            if (i + 1) % 100 == 0:
                self.stdout.write(f"  Processing row {i + 1}/{len(india_rows)}...")
                self.stdout.flush()

            try:
                lat_str = (row.get("latitude") or "").strip()
                lng_str = (row.get("longitude") or "").strip()
                if not lat_str or not lng_str:
                    skipped_no_coords += 1
                    continue

                lat = float(lat_str)
                lng = float(lng_str)

                ocm_id_str = (row.get("id") or "").strip()
                ocm_id = int(ocm_id_str) if ocm_id_str else None

                if _is_duplicate(lat, lng, ocm_id, existing_stations):
                    skipped_dup += 1
                    continue

                name = (row.get("name") or "Charging Station").strip()[:200]
                city = (row.get("city") or "").strip()
                state = (row.get("state_province") or "").strip()
                address_parts = [p for p in [city, state] if p and p not in ("UNKNOWN", "IN", "India")]
                address = ", ".join(address_parts) if address_parts else "India"

                power_class = (row.get("power_class") or "UNKNOWN").strip()
                power_kw_str = (row.get("power_kw") or "").strip()
                power_kw = float(power_kw_str) if power_kw_str else None

                slot_type = _map_slot_type(power_class, power_kw)

                station_data = {
                    "name": name,
                    "owner": system_user,
                    "location": Point(float(lng), float(lat), srid=4326),
                    "address": address,
                    "amenities": [],
                    "status": "ACTIVE",
                    "source": "KAGGLE",
                    "ocm_id": ocm_id,
                }

                station = ChargingStation(**station_data)
                batch.append((station, slot_type))

                existing_stations["by_ocm_id"].add(ocm_id)
                existing_stations["by_location"].append((lat, lng, "KAGGLE"))

                if len(batch) >= batch_size:
                    self._flush_batch(batch, slot_type_counts)
                    created_count += len(batch)
                    slot_count += len(batch)
                    batch = []

            except (ValueError, TypeError):
                skipped_error += 1
                continue

        if batch:
            self._flush_batch(batch, slot_type_counts)
            created_count += len(batch)
            slot_count += len(batch)

        self.stdout.write("")
        self.stdout.write("=" * 60)
        self.stdout.write(self.style.SUCCESS("HUGGINGFACE IMPORT COMPLETE"))
        self.stdout.write(f"  Stations imported:      {created_count}")
        self.stdout.write(f"  Slots created:          {slot_count}")
        self.stdout.write(f"  Skipped (duplicate):    {skipped_dup}")
        self.stdout.write(f"  Skipped (no coords):    {skipped_no_coords}")
        self.stdout.write(f"  Skipped (error):        {skipped_error}")
        self.stdout.write("  Slot type breakdown:")
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
