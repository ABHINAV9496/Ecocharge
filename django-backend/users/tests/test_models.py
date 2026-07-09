from django.contrib.auth import get_user_model

User = get_user_model()


class TestCustomUser:
    def test_create_driver(self, db):
        user = User.objects.create_user(
            username='driver1', password='testpass123', role='DRIVER'
        )
        assert user.role == 'DRIVER'
        assert user.is_active
        assert str(user) == 'driver1 (DRIVER)'

    def test_default_role_is_driver(self, db):
        user = User.objects.create_user(username='test', password='pass')
        assert user.role == 'DRIVER'

    def test_create_super_admin(self, db):
        user = User.objects.create_superuser(
            username='admin', password='pass', role='SUPER_ADMIN'
        )
        assert user.role == 'SUPER_ADMIN'
        assert user.is_staff
        assert user.is_superuser

    def test_create_station_owner(self, db):
        user = User.objects.create_user(
            username='owner1', password='pass', role='STATION_OWNER'
        )
        assert user.role == 'STATION_OWNER'

    def test_user_fields(self, db):
        user = User.objects.create_user(
            username='user1', password='pass',
            email='user@test.com', phone_number='+911234567890',
            car_model='Nexon EV', battery_capacity_kwh=40.5,
        )
        assert user.email == 'user@test.com'
        assert user.phone_number == '+911234567890'
        assert user.car_model == 'Nexon EV'
        assert user.battery_capacity_kwh == 40.5
