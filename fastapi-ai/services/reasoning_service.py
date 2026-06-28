import json
import logging
import time

from services.openai_service import OpenAIService

logger = logging.getLogger(__name__)

_REASONING_PROMPT = """You are the EcoCharge AI reasoning engine. Your role is to analyse EV tool outputs and produce a clear, structured reasoning analysis that the final response generator will use to answer the user.

Analyse the tool outputs below and produce a structured analysis. Be specific — reference actual numbers, locations, station names, and weather data from the tool outputs. Do NOT repeat the raw JSON. Instead, extract the meaningful information and connect the dots between different tools.

TOOL OUTPUTS:
{tool_outputs}

USER'S QUESTION: {user_message}

Produce a structured analysis covering these sections. Use plain text with markdown headers.

## Trip Summary
Key trip details: origin, destination, distance, duration, charging stops, total cost, charging time, arrival battery percentage.

## Weather Impact
How current/forecast weather affects the trip, battery range, and charging. Be specific about temperature, precipitation, and wind.

## Charging Station Recommendations
Best charging stations to use along this route or at the destination. Consider distance, connector type, availability, and pricing.

## Battery & Efficiency Advice
Is the range sufficient? Speed recommendations, preconditioning tips, optimal charging %, reserve battery. Reference the specific vehicle and battery level.

## Trade-offs & Alternatives
If the user asked about strategy or route choices, compare options. What are the pros and cons?

## Recommendation
A clear, actionable recommendation. EXPLAIN WHY — reference specific data from the tool outputs."""


class ReasoningService:
    """Produces structured reasoning over multiple tool outputs.

    Takes results from Trip Planner, Weather, and Station tools,
    analyses them together, and produces a coherent reasoning
    analysis for the final LLM response generator.
    """

    def __init__(self, llm: OpenAIService) -> None:
        self._llm = llm

    async def reason(
        self,
        tool_results: list[dict],
        user_message: str,
    ) -> str:
        """Analyse tool outputs and produce structured reasoning.

        Args:
            tool_results: List of dicts, each with 'tool', 'arguments', 'result'.
            user_message: The user's original message.

        Returns:
            Structured reasoning text for injection into the conversation.
        """
        if not tool_results:
            return ''

        tool_outputs_text = self._build_tool_outputs_text(tool_results)

        prompt = _REASONING_PROMPT.format(
            tool_outputs=tool_outputs_text,
            user_message=user_message,
        )

        messages = [{'role': 'user', 'content': prompt}]

        start = time.monotonic()
        try:
            response = await self._llm.complete(
                messages=messages,
                max_tokens=800,
                temperature=0.3,
            )
            reasoning = (response.content or '').strip()
            elapsed = time.monotonic() - start
            logger.info(
                'Reasoning completed in %.2fs — %d chars',
                elapsed, len(reasoning),
            )
            logger.debug('Reasoning output:\n%s', reasoning[:500])
            return reasoning
        except Exception as e:
            elapsed = time.monotonic() - start
            logger.error('Reasoning failed after %.2fs: %s', elapsed, str(e))
            return ''

    @staticmethod
    def _build_tool_outputs_text(tool_results: list[dict]) -> str:
        """Build a readable summary of all tool outputs."""
        sections = []
        for item in tool_results:
            tool_name = item.get('tool', 'unknown')
            arguments = item.get('arguments', {})
            result = item.get('result', {})

            args_summary = ', '.join(
                f'{k}={v}' for k, v in arguments.items()
            )

            # Format result based on tool type
            if tool_name == 'trip_planner':
                result_text = _format_trip_result(result)
            elif tool_name == 'weather_tool':
                result_text = _format_weather_result(result)
            elif tool_name == 'station_tool':
                result_text = _format_station_result(result)
            else:
                result_text = json.dumps(result, indent=2)

            sections.append(
                f'--- {tool_name} ---\n'
                f'Called with: {args_summary}\n'
                f'{result_text}'
            )

        return '\n\n'.join(sections)


def _format_trip_result(result: dict) -> str:
    """Extract key fields from trip planner output into readable text."""
    if result.get('error'):
        return f'Error: {result.get("message", "Unknown error")}'

    lines = []

    origin = result.get('origin') or result.get('origin_name', '?')
    dest = result.get('destination') or result.get('dest_name', '?')
    vehicle = result.get('vehicle_query', '?')
    strategy = result.get('strategy', '?')

    lines.append(f'Route: {origin} → {dest}')
    lines.append(f'Vehicle: {vehicle}')
    lines.append(f'Strategy: {strategy}')

    total_distance = result.get('total_distance_km')
    if total_distance:
        lines.append(f'Total distance: {total_distance} km')

    drive_s = result.get('total_drive_time_seconds')
    charge_s = result.get('total_charge_time_seconds')
    if drive_s is not None:
        total_h = (drive_s + (charge_s or 0)) / 3600
        drive_h = drive_s / 3600
        lines.append(f'Total trip time: {total_h:.1f} hours ({drive_h:.1f}h driving')
        if charge_s:
            charge_min = charge_s / 60
            lines[-1] = lines[-1] + f', {charge_min:.0f}min charging)'
        else:
            lines[-1] = lines[-1] + ')'

    stops = result.get('stops', [])
    if stops:
        lines.append(f'Charging stops: {len(stops)}')
        for s in stops:
            stop_name = s.get('station_name', f'Stop at {s.get("distance_from_start_km", "?")} km')
            charge_sec = s.get('charge_time_seconds')
            charge_min = round(charge_sec / 60) if charge_sec else '?'
            cost = s.get('cost', '?')
            soc = s.get('arrival_soc_percent', '?')
            lines.append(f'  - {stop_name}: charge {charge_min} min, ₹{cost}, arrive at {soc}%')

    total_cost = result.get('total_cost')
    if total_cost is not None:
        lines.append(f'Total charging cost: ₹{total_cost}')

    arrival_battery = result.get('final_soc_percent')
    if arrival_battery is not None:
        lines.append(f'Arrival battery: {arrival_battery}%')

    note = result.get('note')
    if note:
        lines.append(f'Note: {note}')

    return '\n'.join(lines)


def _format_weather_result(result: dict) -> str:
    """Extract key fields from weather tool output."""
    if result.get('error'):
        return f'Error: {result.get("message", "Unknown error")}'

    lines = []

    location = result.get('city') or result.get('location', '?')
    country = result.get('country', '')
    loc_str = f'{location}, {country}' if country else location
    lines.append(f'Location: {loc_str}')

    temp = result.get('temperature')
    if temp is not None:
        lines.append(f'Temperature: {temp}°C')

    feels_like = result.get('feels_like')
    if feels_like is not None:
        lines.append(f'Feels like: {feels_like}°C')

    desc = result.get('description')
    if desc:
        lines.append(f'Condition: {desc}')

    humidity = result.get('humidity')
    if humidity is not None:
        lines.append(f'Humidity: {humidity}%')

    wind = result.get('wind_speed')
    if wind is not None:
        lines.append(f'Wind speed: {wind} km/h')

    precip = result.get('precipitation')
    if precip is not None:
        lines.append(f'Precipitation: {precip} mm')

    precip_prob = result.get('precipitation_probability')
    if precip_prob is not None:
        lines.append(f'Rain probability: {precip_prob}%')

    forecast = result.get('forecast')
    if forecast:
        if isinstance(forecast, list):
            lines.append(f'Hourly/daily forecast: {len(forecast)} entries')

    return '\n'.join(lines)


def _format_station_result(result: dict) -> str:
    """Extract key fields from station tool output."""
    if result.get('error'):
        return f'Error: {result.get("message", "Unknown error")}'

    lines = []
    location = result.get('location', '?')
    lines.append(f'Location: {location}')
    lines.append(f'Total stations found: {result.get("total_stations", 0)}')

    stations = result.get('stations', [])
    for s in stations:
        name = s.get('name', 'Unknown')
        addr = s.get('address', '')
        dist = s.get('distance_km')
        conn = ', '.join(s.get('connector_types', []))
        avail = s.get('available_slots', 0)
        rate = s.get('rate_per_kwh_min')
        recommended = s.get('recommended', False)

        parts = [name]
        if dist is not None:
            parts.append(f'{dist} km')
        if conn:
            parts.append(conn)
        parts.append(f'{avail} available')
        if rate is not None:
            parts.append(f'₹{rate}/kWh')
        if recommended:
            parts.append('★ RECOMMENDED')

        lines.append(f'  - {" | ".join(parts)}')
        if addr:
            lines.append(f'    {addr}')

    return '\n'.join(lines) if lines else 'No stations found.'
