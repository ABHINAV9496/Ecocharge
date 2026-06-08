import json
from channels.generic.websocket import AsyncWebsocketConsumer


class SlotStatusConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.station_id = self.scope['url_route']['kwargs']['station_id']
        self.group_name = f'station_{self.station_id}'

        # join station group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()
        await self.send(text_data=json.dumps({
            'message': f'Connected to Station {self.station_id} live updates'
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        pass

    async def slot_update(self, event):
        await self.send(text_data=json.dumps({
            'slot_id': event['slot_id'],
            'status': event['status'],
            'slot_type': event['slot_type'],
            'station_id': event['station_id'],
        }))