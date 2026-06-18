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


class TripPlanRequestSerializer(serializers.Serializer):
    route_coords = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField()),
        allow_empty=False,
    )
    total_distance_m = serializers.FloatField()
    total_duration_s = serializers.FloatField(required=False, default=0)
    vehicle_id = serializers.CharField()
    battery_start_percent = serializers.FloatField(min_value=0, max_value=100)
    origin_name = serializers.CharField(required=False, default='Origin')
    dest_name = serializers.CharField(required=False, default='Destination')


class TripPlanStopSerializer(serializers.Serializer):
    stop_index = serializers.IntegerField()
    station_id = serializers.IntegerField()
    station_name = serializers.CharField()
    address = serializers.CharField()
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    distance_from_start_km = serializers.FloatField()
    arrival_soc_percent = serializers.FloatField()
    departure_soc_percent = serializers.FloatField()
    charge_kwh = serializers.FloatField()
    charge_time_seconds = serializers.FloatField()
    slot_type = serializers.CharField()
    charger_power_kw = serializers.FloatField()
    cost = serializers.FloatField()
    detour_km = serializers.FloatField()
    alternatives = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class TripPlanLegSerializer(serializers.Serializer):
    leg_index = serializers.IntegerField()
    start_name = serializers.CharField()
    end_name = serializers.CharField()
    distance_km = serializers.FloatField()
    drive_time_seconds = serializers.FloatField()
    start_soc_percent = serializers.FloatField()
    end_soc_percent = serializers.FloatField()


class TripPlanResponseSerializer(serializers.Serializer):
    total_distance_km = serializers.FloatField()
    total_drive_time_seconds = serializers.FloatField()
    total_charge_time_seconds = serializers.FloatField()
    total_cost = serializers.FloatField()
    total_energy_consumed_kwh = serializers.FloatField()
    legs = TripPlanLegSerializer(many=True)
    stops = TripPlanStopSerializer(many=True)
    final_soc_percent = serializers.FloatField()
    origin_name = serializers.CharField()
    dest_name = serializers.CharField()
    note = serializers.CharField(required=False, default='')
