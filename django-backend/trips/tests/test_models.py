from trips.models import Trip


class TestTrip:
    def test_create_trip(self, db, test_user):
        trip = Trip.objects.create(
            driver=test_user,
            origin='Delhi',
            destination='Agra',
            distance_km=233,
            battery_start_percent=90,
            total_cost=0,
        )
        assert trip.origin == 'Delhi'
        assert trip.destination == 'Agra'
        assert trip.distance_km == 233
        assert str(trip) == f'{test_user.username}: Delhi → Agra'

    def test_trip_optional_fields(self, db, test_user):
        trip = Trip.objects.create(
            driver=test_user,
            origin='Mumbai',
            destination='Pune',
            distance_km=150,
            battery_start_percent=80,
            battery_end_percent=45,
            energy_consumed_kwh=18.5,
            total_cost=350.00,
        )
        assert trip.battery_end_percent == 45
        assert trip.energy_consumed_kwh == 18.5
        assert trip.total_cost == 350.00
        assert trip.duration_minutes is None

    def test_trip_defaults(self, db, test_user):
        trip = Trip.objects.create(
            driver=test_user,
            origin='A', destination='B',
            distance_km=50, battery_start_percent=100,
        )
        assert trip.total_cost == 0
        assert trip.stops == []
        assert trip.route_geometry == []
        assert trip.predicted_battery_readings == []
        assert trip.actual_battery_readings == []
