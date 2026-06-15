from django.db import models

class Trip(models.Model):
    driver = models.ForeignKey(
        'users.CustomUser', on_delete=models.CASCADE, related_name='trips'
    )
    origin = models.CharField(max_length=200)
    destination = models.CharField(max_length=200)
    origin_lat = models.FloatField(null=True, blank=True)
    origin_lng = models.FloatField(null=True, blank=True)
    dest_lat = models.FloatField(null=True, blank=True)
    dest_lng = models.FloatField(null=True, blank=True)
    distance_km = models.FloatField()
    duration_minutes = models.FloatField(null=True, blank=True)
    battery_start_percent = models.FloatField()
    battery_end_percent = models.FloatField(null=True, blank=True)
    predicted_battery_readings = models.JSONField(default=list)
    actual_battery_readings = models.JSONField(default=list)
    route_geometry = models.JSONField(default=list)
    stops = models.JSONField(default=list)
    total_cost = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    energy_consumed_kwh = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.driver.username}: {self.origin} → {self.destination}"