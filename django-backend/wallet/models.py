from django.db import models

class WalletTransaction(models.Model):
    class TransactionType(models.TextChoices):
        TOPUP = 'TOPUP', 'Top Up'
        DEDUCTION = 'DEDUCTION', 'Deduction'
        REFUND = 'REFUND', 'Refund'

    user = models.ForeignKey(
        'users.CustomUser', on_delete=models.CASCADE, related_name='transactions'
    )
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    balance_after = models.DecimalField(max_digits=8, decimal_places=2)
    description = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.transaction_type} - {self.amount}"