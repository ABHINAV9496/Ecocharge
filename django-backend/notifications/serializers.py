from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'title', 'message',
            'link', 'is_read', 'created_at', 'time_ago',
        ]
        read_only_fields = ['id', 'created_at', 'time_ago']

    def get_time_ago(self, obj):
        from django.utils import timezone
        delta = timezone.now() - obj.created_at
        if delta.days > 0:
            return f'{delta.days}d ago'
        if delta.seconds >= 3600:
            return f'{delta.seconds // 3600}h ago'
        if delta.seconds >= 60:
            return f'{delta.seconds // 60}m ago'
        return 'just now'
