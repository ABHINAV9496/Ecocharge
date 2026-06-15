from rest_framework import generics, permissions
from .models import Trip
from .serializers import TripSerializer
from users.permissions import IsDriver


class TripListCreateView(generics.ListCreateAPIView):
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated, IsDriver]

    def get_queryset(self):
        return Trip.objects.filter(driver=self.request.user).order_by('-created_at')


class TripDetailView(generics.RetrieveAPIView):
    serializer_class = TripSerializer
    permission_classes = [permissions.IsAuthenticated, IsDriver]

    def get_queryset(self):
        return Trip.objects.filter(driver=self.request.user)
