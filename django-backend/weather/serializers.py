from rest_framework import serializers


class CurrentWeatherSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class ForecastSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class CityWeatherSerializer(serializers.Serializer):
    city = serializers.CharField()


class RouteWeatherSerializer(serializers.Serializer):
    route_coords = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField()),
        allow_empty=False,
    )


class WeatherPointSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    temperature = serializers.FloatField(allow_null=True)
    description = serializers.CharField(allow_null=True)
    icon = serializers.CharField(allow_null=True)
    precipitation_probability = serializers.FloatField(allow_null=True)
    wind_speed = serializers.FloatField(allow_null=True)
    weather_code = serializers.IntegerField(allow_null=True)
