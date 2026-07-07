import logging

import httpx

from config import settings
from tools.base import BaseTool
from tools.context import auth_token_var

logger = logging.getLogger(__name__)

DJANGO_BASE = settings.DJANGO_BASE
DJANGO_TIMEOUT = 15


class RealBookingTool(BaseTool):
    name = 'booking_tool'
    description = "Get information about the user's charging bookings, including status, upcoming bookings, and history. Use this when the user asks about bookings, reservations, or charging schedule."
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
        booking_id = kwargs.get('booking_id')

        token = auth_token_var.get()
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        if booking_id:
            return await self._fetch_single(booking_id, headers)

        return await self._fetch_all(headers)

    async def _fetch_single(self, booking_id: str, headers: dict) -> dict:
        url = f'{DJANGO_BASE}/api/bookings/{booking_id}/'
        try:
            async with httpx.AsyncClient(timeout=DJANGO_TIMEOUT) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 401:
                    return {'error': True, 'message': 'Please log in to view booking details.'}
                if resp.status_code == 404:
                    return {'error': True, 'message': f'Booking #{booking_id} not found.'}
                resp.raise_for_status()
                data = resp.json()
                return self._format_single(data)
        except Exception as e:
            logger.exception('Booking detail API failed')
            return {'error': True, 'message': 'Could not retrieve booking details.'}

    async def _fetch_all(self, headers: dict) -> dict:
        url = f'{DJANGO_BASE}/api/bookings/'
        try:
            async with httpx.AsyncClient(timeout=DJANGO_TIMEOUT) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 401:
                    return {'error': True, 'message': 'Please log in to view your bookings.'}
                resp.raise_for_status()
                data = resp.json()
                bookings = [
                    {
                        'id': str(b.get('id')),
                        'station': self._station_name(b),
                        'status': b.get('status', '').title(),
                        'date': (b.get('start_time') or '')[:10],
                        'time': ((b.get('start_time') or '') + ' - ' + (b.get('end_time') or ''))[11:16]
                                if b.get('start_time') else '',
                        'amount': float(b.get('amount_charged', 0)),
                    }
                    for b in data
                ]
                return {'bookings': bookings}
        except Exception as e:
            logger.exception('Booking list API failed')
            return {'error': True, 'message': 'Could not retrieve bookings.'}

    @staticmethod
    def _format_single(data: dict) -> dict:
        return {
            'booking_id': str(data.get('id')),
            'status': data.get('status', '').title(),
            'station': RealBookingTool._station_name(data),
            'date': (data.get('start_time') or '')[:10],
            'start_time': ((data.get('start_time') or '') + ' - ' + (data.get('end_time') or ''))[11:16],
            'amount_inr': float(data.get('amount_charged', 0)),
            'is_active': data.get('status') in ('PENDING', 'CONFIRMED', 'IN_PROGRESS'),
        }

    @staticmethod
    def _station_name(data: dict) -> str:
        details = data.get('slot_details') or {}
        return details.get('station_name', details.get('station', 'Unknown'))
