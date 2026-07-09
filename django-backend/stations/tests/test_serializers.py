from stations.serializers import (
    ChargingSlotSerializer,
    ChargingStationSerializer,
    CreateStationSerializer,
)


class TestChargingStationSerializer:
    def test_serializer_contains_expected_fields(self, db, test_station):
        serializer = ChargingStationSerializer(test_station)
        assert 'id' in serializer.data
        assert 'name' in serializer.data
        assert 'latitude' in serializer.data
        assert 'longitude' in serializer.data
        assert 'slots' in serializer.data
        assert 'owner_username' in serializer.data

    def test_latitude_longitude_from_point(self, db, test_station):
        serializer = ChargingStationSerializer(test_station)
        assert serializer.data['latitude'] == 28.7041
        assert serializer.data['longitude'] == 77.1025


class TestCreateStationSerializer:
    def test_valid_data(self, db, test_owner):
        data = {
            'name': 'New Station',
            'address': '456 New Rd',
            'latitude': 28.5,
            'longitude': 77.2,
            'amenities': ['cafe', 'restroom'],
            'status': 'ACTIVE',
        }
        serializer = CreateStationSerializer(
            data=data,
            context={'request': type('Req', (), {'user': test_owner})()}
        )
        assert serializer.is_valid(), serializer.errors

    def test_missing_latitude(self, db):
        data = {
            'name': 'Bad Station',
            'address': 'Nowhere',
        }
        serializer = CreateStationSerializer(data=data)
        assert not serializer.is_valid()
        assert 'latitude' in serializer.errors


class TestChargingSlotSerializer:
    def test_serializer_fields(self, db, test_slot):
        serializer = ChargingSlotSerializer(test_slot)
        assert 'slot_type' in serializer.data
        assert 'rate_per_kwh' in serializer.data
        assert serializer.data['slot_type'] == 'DC_FAST'
