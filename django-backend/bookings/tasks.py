from celery import shared_task
from django.utils import timezone
from .models import Booking
from wallet.models import WalletTransaction


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
    now = timezone.now()
    expired_bookings = Booking.objects.filter(
        status='CONFIRMED',
        end_time__lt=now
    )
    cancelled_count = 0
    for booking in expired_bookings:
        booking.status = 'COMPLETED'
        booking.save()
        cancelled_count += 1
    return f"Marked {cancelled_count} bookings as completed"


@shared_task
def check_pending_bookings():
    pending = Booking.objects.filter(status='PENDING').count()
    print(f"⏳ {pending} pending bookings found")
    return f"{pending} pending bookings"