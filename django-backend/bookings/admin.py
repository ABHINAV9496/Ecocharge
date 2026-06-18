from django.contrib import admin
from .models import Booking

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'driver', 'slot', 'status', 'start_time', 'amount_charged')
    list_filter = ('status',)
    search_fields = ('driver__username',)
    date_hierarchy = 'created_at'
