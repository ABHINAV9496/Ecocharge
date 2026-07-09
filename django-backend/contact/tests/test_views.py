class TestContactView:
    def test_submit_contact(self, api_client, db):
        resp = api_client.post('/api/contact/', {
            'name': 'John Doe',
            'email': 'john@example.com',
            'message': 'Great platform!',
        })
        assert resp.status_code == 201

    def test_submit_contact_missing_fields(self, api_client, db):
        resp = api_client.post('/api/contact/', {})
        assert resp.status_code == 400
