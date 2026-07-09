from trips.serializers import TripPlanRequestSerializer, TripSerializer


class TestTripSerializer:
    def test_serializes_all_fields(self, db, test_user):
        from trips.models import Trip
        trip = Trip.objects.create(
            driver=test_user, origin='X', destination='Y',
            distance_km=100, battery_start_percent=80,
        )
        serializer = TripSerializer(trip)
        assert serializer.data['origin'] == 'X'
        assert serializer.data['distance_km'] == 100
        assert 'driver' in serializer.data


class TestTripPlanRequestSerializer:
    def test_valid_request(self):
        data = {
            'route_coords': [[77.1, 28.5], [77.2, 28.6]],
            'total_distance_m': 10000,
            'total_duration_s': 600,
            'vehicle_id': 'tata-nexon-ev',
            'battery_start_percent': 90,
        }
        serializer = TripPlanRequestSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_invalid_battery_percent(self):
        data = {
            'route_coords': [[77.1, 28.5]],
            'total_distance_m': 10000,
            'vehicle_id': 'test-car',
            'battery_start_percent': 150,
        }
        serializer = TripPlanRequestSerializer(data=data)
        assert not serializer.is_valid()

    def test_empty_route_coords(self):
        data = {
            'route_coords': [],
            'total_distance_m': 10000,
            'vehicle_id': 'test-car',
            'battery_start_percent': 80,
        }
        serializer = TripPlanRequestSerializer(data=data)
        assert not serializer.is_valid()
