import logging

from core.llm import GroqLLMClient

logger = logging.getLogger(__name__)

_VERIFIER_PROMPT = """You are a response quality checker. Your job is to verify that the AI's response actually answers the user's question.

User Query: {query}
AI Response: {response}

Check:
1. Does the response directly address the user's question?
2. Does it contain any made-up facts or hallucinated data?
3. Is it helpful and relevant?

Reply with exactly one of:
- YES — if the response is correct and answers the question
- NO: <brief reason> — if the response fails to answer or contains errors"""


class Verifier:
    """Lightweight LLM call to verify response quality before returning to user."""

    def __init__(self, llm: GroqLLMClient):
        self._llm = llm

    async def verify(self, query: str, response: str) -> tuple[bool, str]:
        if not response:
            return False, 'No response generated.'

        try:
            result = await self._llm.generate(
                messages=[
                    {'role': 'system', 'content': _VERIFIER_PROMPT.format(query=query, response=response)},
                ],
                max_tokens=100,
                temperature=0.0,
            )
            result = result.strip()
            if result.upper().startswith('YES'):
                return True, response
            logger.info('Verifier rejected response: %s', result[:100])
            return False, response
        except Exception as e:
            logger.warning('Verifier failed: %s', e)
            return True, response
