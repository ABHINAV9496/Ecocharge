from django.urls import path
from .views import BookingListView, BookingDetailView, HeatmapView, CreateBookingView

urlpatterns = [
    path('', BookingListView.as_view(), name='booking-list'),
    path('<int:pk>/', BookingDetailView.as_view(), name='booking-detail'),
    path('heatmap/', HeatmapView.as_view(), name='booking-heatmap'),
    path('create/', CreateBookingView.as_view(), name='create-booking'),
]