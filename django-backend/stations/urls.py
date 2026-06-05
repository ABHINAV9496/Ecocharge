from django.urls import path
from .views import StationListView, StationDetailView, SlotListView, SlotDetailView

urlpatterns = [
    path('', StationListView.as_view(), name='station-list'),
    path('<int:pk>/', StationDetailView.as_view(), name='station-detail'),
    path('<int:station_pk>/slots/', SlotListView.as_view(), name='slot-list'),
    path('<int:station_pk>/slots/<int:pk>/', SlotDetailView.as_view(), name='slot-detail'),
]