import json
import paho.mqtt.client as mqtt
import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from stations.models import ChargingSlot


MQTT_BROKER = os.environ.get('MQTT_BROKER_HOST', 'mosquitto')
MQTT_PORT = 1883
MQTT_TOPIC = 'ecocharge/slots/status'


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print('✅ MQTT Consumer connected to broker')
        client.subscribe(MQTT_TOPIC)
        print(f'📡 Subscribed to topic: {MQTT_TOPIC}')
    else:
        print(f'❌ Connection failed with code {rc}')


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        slot_id = payload.get('slot_id')
        status = payload.get('status')

        print(f'📨 MQTT message received: Slot {slot_id} → {status}')

        slot = ChargingSlot.objects.get(pk=slot_id)
        if slot.status != 'OCCUPIED':
            slot.status = status
            slot.save()
            print(f'✅ Slot {slot_id} updated to {status} in database')

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'station_{slot.station.id}',
            {
                'type': 'slot_update',
                'slot_id': slot_id,
                'status': status,
                'slot_type': slot.slot_type,
                'station_id': slot.station.id,
            }
        )
        print(f'📡 WebSocket update pushed for station {slot.station.id}')

    except ChargingSlot.DoesNotExist:
        print(f'❌ Slot {slot_id} not found in database')
    except Exception as e:
        print(f'❌ Error processing MQTT message: {e}')


def start_mqtt_consumer():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    print(f'🔌 Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}')
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_forever()


if __name__ == '__main__':
    start_mqtt_consumer()