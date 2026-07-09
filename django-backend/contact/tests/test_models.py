from contact.models import ContactMessage


class TestContactMessage:
    def test_create_message(self, db):
        msg = ContactMessage.objects.create(
            name='John Doe',
            email='john@example.com',
            message='I have a question about charging stations.',
        )
        assert msg.name == 'John Doe'
        assert msg.email == 'john@example.com'
        assert str(msg) == 'John Doe - john@example.com'

    def test_message_timestamps(self, db):
        msg = ContactMessage.objects.create(
            name='Jane', email='jane@test.com', message='Hello'
        )
        assert msg.created_at is not None
