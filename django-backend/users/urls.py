from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    UserAdminView,
    RegisterView, LoginView, LogoutView, UserProfileView, GoogleLoginView,
    PasswordResetRequestView, PasswordResetConfirmView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('google/', GoogleLoginView.as_view(), name='google-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view()),
    path('users/', UserAdminView.as_view(), name='user-list'),
    path('users/<int:user_id>/', UserAdminView.as_view(), name='user-detail'),
]
