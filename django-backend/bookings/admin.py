from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'driver', 'slot', 'vehicle', 'status',
        'start_time', 'end_time', 'amount_charged', 'created_at',
    )
    list_filter = ('status',)
    search_fields = ('driver__username', 'slot__station__name')
    date_hierarchy = 'created_at'
    list_select_related = ('driver', 'slot', 'vehicle')
