

class TestStationListView:
    def test_list_stations(self, api_client, db):
        resp = api_client.get('/api/stations/')
        assert resp.status_code == 200
        assert isinstance(resp.data, list)

    def test_filter_by_status(self, api_client, db):
        resp = api_client.get('/api/stations/?station_status=ACTIVE')
        assert resp.status_code == 200


class TestStationDetailView:
    def test_get_station_detail(self, auth_client, test_station):
        resp = auth_client.get(f'/api/stations/{test_station.id}/')
        assert resp.status_code == 200
        assert resp.data['name'] == 'Test Station'

    def test_get_nonexistent_station(self, auth_client):
        resp = auth_client.get('/api/stations/99999/')
        assert resp.status_code == 404


class TestFavoriteStation:
    def test_toggle_favorite(self, auth_client, test_station):
        resp = auth_client.post('/api/stations/favorites/toggle/',
                                {'station_id': test_station.id})
        assert resp.status_code in [200, 201]

    def test_list_favorites(self, auth_client, test_station):
        auth_client.post('/api/stations/favorites/toggle/',
                         {'station_id': test_station.id})
        resp = auth_client.get('/api/stations/favorites/')
        assert resp.status_code == 200
        assert isinstance(resp.data, list)

    def test_favorites_unauthenticated(self, api_client):
        resp = api_client.get('/api/stations/favorites/')
        assert resp.status_code == 401


class TestStationReviews:
    def test_create_review(self, auth_client, test_station):
        resp = auth_client.post(
            f'/api/stations/{test_station.id}/reviews/',
            {'rating': 5, 'comment': 'Excellent!'},
        )
        assert resp.status_code == 201

    def test_list_reviews(self, auth_client, test_station):
        resp = auth_client.get(f'/api/stations/{test_station.id}/reviews/')
        assert resp.status_code == 200
        assert isinstance(resp.data, list)


class TestStationSlots:
    def test_list_slots(self, auth_client, test_station, test_slot):
        resp = auth_client.get(f'/api/stations/{test_station.id}/slots/')
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_slot_detail(self, auth_client, test_station, test_slot):
        resp = auth_client.get(
            f'/api/stations/{test_station.id}/slots/{test_slot.id}/'
        )
        assert resp.status_code == 200
        assert resp.data['slot_type'] == 'DC_FAST'


class TestMyStations:
    def test_owner_my_stations(self, owner_client, test_station):
        resp = owner_client.get('/api/stations/my-stations/')
        assert resp.status_code == 200
        assert len(resp.data['results']) == 1

    def test_driver_my_stations_empty(self, auth_client):
        resp = auth_client.get('/api/stations/my-stations/')
        assert resp.status_code == 200
        assert resp.data['count'] == 0
