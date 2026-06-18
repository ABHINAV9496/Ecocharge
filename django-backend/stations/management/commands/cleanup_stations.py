from django.core.management.base import BaseCommand
from stations.models import ChargingStation
from stations.india_boundary import is_on_indian_landmass


class Command(BaseCommand):
    help = "Remove stations whose coordinates fall outside India's landmass polygon"

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Report without deleting')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        all_stations = ChargingStation.objects.all()
        total = all_stations.count()
        self.stdout.write(f'Checking {total} stations against India landmass polygon...')

        invalid = []
        for s in all_stations.iterator():
            lat = s.location.y
            lng = s.location.x
            if not is_on_indian_landmass(lat, lng):
                invalid.append((s.id, s.name, lat, lng, s.status, s.address))

        self.stdout.write(f'Found {len(invalid)} stations outside landmass:')
        for sid, name, lat, lng, status, addr in invalid:
            self.stdout.write(f'  #{sid}: {name[:40]} @ ({lat:.4f}, {lng:.4f}) [{addr[:30]}] status={status}')

        if invalid and not dry_run:
            ids = [r[0] for r in invalid]
            ChargingStation.objects.filter(id__in=ids).delete()
            remaining = ChargingStation.objects.count()
            self.stdout.write(self.style.SUCCESS(f'Deleted {len(ids)} stations. Remaining: {remaining}'))
        elif dry_run:
            self.stdout.write(self.style.WARNING('Dry run — no stations deleted'))
