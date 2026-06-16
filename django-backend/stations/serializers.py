from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import ChargingStation, ChargingSlot, CachedOCMStation


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


OCM_CONNECTOR_TYPE_MAP = {
    'CCS': 'DC_FAST',
    'CHAdeMO': 'DC_FAST',
    'Type 2': 'AC_FAST',
    'Mennekes': 'AC_FAST',
    'Type 1': 'AC_SLOW',
    'J1772': 'AC_SLOW',
    'Tesla': 'DC_ULTRA',
    'Supercharger': 'DC_ULTRA',
    'Wall Outlet': 'AC_SLOW',
    'BS 1363': 'AC_SLOW',
    'IEC 60309': 'AC_SLOW',
    'Commando': 'AC_SLOW',
    'Type 3': 'AC_SLOW',
    'SCAME': 'AC_SLOW',
    'NEMA': 'AC_SLOW',
}


def _map_ocm_connector(title):
    if not title:
        return 'AC_FAST'
    lower = title.lower()
    for key, slot_type in OCM_CONNECTOR_TYPE_MAP.items():
        if key.lower() in lower:
            return slot_type
    return 'AC_FAST'


def _extract_connector_type(entry):
    if isinstance(entry, dict):
        return entry.get('type', 'Unknown'), entry.get('power_kw')
    return str(entry), None


class CachedOCMStationSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    slots = serializers.SerializerMethodField()
    total_slots = serializers.SerializerMethodField()
    available_slots = serializers.SerializerMethodField()
    amenities = serializers.SerializerMethodField()
    isOCM = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()
    ocm_id = serializers.IntegerField()
    last_updated = serializers.DateTimeField()

    class Meta:
        model = CachedOCMStation
        fields = [
            'id', 'ocm_id', 'name', 'address',
            'latitude', 'longitude', 'city', 'state',
            'status', 'slots', 'total_slots', 'available_slots',
            'amenities', 'isOCM', 'source', 'last_updated',
        ]

    def get_id(self, obj):
        return 100000 + obj.id

    def get_slots(self, obj):
        slots = []
        connector_types = obj.connector_types or []
        for i, entry in enumerate(connector_types):
            title, power_kw = _extract_connector_type(entry)
            slot_type = _map_ocm_connector(title)
            slots.append({
                'id': 'ocm_slot_{}_{}'.format(obj.ocm_id, i),
                'station': obj.ocm_id,
                'slot_type': slot_type,
                'label': title,
                'name': '{} #{}'.format(title, i + 1),
                'status': 'AVAILABLE',
                'rate_per_kwh': '10.00',
                'power_kw': power_kw,
                'off_peak_rate': None,
                'isOCM': True,
            })
        if not slots:
            slots.append({
                'id': 'ocm_slot_{}_0'.format(obj.ocm_id),
                'station': obj.ocm_id,
                'slot_type': 'AC_FAST',
                'label': 'Standard',
                'name': 'Standard #1',
                'status': 'AVAILABLE',
                'rate_per_kwh': '10.00',
                'power_kw': None,
                'off_peak_rate': None,
                'isOCM': True,
            })
        return slots

    def get_total_slots(self, obj):
        return max(len(obj.connector_types or []), 1)

    def get_available_slots(self, obj):
        return max(len(obj.connector_types or []), 1)

    def get_amenities(self, obj):
        return []

    def get_isOCM(self, obj):
        return True

    def get_source(self, obj):
        return 'ocm'


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