
class TestRegisterView:
    def test_register_success(self, api_client, db):
        data = {
            'username': 'newuser',
            'email': 'new@test.com',
            'password': 'StrongPass123!',
            'password2': 'StrongPass123!',
        }
        resp = api_client.post('/api/auth/register/', data)
        assert resp.status_code == 201
        assert resp.data['user']['username'] == 'newuser'
        assert 'message' in resp.data

    def test_register_password_mismatch(self, api_client, db):
        data = {
            'username': 'newuser',
            'email': 'new@test.com',
            'password': 'StrongPass123!',
            'password2': 'DifferentPass!',
        }
        resp = api_client.post('/api/auth/register/', data)
        assert resp.status_code == 400


class TestLoginView:
    def test_login_success(self, api_client, test_user):
        resp = api_client.post('/api/auth/login/', {
            'username': 'testdriver',
            'password': 'testpass123',
        })
        assert resp.status_code == 200
        assert 'access' in resp.data
        assert 'refresh' in resp.data

    def test_login_invalid_credentials(self, api_client, db):
        resp = api_client.post('/api/auth/login/', {
            'username': 'nonexistent',
            'password': 'wrong',
        })
        assert resp.status_code == 401

    def test_login_missing_fields(self, api_client, db):
        resp = api_client.post('/api/auth/login/', {})
        assert resp.status_code == 400


class TestUserProfileView:
    def test_get_profile(self, auth_client):
        resp = auth_client.get('/api/auth/profile/')
        assert resp.status_code == 200
        assert resp.data['username'] == 'testdriver'

    def test_profile_unauthenticated(self, api_client):
        resp = api_client.get('/api/auth/profile/')
        assert resp.status_code == 401


class TestLogoutView:
    def test_logout_missing_refresh(self, auth_client):
        resp = auth_client.post('/api/auth/logout/', {})
        assert resp.status_code == 400


class TestPasswordReset:
    def test_request_reset_missing_email(self, api_client, db):
        resp = api_client.post('/api/auth/password-reset/', {})
        assert resp.status_code == 400

    def test_request_reset_nonexistent_email(self, api_client, db):
        resp = api_client.post('/api/auth/password-reset/', {
            'email': 'ghost@test.com'
        })
        assert resp.status_code == 200
        assert 'message' in resp.data

    def test_confirm_reset_missing_fields(self, api_client, db):
        resp = api_client.post('/api/auth/password-reset/confirm/', {})
        assert resp.status_code == 400


class TestUserAdminView:
    def test_admin_list_users(self, admin_client):
        resp = admin_client.get('/api/auth/users/')
        assert resp.status_code == 200
        assert isinstance(resp.data, list)

    def test_non_admin_cannot_list_users(self, auth_client):
        resp = auth_client.get('/api/auth/users/')
        assert resp.status_code == 403

    def test_admin_delete_user(self, admin_client, test_user):
        resp = admin_client.delete(f'/api/auth/users/{test_user.id}/')
        assert resp.status_code == 200
