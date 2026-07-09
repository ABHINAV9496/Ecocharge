from django.urls import path

from . import views

urlpatterns = [
    path('create-order/', views.CreateOrderView.as_view(), name='payment-create-order'),
    path('verify/', views.VerifyPaymentView.as_view(), name='payment-verify'),
    path('capture/', views.CapturePaymentView.as_view(), name='payment-capture'),
    path('status/<int:booking_id>/', views.PaymentStatusView.as_view(), name='payment-status'),
    path('history/', views.PaymentHistoryView.as_view(), name='payment-history'),
    path('<int:payment_id>/', views.PaymentDeleteView.as_view(), name='payment-delete'),
]
