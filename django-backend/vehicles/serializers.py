from rest_framework import serializers
from .models import VehicleProfile

class VehicleProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleProfile
        fields = [
            'id', 'make', 'model', 'year', 'battery_kwh',
            'consumption_wh_per_km', 'fast_charge_kw', 'ac_charge_kw',
            'charging_curve', 'is_builtin', 'created_at',
        ]
        read_only_fields = ['id', 'is_builtin', 'created_at']

class CreateVehicleSerializer(serializers.ModelSerializer):
    charging_curve = serializers.JSONField(required=False)

    class Meta:
        model = VehicleProfile
        fields = [
            'make', 'model', 'year', 'battery_kwh',
            'consumption_wh_per_km', 'fast_charge_kw', 'ac_charge_kw',
            'charging_curve',
        ]

    def create(self, validated_data):
        validated_data['is_builtin'] = False
        validated_data['owner'] = self.context['request'].user
        count = VehicleProfile.objects.filter(is_builtin=False).count()
        validated_data['id'] = 'custom-' + str(count + 1)
        return super().create(validated_data)
