from django.urls import path
from .views import (
    CurrentWeatherView, ForecastView, SevenDayForecastView,
    CityWeatherView, RouteWeatherView,
)

urlpatterns = [
    path('current/', CurrentWeatherView.as_view(), name='weather-current'),
    path('forecast/', ForecastView.as_view(), name='weather-forecast'),
    path('forecast/7-day/', SevenDayForecastView.as_view(), name='weather-7day'),
    path('city/', CityWeatherView.as_view(), name='weather-city'),
    path('route/', RouteWeatherView.as_view(), name='weather-route'),
]
