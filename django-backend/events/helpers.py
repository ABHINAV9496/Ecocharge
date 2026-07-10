import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def send_user_event(user_id, event_type, payload):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.error("Channel layer not available — cannot send event")
        return
    async_to_sync(channel_layer.group_send)(
        f'user_{user_id}',
        {
            'type': 'user_event',
            'event_type': event_type,
            'payload': payload,
        },
    )


def send_slot_update(station_id):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.error("Channel layer not available — cannot send slot update")
        return
    async_to_sync(channel_layer.group_send)(
        f'station_{station_id}',
        {
            'type': 'slot_update',
            'station_id': station_id,
        },
    )
    async_to_sync(channel_layer.group_send)(
        'stations_global',
        {
            'type': 'slot_update',
            'station_id': station_id,
        },
    )
