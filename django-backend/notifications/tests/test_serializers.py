from notifications.models import Notification
from notifications.serializers import NotificationSerializer


class TestNotificationSerializer:
    def test_serializer_fields(self, db, test_user):
        notif = Notification.objects.create(
            user=test_user, notification_type='INFO',
            title='Test Notification',
        )
        serializer = NotificationSerializer(notif)
        assert 'id' in serializer.data
        assert 'notification_type' in serializer.data
        assert 'title' in serializer.data
        assert 'is_read' in serializer.data
        assert serializer.data['title'] == 'Test Notification'
        assert serializer.data['is_read'] is False

    def test_time_ago_field(self, db, test_user):
        notif = Notification.objects.create(
            user=test_user, notification_type='INFO',
            title='Recent',
        )
        serializer = NotificationSerializer(notif)
        assert 'time_ago' in serializer.data
        assert serializer.data['time_ago'] == 'just now'
