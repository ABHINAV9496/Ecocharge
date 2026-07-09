from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        'razorpay_order_id', 'booking', 'user', 'amount',
        'currency', 'status', 'created_at',
    ]
    list_filter = ['status', 'currency']
    search_fields = [
        'razorpay_order_id', 'razorpay_payment_id',
        'user__username', 'booking__id',
    ]
    readonly_fields = [
        'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature',
        'amount', 'currency', 'status', 'created_at', 'captured_at', 'refunded_at',
    ]
