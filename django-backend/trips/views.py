import concurrent.futures
import json
import logging
import time

from django.contrib.gis.geos import Polygon
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.helpers import create_notification
from stations.models import ChargingStation
from users.permissions import IsDriver
from vehicles.models import VehicleProfile
from weather.services import WeatherService, WeatherServiceError

from .models import Trip
from .serializers import (
    TripPlanRequestSerializer,
    TripPlanResponseSerializer,
    TripSerializer,
)
from .services.route_planner import EnergyAwareRoutePlanner

logger = logging.getLogger(__name__)


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
            title='Trip Planned',
            message=f'Trip from {trip.origin} to {trip.destination} planned — {trip.distance_km:.1f} km',
            link='/trips',
        )


class TripDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated, IsDriver]

    def get_queryset(self):
        return Trip.objects.filter(driver=self.request.user)

    def perform_update(self, serializer):
        trip = serializer.save()
        if trip.status == Trip.STATUS_IN_PROGRESS:
            create_notification(
                user=self.request.user,
                notification_type='TRIP',
                title='Trip Started',
                message=f'Trip from {trip.origin} to {trip.destination} has started!',
                link='/trips',
            )
        elif trip.status == Trip.STATUS_COMPLETED:
            create_notification(
                user=self.request.user,
                notification_type='TRIP',
                title='Trip Completed',
                message=f'Trip from {trip.origin} to {trip.destination} completed — {trip.distance_km:.1f} km',
                link='/trips',
            )


def _fetch_weather_for_plan(plan, route_coords):
    """Fetch origin, destination, and stop weather in parallel."""
    if not route_coords:
        return

    futures = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        origin_coords = route_coords[0]
        dest_coords = route_coords[-1]

        if origin_coords:
            futures['origin'] = pool.submit(
                WeatherService.get_current_weather,
                origin_coords[0], origin_coords[1],
            )
        if dest_coords:
            futures['destination'] = pool.submit(
                WeatherService.get_current_weather,
                dest_coords[0], dest_coords[1],
            )

        for i, stop in enumerate(plan.stops):
            futures[f'stop_{i}'] = pool.submit(
                WeatherService.get_current_weather,
                stop.lat, stop.lng,
            )

        try:
            if 'origin' in futures:
                plan.origin_weather = futures['origin'].result()
            if 'destination' in futures:
                plan.destination_weather = futures['destination'].result()
            for i, stop in enumerate(plan.stops):
                stop.weather = futures[f'stop_{i}'].result()
        except WeatherServiceError:
            plan.origin_weather = None
            plan.destination_weather = None
            for stop in plan.stops:
                stop.weather = None


class TripPlanView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDriver]

    def post(self, request):
        _timings = {}
        _t0 = time.time()

        # --- 1. Request received (validation) ---
        t = time.time()
        serializer = TripPlanRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        _timings['1_request_received'] = round(time.time() - t, 3)

        vehicle = get_object_or_404(
            VehicleProfile,
            id=data['vehicle_id'],
        )

        # --- 6. Charging station database query ---
        t = time.time()
        route_coords, stations_data = _prepare_route_data(data['route_coords'])
        _timings['6_station_db_query'] = round(time.time() - t, 3)

        # --- 7+8. Charging stop optimization (planner) ---
        t = time.time()
        planner = EnergyAwareRoutePlanner(
            consumption_wh_per_km=vehicle.consumption_wh_per_km,
            battery_kwh=vehicle.battery_kwh,
            battery_start_percent=data['battery_start_percent'],
            max_charge_kw=vehicle.fast_charge_kw,
            ac_charge_kw=vehicle.ac_charge_kw,
            charging_curve=vehicle.effective_charging_curve,
        )

        plan = planner.plan_routes(
            route_coords=route_coords,
            total_distance_m=data['total_distance_m'],
            stations=stations_data,
            origin_name=data.get('origin_name', 'Origin'),
            dest_name=data.get('dest_name', 'Destination'),
            charger_type=data.get('charger_type', 'all'),
        )
        _timings['7_8_stop_optimization'] = round(time.time() - t, 3)

        # --- 9. Weather API ---
        t = time.time()
        _fetch_weather_for_plan(plan, route_coords)
        _timings['9_weather_api'] = round(time.time() - t, 3)

        # --- 11. Serialization ---
        t = time.time()
        response_serializer = TripPlanResponseSerializer(plan)
        _timings['11_serialization'] = round(time.time() - t, 3)

        # --- 12. Total backend time ---
        _timings['12_total_backend'] = round(time.time() - _t0, 3)

        logger.info(
            "\n========== TRIP PLAN TIMINGS ==========\n"
            + "\n".join(f"  {k}: {v}s" for k, v in _timings.items())
            + "\n======================================"
        )

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
            max_charge_kw=vehicle.fast_charge_kw,
            ac_charge_kw=vehicle.ac_charge_kw,
            charging_curve=vehicle.effective_charging_curve,
        )

        def event_stream():
            _timings = {}
            _t0 = time.time()

            yield json.dumps({'progress': 'Planning route...'}) + '\n'

            try:
                # --- 7+8. Stop optimization ---
                t = time.time()
                plan = planner.plan_routes(
                    route_coords=route_coords,
                    total_distance_m=data['total_distance_m'],
                    stations=stations_data,
                    origin_name=data.get('origin_name', 'Origin'),
                    dest_name=data.get('dest_name', 'Destination'),
                    charger_type=data.get('charger_type', 'all'),
                )
                _timings['7_8_stop_optimization'] = round(time.time() - t, 3)

                yield json.dumps({'progress': 'Fetching weather data...'}) + '\n'

                # --- 9. Weather API ---
                t = time.time()
                _fetch_weather_for_plan(plan, route_coords)
                _timings['9_weather_api'] = round(time.time() - t, 3)

                # --- 11. Serialization ---
                t = time.time()
                s = TripPlanResponseSerializer(plan)
                _timings['11_serialization'] = round(time.time() - t, 3)

                _timings['12_total_backend'] = round(time.time() - _t0, 3)

                logger.info(
                    "\n========== TRIP PLAN STREAM TIMINGS ==========\n"
                    + "\n".join(f"  {k}: {v}s" for k, v in _timings.items())
                    + "\n============================================"
                )

                yield json.dumps({'result': s.data}) + '\n'
            except Exception as e:
                logger.error("Route planning failed: %s", e, exc_info=True)
                yield json.dumps({'error': f'Route planning failed: {str(e)}'}) + '\n'

        response = StreamingHttpResponse(
            event_stream(),
            content_type='application/x-ndjson',
        )
        response['X-Accel-Buffering'] = 'no'
        return response
