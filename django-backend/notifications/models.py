from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        INFO = 'INFO', 'Info'
        SUCCESS = 'SUCCESS', 'Success'
        WARNING = 'WARNING', 'Warning'
        ERROR = 'ERROR', 'Error'
        BOOKING = 'BOOKING', 'Booking'
        PAYMENT = 'PAYMENT', 'Payment'
        TRIP = 'TRIP', 'Trip'
        WEATHER = 'WEATHER', 'Weather'
        AI = 'AI', 'AI'
        ADMIN = 'ADMIN', 'Admin'

    user = models.ForeignKey(
        'users.CustomUser', on_delete=models.CASCADE, related_name='notifications'
    )
    notification_type = models.CharField(max_length=20, choices=Type.choices, default=Type.INFO)
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    link = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'is_read']),
        ]

    def __str__(self):
        return f"[{self.notification_type}] {self.title} — {self.user.username}"
