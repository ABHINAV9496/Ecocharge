from django.db import models

class VehicleProfile(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    make = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    year = models.IntegerField()
    battery_kwh = models.FloatField()
    consumption_wh_per_km = models.FloatField()
    fast_charge_kw = models.FloatField()
    ac_charge_kw = models.FloatField()
    is_builtin = models.BooleanField(default=True)
    owner = models.ForeignKey(
        'users.CustomUser', on_delete=models.CASCADE,
        null=True, blank=True, related_name='vehicles'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.make} {self.model} ({self.year})"

    class Meta:
        ordering = ['make', 'model']
