import pytest
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def test_user(db):
    return User.objects.create_user(
        username='testdriver',
        password='testpass123',
        email='driver@ecocharge.com',
        role='DRIVER',
    )


@pytest.fixture
def test_owner(db):
    return User.objects.create_user(
        username='testowner',
        password='testpass123',
        email='owner@ecocharge.com',
        role='STATION_OWNER',
    )


@pytest.fixture
def test_admin(db):
    return User.objects.create_user(
        username='testadmin',
        password='testpass123',
        email='admin@ecocharge.com',
        role='SUPER_ADMIN',
    )


@pytest.fixture
def auth_client(api_client, test_user):
    refresh = RefreshToken.for_user(test_user)
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return api_client


@pytest.fixture
def owner_client(api_client, test_owner):
    refresh = RefreshToken.for_user(test_owner)
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return api_client


@pytest.fixture
def admin_client(api_client, test_admin):
    refresh = RefreshToken.for_user(test_admin)
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return api_client


@pytest.fixture
def test_station(db, test_owner):
    from stations.models import ChargingStation
    return ChargingStation.objects.create(
        name='Test Station',
        owner=test_owner,
        location=Point(77.1025, 28.7041),
        address='123 Test Street, New Delhi',
        status='ACTIVE',
    )


@pytest.fixture
def test_slot(db, test_station):
    from stations.models import ChargingSlot
    return ChargingSlot.objects.create(
        station=test_station,
        slot_type='DC_FAST',
        status='AVAILABLE',
        rate_per_kwh=12.00,
        off_peak_rate=8.00,
    )


@pytest.fixture
def test_vehicle(db):
    from vehicles.models import VehicleProfile
    obj, _ = VehicleProfile.objects.get_or_create(
        id='tata-nexon-ev',
        defaults={
            'make': 'Tata',
            'model': 'Nexon EV',
            'year': 2024,
            'battery_kwh': 40.5,
            'consumption_wh_per_km': 150,
            'fast_charge_kw': 50,
            'ac_charge_kw': 7.4,
            'is_builtin': True,
        },
    )
    return obj
