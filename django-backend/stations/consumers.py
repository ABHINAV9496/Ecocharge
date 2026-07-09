import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer


class SlotStatusConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.station_id = self.scope['url_route']['kwargs'].get('station_id')
        self.group_name = f'station_{self.station_id}' if self.station_id else 'stations_global'
        self.subscribed_ids = []

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()
        await self.send(text_data=json.dumps({
            'type': 'connected',
            'message': 'Connected to live updates'
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            msg = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if msg.get('type') == 'subscribe':
            station_ids = msg.get('station_ids', [])
            if isinstance(station_ids, list):
                self.subscribed_ids = station_ids
                stations_data = await self.get_stations_batch(station_ids)
                await self.send(text_data=json.dumps({
                    'type': 'batch_update',
                    'stations': stations_data
                }))

    async def slot_update(self, event):
        station_id = event.get('station_id')
        if not self.subscribed_ids or station_id in self.subscribed_ids:
            stations_data = await self.get_stations_batch([station_id])
            if stations_data:
                await self.send(text_data=json.dumps({
                    'type': 'station_update',
                    'station': stations_data[0]
                }))

    @database_sync_to_async
    def get_stations_batch(self, station_ids):
        if not station_ids:
            return []
        from .models import ChargingStation
        from .serializers import ChargingStationSerializer
        qs = ChargingStation.objects.filter(id__in=station_ids)
        serializer = ChargingStationSerializer(qs, many=True)
        return serializer.data


class GlobalStationsConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.group_name = 'stations_global'
        self.subscribed_ids = []

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()
        await self.send(text_data=json.dumps({
            'type': 'connected',
            'message': 'Connected to global station updates'
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            msg = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if msg.get('type') == 'subscribe':
            station_ids = msg.get('station_ids', [])
            if isinstance(station_ids, list):
                self.subscribed_ids = station_ids
                stations_data = await self.get_stations_batch(station_ids)
                await self.send(text_data=json.dumps({
                    'type': 'batch_update',
                    'stations': stations_data
                }))

    async def slot_update(self, event):
        station_id = event.get('station_id')
        if not self.subscribed_ids or station_id in self.subscribed_ids:
            stations_data = await self.get_stations_batch([station_id])
            if stations_data:
                await self.send(text_data=json.dumps({
                    'type': 'station_update',
                    'station': stations_data[0]
                }))

    @database_sync_to_async
    def get_stations_batch(self, station_ids):
        if not station_ids:
            return []
        from .models import ChargingStation
        from .serializers import ChargingStationSerializer
        qs = ChargingStation.objects.filter(id__in=station_ids)
        serializer = ChargingStationSerializer(qs, many=True)
        return serializer.data
