import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .helpers import send_user_event

logger = logging.getLogger(__name__)


@extend_schema(tags=['Events'])
class SendTestEventView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        event_type = request.data.get('event_type', 'notification.created')
        payload = request.data.get('payload', {'message': 'Test event from server'})

        send_user_event(request.user.id, event_type, payload)

        logger.info("Test event sent to user %s: type=%s", request.user.id, event_type)

        return Response({
            'status': 'sent',
            'event_type': event_type,
            'user_id': request.user.id,
        }, status=status.HTTP_200_OK)
