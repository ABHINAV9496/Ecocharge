from rest_framework import serializers

from stations.serializers import ChargingSlotSerializer
from vehicles.models import VehicleProfile
from vehicles.serializers import VehicleProfileSerializer

from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    slot_details = ChargingSlotSerializer(source='slot', read_only=True)
    driver_username = serializers.CharField(source='driver.username', read_only=True)
    vehicle_details = VehicleProfileSerializer(source='vehicle', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'driver_username', 'slot', 'slot_details',
            'vehicle', 'vehicle_details',
            'status', 'start_time', 'end_time',
            'amount_charged', 'created_at'
        ]
        read_only_fields = ['id', 'driver_username', 'status', 'amount_charged', 'created_at']


class CreateBookingSerializer(serializers.ModelSerializer):
    vehicle_id = serializers.CharField(required=False, allow_null=True)

    class Meta:
        model = Booking
        fields = ['slot', 'start_time', 'end_time', 'vehicle_id']

    def validate(self, attrs):
        slot = attrs['slot']
        if slot.status == 'FAULT':
            raise serializers.ValidationError(
                {'slot': 'This slot is offline due to a fault'}
            )
        start_time = attrs['start_time']
        end_time = attrs.get('end_time')
        if end_time and end_time <= start_time:
            raise serializers.ValidationError(
                {'end_time': 'End time must be after start time'}
            )
        vehicle_id = attrs.get('vehicle_id')
        if vehicle_id:
            try:
                vehicle = VehicleProfile.objects.get(pk=vehicle_id)
                attrs['vehicle'] = vehicle
            except VehicleProfile.DoesNotExist:
                raise serializers.ValidationError(
                    {'vehicle_id': 'Vehicle not found'}
                )
        return attrs
