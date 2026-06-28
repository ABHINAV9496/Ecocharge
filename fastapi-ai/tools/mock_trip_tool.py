from tools.base import BaseTool


class MockTripTool(BaseTool):
    name = 'mock_trip_tool'
    description = 'Plan an EV road trip between two cities — returns distance, charging stops needed, and estimated cost. Use this when the user asks about trip planning, road trips, or driving between cities.'
    parameters = {
        'type': 'object',
        'properties': {
            'origin': {
                'type': 'string',
                'description': 'Starting city or location',
            },
            'destination': {
                'type': 'string',
                'description': 'Destination city or location',
            },
        },
        'required': ['origin', 'destination'],
    }

    async def execute(self, **kwargs) -> dict:
        origin = kwargs.get('origin', 'Unknown')
        destination = kwargs.get('destination', 'Unknown')
        return {
            'origin': origin,
            'destination': destination,
            'distance_km': 530,
            'charging_stops': 4,
            'total_cost_inr': 1450,
            'estimated_drive_time_minutes': 390,
            'total_charge_time_minutes': 120,
        }
