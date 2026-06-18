from django.db import models
from django.contrib.gis.db import models as gis_models
from django.conf import settings

class ChargingStation(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        INACTIVE = 'INACTIVE', 'Inactive'
        MAINTENANCE = 'MAINTENANCE', 'Maintenance'

    name = models.CharField(max_length=200)
    owner = models.ForeignKey(
        'users.CustomUser', on_delete=models.CASCADE, related_name='stations'
    )
    location = gis_models.PointField()
    address = models.TextField()
    amenities = models.JSONField(default=list)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class ChargingSlot(models.Model):
    class SlotType(models.TextChoices):
        AC_SLOW = 'AC_SLOW', 'AC Slow (3.3kW)'
        AC_FAST = 'AC_FAST', 'AC Fast (7.4kW)'
        DC_FAST = 'DC_FAST', 'DC Fast (50kW)'
        DC_ULTRA = 'DC_ULTRA', 'DC Ultra (150kW)'

    class Status(models.TextChoices):
        AVAILABLE = 'AVAILABLE', 'Available'
        OCCUPIED = 'OCCUPIED', 'Occupied'
        FAULT = 'FAULT', 'Fault'

    station = models.ForeignKey(ChargingStation, on_delete=models.CASCADE, related_name='slots')
    slot_type = models.CharField(max_length=20, choices=SlotType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    rate_per_kwh = models.DecimalField(max_digits=6, decimal_places=2)
    off_peak_rate = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"{self.station.name} - {self.slot_type} ({self.status})"


class UserFavoriteStation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='favorite_stations'
    )
    station = models.ForeignKey(ChargingStation, on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'station')

    def __str__(self):
        return f"{self.user.username} → {self.station.name}"


class StationReview(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews'
    )
    station = models.ForeignKey(ChargingStation, on_delete=models.CASCADE, related_name='reviews')
    rating = models.IntegerField(choices=[(1, '1'), (2, '2'), (3, '3'), (4, '4'), (5, '5')])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'station')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.station.name} ({self.rating}/5)"


