from users.serializers import RegisterSerializer, UserProfileSerializer


class TestRegisterSerializer:
    def test_valid_registration(self, db):
        data = {
            'username': 'newuser',
            'email': 'new@test.com',
            'password': 'StrongPass123!',
            'password2': 'StrongPass123!',
            'role': 'DRIVER',
        }
        serializer = RegisterSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_password_mismatch(self, db):
        data = {
            'username': 'newuser',
            'email': 'new@test.com',
            'password': 'StrongPass123!',
            'password2': 'DifferentPass123!',
            'role': 'DRIVER',
        }
        serializer = RegisterSerializer(data=data)
        assert not serializer.is_valid()
        assert 'password' in serializer.errors

    def test_missing_required_fields(self, db):
        serializer = RegisterSerializer(data={})
        assert not serializer.is_valid()
        assert 'username' in serializer.errors
        assert 'password' in serializer.errors


class TestUserProfileSerializer:
    def test_read_only_role(self, db, test_user):
        serializer = UserProfileSerializer(test_user)
        assert 'role' in serializer.data
        assert serializer.data['username'] == 'testdriver'
