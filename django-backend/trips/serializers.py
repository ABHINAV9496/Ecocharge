from rest_framework import serializers
from .models import Trip


class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = [
            'id', 'driver', 'origin', 'destination', 'origin_lat', 'origin_lng',
            'dest_lat', 'dest_lng', 'distance_km', 'duration_minutes',
            'battery_start_percent', 'battery_end_percent',
            'predicted_battery_readings', 'actual_battery_readings',
            'route_geometry', 'stops', 'total_cost', 'energy_consumed_kwh',
            'created_at',
        ]
        read_only_fields = ['id', 'driver', 'created_at']

    def create(self, validated_data):
        validated_data['driver'] = self.context['request'].user
        return super().create(validated_data)
