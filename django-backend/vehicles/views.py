from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema
from .models import VehicleProfile
from .serializers import VehicleProfileSerializer, CreateVehicleSerializer

@extend_schema(tags=['Vehicles'])
class VehicleListView(APIView):

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        vehicles = VehicleProfile.objects.filter(is_builtin=True)
        if request.user.is_authenticated:
            custom = VehicleProfile.objects.filter(
                is_builtin=False, owner=request.user
            )
            vehicles = vehicles | custom
        serializer = VehicleProfileSerializer(vehicles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CreateVehicleSerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            vehicle = serializer.save()
            return Response(
                VehicleProfileSerializer(vehicle).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=['Vehicles'])
class VehicleDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            vehicle = VehicleProfile.objects.get(pk=pk)
        except VehicleProfile.DoesNotExist:
            return Response(
                {'error': 'Vehicle not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = VehicleProfileSerializer(vehicle)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        try:
            vehicle = VehicleProfile.objects.get(pk=pk)
        except VehicleProfile.DoesNotExist:
            return Response(
                {'error': 'Vehicle not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        if vehicle.is_builtin:
            return Response(
                {'error': 'Cannot delete built-in vehicle'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if vehicle.owner != request.user:
            return Response(
                {'error': 'You can only delete your own vehicles'},
                status=status.HTTP_403_FORBIDDEN
            )
        vehicle.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
