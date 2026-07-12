from django.db import models

DEFAULT_CHARGING_CURVE = [
    {'from_soc': 0, 'to_soc': 20, 'power_factor': 0.8},
    {'from_soc': 20, 'to_soc': 80, 'power_factor': 1.0},
    {'from_soc': 80, 'to_soc': 90, 'power_factor': 0.5},
    {'from_soc': 90, 'to_soc': 100, 'power_factor': 0.2},
]


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
    charging_curve = models.JSONField(default=list, blank=True)
    image = models.ImageField(upload_to='vehicles/', null=True, blank=True)
    owner = models.ForeignKey(
        'users.CustomUser', on_delete=models.CASCADE,
        null=True, blank=True, related_name='vehicles'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def effective_charging_curve(self):
        return self.charging_curve or DEFAULT_CHARGING_CURVE

    def __str__(self):
        return f"{self.make} {self.model} ({self.year})"

    class Meta:
        ordering = ['make', 'model']
