from contact.serializers import ContactSerializer


class TestContactSerializer:
    def test_valid_message(self):
        data = {
            'name': 'John Doe',
            'email': 'john@example.com',
            'message': 'Hello, I need help.',
        }
        serializer = ContactSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

    def test_missing_name(self):
        data = {'email': 'john@test.com', 'message': 'Hi'}
        serializer = ContactSerializer(data=data)
        assert not serializer.is_valid()
        assert 'name' in serializer.errors

    def test_invalid_email(self):
        data = {
            'name': 'John',
            'email': 'not-an-email',
            'message': 'Hello',
        }
        serializer = ContactSerializer(data=data)
        assert not serializer.is_valid()
        assert 'email' in serializer.errors
