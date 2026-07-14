from bookings.serializers import CreateBookingSerializer


class TestCreateBookingSerializer:
    def test_valid_booking(self, db, test_slot):
        from django.utils import timezone
        now = timezone.now()
        data = {
            'slot': test_slot.id,
            'start_time': now,
            'end_time': now + timezone.timedelta(hours=1),
        }
        serializer = CreateBookingSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_end_before_start(self, db, test_slot):
        from django.utils import timezone
        now = timezone.now()
        data = {
            'slot': test_slot.id,
            'start_time': now,
            'end_time': now - timezone.timedelta(hours=1),
        }
        serializer = CreateBookingSerializer(data=data)
        assert not serializer.is_valid()
        assert 'end_time' in serializer.errors

    def test_slot_fault_rejected(self, db, test_slot):
        from django.utils import timezone
        test_slot.status = 'FAULT'
        test_slot.save()
        data = {
            'slot': test_slot.id,
            'start_time': timezone.now(),
        }
        serializer = CreateBookingSerializer(data=data)
        assert not serializer.is_valid()
        assert 'slot' in serializer.errors
