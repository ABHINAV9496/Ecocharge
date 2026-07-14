from django.core.management.base import BaseCommand
from django.utils import timezone

from bookings.models import Booking


class Command(BaseCommand):
    help = 'Clean stale bookings and mark them as completed'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Show what would be updated without making changes',
        )

    def handle(self, *args, **options):
        now = timezone.now()
        dry_run = options['dry_run']

        stale = Booking.objects.filter(
            status__in=['CONFIRMED', 'IN_PROGRESS', 'PENDING'],
            end_time__isnull=False,
            end_time__lt=now,
        )
        stale_count = stale.count()

        if stale_count > 0:
            if dry_run:
                self.stdout.write(self.style.WARNING(
                    f'Dry run: {stale_count} stale booking(s) would be marked COMPLETED:'
                ))
                for b in stale.select_related('slot__station', 'driver'):
                    self.stdout.write(
                        f'  Booking #{b.id} | {b.status} | {b.driver.username} '
                        f'| {b.slot.station.name} | end={b.end_time}'
                    )
            else:
                updated = stale.update(status='COMPLETED')
                self.stdout.write(self.style.SUCCESS(f'Marked {updated} stale booking(s) as COMPLETED.'))
        else:
            self.stdout.write(self.style.SUCCESS('No stale bookings found.'))
