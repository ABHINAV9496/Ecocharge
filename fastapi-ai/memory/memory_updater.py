import json
import logging

from services.openai_service import OpenAIService

logger = logging.getLogger(__name__)

_EXTRACTION_PROMPT = (
    'You are a preference extraction system for an EV assistant. '
    'Analyse the conversation below and extract any **long-term user preferences** '
    'the user explicitly stated.\n\n'
    'Return ONLY a JSON object with these optional fields (omit any not mentioned):\n'
    '- "preferred_vehicle": string — EV make and model the user drives\n'
    '- "preferred_strategy": "fastest" | "cheapest" — their charging strategy preference\n'
    '- "preferred_connector": "CCS2" | "CHAdeMO" | "Type 2 AC" — their connector preference\n'
    '- "preferred_language": string — their language preference\n'
    '- "home_city": string — their home or base city\n'
    '- "frequent_destinations": list of strings — cities they visit often\n'
    '- "typical_battery_percent": number (0-100) — their typical starting battery\n\n'
    'Rules:\n'
    '- Only include values the user EXPLICITLY provided.\n'
    '- Do NOT infer or guess.\n'
    '- If a preference was already known but the user updates it, include the NEW value.\n'
    '- If no new preferences are stated, return an empty JSON object: {}\n'
    '- Return ONLY the JSON object, no explanation.\n\n'
    'Conversation:\n'
)


class MemoryUpdater:
    """Analyses a conversation and extracts new/changed preferences."""

    def __init__(self, llm: OpenAIService) -> None:
        self._llm = llm

    async def extract(
        self,
        user_message: str,
        assistant_reply: str,
    ) -> dict:
        """Extract preferences from the latest user → assistant exchange.

        Returns a dict with only the fields that were explicitly mentioned.
        Returns {} when nothing new is found.
        """
        conversation_text = (
            f'User: {user_message}\n'
            f'Assistant: {assistant_reply}\n'
        )

        messages = [
            {'role': 'system', 'content': _EXTRACTION_PROMPT},
            {'role': 'user', 'content': conversation_text},
        ]

        try:
            response = await self._llm.complete(
                messages=messages,
                max_tokens=300,
                temperature=0.0,
            )
            content = (response.content or '').strip()
            if not content:
                return {}

            # Strip markdown fence if present
            if content.startswith('```'):
                content = content.strip('`').strip()
                if content.startswith('json'):
                    content = content[4:].strip()

            parsed = json.loads(content)
            if not isinstance(parsed, dict):
                return {}
            # Remove None values
            return {k: v for k, v in parsed.items() if v is not None}
        except (json.JSONDecodeError, Exception) as e:
            logger.warning('Memory extraction failed: %s', e)
            return {}
