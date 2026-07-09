from bookings.models import Booking


class TestBooking:
    def test_create_booking(self, db, test_user, test_slot):
        from django.utils import timezone
        booking = Booking.objects.create(
            driver=test_user,
            slot=test_slot,
            start_time=timezone.now(),
        )
        assert booking.status == 'PENDING'
        assert booking.driver == test_user
        assert booking.slot == test_slot
        assert str(booking).startswith('Booking ')

    def test_booking_default_amount(self, db, test_user, test_slot):
        from django.utils import timezone
        booking = Booking.objects.create(
            driver=test_user,
            slot=test_slot,
            start_time=timezone.now(),
        )
        assert booking.amount_charged == 0
