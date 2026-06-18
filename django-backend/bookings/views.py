import razorpay
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from .models import Booking
from .serializers import BookingSerializer, CreateBookingSerializer
from stations.models import ChargingSlot, ChargingStation
from .tasks import send_booking_confirmation


def calc_booking_cost(slot, start_time, end_time):
    duration_hours = 1
    if end_time:
        duration_hours = (end_time - start_time).seconds / 3600
    estimated_kwh = duration_hours * 7.4
    return round(estimated_kwh * float(slot.rate_per_kwh), 2)


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

        serializer = BookingSerializer(bookings, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(tags=['Bookings'])
class CreateOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role not in ['DRIVER', 'GUEST']:
            return Response({'error': 'Only drivers can book'}, status=status.HTTP_403_FORBIDDEN)

        slot_id = request.data.get('slot')
        start_time = request.data.get('start_time')
        end_time = request.data.get('end_time')

        try:
            slot = ChargingSlot.objects.get(pk=slot_id)
        except ChargingSlot.DoesNotExist:
            return Response({'error': 'Slot not found'}, status=status.HTTP_404_NOT_FOUND)

        if slot.status != 'AVAILABLE':
            return Response({'error': 'Slot is not available'}, status=status.HTTP_400_BAD_REQUEST)

        amount = calc_booking_cost(slot, start_time, end_time)
        amount_paise = int(amount * 100)

        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        order = client.order.create({
            'amount': amount_paise,
            'currency': 'INR',
            'receipt': f'booking_{slot_id}_{request.user.id}',
            'payment_capture': 1,
        })

        return Response({
            'order_id': order['id'],
            'amount': amount_paise,
            'amount_display': amount,
            'currency': 'INR',
            'key_id': settings.RAZORPAY_KEY_ID,
            'slot_id': slot.id,
            'start_time': start_time,
            'end_time': end_time,
        }, status=status.HTTP_200_OK)


@extend_schema(tags=['Bookings'])
class VerifyPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role not in ['DRIVER', 'GUEST']:
            return Response({'error': 'Only drivers can book'}, status=status.HTTP_403_FORBIDDEN)

        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_signature = request.data.get('razorpay_signature')
        slot_id = request.data.get('slot_id')
        start_time = request.data.get('start_time')
        end_time = request.data.get('end_time')

        # verify signature
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature,
        }
        try:
            client.utility.verify_payment_signature(params_dict)
        except razorpay.errors.SignatureVerificationError:
            return Response({'error': 'Payment verification failed'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            slot = ChargingSlot.objects.get(pk=slot_id)
        except ChargingSlot.DoesNotExist:
            return Response({'error': 'Slot not found'}, status=status.HTTP_404_NOT_FOUND)

        amount = calc_booking_cost(slot, start_time, end_time)

        try:
            with transaction.atomic():
                slot = ChargingSlot.objects.select_for_update().get(pk=slot.pk)
                if slot.status != 'AVAILABLE':
                    return Response({'error': 'Slot was just booked'}, status=status.HTTP_400_BAD_REQUEST)

                booking = Booking.objects.create(
                    driver=request.user,
                    slot=slot,
                    start_time=start_time,
                    end_time=end_time,
                    status='CONFIRMED',
                    amount_charged=amount,
                )

                slot.status = 'OCCUPIED'
                slot.save()
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        send_booking_confirmation.delay(booking.id)

        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


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
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {'message': 'Booking cancelled. Refund processed via Razorpay.'},
            status=status.HTTP_200_OK
        )


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