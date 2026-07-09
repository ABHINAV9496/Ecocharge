from rest_framework import serializers

from .models import ChargingSlot, ChargingStation, MaintenanceSchedule, StationReview, UserFavoriteStation


class ChargingSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChargingSlot
        fields = ['id', 'slot_type', 'status', 'rate_per_kwh', 'off_peak_rate']


class ChargingStationSerializer(serializers.ModelSerializer):
    slots = ChargingSlotSerializer(many=True, read_only=True)
    owner_username = serializers.CharField(source='owner.username', read_only=True)
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()

    class Meta:
        model = ChargingStation
        fields = [
            'id', 'name', 'owner_username', 'address',
            'latitude', 'longitude', 'amenities',
            'status', 'source', 'ocm_id', 'created_at', 'slots'
        ]
        read_only_fields = ['id', 'created_at', 'owner_username']

    def get_latitude(self, obj):
        return obj.location.y if obj.location else None

    def get_longitude(self, obj):
        return obj.location.x if obj.location else None



class CreateStationSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True)
    longitude = serializers.FloatField(write_only=True)

    class Meta:
        model = ChargingStation
        fields = ['name', 'address', 'latitude', 'longitude', 'amenities', 'status']

    def create(self, validated_data):
        from django.contrib.gis.geos import Point
        latitude = validated_data.pop('latitude')
        longitude = validated_data.pop('longitude')
        validated_data['location'] = Point(longitude, latitude)
        validated_data['owner'] = self.context['request'].user
        return ChargingStation.objects.create(**validated_data)

    def update(self, instance, validated_data):
        from django.contrib.gis.geos import Point
        latitude = validated_data.pop('latitude', None)
        longitude = validated_data.pop('longitude', None)
        if latitude and longitude:
            instance.location = Point(longitude, latitude)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class FavoriteStationSerializer(serializers.ModelSerializer):
    station_name = serializers.CharField(source='station.name', read_only=True)
    station_address = serializers.CharField(source='station.address', read_only=True)
    station_latitude = serializers.SerializerMethodField()
    station_longitude = serializers.SerializerMethodField()

    class Meta:
        model = UserFavoriteStation
        fields = ['id', 'station', 'station_name', 'station_address', 'station_latitude', 'station_longitude', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_station_latitude(self, obj):
        return obj.station.location.y if obj.station.location else None

    def get_station_longitude(self, obj):
        return obj.station.location.x if obj.station.location else None


class StationReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = StationReview
        fields = ['id', 'user', 'username', 'rating', 'comment', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class MaintenanceScheduleSerializer(serializers.ModelSerializer):
    station_name = serializers.CharField(source='station.name', read_only=True)
    slot_type = serializers.CharField(source='slot.slot_type', read_only=True, default=None)

    class Meta:
        model = MaintenanceSchedule
        fields = [
            'id', 'station', 'station_name', 'slot', 'slot_type',
            'start_time', 'end_time', 'reason', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'station_name', 'slot_type']


class OwnerRevenueSerializer(serializers.Serializer):
    station_id = serializers.IntegerField()
    station_name = serializers.CharField()
    total_revenue = serializers.FloatField()
    booking_count = serializers.IntegerField()
