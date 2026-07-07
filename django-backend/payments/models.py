from django.db import models


class Payment(models.Model):
    class Status(models.TextChoices):
        CREATED = 'CREATED', 'Created'
        AUTHORIZED = 'AUTHORIZED', 'Authorized'
        CAPTURED = 'CAPTURED', 'Captured'
        FAILED = 'FAILED', 'Failed'
        REFUNDED = 'REFUNDED', 'Refunded'

    booking = models.ForeignKey(
        'bookings.Booking', on_delete=models.CASCADE, related_name='payments'
    )
    user = models.ForeignKey(
        'users.CustomUser', on_delete=models.CASCADE, related_name='payments'
    )
    razorpay_order_id = models.CharField(max_length=100, unique=True)
    razorpay_payment_id = models.CharField(max_length=100, null=True, blank=True)
    razorpay_signature = models.CharField(max_length=255, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.CREATED
    )
    created_at = models.DateTimeField(auto_now_add=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment {self.razorpay_order_id} — {self.status} — ₹{self.amount}"
