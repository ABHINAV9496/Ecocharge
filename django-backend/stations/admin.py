from django.contrib import admin
from .models import ChargingStation, ChargingSlot

@admin.register(ChargingStation)
class ChargingStationAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'address')

@admin.register(ChargingSlot)
class ChargingSlotAdmin(admin.ModelAdmin):
    list_display = ('station', 'slot_type', 'status', 'rate_per_kwh')
    list_filter = ('slot_type', 'status')
