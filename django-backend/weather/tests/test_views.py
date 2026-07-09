

class TestCurrentWeather:
    def test_missing_params(self, api_client):
        resp = api_client.get('/api/weather/current/')
        assert resp.status_code == 400

    def test_with_lat_lng(self, api_client):
        resp = api_client.get('/api/weather/current/?latitude=28.7&longitude=77.1')
        assert resp.status_code in [200, 502]


class TestCityWeather:
    def test_missing_city(self, api_client):
        resp = api_client.get('/api/weather/city/')
        assert resp.status_code == 400

    def test_with_city_param(self, api_client):
        resp = api_client.get('/api/weather/city/?city=Delhi')
        assert resp.status_code in [200, 502]
