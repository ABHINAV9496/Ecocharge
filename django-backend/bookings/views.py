from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from events.helpers import send_slot_update
from notifications.helpers import create_notification
from stations.models import ChargingSlot, ChargingStation

from vehicles.models import VehicleProfile

from .models import Booking
from .serializers import BookingSerializer

CHARGER_POWER_MAP = {
    'DC_ULTRA': 150.0,
    'DC_FAST': 50.0,
    'AC_FAST': 7.4,
    'AC_SLOW': 3.3,
}

def calc_booking_cost(slot, start_time, end_time, vehicle=None):
    duration_hours = 1
    if end_time and start_time:
        try:
            from dateutil import parser
            st = parser.parse(start_time) if isinstance(start_time, str) else start_time
            et = parser.parse(end_time) if isinstance(end_time, str) else end_time
            duration_hours = (et - st).total_seconds() / 3600
        except Exception:
            duration_hours = 1

    nominal_power = CHARGER_POWER_MAP.get(slot.slot_type, 7.4)

    if vehicle:
        is_dc = slot.slot_type in ('DC_FAST', 'DC_ULTRA')
        vehicle_power = vehicle.fast_charge_kw if is_dc else vehicle.ac_charge_kw
        power_kw = min(vehicle_power, nominal_power) if vehicle_power else nominal_power
    else:
        power_kw = nominal_power

    estimated_kwh = duration_hours * power_kw
    return round(estimated_kwh * float(slot.rate_per_kwh), 2)


class BookingPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


@extend_schema(tags=['Bookings'])
class BookingListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'SUPER_ADMIN':
            bookings = Booking.objects.all().order_by('-created_at')
        elif request.user.role == 'STATION_OWNER':
            bookings = Booking.objects.filter(
                slot__station__owner=request.user
            ).order_by('-created_at')
        else:
            bookings = Booking.objects.filter(
                driver=request.user
            ).order_by('-created_at')

        q = request.query_params.get('q')
        if q:
            bookings = bookings.filter(
                Q(id__icontains=q) |
                Q(driver__username__icontains=q) |
                Q(slot__station__name__icontains=q)
            )

        status_filter = request.query_params.get('status')
        if status_filter and status_filter != 'ALL':
            bookings = bookings.filter(status=status_filter)

        days = request.query_params.get('days')
        if days:
            from datetime import timedelta
            cutoff = timezone.now() - timedelta(days=int(days))
            bookings = bookings.filter(created_at__gte=cutoff)

        page = request.query_params.get('page')
        if page:
            paginator = BookingPagination()
            page_obj = paginator.paginate_queryset(bookings, request)
            serializer = BookingSerializer(page_obj, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = BookingSerializer(bookings, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(tags=['Bookings'])
class CreateBookingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role not in ['DRIVER', 'GUEST']:
            return Response({'error': 'Only drivers can book'}, status=status.HTTP_403_FORBIDDEN)

        slot_id = request.data.get('slot')
        start_time = request.data.get('start_time')
        end_time = request.data.get('end_time')
        vehicle_id = request.data.get('vehicle_id')

        if not slot_id:
            return Response({'error': 'Slot ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            slot = ChargingSlot.objects.get(pk=slot_id)
        except ChargingSlot.DoesNotExist:
            return Response({'error': 'Slot not found'}, status=status.HTTP_404_NOT_FOUND)

        if slot.status != 'AVAILABLE':
            return Response({'error': 'Slot is not available'}, status=status.HTTP_400_BAD_REQUEST)

        if start_time:
            from django.utils import timezone
            try:
                from dateutil import parser
                st = parser.parse(start_time) if isinstance(start_time, str) else start_time
                if st < timezone.now():
                    return Response({'error': 'Cannot book in the past'}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                return Response({'error': 'Invalid start_time format'}, status=status.HTTP_400_BAD_REQUEST)

        vehicle = None
        if vehicle_id:
            try:
                vehicle = VehicleProfile.objects.get(pk=vehicle_id)
            except VehicleProfile.DoesNotExist:
                return Response({'error': 'Vehicle not found'}, status=status.HTTP_404_NOT_FOUND)

        amount = calc_booking_cost(slot, start_time, end_time, vehicle)

        try:
            with transaction.atomic():
                slot = ChargingSlot.objects.select_for_update().get(pk=slot.pk)
                if slot.status != 'AVAILABLE':
                    return Response({'error': 'Slot was just booked'}, status=status.HTTP_400_BAD_REQUEST)

                if start_time and end_time:
                    from dateutil import parser
                    st = parser.parse(start_time) if isinstance(start_time, str) else start_time
                    et = parser.parse(end_time) if isinstance(end_time, str) else end_time
                    overlapping = Booking.objects.filter(
                        slot=slot,
                        status__in=['CONFIRMED', 'IN_PROGRESS'],
                        end_time__gt=st,
                        start_time__lt=et,
                    ).exists()
                    if overlapping:
                        return Response({'error': 'This slot is already booked for the selected time'}, status=status.HTTP_400_BAD_REQUEST)

                booking = Booking.objects.create(
                    driver=request.user,
                    slot=slot,
                    vehicle=vehicle,
                    start_time=start_time,
                    end_time=end_time,
                    status='PENDING',
                    amount_charged=amount,
                )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        create_notification(
            user=request.user,
            notification_type='BOOKING',
            title='Booking Created',
            message=f'Booking at {booking.slot.station.name} created. Complete payment to confirm.',
            link='/bookings',
        )

        return Response(
            {'id': booking.id, 'status': 'PENDING', 'amount_charged': float(booking.amount_charged)},
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=['Bookings'])
class BookingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return None

    def get(self, request, pk):
        booking = self.get_object(pk, request.user)
        if not booking:
            return Response(
                {'error': 'Booking not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        if booking.driver != request.user and request.user.role != 'SUPER_ADMIN':
            return Response(
                {'error': 'You can only view your own bookings'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = BookingSerializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        booking = self.get_object(pk, request.user)
        if not booking:
            return Response(
                {'error': 'Booking not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        if booking.driver != request.user:
            return Response(
                {'error': 'You can only cancel your own bookings'},
                status=status.HTTP_403_FORBIDDEN
            )
        if booking.status == 'CANCELLED':
            return Response(
                {'error': 'Booking is already cancelled'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if booking.status == 'COMPLETED':
            return Response(
                {'error': 'Cannot cancel a completed booking'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                slot = booking.slot
                slot.status = 'AVAILABLE'
                slot.save()

                booking.status = 'CANCELLED'
                booking.save()

            send_slot_update(slot.station.id)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            from payments.models import Payment
            payment = Payment.objects.get(booking=booking, status='AUTHORIZED')
            import razorpay
            from django.conf import settings
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            client.payment.refund(payment.razorpay_payment_id, {})
            payment.status = 'REFUNDED'
            payment.refunded_at = timezone.now()
            payment.save(update_fields=['status', 'refunded_at'])
        except Payment.DoesNotExist:
            pass
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('Payment refund failed: %s', e)

        create_notification(
            user=request.user,
            notification_type='BOOKING',
            title='Booking Cancelled',
            message=f'Your booking at {booking.slot.station.name} has been cancelled',
            link='/bookings',
        )

        return Response(
            {'message': 'Booking cancelled successfully.'},
            status=status.HTTP_200_OK
        )


@extend_schema(tags=['Bookings'])
class BookingStartView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if booking.driver != request.user:
            return Response({'error': 'You can only start your own charging'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status != 'CONFIRMED':
            return Response({'error': 'Booking must be CONFIRMED to start charging'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            booking.status = 'IN_PROGRESS'
            booking.save()

            slot = booking.slot
            slot.status = 'OCCUPIED'
            slot.save(update_fields=['status'])

            send_slot_update(slot.station.id)

        create_notification(
            user=request.user,
            notification_type='BOOKING',
            title='Charging Started',
            message=f'Charging started at {booking.slot.station.name}',
            link='/bookings',
        )

        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)


@extend_schema(tags=['Bookings'])
class BookingCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if booking.driver != request.user:
            return Response({'error': 'You can only complete your own charging'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status != 'IN_PROGRESS':
            return Response({'error': 'Booking must be IN_PROGRESS to complete charging'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            slot = booking.slot
            slot.status = 'AVAILABLE'
            slot.save()

            booking.status = 'COMPLETED'
            booking.save()

            send_slot_update(slot.station.id)

        try:
            from payments.models import Payment
            payment = Payment.objects.get(booking=booking, status='AUTHORIZED')
            import razorpay
            from django.conf import settings
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            capture_amount = int(float(payment.amount) * 100)
            client.payment.capture(payment.razorpay_payment_id, capture_amount, {'currency': 'INR'})
            payment.status = 'CAPTURED'
            payment.captured_at = timezone.now()
            payment.save(update_fields=['status', 'captured_at'])
        except Payment.DoesNotExist:
            pass
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('Payment capture failed: %s', e)

        create_notification(
            user=request.user,
            notification_type='BOOKING',
            title='Charging Completed',
            message=f'Charging completed at {booking.slot.station.name}. ₹{booking.amount_charged} charged.',
            link='/bookings',
        )

        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)


@extend_schema(tags=['Bookings'])
class BookingOwnerCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if booking.slot.station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'You can only manage bookings on your own stations'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status not in ['CONFIRMED', 'IN_PROGRESS']:
            return Response({'error': 'Booking is not in an active state'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            slot = booking.slot
            slot.status = 'AVAILABLE'
            slot.save()

            booking.status = 'COMPLETED'
            booking.save()

            send_slot_update(slot.station.id)

        create_notification(
            user=booking.driver,
            notification_type='BOOKING',
            title='Charging Force Completed',
            message=f'Your charging session at {booking.slot.station.name} was marked complete by the station owner.',
            link='/bookings',
        )

        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)


@extend_schema(tags=['Bookings'])
class BookingOwnerNoShowView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if booking.slot.station.owner != request.user and request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'You can only manage bookings on your own stations'}, status=status.HTTP_403_FORBIDDEN)

        if booking.status != 'CONFIRMED':
            return Response({'error': 'Only CONFIRMED bookings can be marked as no show'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            slot = booking.slot
            slot.status = 'AVAILABLE'
            slot.save()

            booking.status = 'CANCELLED'
            booking.save()

            send_slot_update(slot.station.id)

        create_notification(
            user=booking.driver,
            notification_type='BOOKING',
            title='Booking Marked No Show',
            message=f'Your booking at {booking.slot.station.name} was cancelled because you did not show up.',
            link='/bookings',
        )

        return Response({'message': 'Booking marked as no show.'}, status=status.HTTP_200_OK)


@extend_schema(tags=['Bookings'])
class HeatmapView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        days = request.query_params.get('days', '90')

        stations = ChargingStation.objects.annotate(
            booking_count=Count('slots__bookings')
        ).filter(booking_count__gt=0)

        if days:
            from datetime import timedelta
            cutoff = timezone.now() - timedelta(days=int(days))
            stations = stations.filter(slots__bookings__created_at__gte=cutoff)

        station_list = list(stations)
        max_count = max((s.booking_count for s in station_list), default=1)
        data = []
        for s in station_list:
            data.append({
                'lat': s.location.y,
                'lng': s.location.x,
                'count': s.booking_count,
                'intensity': s.booking_count / max_count,
            })

        return Response(data, status=status.HTTP_200_OK)
