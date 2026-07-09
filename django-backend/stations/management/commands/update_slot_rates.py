import random

from django.core.management.base import BaseCommand

from stations.models import ChargingSlot

RATE_RANGES = {
    "AC_SLOW": (8.0, 12.0),
    "AC_FAST": (12.0, 18.0),
    "DC_FAST": (20.0, 30.0),
    "DC_ULTRA": (25.0, 35.0),
}


class Command(BaseCommand):
    help = "Resets rate_per_kwh on all slots to realistic ranges per slot_type"

    def handle(self, *args, **options):
        random.seed(42)
        total = 0

        for slot_type, (lo, hi) in RATE_RANGES.items():
            slots = list(ChargingSlot.objects.filter(slot_type=slot_type))
            for slot in slots:
                rate = round(random.uniform(lo, hi), 2)
                slot.rate_per_kwh = rate
                slot.off_peak_rate = round(rate * 0.7, 2)
            ChargingSlot.objects.bulk_update(slots, ["rate_per_kwh", "off_peak_rate"])
            count = len(slots)
            total += count
            rates = [float(s.rate_per_kwh) for s in slots]
            self.stdout.write(
                f"  {slot_type:12s} count={count:5d}  "
                f"min=Rs{min(rates):6.2f}  max=Rs{max(rates):6.2f}  "
                f"avg=Rs{sum(rates)/count:6.2f}"
            )

        self.stdout.write(self.style.SUCCESS(f"\nUpdated {total} slots total"))
