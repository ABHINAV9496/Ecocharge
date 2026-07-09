from notifications.models import Notification


class TestNotification:
    def test_create_notification(self, db, test_user):
        notif = Notification.objects.create(
            user=test_user,
            notification_type='INFO',
            title='Welcome!',
            message='Thanks for joining EcoCharge',
        )
        assert notif.notification_type == 'INFO'
        assert notif.title == 'Welcome!'
        assert notif.is_read is False
        assert str(notif) == f'[INFO] Welcome! — {test_user.username}'

    def test_mark_as_read(self, db, test_user):
        notif = Notification.objects.create(
            user=test_user, notification_type='SUCCESS',
            title='Booking Confirmed',
        )
        assert notif.is_read is False
        notif.is_read = True
        notif.save()
        assert Notification.objects.get(id=notif.id).is_read is True

    def test_notification_types(self, db, test_user):
        for ntype in ['INFO', 'SUCCESS', 'WARNING', 'ERROR',
                      'BOOKING', 'PAYMENT', 'TRIP', 'WEATHER', 'AI', 'ADMIN']:
            notif = Notification.objects.create(
                user=test_user, notification_type=ntype, title=f'Test {ntype}'
            )
            assert notif.notification_type == ntype

    def test_ordering(self, db, test_user):
        n1 = Notification.objects.create(
            user=test_user, notification_type='INFO', title='First'
        )
        n2 = Notification.objects.create(
            user=test_user, notification_type='INFO', title='Second'
        )
        notifications = Notification.objects.all()
        assert notifications[0] == n2
        assert notifications[1] == n1
