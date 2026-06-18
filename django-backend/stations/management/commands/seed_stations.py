import random
import time
from collections import defaultdict
from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from django.db import transaction
from stations.models import ChargingStation, ChargingSlot
from stations.seed_data import generate_all_stations
from stations.india_boundary import is_on_indian_landmass
from users.models import CustomUser

BATCH_SIZE = 50

SLOT_TYPE_RATES = {
    "AC_SLOW": (6, 9),
    "AC_FAST": (9, 13),
    "DC_FAST": (13, 17),
    "DC_ULTRA": (17, 22),
}

SLOT_STATUS_WEIGHTS = ["AVAILABLE"] * 85 + ["OCCUPIED"] * 10 + ["FAULT"] * 5


def _random_rate(slot_type):
    lo, hi = SLOT_TYPE_RATES[slot_type]
    return round(random.uniform(lo, hi), 2)


def _random_off_peak(rate):
    return round(rate * random.uniform(0.6, 0.7), 2)


def _random_slot_status():
    return random.choice(SLOT_STATUS_WEIGHTS)


def _make_slots(slot_types):
    return [
        ChargingSlot(
            slot_type=st,
            rate_per_kwh=_random_rate(st),
            off_peak_rate=_random_off_peak(_random_rate(st)),
            status=_random_slot_status(),
        )
        for st in slot_types
    ]


def _flush_batch(batch, slot_batch):
    with transaction.atomic():
        for station in batch:
            station.save()
        for station, slots in slot_batch:
            for slot in slots:
                slot.station = station
            ChargingSlot.objects.bulk_create(slots)


class Command(BaseCommand):
    help = "Seeds ~3,000 EV charging stations via grid-based generation"

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Delete all seeded stations first")

    def handle(self, *args, **options):
        system_user, created = CustomUser.objects.get_or_create(
            username="ecocharge_network",
            defaults={
                "role": "STATION_OWNER",
                "email": "network@ecocharge.in",
                "phone_number": "1800-123-4567",
            },
        )
        if created:
            system_user.set_unusable_password()
            system_user.save()
            self.stdout.write(self.style.SUCCESS("Created system owner: ecocharge_network"))

        if options["clear"]:
            self.stdout.write("Clearing existing seeded stations...")
            owned = ChargingStation.objects.filter(owner=system_user)
            count = owned.count()
            owned.delete()
            self.stdout.write(self.style.WARNING(f"Deleted {count} stations"))

        existing_names = set(
            ChargingStation.objects.filter(owner=system_user).values_list("name", flat=True)
        )
        random.seed(42)

        t0 = time.time()
        total_created = 0
        total_skipped = 0
        total_out_of_bounds = 0
        total_slots = 0
        state_counts = defaultdict(int)

        self.stdout.write("\n=== Generating stations ===")
        all_stations = generate_all_stations()
        self.stdout.write(f"  Generated {len(all_stations)} station records")

        self.stdout.write("\n=== Seeding stations ===")
        batch = []
        slot_batch = []

        for sd in all_stations:
            if sd["name"] in existing_names and not options["clear"]:
                total_skipped += 1
                continue

            if not is_on_indian_landmass(sd["lat"], sd["lng"]):
                total_out_of_bounds += 1
                continue

            station = ChargingStation(
                name=sd["name"],
                owner=system_user,
                location=Point(sd["lng"], sd["lat"], srid=4326),
                address=sd["address"],
                amenities=sd["amenities"],
                status=sd["status"],
            )
            slots = _make_slots(sd["slot_types"])

            batch.append(station)
            slot_batch.append((station, slots))

            state = sd.get("state") or sd.get("city", "Unknown")
            state_counts[state] += 1

            if len(batch) >= BATCH_SIZE:
                _flush_batch(batch, slot_batch)
                total_created += len(batch)
                total_slots += sum(len(sl) for _, sl in slot_batch)
                batch.clear()
                slot_batch.clear()
                self.stdout.write(f"  ... {total_created} stations created", ending="\r")

        if batch:
            _flush_batch(batch, slot_batch)
            total_created += len(batch)
            total_slots += sum(len(sl) for _, sl in slot_batch)
            batch.clear()
            slot_batch.clear()

        elapsed = time.time() - t0

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("SEED COMPLETE"))
        self.stdout.write(f"  Stations created:   {total_created}")
        self.stdout.write(f"  Stations skipped:   {total_skipped}")
        self.stdout.write(f"  Out of bounds:      {total_out_of_bounds}")
        self.stdout.write(f"  Slots created:      {total_slots}")
        self.stdout.write(f"  System owner:       ecocharge_network")
        self.stdout.write(f"  Time elapsed:       {elapsed:.1f}s")
        self.stdout.write(f"  Top states:")
        for st, cnt in sorted(state_counts.items(), key=lambda x: -x[1])[:10]:
            self.stdout.write(f"    {st}: {cnt}")
        self.stdout.write("=" * 60)
