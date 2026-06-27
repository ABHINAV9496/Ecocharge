from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from drf_spectacular.utils import extend_schema
from .models import WalletTransaction
from .serializers import WalletTransactionSerializer, WalletTopUpSerializer
from notifications.helpers import create_notification


def get_wallet_balance(user):
    last_transaction = WalletTransaction.objects.filter(
        user=user
    ).order_by('-created_at').first()
    return last_transaction.balance_after if last_transaction else 0


@extend_schema(tags=['Wallet'])
class WalletBalanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        balance = get_wallet_balance(request.user)
        return Response(
            {
                'username': request.user.username,
                'balance': float(balance),
                'currency': 'INR'
            },
            status=status.HTTP_200_OK
        )


@extend_schema(tags=['Wallet'])
class WalletTopUpView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletTopUpSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = serializer.validated_data['amount']

        try:
            with transaction.atomic():
                current_balance = get_wallet_balance(request.user)
                new_balance = float(current_balance) + float(amount)

                wallet_transaction = WalletTransaction.objects.create(
                    user=request.user,
                    transaction_type='TOPUP',
                    amount=amount,
                    balance_after=new_balance,
                    description=f'Wallet top-up of ₹{amount}'
                )

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        create_notification(
            user=request.user,
            notification_type='PAYMENT',
            title='Wallet Recharged',
            message=f'₹{amount} added to your wallet. New balance: ₹{new_balance}',
        )

        return Response(
            {
                'message': f'₹{amount} added successfully',
                'new_balance': new_balance,
                'transaction_id': wallet_transaction.id
            },
            status=status.HTTP_201_CREATED
        )


@extend_schema(tags=['Wallet'])
class WalletTransactionHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        transactions = WalletTransaction.objects.filter(
            user=request.user
        ).order_by('-created_at')

        serializer = WalletTransactionSerializer(transactions, many=True)
        return Response(
            {
                'current_balance': float(get_wallet_balance(request.user)),
                'transactions': serializer.data
            },
            status=status.HTTP_200_OK
        )