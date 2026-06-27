import logging
from events.helpers import send_user_event

logger = logging.getLogger(__name__)


def create_notification(user, notification_type, title, message='', link=''):
    from .models import Notification

    notification = Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
    )

    send_user_event(
        user_id=user.id,
        event_type=f'notification.{notification_type.lower()}',
        payload={
            'id': notification.id,
            'notification_type': notification.notification_type,
            'title': notification.title,
            'message': notification.message,
            'link': notification.link,
            'is_read': notification.is_read,
            'created_at': notification.created_at.isoformat(),
        },
    )

    return notification
