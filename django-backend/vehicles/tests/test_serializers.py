from vehicles.serializers import CreateVehicleSerializer, VehicleProfileSerializer


class TestVehicleProfileSerializer:
    def test_serializes_all_fields(self, db, test_vehicle):
        serializer = VehicleProfileSerializer(test_vehicle)
        assert serializer.data['make'] == 'Tata'
        assert serializer.data['model'] == 'Nexon EV'
        assert serializer.data['is_builtin'] is True

    def test_read_only_fields(self, db, test_vehicle):
        serializer = VehicleProfileSerializer(test_vehicle)
        assert 'id' in serializer.data
        assert 'created_at' in serializer.data


class TestCreateVehicleSerializer:
    def test_valid_custom_vehicle(self, db):
        data = {
            'make': 'Hyundai',
            'model': 'Kona Electric',
            'year': 2024,
            'battery_kwh': 39.2,
            'consumption_wh_per_km': 140,
            'fast_charge_kw': 100,
            'ac_charge_kw': 7.4,
        }
        serializer = CreateVehicleSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_missing_required_field(self, db):
        data = {'make': 'Tesla'}
        serializer = CreateVehicleSerializer(data=data)
        assert not serializer.is_valid()
        assert 'model' in serializer.errors
