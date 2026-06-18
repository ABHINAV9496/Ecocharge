from django.contrib import admin
from .models import WalletTransaction

@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'transaction_type', 'amount', 'balance_after', 'created_at')
    list_filter = ('transaction_type',)
    search_fields = ('user__username',)
    date_hierarchy = 'created_at'
