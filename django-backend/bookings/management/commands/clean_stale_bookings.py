from django.core.management.base import BaseCommand
from django.utils import timezone

from bookings.models import Booking
from stations.models import ChargingSlot


class Command(BaseCommand):
    help = 'Clean stale bookings and reset stuck OCCUPIED slot statuses'

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

        stuck_slots = ChargingSlot.objects.filter(status='OCCUPIED')
        stuck_count = stuck_slots.count()

        if stuck_count > 0:
            if dry_run:
                self.stdout.write(self.style.WARNING(
                    f'Dry run: {stuck_count} stuck OCCUPIED slot(s) would be reset to AVAILABLE:'
                ))
                for slot in stuck_slots.select_related('station'):
                    self.stdout.write(f'  Slot #{slot.id} ({slot.slot_type}) at {slot.station.name}')
            else:
                updated = stuck_slots.update(status='AVAILABLE')
                self.stdout.write(self.style.SUCCESS(f'Reset {updated} stuck OCCUPIED slot(s) to AVAILABLE.'))
        else:
            self.stdout.write(self.style.SUCCESS('No stuck OCCUPIED slots found.'))
