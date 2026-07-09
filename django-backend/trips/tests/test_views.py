

class TestTripListCreate:
    def test_create_trip(self, auth_client):
        resp = auth_client.post('/api/trips/', {
            'origin': 'Delhi',
            'destination': 'Agra',
            'distance_km': 233,
            'battery_start_percent': 90,
        })
        assert resp.status_code == 201

    def test_list_trips(self, auth_client):
        auth_client.post('/api/trips/', {
            'origin': 'Delhi', 'destination': 'Agra',
            'distance_km': 233, 'battery_start_percent': 90,
        })
        resp = auth_client.get('/api/trips/')
        assert resp.status_code == 200
        assert len(resp.data) >= 1

    def test_create_trip_unauthenticated(self, api_client):
        resp = api_client.post('/api/trips/', {
            'origin': 'Delhi', 'destination': 'Agra',
            'distance_km': 233, 'battery_start_percent': 90,
        })
        assert resp.status_code == 401


class TestTripDetail:
    def test_get_trip_detail(self, auth_client):
        create_resp = auth_client.post('/api/trips/', {
            'origin': 'Delhi', 'destination': 'Agra',
            'distance_km': 233, 'battery_start_percent': 90,
        })
        trip_id = create_resp.data['id']
        resp = auth_client.get(f'/api/trips/{trip_id}/')
        assert resp.status_code == 200
        assert resp.data['origin'] == 'Delhi'

    def test_get_nonexistent_trip(self, auth_client):
        resp = auth_client.get('/api/trips/99999/')
        assert resp.status_code == 404
