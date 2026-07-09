
class TestNotificationList:
    def test_list_notifications(self, auth_client, test_user):
        from notifications.models import Notification
        Notification.objects.create(
            user=test_user, notification_type='INFO', title='Test Notif'
        )
        resp = auth_client.get('/api/notifications/')
        assert resp.status_code == 200
        assert 'results' in resp.data

    def test_list_unauthenticated(self, api_client):
        resp = api_client.get('/api/notifications/')
        assert resp.status_code == 401


class TestNotificationMarkRead:
    def test_mark_single_read(self, auth_client, test_user):
        from notifications.models import Notification
        notif = Notification.objects.create(
            user=test_user, notification_type='INFO', title='Unread'
        )
        resp = auth_client.patch(f'/api/notifications/{notif.id}/read/')
        assert resp.status_code == 200

    def test_mark_all_read(self, auth_client, test_user):
        from notifications.models import Notification
        Notification.objects.create(
            user=test_user, notification_type='INFO', title='N1'
        )
        Notification.objects.create(
            user=test_user, notification_type='INFO', title='N2'
        )
        resp = auth_client.patch('/api/notifications/mark-all-read/')
        assert resp.status_code == 200
