from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from drf_spectacular.utils import extend_schema
from django.conf import settings
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
