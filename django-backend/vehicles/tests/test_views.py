

class TestVehicleListView:
    def test_list_vehicles(self, api_client, test_vehicle):
        resp = api_client.get('/api/vehicles/')
        assert resp.status_code == 200
        assert isinstance(resp.data, list)
        assert len(resp.data) >= 1

    def test_list_vehicles_includes_builtin(self, api_client, test_vehicle):
        resp = api_client.get('/api/vehicles/')
        ids = [v['id'] for v in resp.data]
        assert 'tata-nexon-ev' in ids


class TestVehicleDetailView:
    def test_get_vehicle(self, api_client, test_vehicle):
        resp = api_client.get('/api/vehicles/tata-nexon-ev/')
        assert resp.status_code == 200
        assert resp.data['make'] == 'Tata'

    def test_get_nonexistent_vehicle(self, api_client, db):
        resp = api_client.get('/api/vehicles/nonexistent/')
        assert resp.status_code == 404
