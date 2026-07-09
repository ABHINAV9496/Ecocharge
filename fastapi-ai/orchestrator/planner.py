import logging

logger = logging.getLogger(__name__)


class Planner:
    """Produces a structured JSON plan from user intent + context."""

    INTENT_TO_SKILL = {
        'trip_planning': 'route_planner',
        'station_search': None,
        'weather': None,
        'booking': None,
        'explain_route': 'trip_explainer',
        'general_ev_knowledge': 'general_ev_knowledge',
        'chitchat': None,
    }

    def plan(self, intent: str, query: str, context: dict) -> list[dict]:
        skill_name = self.INTENT_TO_SKILL.get(intent)

        if skill_name:
            return [
                {
                    'action': 'skill',
                    'skill': skill_name,
                    'params': {
                        'query': query,
                        'rag_context': context.get('rag_context', ''),
                        'trip_state': context.get('trip_state'),
                    },
                },
            ]

        if intent == 'chitchat':
            return [
                {
                    'action': 'generate_response',
                    'template': 'chitchat',
                    'params': {'query': query},
                },
            ]

        if intent == 'station_search':
            return [
                {
                    'action': 'tool_call',
                    'tool': 'station_tool',
                    'params': {'location': self._extract_location(query)},
                },
            ]

        if intent == 'weather':
            return [
                {
                    'action': 'tool_call',
                    'tool': 'weather_tool',
                    'params': {'location': self._extract_location(query)},
                },
            ]

        if intent == 'booking':
            return [
                {
                    'action': 'tool_call',
                    'tool': 'booking_tool',
                    'params': {},
                },
            ]

        return [
            {
                'action': 'skill',
                'skill': 'general_ev_knowledge',
                'params': {
                    'query': query,
                    'rag_context': context.get('rag_context', ''),
                },
            },
        ]

    def _extract_location(self, query: str) -> str:
        query_lower = query.lower()
        prepositions = ['in ', 'at ', 'near ', 'around ', 'for ']
        for prep in prepositions:
            if prep in query_lower:
                idx = query_lower.index(prep) + len(prep)
                remainder = query[idx:].strip().rstrip('.!?,').strip()
                if remainder:
                    return remainder.split()[0] if ' ' not in remainder else remainder.split('?')[0]
        return query
