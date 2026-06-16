from django.urls import path
from .views import VehicleListView, VehicleDetailView

urlpatterns = [
    path('', VehicleListView.as_view(), name='vehicle-list'),
    path('<str:pk>/', VehicleDetailView.as_view(), name='vehicle-detail'),
]
