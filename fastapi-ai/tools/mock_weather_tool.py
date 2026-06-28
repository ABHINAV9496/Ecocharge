from tools.base import BaseTool


class MockWeatherTool(BaseTool):
    name = 'mock_weather_tool'
    description = 'Get current weather conditions for a city. Use this when the user asks about weather, temperature, or driving conditions.'
    parameters = {
        'type': 'object',
        'properties': {
            'location': {
                'type': 'string',
                'description': 'City or location name',
            },
        },
        'required': ['location'],
    }

    async def execute(self, **kwargs) -> dict:
        location = kwargs.get('location', 'Unknown')
        return {
            'location': location,
            'temperature_celsius': 31,
            'condition': 'Cloudy',
            'humidity_percent': 68,
            'wind_speed_kmh': 12,
            'precipitation_chance_percent': 20,
        }
