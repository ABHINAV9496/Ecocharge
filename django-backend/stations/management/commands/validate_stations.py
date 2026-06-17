from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from stations.models import ChargingStation
from stations.india_boundary import is_within_india
from users.models import CustomUser


def _check_station(station):
    lng = station.location.x
    lat = station.location.y
    return is_within_india(lat, lng)


class Command(BaseCommand):
    help = "Validates all seeded stations are within India's landmass boundary"

    def add_arguments(self, parser):
        parser.add_argument("--fix", action="store_true", help="Delete out-of-bounds stations")
        parser.add_argument("--list", action="store_true", help="List out-of-bounds station names")

    def handle(self, *args, **options):
        try:
            owner = CustomUser.objects.get(username="ecocharge_network")
        except CustomUser.DoesNotExist:
            self.stdout.write(self.style.ERROR("No ecocharge_network user found. Run seed_stations first."))
            return

        stations = ChargingStation.objects.filter(owner=owner)
        total = stations.count()
        if total == 0:
            self.stdout.write("No seeded stations to validate.")
            return

        self.stdout.write(f"Checking {total} stations against India boundary...")

        bad = []
        for station in stations.iterator():
            if not _check_station(station):
                bad.append(station)

        if not bad:
            self.stdout.write(self.style.SUCCESS(f"All {total} stations are within India's landmass."))
            return

        self.stdout.write(self.style.WARNING(f"Found {len(bad)} out-of-bounds stations:"))

        if options["list"]:
            for s in bad:
                self.stdout.write(f"  {s.id}: {s.name} ({s.location.y:.4f}, {s.location.x:.4f}) - {s.address}")

        if options["fix"]:
            names = [s.name for s in bad]
            ChargingStation.objects.filter(owner=owner, name__in=names).delete()
            self.stdout.write(self.style.SUCCESS(f"Deleted {len(bad)} out-of-bounds stations."))
        else:
            self.stdout.write("Use --fix to delete them.")
