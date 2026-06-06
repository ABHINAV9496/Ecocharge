from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from .models import Booking
from .serializers import BookingSerializer, CreateBookingSerializer
from wallet.models import WalletTransaction
from stations.models import ChargingSlot
from .tasks import send_booking_confirmation


def get_wallet_balance(user):
    last_transaction = WalletTransaction.objects.filter(
        user=user
    ).order_by('-created_at').first()
    return last_transaction.balance_after if last_transaction else 0


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

    def post(self, request):
        if request.user.role not in ['DRIVER', 'GUEST']:
            return Response(
                {'error': 'Only drivers can make bookings'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CreateBookingSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        slot = serializer.validated_data['slot']
        start_time = serializer.validated_data['start_time']
        end_time = serializer.validated_data.get('end_time')

        # calculate estimated cost
        duration_hours = 1
        if end_time:
            duration_hours = (end_time - start_time).seconds / 3600

        estimated_kwh = duration_hours * 7.4
        estimated_cost = estimated_kwh * float(slot.rate_per_kwh)

        # check wallet balance
        balance = get_wallet_balance(request.user)
        if float(balance) < estimated_cost:
            return Response(
                {
                    'error': 'Insufficient wallet balance',
                    'required': estimated_cost,
                    'available': float(balance)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # atomic transaction — prevent double booking
        try:
            with transaction.atomic():
                # lock the slot row
                slot = ChargingSlot.objects.select_for_update().get(pk=slot.pk)

                if slot.status != 'AVAILABLE':
                    return Response(
                        {'error': 'Slot was just booked by someone else'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # create booking
                booking = Booking.objects.create(
                    driver=request.user,
                    slot=slot,
                    start_time=start_time,
                    end_time=end_time,
                    status='CONFIRMED',
                    amount_charged=estimated_cost
                )

                # mark slot as occupied
                slot.status = 'OCCUPIED'
                slot.save()

                # deduct from wallet
                new_balance = float(balance) - estimated_cost
                WalletTransaction.objects.create(
                    user=request.user,
                    transaction_type='DEDUCTION',
                    amount=estimated_cost,
                    balance_after=new_balance,
                    description=f'Booking #{booking.id} - {slot.station.name}'
                )

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # trigger confirmation task in background
        send_booking_confirmation.delay(booking.id)

        return Response(
            BookingSerializer(booking).data,
            status=status.HTTP_201_CREATED
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
                # refund wallet
                balance = get_wallet_balance(request.user)
                new_balance = float(balance) + float(booking.amount_charged)
                WalletTransaction.objects.create(
                    user=request.user,
                    transaction_type='REFUND',
                    amount=booking.amount_charged,
                    balance_after=new_balance,
                    description=f'Refund for cancelled Booking #{booking.id}'
                )

                # free up the slot
                slot = booking.slot
                slot.status = 'AVAILABLE'
                slot.save()

                # cancel booking
                booking.status = 'CANCELLED'
                booking.save()

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {'message': 'Booking cancelled and refund processed'},
            status=status.HTTP_200_OK
        )