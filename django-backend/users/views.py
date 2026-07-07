import uuid
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from drf_spectacular.utils import extend_schema
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from .serializers import RegisterSerializer, UserProfileSerializer
from .models import CustomUser


@extend_schema(tags=['Authentication'])
class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Send welcome email if SMTP is configured
        if settings.EMAIL_HOST and user.email:
            try:
                html_content = render_to_string('emails/welcome.html', {
                    'username': user.username,
                    'map_url': 'http://localhost:5173/map',
                })
                text_content = strip_tags(html_content)
                email = EmailMultiAlternatives(
                    subject='Welcome to EcoCharge! ⚡',
                    body=text_content,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[user.email],
                )
                email.attach_alternative(html_content, 'text/html')
                email.send(fail_silently=False)
            except Exception:
                pass  # Email failure should not block registration

        return Response({
            'user': UserProfileSerializer(user).data,
            'message': f'Welcome to EcoCharge, {user.username}! Your account has been created.',
        }, status=status.HTTP_201_CREATED)


@extend_schema(tags=['Authentication'])
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {'error': 'Username and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = CustomUser.objects.get(username=username)
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.check_password(password):
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        return self._login_response(user)

    def _login_response(self, user):
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
            }
        }, status=status.HTTP_200_OK)


@extend_schema(tags=['Authentication'])
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if not refresh_token:
                return Response(
                    {'error': 'Refresh token is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {'message': 'Logged out successfully'},
                status=status.HTTP_200_OK
            )
        except TokenError:
            return Response(
                {'error': 'Invalid or expired token'},
                status=status.HTTP_400_BAD_REQUEST
            )


@extend_schema(tags=['Authentication'])
class UserProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user


@extend_schema(tags=['Authentication'])
class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('id_token')
        if not token:
            return Response(
                {'error': 'ID token is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        client_id = settings.GOOGLE_CLIENT_ID
        if not client_id:
            return Response(
                {'error': 'Google login is not configured on the server'},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests
            info = google_id_token.verify_oauth2_token(
                token, google_requests.Request(), client_id
            )
        except ValueError as e:
            return Response(
                {'error': 'Invalid token: ' + str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        email = info.get('email')
        if not email:
            return Response(
                {'error': 'Email not provided by Google'},
                status=status.HTTP_400_BAD_REQUEST
            )

        name = info.get('name', '')
        base_username = email.split('@')[0]

        try:
            user = CustomUser.objects.get(email=email)
            created = False
        except CustomUser.DoesNotExist:
            username = base_username
            if CustomUser.objects.filter(username=username).exists():
                import uuid
                username = base_username + '-' + str(uuid.uuid4())[:6]
            user = CustomUser.objects.create(
                username=username,
                email=email,
                role='DRIVER',
            )
            user.set_unusable_password()
            user.save()
            created = True

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
            },
            'is_new': created,
        }, status=status.HTTP_200_OK)


token_generator = PasswordResetTokenGenerator()
_password_reset_tokens = {}  # email -> (token, uid)


@extend_schema(tags=['Authentication'])
class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            return Response({'message': 'If this email is registered, a reset link has been sent.'})

        token = token_generator.make_token(user)
        uid = user.pk
        _password_reset_tokens[email] = (token, uid)

        reset_url = f"http://localhost:5173/reset-password?uid={uid}&token={token}"

        if settings.EMAIL_HOST and user.email:
            try:
                html_content = render_to_string('emails/password_reset.html', {
                    'username': user.username,
                    'reset_url': reset_url,
                })
                text_content = strip_tags(html_content)
                email_msg = EmailMultiAlternatives(
                    subject='EcoCharge — Password Reset',
                    body=text_content,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[user.email],
                )
                email_msg.attach_alternative(html_content, 'text/html')
                email_msg.send(fail_silently=False)
            except Exception:
                pass

        return Response({'message': 'If this email is registered, a reset link has been sent.'})


@extend_schema(tags=['Authentication'])
class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get('uid')
        token = request.data.get('token')
        password = request.data.get('password')
        password2 = request.data.get('password2')

        if not all([uid, token, password, password2]):
            return Response({'error': 'uid, token, password, and password2 are required'}, status=status.HTTP_400_BAD_REQUEST)

        if password != password2:
            return Response({'error': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = CustomUser.objects.get(pk=uid)
        except CustomUser.DoesNotExist:
            return Response({'error': 'Invalid reset link'}, status=status.HTTP_400_BAD_REQUEST)

        if not token_generator.check_token(user, token):
            return Response({'error': 'Invalid or expired reset link'}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth.password_validation import validate_password
        try:
            validate_password(password)
        except Exception as e:
            return Response({'error': list(e)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save()

        return Response({'message': 'Password has been reset successfully. You can now login.'})

@extend_schema(tags=['Admin'])
class UserAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'Only SUPER_ADMIN can manage users'}, status=403)

        users = CustomUser.objects.all().order_by('-date_joined')
        serializer = UserProfileSerializer(users, many=True)
        return Response(serializer.data, status=200)

    def patch(self, request, user_id):
        if request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'Only SUPER_ADMIN can manage users'}, status=403)

        try:
            user = CustomUser.objects.get(pk=user_id)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        role = request.data.get('role')
        if role and role in dict(CustomUser.Role.choices):
            user.role = role
            user.save(update_fields=['role'])
            return Response(UserProfileSerializer(user).data, status=200)

        return Response({'error': 'Invalid role'}, status=400)

    def delete(self, request, user_id):
        if request.user.role != 'SUPER_ADMIN':
            return Response({'error': 'Only SUPER_ADMIN can manage users'}, status=403)

        try:
            user = CustomUser.objects.get(pk=user_id)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        if user == request.user:
            return Response({'error': 'Cannot delete yourself'}, status=400)

        user.delete()
        return Response({'message': 'User deleted'}, status=200)
