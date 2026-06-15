from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from drf_spectacular.utils import extend_schema
from .models import ChargingStation, ChargingSlot, CachedOCMStation
from .serializers import (
    ChargingStationSerializer,
    CachedOCMStationSerializer,
    CreateStationSerializer,
    ChargingSlotSerializer
)


@extend_schema(tags=['Stations'])
class StationListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        include_ocm = request.query_params.get('include_ocm', 'true').lower() == 'true'
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        radius = request.query_params.get('radius')

        if lat and lng and radius:
            user_location = Point(float(lng), float(lat), srid=4326)
            stations = ChargingStation.objects.filter(
                location__distance_lte=(user_location, D(km=float(radius)))
            ).annotate(
                distance=Distance('location', user_location)
            ).order_by('distance')
        else:
            stations = ChargingStation.objects.all()

        merged = list(ChargingStationSerializer(stations, many=True).data)

        if include_ocm:
            ocm_stations = CachedOCMStation.objects.all()
            if lat and lng and radius:
                from math import radians, sin, cos, sqrt, atan2
                rad = float(radius)
                filtered_ocm = []
                for ocm in ocm_stations:
                    dlat = radians(ocm.latitude - float(lat))
                    dlng = radians(ocm.longitude - float(lng))
                    a = sin(dlat / 2) ** 2 + cos(radians(float(lat))) * cos(radians(ocm.latitude)) * sin(dlng / 2) ** 2
                    c = 2 * atan2(sqrt(a), sqrt(1 - a))
                    dist = 6371 * c
                    if dist <= rad:
                        filtered_ocm.append(ocm)
                ocm_stations = filtered_ocm
            merged.extend(CachedOCMStationSerializer(ocm_stations, many=True).data)

        return Response(merged, status=status.HTTP_200_OK)

    def post(self, request):
        if request.user.role not in ['STATION_OWNER', 'SUPER_ADMIN']:
            return Response(
                {'error': 'Only Station Owners can create stations'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = CreateStationSerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            station = serializer.save()
            return Response(
                ChargingStationSerializer(station).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=['Stations'])
class StationDetailView(APIView):

    def get_object(self, pk):
        try:
            return ChargingStation.objects.get(pk=pk)
        except ChargingStation.DoesNotExist:
            return None

    def get(self, request, pk):
        station = self.get_object(pk)
        if not station:
            return Response(
                {'error': 'Station not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = ChargingStationSerializer(station)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        station = self.get_object(pk)
        if not station:
            return Response(
                {'error': 'Station not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        if station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response(
                {'error': 'You can only update your own stations'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = CreateStationSerializer(
            station,
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            updated = serializer.save()
            return Response(
                ChargingStationSerializer(updated).data,
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        station = self.get_object(pk)
        if not station:
            return Response(
                {'error': 'Station not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        if station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response(
                {'error': 'You can only delete your own stations'},
                status=status.HTTP_403_FORBIDDEN
            )
        station.delete()
        return Response(
            {'message': 'Station deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )


@extend_schema(tags=['Slots'])
class SlotListView(APIView):

    def get(self, request, station_pk):
        try:
            station = ChargingStation.objects.get(pk=station_pk)
        except ChargingStation.DoesNotExist:
            return Response(
                {'error': 'Station not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        slots = ChargingSlot.objects.filter(station=station)
        serializer = ChargingSlotSerializer(slots, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, station_pk):
        try:
            station = ChargingStation.objects.get(pk=station_pk)
        except ChargingStation.DoesNotExist:
            return Response(
                {'error': 'Station not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        if station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response(
                {'error': 'You can only add slots to your own stations'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = ChargingSlotSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(station=station)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=['Slots'])
class SlotDetailView(APIView):

    def get_object(self, station_pk, pk):
        try:
            return ChargingSlot.objects.get(pk=pk, station__pk=station_pk)
        except ChargingSlot.DoesNotExist:
            return None

    def get(self, request, station_pk, pk):
        slot = self.get_object(station_pk, pk)
        if not slot:
            return Response(
                {'error': 'Slot not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = ChargingSlotSerializer(slot)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, station_pk, pk):
        slot = self.get_object(station_pk, pk)
        if not slot:
            return Response(
                {'error': 'Slot not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        if slot.station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response(
                {'error': 'You can only update slots in your own stations'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = ChargingSlotSerializer(slot, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, station_pk, pk):
        slot = self.get_object(station_pk, pk)
        if not slot:
            return Response(
                {'error': 'Slot not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        if slot.station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response(
                {'error': 'You can only delete slots in your own stations'},
                status=status.HTTP_403_FORBIDDEN
            )
        slot.delete()
        return Response(
            {'message': 'Slot deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )