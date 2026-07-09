from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(
        r'ws/stations/$',
        consumers.GlobalStationsConsumer.as_asgi()
    ),
    re_path(
        r'ws/stations/(?P<station_id>\d+)/slots/$',
        consumers.SlotStatusConsumer.as_asgi()
    ),
]
