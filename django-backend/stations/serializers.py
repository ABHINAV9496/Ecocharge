from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import ChargingStation, ChargingSlot


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
            'status', 'created_at', 'slots'
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