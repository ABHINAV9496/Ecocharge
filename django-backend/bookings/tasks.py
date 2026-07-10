from celery import shared_task
from django.db import transaction
from django.utils import timezone

from .models import Booking


@shared_task
def send_booking_confirmation(booking_id):
    try:
        booking = Booking.objects.get(id=booking_id)
        print(f"""
        ✅ BOOKING CONFIRMATION
        Booking ID  : #{booking.id}
        Driver      : {booking.driver.username}
        Station     : {booking.slot.station.name}
        Slot Type   : {booking.slot.slot_type}
        Start Time  : {booking.start_time}
        End Time    : {booking.end_time}
        Amount      : ₹{booking.amount_charged}
        Status      : {booking.status}
        """)
        return f"Confirmation sent for booking #{booking_id}"
    except Booking.DoesNotExist:
        return f"Booking #{booking_id} not found"


@shared_task
def auto_cancel_expired_bookings():
    from datetime import timedelta

    from events.helpers import send_slot_update
    from notifications.helpers import create_notification

    now = timezone.now()
    cutoff = now - timedelta(minutes=15)
    expired_bookings = Booking.objects.filter(
        status__in=['CONFIRMED', 'IN_PROGRESS'],
        end_time__lt=cutoff
    )
    processed_count = 0
    for booking in expired_bookings:
        with transaction.atomic():
            slot = booking.slot
            slot.status = 'AVAILABLE'
            slot.save()

            booking.status = 'COMPLETED'
            booking.save()

        send_slot_update(booking.slot.station.id)
        create_notification(
            user=booking.driver,
            notification_type='BOOKING',
            title='Slot Released Automatically',
            message=f'Your booking at {booking.slot.station.name} has been completed and the slot is now available.',
            link='/bookings',
        )

        processed_count += 1
    return f"Processed {processed_count} expired bookings"


@shared_task
def check_pending_bookings():
    pending = Booking.objects.filter(status='PENDING').count()
    print(f"⏳ {pending} pending bookings found")
    return f"{pending} pending bookings"
