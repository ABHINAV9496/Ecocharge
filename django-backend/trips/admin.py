from django.contrib import admin
from .models import Trip

@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ('driver', 'origin', 'destination', 'distance_km', 'total_cost', 'created_at')
    search_fields = ('driver__username', 'origin', 'destination')
    date_hierarchy = 'created_at'
