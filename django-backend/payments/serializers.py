from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    booking_station = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id', 'booking', 'booking_station', 'razorpay_order_id', 'razorpay_payment_id',
            'amount', 'currency', 'status', 'created_at', 'captured_at', 'refunded_at',
        ]
        read_only_fields = fields

    def get_booking_station(self, obj):
        try:
            return obj.booking.slot.station.name
        except AttributeError:
            return None


class CreateOrderSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField()

    def validate_booking_id(self, value):
        if value <= 0:
            raise serializers.ValidationError('Invalid booking ID')
        return value


class VerifyPaymentSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField()
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()


class CapturePaymentSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField()
