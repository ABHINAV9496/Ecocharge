from django.urls import path

from . import views

urlpatterns = [
    path('', views.BookingListView.as_view(), name='booking-list'),
    path('<int:pk>/', views.BookingDetailView.as_view(), name='booking-detail'),
    path('<int:pk>/start/', views.BookingStartView.as_view(), name='booking-start'),
    path('<int:pk>/complete/', views.BookingCompleteView.as_view(), name='booking-complete'),
    path('<int:pk>/owner-complete/', views.BookingOwnerCompleteView.as_view(), name='booking-owner-complete'),
    path('<int:pk>/owner-no-show/', views.BookingOwnerNoShowView.as_view(), name='booking-owner-no-show'),
    path('heatmap/', views.HeatmapView.as_view(), name='booking-heatmap'),
    path('create/', views.CreateBookingView.as_view(), name='create-booking'),
]
