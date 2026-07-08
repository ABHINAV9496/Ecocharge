from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from django.contrib.gis.geos import Point, Polygon
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from drf_spectacular.utils import extend_schema
from django.db.models import Count, Q, Sum
from .models import ChargingStation, ChargingSlot, UserFavoriteStation, StationReview, MaintenanceSchedule
from bookings.models import Booking
from users.models import CustomUser
from .serializers import (
    ChargingStationSerializer,
    CreateStationSerializer,
    ChargingSlotSerializer,
    FavoriteStationSerializer,
    StationReviewSerializer,
    MaintenanceScheduleSerializer,
    OwnerRevenueSerializer,
)


class StationPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


@extend_schema(tags=['Stations'])
class StationListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        page = request.query_params.get('page')
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        radius = request.query_params.get('radius')
        amenities_param = request.query_params.get('amenities')
        slot_type = request.query_params.get('slot_type')
        station_status = request.query_params.get('station_status')
        min_lat = request.query_params.get('min_lat')
        max_lat = request.query_params.get('max_lat')
        min_lng = request.query_params.get('min_lng')
        max_lng = request.query_params.get('max_lng')
        bounds = request.query_params.get('bounds')
        q = request.query_params.get('q')

        stations = ChargingStation.objects.all().select_related('owner').prefetch_related('slots').order_by('-created_at')

        if lat and lng and radius:
            user_location = Point(float(lng), float(lat), srid=4326)
            stations = stations.filter(
                location__distance_lte=(user_location, D(km=float(radius)))
            ).annotate(
                distance=Distance('location', user_location)
            ).order_by('distance')

        if station_status:
            stations = stations.filter(status=station_status.upper())

        if slot_type:
            stations = stations.filter(slots__slot_type=slot_type.upper()).distinct()

        if amenities_param:
            amenity_list = [a.strip() for a in amenities_param.split(',') if a.strip()]
            for amenity in amenity_list:
                stations = stations.filter(amenities__contains=[amenity])

        if min_lat and max_lat and min_lng and max_lng:
            stations = stations.filter(
                location__within=Polygon.from_bbox((
                    float(min_lng), float(min_lat),
                    float(max_lng), float(max_lat)
                ))
            )

        if bounds:
            parts = [float(x) for x in bounds.split(',')]
            if len(parts) == 4:
                south, west, north, east = parts
                stations = stations.filter(
                    location__within=Polygon.from_bbox((west, south, east, north))
                )

        if q:
            stations = stations.filter(Q(name__icontains=q) | Q(address__icontains=q))

        if page:
            paginator = StationPagination()
            page_obj = paginator.paginate_queryset(stations, request)
            serializer = ChargingStationSerializer(page_obj, many=True)
            return paginator.get_paginated_response(serializer.data)

        # Limit unfiltered results to avoid serializing thousands of stations
        if not any([lat, lng, slot_type, station_status, amenities_param, min_lat, bounds, q]):
            stations = stations[:200]

        serializer = ChargingStationSerializer(stations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

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


@extend_schema(tags=['Stations'])
class StationBatchView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        points = request.data.get('points', [])
        radius = request.data.get('radius', 20)
        if not points or not isinstance(points, list):
            return Response({'error': 'points must be a list of {lat,lng} objects'}, status=400)
        all_ids = {}
        results = []
        for pt in points:
            lat = pt.get('lat')
            lng = pt.get('lng')
            if lat is None or lng is None:
                continue
            user_location = Point(float(lng), float(lat), srid=4326)
            qs = ChargingStation.objects.filter(
                location__distance_lte=(user_location, D(km=float(radius)))
            ).select_related('owner').prefetch_related('slots')
            for s in qs:
                if s.id not in all_ids:
                    all_ids[s.id] = True
                    results.append(s)
        serializer = ChargingStationSerializer(results, many=True)
        return Response({'stations': serializer.data, 'count': len(serializer.data)})


@extend_schema(tags=['Stations'])
class StationByRouteView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        waypoints = request.data.get('waypoints', [])
        radius = request.data.get('radius', 20)
        if not waypoints or len(waypoints) < 2:
            return Response({'error': 'At least 2 waypoints [lat, lng] required'}, status=400)

        from django.contrib.gis.geos import LineString
        line = LineString([(float(w[1]), float(w[0])) for w in waypoints], srid=4326)
        corridor = line.buffer(float(radius) / 111.0)

        stations = ChargingStation.objects.filter(
            location__within=corridor
        ).select_related('owner').prefetch_related('slots')
        serializer = ChargingStationSerializer(stations, many=True)
        return Response({'stations': serializer.data, 'count': len(serializer.data)})


@extend_schema(tags=['Stations'])
@extend_schema(tags=['Stations'])
class StationStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'Only SUPER_ADMIN can view stats'}, status=403)

        station_qs = ChargingStation.objects.all()
        total_stations = station_qs.count()
        slot_stats = ChargingSlot.objects.aggregate(
            total=Count('id'),
            available=Count('id', filter=Q(status='AVAILABLE')),
        )
        booking_qs = Booking.objects.all()
        total_bookings = booking_qs.count()
        revenue = booking_qs.aggregate(
            total=Sum('amount_charged')
        )['total'] or 0
        active_drivers = booking_qs.values('driver_id').distinct().count()

        return Response({
            'total_stations': total_stations,
            'total_slots': slot_stats['total'],
            'available_slots': slot_stats['available'],
            'total_bookings': total_bookings,
            'revenue': float(revenue),
            'active_drivers': active_drivers,
            'total_users': CustomUser.objects.count(),
            'total_drivers': CustomUser.objects.filter(role='DRIVER').count(),
        })


@extend_schema(tags=['Stations'])
class MyStationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stations = ChargingStation.objects.filter(
            owner=request.user
        ).select_related('owner').prefetch_related('slots').order_by('-created_at')
        paginator = StationPagination()
        page = paginator.paginate_queryset(stations, request)
        serializer = ChargingStationSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


@extend_schema(tags=['Stations'])
class FavoriteStationToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        station_id = request.data.get('station_id')
        if not station_id:
            return Response({'error': 'station_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            station = ChargingStation.objects.get(pk=station_id)
        except ChargingStation.DoesNotExist:
            return Response({'error': 'Station not found'}, status=status.HTTP_404_NOT_FOUND)

        fav, created = UserFavoriteStation.objects.get_or_create(
            user=request.user,
            station=station,
        )
        if not created:
            fav.delete()
            return Response({'favorited': False, 'message': 'Removed from favorites'})

        return Response({'favorited': True, 'message': 'Added to favorites'}, status=status.HTTP_201_CREATED)


@extend_schema(tags=['Stations'])
class FavoriteStationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        favorites = UserFavoriteStation.objects.filter(user=request.user).select_related('station')
        serializer = FavoriteStationSerializer(favorites, many=True)
        return Response(serializer.data)


@extend_schema(tags=['Stations'])
class StationReviewListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, station_pk):
        try:
            station = ChargingStation.objects.get(pk=station_pk)
        except ChargingStation.DoesNotExist:
            return Response({'error': 'Station not found'}, status=status.HTTP_404_NOT_FOUND)
        reviews = StationReview.objects.filter(station=station).select_related('user')
        serializer = StationReviewSerializer(reviews, many=True)
        return Response(serializer.data)

    def post(self, request, station_pk):
        try:
            station = ChargingStation.objects.get(pk=station_pk)
        except ChargingStation.DoesNotExist:
            return Response({'error': 'Station not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = StationReviewSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user, station=station)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=['Stations'])
class OwnerStationRevenueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ['STATION_OWNER', 'SUPER_ADMIN']:
            return Response({'error': 'Only station owners can view revenue'}, status=403)

        stations = ChargingStation.objects.all()
        if request.user.role == 'STATION_OWNER':
            stations = stations.filter(owner=request.user)

        revenue_data = []
        for station in stations:
            agg = Booking.objects.filter(
                slot__station=station,
                status__in=['CONFIRMED', 'IN_PROGRESS', 'COMPLETED']
            ).aggregate(
                total=Sum('amount_charged'),
                count=Count('id')
            )
            total_revenue = float(agg['total'] or 0)
            if total_revenue > 0:
                revenue_data.append({
                    'station_id': station.id,
                    'station_name': station.name,
                    'total_revenue': total_revenue,
                    'booking_count': agg['count'],
                })

        revenue_data.sort(key=lambda x: x['total_revenue'], reverse=True)
        serializer = OwnerRevenueSerializer(revenue_data, many=True)
        return Response(serializer.data)


@extend_schema(tags=['Stations'])
class MaintenanceListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, station_pk):
        try:
            station = ChargingStation.objects.get(pk=station_pk)
        except ChargingStation.DoesNotExist:
            return Response({'error': 'Station not found'}, status=404)

        if station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'Not your station'}, status=403)

        schedules = MaintenanceSchedule.objects.filter(station=station)
        serializer = MaintenanceScheduleSerializer(schedules, many=True)
        return Response(serializer.data)

    def post(self, request, station_pk):
        try:
            station = ChargingStation.objects.get(pk=station_pk)
        except ChargingStation.DoesNotExist:
            return Response({'error': 'Station not found'}, status=404)

        if station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'Not your station'}, status=403)

        serializer = MaintenanceScheduleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(station=station)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


@extend_schema(tags=['Stations'])
class MaintenanceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, station_pk, pk):
        try:
            return MaintenanceSchedule.objects.get(pk=pk, station__pk=station_pk)
        except MaintenanceSchedule.DoesNotExist:
            return None

    def get(self, request, station_pk, pk):
        schedule = self.get_object(station_pk, pk)
        if not schedule:
            return Response({'error': 'Maintenance schedule not found'}, status=404)
        if schedule.station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'Not your station'}, status=403)
        serializer = MaintenanceScheduleSerializer(schedule)
        return Response(serializer.data)

    def patch(self, request, station_pk, pk):
        schedule = self.get_object(station_pk, pk)
        if not schedule:
            return Response({'error': 'Maintenance schedule not found'}, status=404)
        if schedule.station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'Not your station'}, status=403)
        serializer = MaintenanceScheduleSerializer(schedule, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, station_pk, pk):
        schedule = self.get_object(station_pk, pk)
        if not schedule:
            return Response({'error': 'Maintenance schedule not found'}, status=404)
        if schedule.station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'Not your station'}, status=403)
        schedule.delete()
        return Response({'message': 'Maintenance schedule deleted'}, status=204)

