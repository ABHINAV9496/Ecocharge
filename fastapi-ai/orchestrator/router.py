import json
import logging
import re

logger = logging.getLogger(__name__)


class Router:
    """Classifies user messages into intent paths.

    Uses a fast keyword-based first pass, falling back to LLM classification
    when the intent is ambiguous.
    """

    INTENT_KEYWORDS = {
        'trip_planning': [
            'plan', 'route', 'trip', 'drive', 'going to', 'reach', 'travel',
            'navigate', 'direction', 'how to go', 'road trip',
            'how do i get', 'how to get', 'how can i reach',
            'get from', 'get to',
        ],
        'station_search': [
            'charger', 'charging', 'station', 'plug', 'charge point',
            'ev hub', 'power station', 'where to charge',
            'where can i charge', 'find a charger', 'nearest charger',
            'find chargers', 'charging station',
        ],
        'weather': [
            'weather', 'rain', 'temperature', 'forecast', 'climate',
            'windy', 'humidity', 'precipitation',
            'will it rain',
        ],
        'booking': [
            'booking', 'reservation', 'book', 'reserve', 'slot',
            'appointment', 'schedule',
        ],
        'explain_route': [
            'why', 'explain', 'how did', 'why did', 'reason',
            'why this', 'how come',
        ],
        'general_ev_knowledge': [
            'what is', 'how does', 'difference between', 'explain',
            'tell me about', 'what are', 'define',
            'battery', 'range', 'charging', 'kwh', 'regenerative',
            'ccs', 'chademo', 'type 2', 'ac charging', 'dc fast',
            'degradation', 'lifespan', 'maintenance',
        ],
    }

    DISAMBIGUATE = {
        'explain_route': ['why.*planner', 'why.*route', 'why.*charg', 'explain.*route'],
        'weather': ['will it rain', 'will it snow', 'weather.*trip', 'forecast.*trip'],
        'station_search': ['where.*charge', 'find.*charg', 'nearest.*charg'],
    }

    # Non-EV greetings to route as chitchat
    GREETING_PATTERNS = [
        r'^(hi|hello|hey|howdy|greetings)\b',
        r'^good\s*(morning|afternoon|evening)',
        r'^(thanks|thank you|ty)\b',
        r'^(bye|goodbye|see you)\b',
    ]

    def route(self, query: str) -> str:
        if not query or not query.strip():
            return 'empty'

        query_lower = query.lower().strip()

        for pattern in self.GREETING_PATTERNS:
            if re.match(pattern, query_lower):
                logger.info('Router: greeting detected — chitchat')
                return 'chitchat'

        scores = {intent: 0 for intent in self.INTENT_KEYWORDS}

        for intent, keywords in self.INTENT_KEYWORDS.items():
            for kw in keywords:
                if kw in query_lower:
                    scores[intent] += 1

        best_intent = max(scores, key=scores.get)
        best_score = scores[best_intent]

        if best_score == 0:
            logger.info('Router: ambiguous — defaulting to general_ev_knowledge')
            return 'general_ev_knowledge'

        # Disambiguation: if top-scoring intent has weaker signal but
        # a more specific pattern matches, override.
        for intent, patterns in self.DISAMBIGUATE.items():
            for pat in patterns:
                if re.search(pat, query_lower):
                    if scores[intent] > 0 or scores[best_intent] <= 2:
                        logger.info('Router: disambiguated to %s (matched pattern=%s)', intent, pat)
                        return intent

        logger.info('Router: %s (score=%d)', best_intent, best_score)
        return best_intent
