import pytest
from django.contrib.gis.geos import Point

from payments.models import Payment


class TestPayment:
    def test_create_payment(self, db, test_user):
        from bookings.models import Booking
        from stations.models import ChargingSlot, ChargingStation
        station = ChargingStation.objects.create(
            name='Test Station', owner=test_user,
            location=Point(77.1025, 28.7041),
        )
        slot = ChargingSlot.objects.create(
            station=station, slot_type='DC_FAST',
            rate_per_kwh=12.00,
        )
        booking = Booking.objects.create(
            driver=test_user, slot=slot,
            start_time='2026-01-01T10:00:00Z',
        )
        payment = Payment.objects.create(
            booking=booking,
            user=test_user,
            razorpay_order_id='order_test_123',
            amount=500.00,
        )
        assert payment.status == 'CREATED'
        assert payment.currency == 'INR'

    def test_payment_status_flow(self, db, test_user):
        from bookings.models import Booking
        from stations.models import ChargingSlot, ChargingStation
        station = ChargingStation.objects.create(
            name='Test Station', owner=test_user,
            location=Point(77.1025, 28.7041),
        )
        slot = ChargingSlot.objects.create(
            station=station, slot_type='DC_FAST',
            rate_per_kwh=12.00,
        )
        booking = Booking.objects.create(
            driver=test_user, slot=slot,
            start_time='2026-01-01T10:00:00Z',
        )
        payment = Payment.objects.create(
            booking=booking, user=test_user,
            razorpay_order_id='order_test_456', amount=300.00,
        )
        payment.status = 'CAPTURED'
        payment.save()
        assert Payment.objects.get(razorpay_order_id='order_test_456').status == 'CAPTURED'

    def test_unique_razorpay_order_id(self, db, test_user):
        from bookings.models import Booking
        from stations.models import ChargingSlot, ChargingStation
        station = ChargingStation.objects.create(
            name='Test Station', owner=test_user,
            location=Point(77.1025, 28.7041),
        )
        slot = ChargingSlot.objects.create(
            station=station, slot_type='DC_FAST',
            rate_per_kwh=12.00,
        )
        booking = Booking.objects.create(
            driver=test_user, slot=slot,
            start_time='2026-01-01T10:00:00Z',
        )
        Payment.objects.create(
            booking=booking, user=test_user,
            razorpay_order_id='unique_order', amount=100.00,
        )
        with pytest.raises(Exception):
            Payment.objects.create(
                booking=booking, user=test_user,
                razorpay_order_id='unique_order', amount=200.00,
            )
