import logging

logger = logging.getLogger(__name__)


def summarize_tool_result(tool_name: str, result: dict) -> dict:
    """Reduce a full tool result to a compact LLM-friendly summary.

    The full ``result`` is still available internally for business logic;
    only the LLM conversation receives the summary.
    """
    summarizer = _SUMMARIZERS.get(tool_name)
    if summarizer is None:
        return result
    try:
        summary = summarizer(result)
        logger.debug(
            'Summarized %s: %d -> %d chars',
            tool_name,
            len(str(result)),
            len(str(summary)),
        )
        return summary
    except Exception as e:
        logger.warning('Failed to summarize %s, falling back to raw: %s', tool_name, e)
        return result


def _summarize_trip(result: dict) -> dict:
    stops = result.get('stops', [])
    charging_stations = []
    for s in stops:
        charging_stations.append({
            'station_name': s.get('station_name', ''),
            'charger_power_kw': s.get('charger_power_kw'),
            'slot_type': s.get('slot_type', ''),
            'charge_time_minutes': round(s.get('charge_time_seconds', 0) / 60) if s.get('charge_time_seconds') else None,
            'cost': s.get('cost'),
            'arrival_soc_percent': s.get('arrival_soc_percent'),
        })

    summary = {
        'origin': result.get('origin') or result.get('origin_name', ''),
        'destination': result.get('destination') or result.get('dest_name', ''),
        'vehicle': result.get('vehicle_query', ''),
        'strategy': result.get('strategy', ''),
        'distance_km': result.get('total_distance_km'),
        'drive_time_minutes': round(result.get('total_drive_time_seconds', 0) / 60) if result.get('total_drive_time_seconds') else None,
        'charge_time_minutes': round(result.get('total_charge_time_seconds', 0) / 60) if result.get('total_charge_time_seconds') else None,
        'total_cost': result.get('total_cost'),
        'energy_consumed_kwh': result.get('energy_consumed_kwh'),
        'charging_stop_count': len(stops),
        'arrival_soc_percent': result.get('final_soc_percent'),
        'note': result.get('note'),
        'charging_stations': charging_stations,
    }
    return {k: v for k, v in summary.items() if v is not None}


def _summarize_weather(result: dict) -> dict:
    summary = {
        'city': result.get('city'),
        'temperature': result.get('temperature'),
        'description': result.get('description'),
        'wind_speed': result.get('wind_speed'),
        'humidity': result.get('humidity'),
        'feels_like': result.get('feels_like'),
        'precipitation': result.get('precipitation'),
        'precipitation_probability': result.get('precipitation_probability'),
    }
    return {k: v for k, v in summary.items() if v is not None}


def _summarize_station(result: dict) -> dict:
    stations_out = []
    for s in result.get('stations', []):
        stations_out.append({
            'name': s.get('name'),
            'distance_km': s.get('distance_km'),
            'connector_types': s.get('connector_types', []),
            'available_slots': s.get('available_slots', 0),
            'rate_per_kwh_min': s.get('rate_per_kwh_min'),
            'address': s.get('address', '')[:60] if s.get('address') else '',
            'recommended': s.get('recommended', False),
        })

    return {
        'location': result.get('location', ''),
        'total_stations': result.get('total_stations', 0),
        'stations': stations_out,
    }


def _summarize_booking(result: dict) -> dict:
    bookings = result.get('bookings', [])
    return {
        'booking_count': len(bookings),
        'upcoming_bookings': [
            {'id': b.get('id'), 'station': b.get('station'), 'status': b.get('status'), 'date': b.get('date')}
            for b in bookings if b.get('status') in ('Confirmed', 'Pending')
        ],
    }


_SUMMARIZERS = {
    'trip_planner': _summarize_trip,
    'weather_tool': _summarize_weather,
    'station_tool': _summarize_station,
    'booking_tool': _summarize_booking,
}
