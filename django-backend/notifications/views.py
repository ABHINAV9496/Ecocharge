from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema
from .models import Notification
from .serializers import NotificationSerializer


@extend_schema(tags=['Notifications'])
class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        unread_first = request.query_params.get('unread_first', 'true') == 'true'

        queryset = Notification.objects.filter(user=request.user)

        if unread_first:
            from django.db.models import Case, BooleanField, Value, When
            queryset = queryset.annotate(
                is_read_order=Case(
                    When(is_read=False, then=Value(0)),
                    default=Value(1),
                    output_field=BooleanField(),
                )
            ).order_by('is_read_order', '-created_at')
        else:
            queryset = queryset.order_by('-created_at')

        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        page_obj = queryset[start:end]

        serializer = NotificationSerializer(page_obj, many=True)
        unread_count = Notification.objects.filter(user=request.user, is_read=False).count()

        return Response({
            'count': total,
            'unread_count': unread_count,
            'page': page,
            'page_size': page_size,
            'results': serializer.data,
        })


@extend_schema(tags=['Notifications'])
class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

        notification.is_read = True
        notification.save(update_fields=['is_read'])

        return Response(NotificationSerializer(notification).data)


@extend_schema(tags=['Notifications'])
class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'updated': count})


@extend_schema(tags=['Notifications'])
class NotificationDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

        notification.delete()
        return Response({'deleted': True}, status=status.HTTP_200_OK)
