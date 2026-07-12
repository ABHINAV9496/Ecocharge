from rest_framework import serializers

from .models import VehicleProfile


class VehicleProfileSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = VehicleProfile
        fields = [
            'id', 'make', 'model', 'year', 'battery_kwh',
            'consumption_wh_per_km', 'fast_charge_kw', 'ac_charge_kw',
            'charging_curve', 'is_builtin', 'created_at', 'image',
        ]
        read_only_fields = ['id', 'is_builtin', 'created_at', 'image']

    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

class CreateVehicleSerializer(serializers.ModelSerializer):
    charging_curve = serializers.JSONField(required=False)
    image = serializers.ImageField(required=False)

    class Meta:
        model = VehicleProfile
        fields = [
            'make', 'model', 'year', 'battery_kwh',
            'consumption_wh_per_km', 'fast_charge_kw', 'ac_charge_kw',
            'charging_curve', 'image',
        ]

    def create(self, validated_data):
        validated_data['is_builtin'] = False
        validated_data['owner'] = self.context['request'].user
        count = VehicleProfile.objects.filter(is_builtin=False).count()
        validated_data['id'] = 'custom-' + str(count + 1)
        return super().create(validated_data)
