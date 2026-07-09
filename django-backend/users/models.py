from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = 'SUPER_ADMIN', 'Super Admin'
        STATION_OWNER = 'STATION_OWNER', 'Station Owner'
        DRIVER = 'DRIVER', 'Driver'
        GUEST = 'GUEST', 'Guest'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.DRIVER)
    phone_number = models.CharField(max_length=15, blank=True)
    car_model = models.CharField(max_length=100, blank=True)
    battery_capacity_kwh = models.FloatField(default=40.0)

    def __str__(self):
        return f"{self.username} ({self.role})"
