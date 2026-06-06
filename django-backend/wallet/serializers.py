from rest_framework import serializers
from .models import WalletTransaction


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = [
            'id', 'transaction_type', 'amount',
            'balance_after', 'description', 'created_at'
        ]
        read_only_fields = ['id', 'balance_after', 'created_at']


class WalletTopUpSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=8, decimal_places=2)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than zero')
        if value > 10000:
            raise serializers.ValidationError('Maximum top-up amount is ₹10,000')
        return value