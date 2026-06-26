from django.urls import path
from .views import TripListCreateView, TripDetailView, TripPlanView, TripPlanStreamView

urlpatterns = [
    path('', TripListCreateView.as_view(), name='trip-list'),
    path('<int:pk>/', TripDetailView.as_view(), name='trip-detail'),
    path('plan/', TripPlanView.as_view(), name='trip-plan'),
    path('plan-stream/', TripPlanStreamView.as_view(), name='trip-plan-stream'),
]
