class TestSendTestEvent:
    def test_send_event_unauthenticated(self, api_client):
        resp = api_client.post('/api/events/test-event/', {
            'event_type': 'test',
            'message': 'Hello',
        })
        assert resp.status_code == 401

    def test_send_event_authenticated(self, auth_client):
        resp = auth_client.post('/api/events/test-event/', {
            'event_type': 'test',
            'message': 'Hello',
        })
        assert resp.status_code == 200
