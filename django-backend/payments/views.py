import hashlib
import hmac
import logging
from datetime import timedelta

import razorpay
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone as tz
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking
from events.helpers import send_slot_update
from notifications.helpers import create_notification

from .models import Payment
from .serializers import (
    CapturePaymentSerializer,
    CreateOrderSerializer,
    PaymentSerializer,
    VerifyPaymentSerializer,
)

logger = logging.getLogger(__name__)


class PaymentPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


def _get_razorpay_client():
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


def _verify_razorpay_signature(order_id, payment_id, signature):
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        (order_id + '|' + payment_id).encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@extend_schema(tags=['Payments'])
class CreateOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        booking_id = serializer.validated_data['booking_id']

        try:
            with transaction.atomic():
                booking = Booking.objects.select_for_update().get(
                    pk=booking_id, driver=request.user
                )
                if booking.status not in ('PENDING', 'CONFIRMED'):
                    return Response(
                        {'error': 'Booking is not in a payable state'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                amount = int(float(booking.amount_charged) * 100)
        except Booking.DoesNotExist:
            return Response(
                {'error': 'Booking not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            client = _get_razorpay_client()
            razorpay_order = client.order.create({
                'amount': amount,
                'currency': 'INR',
                'payment_capture': 0,
                'notes': {
                    'booking_id': str(booking.id),
                    'user_id': str(request.user.id),
                },
            })
        except Exception as e:
            logger.error('Razorpay order creation failed: %s', e)
            return Response(
                {'error': 'Payment service unavailable. Try again.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        Payment.objects.create(
            booking=booking,
            user=request.user,
            razorpay_order_id=razorpay_order['id'],
            amount=booking.amount_charged,
            status=Payment.Status.CREATED,
        )

        return Response(
            {
                'order_id': razorpay_order['id'],
                'amount': amount,
                'currency': 'INR',
                'key_id': settings.RAZORPAY_KEY_ID,
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=['Payments'])
class VerifyPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = VerifyPaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        try:
            payment = Payment.objects.select_related('booking').get(
                booking_id=data['booking_id'],
                razorpay_order_id=data['razorpay_order_id'],
                user=request.user,
            )
        except Payment.DoesNotExist:
            return Response(
                {'error': 'Payment record not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if payment.status != Payment.Status.CREATED:
            return Response(
                {'error': f'Payment already in state: {payment.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not _verify_razorpay_signature(
            data['razorpay_order_id'],
            data['razorpay_payment_id'],
            data['razorpay_signature'],
        ):
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=['status'])
            return Response(
                {'error': 'Payment verification failed'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            payment.razorpay_payment_id = data['razorpay_payment_id']
            payment.razorpay_signature = data['razorpay_signature']
            payment.status = Payment.Status.AUTHORIZED
            payment.save(update_fields=[
                'razorpay_payment_id', 'razorpay_signature', 'status',
            ])

            booking = payment.booking
            booking.status = 'CONFIRMED'
            booking.save(update_fields=['status'])

            slot = booking.slot
            slot.status = 'OCCUPIED'
            slot.save(update_fields=['status'])

            send_slot_update(slot.station.id)

        create_notification(
            user=request.user,
            notification_type='PAYMENT',
            title='Payment Authorized',
            message=f'₹{payment.amount} authorized for booking #{booking.id}. Charge captured on completion.',
            link='/bookings',
        )

        return Response(
            {
                'status': 'AUTHORIZED',
                'message': 'Payment authorized. Amount will be captured on charge completion.',
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(tags=['Payments'])
class CapturePaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CapturePaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        booking_id = serializer.validated_data['booking_id']

        try:
            payment = Payment.objects.select_related('booking').get(
                booking_id=booking_id,
                user=request.user,
                status=Payment.Status.AUTHORIZED,
            )
        except Payment.DoesNotExist:
            return Response(
                {'error': 'No authorized payment found for this booking'},
                status=status.HTTP_404_NOT_FOUND,
            )

        amount = int(float(payment.amount) * 100)

        try:
            client = _get_razorpay_client()
            client.payment.capture(
                payment.razorpay_payment_id, amount, {'currency': 'INR'}
            )
        except Exception as e:
            logger.error('Razorpay capture failed: %s', e)
            return Response(
                {'error': 'Payment capture failed. Please contact support.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        with transaction.atomic():
            payment.status = Payment.Status.CAPTURED
            payment.captured_at = tz.now()
            payment.save(update_fields=['status', 'captured_at'])

            booking = payment.booking

            slot = booking.slot
            slot.status = 'AVAILABLE'
            slot.save(update_fields=['status'])

            booking.status = 'COMPLETED'
            booking.save(update_fields=['status'])

            send_slot_update(slot.station.id)

        create_notification(
            user=request.user,
            notification_type='PAYMENT',
            title='Payment Captured',
            message=f'₹{payment.amount} charged for charging at {booking.slot.station.name}.',
            link='/bookings',
        )

        return Response(
            {
                'status': 'CAPTURED',
                'message': f'₹{payment.amount} charged successfully.',
                'razorpay_payment_id': payment.razorpay_payment_id,
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(tags=['Payments'])
class PaymentStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id):
        try:
            payment = Payment.objects.get(
                booking_id=booking_id, user=request.user
            )
        except Payment.DoesNotExist:
            return Response(
                {'payment': None, 'status': None},
                status=status.HTTP_200_OK,
            )

        serializer = PaymentSerializer(payment)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(tags=['Payments'])
class PaymentHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payments = Payment.objects.all().order_by('-created_at')
        if request.user.role != 'SUPER_ADMIN':
            payments = payments.filter(user=request.user)

        q = request.query_params.get('q')
        if q:
            payments = payments.filter(
                Q(id__icontains=q) |
                Q(razorpay_order_id__icontains=q) |
                Q(user__username__icontains=q) |
                Q(booking__slot__station__name__icontains=q)
            )

        days = request.query_params.get('days')
        if days:
            cutoff = tz.now() - timedelta(days=int(days))
            payments = payments.filter(created_at__gte=cutoff)

        page = request.query_params.get('page')
        if page:
            paginator = PaymentPagination()
            page_obj = paginator.paginate_queryset(payments, request)
            serializer = PaymentSerializer(page_obj, many=True)
            total = sum(float(p.amount) for p in page_obj if p.status in (
                Payment.Status.CAPTURED, Payment.Status.AUTHORIZED
            ))
            result = paginator.get_paginated_response(serializer.data)
            result.data['total_captured'] = round(total, 2)
            return result

        serializer = PaymentSerializer(payments, many=True)
        total = sum(float(p.amount) for p in payments if p.status in (
            Payment.Status.CAPTURED, Payment.Status.AUTHORIZED
        ))
        return Response(
            {
                'payments': serializer.data,
                'total_captured': round(total, 2),
            },
            status=status.HTTP_200_OK,
        )


@extend_schema(tags=['Payments'])
class PaymentDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, payment_id):
        if request.user.role != 'SUPER_ADMIN':
            return Response(
                {'error': 'Only super admins can delete payments'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            payment = Payment.objects.get(pk=payment_id)
        except Payment.DoesNotExist:
            return Response(
                {'error': 'Payment not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if payment.status not in ('CREATED', 'FAILED'):
            return Response(
                {'error': f'Cannot delete payment in status: {payment.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment.delete()
        return Response(
            {'message': 'Payment deleted successfully'},
            status=status.HTTP_200_OK,
        )
