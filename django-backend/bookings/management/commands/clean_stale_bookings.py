from django.core.management.base import BaseCommand
from django.utils import timezone

from bookings.models import Booking


class Command(BaseCommand):
    help = 'Mark stale CONFIRMED/IN_PROGRESS bookings as COMPLETED if their end_time has passed'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Show what would be updated without making changes',
        )

    def handle(self, *args, **options):
        now = timezone.now()
        stale = Booking.objects.filter(
            status__in=['CONFIRMED', 'IN_PROGRESS'],
            end_time__isnull=False,
            end_time__lt=now,
        )

        count = stale.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No stale bookings found.'))
            return

        if options['dry_run']:
            self.stdout.write(self.style.WARNING(f'Dry run: {count} stale booking(s) would be marked COMPLETED:'))
            for b in stale.select_related('slot__station', 'driver'):
                self.stdout.write(f'  Booking #{b.id} | {b.driver.username} | {b.slot.station.name} | end={b.end_time}')
            return

        updated = stale.update(status='COMPLETED')
        self.stdout.write(self.style.SUCCESS(f'Marked {updated} stale booking(s) as COMPLETED.'))
