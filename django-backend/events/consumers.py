import json
import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class UserEventConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = None
        self.user_id = None
        self.group_name = None

        user = await self._authenticate()
        if user is None or not user.is_authenticated:
            logger.warning("WS /ws/events/ — authentication failed")
            await self.close(code=4001)
            return

        self.user = user
        self.user_id = user.id
        self.group_name = f'user_{self.user_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info("WS /ws/events/ — user %s (id=%s) connected, group=%s",
                     user.username, user.id, self.group_name)

        await self.send(text_data=json.dumps({
            'type': 'connected',
            'user_id': self.user_id,
            'message': 'Event channel established',
        }))

    async def disconnect(self, close_code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info("WS /ws/events/ — user %s (id=%s) disconnected (code=%s)",
                     getattr(self.user, 'username', '?'),
                     self.user_id or '?', close_code)

    async def receive(self, text_data):
        try:
            msg = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if msg.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    async def user_event(self, event):
        await self.send(text_data=json.dumps({
            'type': 'event',
            'event_type': event['event_type'],
            'payload': event['payload'],
        }))

    @database_sync_to_async
    def _authenticate(self):
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.tokens import AccessToken

        query_string = self.scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token = params.get('token', [None])[0]

        if not token:
            return None

        try:
            access = AccessToken(token)
            User = get_user_model()
            user = User.objects.get(id=access['user_id'])
            return user
        except (TokenError, User.DoesNotExist, KeyError) as e:
            logger.warning("WS auth failed: %s", e)
            return None
