from django.contrib import admin
from django.contrib.gis import admin as gis_admin

from .models import ChargingSlot, ChargingStation


@admin.register(ChargingStation)
class ChargingStationAdmin(gis_admin.GISModelAdmin):
    list_display = ('name', 'owner', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'address')

@admin.register(ChargingSlot)
class ChargingSlotAdmin(admin.ModelAdmin):
    list_display = ('station', 'slot_type', 'status', 'rate_per_kwh')
    list_filter = ('slot_type', 'status')
