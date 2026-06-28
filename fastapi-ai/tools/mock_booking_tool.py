from tools.base import BaseTool


class MockBookingTool(BaseTool):
    name = 'mock_booking_tool'
    description = 'Get information about the user\'s charging bookings, including status, upcoming bookings, and history. Use this when the user asks about bookings, reservations, or charging schedule.'
    parameters = {
        'type': 'object',
        'properties': {
            'booking_id': {
                'type': 'string',
                'description': 'Optional specific booking ID to look up',
            },
        },
    }

    async def execute(self, **kwargs) -> dict:
        booking_id = kwargs.get('booking_id', None)
        if booking_id:
            return {
                'booking_id': booking_id,
                'status': 'Confirmed',
                'station': 'Kochi Fast Charger',
                'slot_type': 'CCS2',
                'date': '2026-06-28',
                'start_time': '14:00',
                'end_time': '15:30',
                'amount_inr': 360,
                'is_active': True,
            }
        return {
            'bookings': [
                {
                    'id': 'BKN001',
                    'station': 'Kochi Fast Charger',
                    'status': 'Confirmed',
                    'date': '2026-06-28',
                    'time': '14:00',
                    'amount': 360,
                },
                {
                    'id': 'BKN002',
                    'station': 'Edapalli EV Hub',
                    'status': 'Completed',
                    'date': '2026-06-22',
                    'time': '10:30',
                    'amount': 180,
                },
            ],
        }
