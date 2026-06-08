import json
import time
import random
import paho.mqtt.client as mqtt
import os

MQTT_BROKER = os.environ.get('MQTT_BROKER_HOST', 'mosquitto')
MQTT_PORT = 1883
MQTT_TOPIC = 'ecocharge/slots/status'

SLOT_IDS = [1, 2]
STATUSES = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'OCCUPIED', 'FAULT']


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print('✅ MQTT Publisher connected to broker')
    else:
        print(f'❌ Connection failed with code {rc}')


def start_publisher():
    client = mqtt.Client()
    client.on_connect = on_connect

    print(f'🔌 Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}')
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()

    time.sleep(2)

    print('🚀 Starting IoT slot status simulation...')
    while True:
        for slot_id in SLOT_IDS:
            status = random.choice(STATUSES)
            payload = {
                'slot_id': slot_id,
                'status': status,
                'timestamp': time.time()
            }
            client.publish(MQTT_TOPIC, json.dumps(payload))
            print(f'📤 Published: Slot {slot_id} → {status}')

        print('⏳ Waiting 30 seconds...')
        time.sleep(30)


if __name__ == '__main__':
    start_publisher()