import json
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.contrib.gis.geos import Polygon
from django.contrib.gis.db.models import Extent
from .models import Trip
from .serializers import (
    TripSerializer,
    TripPlanRequestSerializer,
    TripPlanResponseSerializer,
)
from .services.route_planner import EnergyAwareRoutePlanner
from vehicles.models import VehicleProfile
from stations.models import ChargingStation
from users.permissions import IsDriver
from notifications.helpers import create_notification
from weather.services import WeatherService, WeatherServiceError


def _prepare_route_data(route_coords):
    """Downsample coordinates and fetch stations within bounding box."""
    MAX_COORDS = 1000
    if len(route_coords) > MAX_COORDS:
        step = len(route_coords) / MAX_COORDS
        route_coords = [c for i, c in enumerate(route_coords)
                        if i == 0 or i == len(route_coords) - 1 or int(i % step) == 0]

    lats = [c[0] for c in route_coords]
    lngs = [c[1] for c in route_coords]
    buffer_deg = 1.0
    bounds_rect = Polygon.from_bbox((
        max(-180, min(lngs) - buffer_deg),
        max(-90, min(lats) - buffer_deg),
        min(180, max(lngs) + buffer_deg),
        min(90, max(lats) + buffer_deg),
    ))

    all_stations = ChargingStation.objects.filter(
        status=ChargingStation.Status.ACTIVE,
        location__within=bounds_rect,
    ).prefetch_related('slots')

    stations_data = []
    for station in all_stations:
        slots_data = []
        for slot in station.slots.all():
            slots_data.append({
                'id': slot.id,
                'slot_type': slot.slot_type,
                'status': slot.status,
                'rate_per_kwh': float(slot.rate_per_kwh),
            })
        stations_data.append({
            'id': station.id,
            'name': station.name,
            'address': station.address,
            'latitude': station.location.y,
            'longitude': station.location.x,
            'slots': slots_data,
        })

    return route_coords, stations_data


class TripListCreateView(generics.ListCreateAPIView):
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated, IsDriver]

    def get_queryset(self):
        return Trip.objects.filter(driver=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        trip = serializer.save()
        create_notification(
            user=self.request.user,
            notification_type='TRIP',
            title='Trip Completed',
            message=f'Trip from {trip.origin} to {trip.destination} completed — {trip.distance_km:.1f} km',
            link='/trips',
        )


class TripDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated, IsDriver]

    def get_queryset(self):
        return Trip.objects.filter(driver=self.request.user)


class TripPlanView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDriver]

    def post(self, request):
        serializer = TripPlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        vehicle = get_object_or_404(
            VehicleProfile,
            id=data['vehicle_id'],
        )

        route_coords = data['route_coords']

        # Downsample for planner performance — 1 point per ~5km is plenty for station proximity
        MAX_COORDS = 1000
        if len(route_coords) > MAX_COORDS:
            step = len(route_coords) / MAX_COORDS
            route_coords = [c for i, c in enumerate(route_coords) if i == 0 or i == len(route_coords) - 1 or int(i % step) == 0]

        lats = [c[0] for c in route_coords]
        lngs = [c[1] for c in route_coords]
        buffer_deg = 1.0
        bounds_rect = Polygon.from_bbox((
            max(-180, min(lngs) - buffer_deg),
            max(-90, min(lats) - buffer_deg),
            min(180, max(lngs) + buffer_deg),
            min(90, max(lats) + buffer_deg),
        ))

        all_stations = ChargingStation.objects.filter(
            status=ChargingStation.Status.ACTIVE,
            location__within=bounds_rect,
        ).prefetch_related('slots')

        stations_data = []
        for station in all_stations:
            slots_data = []
            for slot in station.slots.all():
                slots_data.append({
                    'id': slot.id,
                    'slot_type': slot.slot_type,
                    'status': slot.status,
                    'rate_per_kwh': float(slot.rate_per_kwh),
                })
            stations_data.append({
                'id': station.id,
                'name': station.name,
                'address': station.address,
                'latitude': station.location.y,
                'longitude': station.location.x,
                'slots': slots_data,
            })

        planner = EnergyAwareRoutePlanner(
            consumption_wh_per_km=vehicle.consumption_wh_per_km,
            battery_kwh=vehicle.battery_kwh,
            battery_start_percent=data['battery_start_percent'],
        )

        result = planner.plan_routes(
            route_coords=route_coords,
            total_distance_m=data['total_distance_m'],
            stations=stations_data,
            origin_name=data.get('origin_name', 'Origin'),
            dest_name=data.get('dest_name', 'Destination'),
        )

        plan = result['selected']
        plan.alternatives = result['alternatives']

        try:
            origin_coords = route_coords[0]
            dest_coords = route_coords[-1]
            plan.origin_weather = WeatherService.get_current_weather(
                origin_coords[0], origin_coords[1]
            ) if origin_coords else None
            plan.destination_weather = WeatherService.get_current_weather(
                dest_coords[0], dest_coords[1]
            ) if dest_coords else None

            for stop in plan.stops:
                stop.weather = WeatherService.get_current_weather(
                    stop.lat, stop.lng
                )
        except WeatherServiceError:
            plan.origin_weather = None
            plan.destination_weather = None
            for stop in plan.stops:
                stop.weather = None

        response_serializer = TripPlanResponseSerializer(plan)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class TripPlanStreamView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDriver]

    def post(self, request):
        serializer = TripPlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        vehicle = get_object_or_404(VehicleProfile, id=data['vehicle_id'])
        route_coords = data['route_coords']
        route_coords, stations_data = _prepare_route_data(route_coords)

        planner = EnergyAwareRoutePlanner(
            consumption_wh_per_km=vehicle.consumption_wh_per_km,
            battery_kwh=vehicle.battery_kwh,
            battery_start_percent=data['battery_start_percent'],
        )

        def event_stream():
            yield json.dumps({'progress': 'Planning route...'}) + '\n'
            yield json.dumps({'progress': 'Fetching weather data...'}) + '\n'
            result = planner.plan_routes(
                route_coords=route_coords,
                total_distance_m=data['total_distance_m'],
                stations=stations_data,
                origin_name=data.get('origin_name', 'Origin'),
                dest_name=data.get('dest_name', 'Destination'),
            )
            plan = result['selected']
            plan.alternatives = result['alternatives']

            try:
                origin_coords = route_coords[0]
                dest_coords = route_coords[-1]
                plan.origin_weather = WeatherService.get_current_weather(
                    origin_coords[0], origin_coords[1]
                ) if origin_coords else None
                plan.destination_weather = WeatherService.get_current_weather(
                    dest_coords[0], dest_coords[1]
                ) if dest_coords else None
                for stop in plan.stops:
                    stop.weather = WeatherService.get_current_weather(
                        stop.lat, stop.lng
                    )
            except WeatherServiceError:
                plan.origin_weather = None
                plan.destination_weather = None
                for stop in plan.stops:
                    stop.weather = None

            s = TripPlanResponseSerializer(plan)
            yield json.dumps({'result': s.data}) + '\n'

        response = StreamingHttpResponse(
            event_stream(),
            content_type='application/x-ndjson',
        )
        response['X-Accel-Buffering'] = 'no'
        return response
