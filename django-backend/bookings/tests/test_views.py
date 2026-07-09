

class TestCreateBooking:
    def test_create_booking_success(self, auth_client, test_slot):
        from django.utils import timezone
        now = timezone.now()
        resp = auth_client.post('/api/bookings/create/', {
            'slot': test_slot.id,
            'start_time': now.isoformat(),
            'end_time': (now + timezone.timedelta(hours=1)).isoformat(),
        })
        assert resp.status_code == 201

    def test_create_booking_unauthenticated(self, api_client, test_slot):
        from django.utils import timezone
        resp = api_client.post('/api/bookings/create/', {
            'slot': test_slot.id,
            'start_time': timezone.now().isoformat(),
        })
        assert resp.status_code == 401


class TestBookingList:
    def test_list_user_bookings(self, auth_client, test_slot):
        from django.utils import timezone
        auth_client.post('/api/bookings/create/', {
            'slot': test_slot.id,
            'start_time': timezone.now().isoformat(),
        })
        resp = auth_client.get('/api/bookings/')
        assert resp.status_code == 200
        assert len(resp.data) >= 1


class TestBookingDetail:
    def test_get_booking_detail(self, auth_client, test_slot):
        from django.utils import timezone
        create_resp = auth_client.post('/api/bookings/create/', {
            'slot': test_slot.id,
            'start_time': timezone.now().isoformat(),
        })
        booking_id = create_resp.data['id']
        resp = auth_client.get(f'/api/bookings/{booking_id}/')
        assert resp.status_code == 200
        assert resp.data['status'] == 'PENDING'

    def test_get_nonexistent_booking(self, auth_client):
        resp = auth_client.get('/api/bookings/99999/')
        assert resp.status_code == 404
