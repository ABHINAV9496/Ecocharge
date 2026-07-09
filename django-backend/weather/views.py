import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    CurrentWeatherSerializer,
    RouteWeatherSerializer,
)
from .services import WeatherService, WeatherServiceError

logger = logging.getLogger(__name__)


@extend_schema(tags=['Weather'])
class CurrentWeatherView(APIView):
    permission_classes = [AllowAny]
    serializer_class = CurrentWeatherSerializer

    def get(self, request):
        lat = request.query_params.get('latitude')
        lng = request.query_params.get('longitude')

        if lat is None or lng is None:
            return Response(
                {'error': 'latitude and longitude are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = WeatherService.get_current_weather(float(lat), float(lng))
            return Response(data)
        except WeatherServiceError as e:
            logger.error('Current weather failed: %s', e)
            return Response(
                {'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


@extend_schema(tags=['Weather'])
class ForecastView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        lat = request.query_params.get('latitude')
        lng = request.query_params.get('longitude')

        if lat is None or lng is None:
            return Response(
                {'error': 'latitude and longitude are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = WeatherService.get_forecast(float(lat), float(lng))
            return Response(data)
        except WeatherServiceError as e:
            logger.error('Forecast failed: %s', e)
            return Response(
                {'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


@extend_schema(tags=['Weather'])
class SevenDayForecastView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        lat = request.query_params.get('latitude')
        lng = request.query_params.get('longitude')

        if lat is None or lng is None:
            return Response(
                {'error': 'latitude and longitude are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = WeatherService.get_7day_forecast(float(lat), float(lng))
            return Response(data)
        except WeatherServiceError as e:
            logger.error('7-day forecast failed: %s', e)
            return Response(
                {'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


@extend_schema(tags=['Weather'])
class CityWeatherView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        city = request.query_params.get('city', '').strip()
        if not city:
            return Response(
                {'error': 'city parameter is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = WeatherService.get_weather_by_city(city)
            return Response(data)
        except WeatherServiceError as e:
            logger.error('City weather failed: %s', e)
            return Response(
                {'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


@extend_schema(tags=['Weather'])
class RouteWeatherView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RouteWeatherSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            data = WeatherService.get_route_weather(
                serializer.validated_data['route_coords']
            )
            return Response(data)
        except WeatherServiceError as e:
            logger.error('Route weather failed: %s', e)
            return Response(
                {'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
