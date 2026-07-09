from payments.serializers import CreateOrderSerializer, VerifyPaymentSerializer


class TestCreateOrderSerializer:
    def test_valid_booking_id(self):
        serializer = CreateOrderSerializer(data={'booking_id': 1})
        assert serializer.is_valid(), serializer.errors

    def test_invalid_booking_id(self):
        serializer = CreateOrderSerializer(data={'booking_id': 0})
        assert not serializer.is_valid()

    def test_missing_booking_id(self):
        serializer = CreateOrderSerializer(data={})
        assert not serializer.is_valid()


class TestVerifyPaymentSerializer:
    def test_valid_data(self):
        data = {
            'booking_id': 1,
            'razorpay_order_id': 'order_test_123',
            'razorpay_payment_id': 'pay_test_456',
            'razorpay_signature': 'sig_test_789',
        }
        serializer = VerifyPaymentSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_missing_fields(self):
        serializer = VerifyPaymentSerializer(data={})
        assert not serializer.is_valid()
