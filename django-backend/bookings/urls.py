from django.urls import path
from .views import BookingListView, BookingDetailView, HeatmapView, CreateOrderView, VerifyPaymentView

urlpatterns = [
    path('', BookingListView.as_view(), name='booking-list'),
    path('<int:pk>/', BookingDetailView.as_view(), name='booking-detail'),
    path('heatmap/', HeatmapView.as_view(), name='booking-heatmap'),
    path('create-order/', CreateOrderView.as_view(), name='create-order'),
    path('verify-payment/', VerifyPaymentView.as_view(), name='verify-payment'),
]