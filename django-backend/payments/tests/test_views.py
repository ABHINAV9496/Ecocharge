
class TestPaymentHistory:
    def test_payment_history_unauthenticated(self, api_client):
        resp = api_client.get('/api/payments/history/')
        assert resp.status_code == 401

    def test_payment_history_authenticated(self, auth_client):
        resp = auth_client.get('/api/payments/history/')
        assert resp.status_code == 200
        assert 'payments' in resp.data
        assert 'total_captured' in resp.data


class TestPaymentStatus:
    def test_payment_status_nonexistent(self, auth_client):
        resp = auth_client.get('/api/payments/status/99999/')
        assert resp.status_code == 200
        assert resp.data['payment'] is None
