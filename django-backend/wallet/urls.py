from django.urls import path
from .views import WalletBalanceView, WalletTopUpView, WalletTransactionHistoryView

urlpatterns = [
    path('balance/', WalletBalanceView.as_view(), name='wallet-balance'),
    path('topup/', WalletTopUpView.as_view(), name='wallet-topup'),
    path('transactions/', WalletTransactionHistoryView.as_view(), name='wallet-transactions'),
]