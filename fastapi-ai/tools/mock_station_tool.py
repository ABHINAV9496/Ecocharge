from tools.base import BaseTool


class MockStationTool(BaseTool):
    name = 'mock_station_tool'
    description = 'Find nearby EV charging stations. Use this when the user asks about charging stations, where to charge, or finding a charger nearby.'
    parameters = {
        'type': 'object',
        'properties': {
            'location': {
                'type': 'string',
                'description': 'City or area to search in',
            },
            'charger_type': {
                'type': 'string',
                'description': 'Preferred charger type (e.g. DC Fast, AC, any)',
                'enum': ['DC Fast', 'AC', 'any'],
            },
        },
        'required': ['location'],
    }

    async def execute(self, **kwargs) -> dict:
        location = kwargs.get('location', 'Unknown')
        charger_type = kwargs.get('charger_type', 'any')
        return {
            'location': location,
            'stations': [
                {
                    'name': location + ' Fast Charger',
                    'address': 'Main Road, ' + location,
                    'distance_km': 3.2,
                    'charger_types': ['CCS2', 'CHAdeMO'],
                    'available_slots': 3,
                    'price_per_kwh_inr': 12,
                },
                {
                    'name': location + ' EV Hub',
                    'address': 'Station Road, ' + location,
                    'distance_km': 5.8,
                    'charger_types': ['Type 2 AC', 'CCS2'],
                    'available_slots': 5,
                    'price_per_kwh_inr': 8,
                },
                {
                    'name': location + ' Supercharger',
                    'address': 'Highway Bypass, ' + location,
                    'distance_km': 8.1,
                    'charger_types': ['CCS2'],
                    'available_slots': 1,
                    'price_per_kwh_inr': 18,
                },
            ],
            'filter_applied': charger_type,
        }
