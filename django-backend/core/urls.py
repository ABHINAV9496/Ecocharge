"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from .views import GeocodeView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/stations/', include('stations.urls')),
    path('api/bookings/', include('bookings.urls')),
    path('api/trips/', include('trips.urls')),

    path('api/contact/', include('contact.urls')),
    path('api/vehicles/', include('vehicles.urls')),
    path('api/payments/', include('payments.urls')),

    # Geocoding proxy
    path('api/geocode/', GeocodeView.as_view(), name='geocode'),

    # Events test endpoint
    path('api/events/', include('events.urls')),

    # Notifications
    path('api/notifications/', include('notifications.urls')),

    # Knowledge / RAG
    path('api/knowledge/', include('knowledge.urls')),

    # Weather
    path('api/weather/', include('weather.urls')),

    # Swagger
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
