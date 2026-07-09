import pytest
from django.contrib.gis.geos import Point

from stations.models import ChargingSlot, ChargingStation, MaintenanceSchedule, StationReview, UserFavoriteStation


class TestChargingStation:
    def test_create_station(self, db, test_owner):
        station = ChargingStation.objects.create(
            name='EcoCharge Hub',
            owner=test_owner,
            location=Point(77.1025, 28.7041),
            address='123 Main St, New Delhi',
            status='ACTIVE',
        )
        assert station.name == 'EcoCharge Hub'
        assert station.address == '123 Main St, New Delhi'
        assert station.status == 'ACTIVE'
        assert station.source == 'ECOCHARGE'
        assert str(station) == 'EcoCharge Hub'

    def test_station_default_status(self, db, test_owner):
        station = ChargingStation.objects.create(
            name='Default Station',
            owner=test_owner,
            location=Point(77.0, 28.0),
            address='Test Address',
        )
        assert station.status == 'ACTIVE'

    def test_ocm_id_unique(self, db, test_owner):
        ChargingStation.objects.create(
            name='Station A', owner=test_owner,
            location=Point(77.0, 28.0), address='Addr A', ocm_id=100,
        )
        with pytest.raises(Exception):
            ChargingStation.objects.create(
                name='Station B', owner=test_owner,
                location=Point(78.0, 29.0), address='Addr B', ocm_id=100,
            )


class TestChargingSlot:
    def test_create_slot(self, db, test_station):
        slot = ChargingSlot.objects.create(
            station=test_station,
            slot_type='DC_FAST',
            status='AVAILABLE',
            rate_per_kwh=12.00,
        )
        assert slot.slot_type == 'DC_FAST'
        assert slot.status == 'AVAILABLE'
        assert slot.rate_per_kwh == 12.00
        assert str(slot) == f'{test_station.name} - DC_FAST (AVAILABLE)'

    def test_slot_default_status(self, db, test_station):
        slot = ChargingSlot.objects.create(
            station=test_station,
            slot_type='AC_SLOW',
            rate_per_kwh=5.00,
        )
        assert slot.status == 'AVAILABLE'
        assert slot.off_peak_rate is None

    def test_off_peak_rate(self, db, test_station):
        slot = ChargingSlot.objects.create(
            station=test_station,
            slot_type='DC_ULTRA',
            status='AVAILABLE',
            rate_per_kwh=18.00,
            off_peak_rate=12.00,
        )
        assert slot.off_peak_rate == 12.00


class TestUserFavoriteStation:
    def test_add_favorite(self, db, test_station, test_user):
        fav = UserFavoriteStation.objects.create(
            user=test_user, station=test_station
        )
        assert str(fav) == f'{test_user.username} → {test_station.name}'
        assert fav in UserFavoriteStation.objects.all()

    def test_unique_together(self, db, test_station, test_user):
        UserFavoriteStation.objects.create(user=test_user, station=test_station)
        with pytest.raises(Exception):
            UserFavoriteStation.objects.create(user=test_user, station=test_station)


class TestStationReview:
    def test_create_review(self, db, test_station, test_user):
        review = StationReview.objects.create(
            user=test_user, station=test_station,
            rating=5, comment='Great station!'
        )
        assert review.rating == 5
        assert review.comment == 'Great station!'
        assert str(review) == f'{test_user.username} - {test_station.name} (5/5)'

    def test_unique_review_per_user_station(self, db, test_station, test_user):
        StationReview.objects.create(user=test_user, station=test_station, rating=4)
        with pytest.raises(Exception):
            StationReview.objects.create(user=test_user, station=test_station, rating=3)


class TestMaintenanceSchedule:
    def test_create_schedule(self, db, test_station, test_slot):
        from django.utils import timezone
        schedule = MaintenanceSchedule.objects.create(
            station=test_station,
            slot=test_slot,
            start_time=timezone.now(),
            end_time=timezone.now() + timezone.timedelta(hours=2),
            reason='Routine maintenance',
        )
        assert schedule.status == 'SCHEDULED'
        assert schedule.reason == 'Routine maintenance'
