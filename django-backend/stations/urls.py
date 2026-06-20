from django.urls import path
from .views import (
    StationListView, StationDetailView,
    SlotListView, SlotDetailView,
    StationBatchView, StationByRouteView,
    FavoriteStationToggleView, FavoriteStationListView,
    StationReviewListCreateView, MyStationListView,
    StationStatsView,
)

urlpatterns = [
    path('', StationListView.as_view(), name='station-list'),
    path('batch/', StationBatchView.as_view(), name='station-batch'),
    path('by_route/', StationByRouteView.as_view(), name='station-by-route'),
    path('my-stations/', MyStationListView.as_view(), name='my-stations'),
    path('stats/', StationStatsView.as_view(), name='station-stats'),
    path('favorites/', FavoriteStationListView.as_view(), name='favorite-list'),
    path('favorites/toggle/', FavoriteStationToggleView.as_view(), name='favorite-toggle'),
    path('<int:pk>/', StationDetailView.as_view(), name='station-detail'),
    path('<int:station_pk>/slots/', SlotListView.as_view(), name='slot-list'),
    path('<int:station_pk>/slots/<int:pk>/', SlotDetailView.as_view(), name='slot-detail'),
    path('<int:station_pk>/reviews/', StationReviewListCreateView.as_view(), name='station-reviews'),
]