from django.db import models


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        CONFIRMED = 'CONFIRMED', 'Confirmed'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        CANCELLED = 'CANCELLED', 'Cancelled'
        COMPLETED = 'COMPLETED', 'Completed'

    driver = models.ForeignKey(
        'users.CustomUser', on_delete=models.CASCADE, related_name='bookings'
    )
    slot = models.ForeignKey(
        'stations.ChargingSlot', on_delete=models.CASCADE, related_name='bookings'
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    amount_charged = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Booking {self.id} - {self.driver.username}"
