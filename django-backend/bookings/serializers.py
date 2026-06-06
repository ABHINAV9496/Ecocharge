from rest_framework import serializers
from .models import Booking
from stations.serializers import ChargingSlotSerializer


class BookingSerializer(serializers.ModelSerializer):
    slot_details = ChargingSlotSerializer(source='slot', read_only=True)
    driver_username = serializers.CharField(source='driver.username', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'driver_username', 'slot', 'slot_details',
            'status', 'start_time', 'end_time',
            'amount_charged', 'created_at'
        ]
        read_only_fields = ['id', 'driver_username', 'status', 'amount_charged', 'created_at']


class CreateBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['slot', 'start_time', 'end_time']

    def validate(self, attrs):
        slot = attrs['slot']
        if slot.status != 'AVAILABLE':
            raise serializers.ValidationError(
                {'slot': 'This slot is not available for booking'}
            )
        start_time = attrs['start_time']
        end_time = attrs.get('end_time')
        if end_time and end_time <= start_time:
            raise serializers.ValidationError(
                {'end_time': 'End time must be after start time'}
            )
        return attrs