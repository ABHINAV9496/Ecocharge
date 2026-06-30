import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Any

from groq import AsyncGroq
from groq import GroqError

from config import settings
from llm import LLMClient
from utils import get_logger

logger = get_logger(__name__)


@dataclass
class FallbackMessage:
    content: str | None
    tool_calls: list | None = None
    role: str = 'assistant'


PRIMARY_MODEL = 'llama-3.3-70b-versatile'
FALLBACK_MODEL = 'llama-3.1-8b-instant'


class GroqLLMClient(LLMClient):
    """Groq-backed LLM client with streaming and function-calling support.

    Uses the official Groq Python SDK (OpenAI-compatible API).
    Model and parameters are read from environment configuration.
    """

    def __init__(self) -> None:
        self._model: str = settings.GROQ_MODEL
        if settings.GROQ_API_KEY:
            self._client: AsyncGroq | None = AsyncGroq(api_key=settings.GROQ_API_KEY)
        else:
            self._client: AsyncGroq | None = None

    async def complete(
        self,
        messages: list[dict],
        tools: list[dict[str, Any]] | None = None,
        **kwargs,
    ) -> Any:
        if not self._client:
            return FallbackMessage(
                content='AI service is not configured. Please set the GROQ_API_KEY environment variable.',
            )

        params = {
            'model': kwargs.get('model', self._model),
            'messages': messages,
            'max_tokens': kwargs.get('max_tokens', settings.MAX_TOKENS),
            'temperature': kwargs.get('temperature', settings.TEMPERATURE),
        }
        if tools:
            params['tools'] = tools
            params['tool_choice'] = 'auto'

        start = time.monotonic()
        try:
            completion = await self._client.chat.completions.create(**params)
            elapsed = time.monotonic() - start
            _log_success('Complete', params['model'], elapsed, completion.usage)
            return completion.choices[0].message
        except GroqError as e:
            elapsed = time.monotonic() - start
            logger.error('complete failed [%s] after %.2fs: %s', params['model'], elapsed, str(e))
            raise

    async def generate_stream(
        self,
        messages: list[dict],
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        if not self._client:
            yield 'AI service is not configured. Please set the GROQ_API_KEY environment variable.'
            return

        model = kwargs.get('model', self._model)
        start = time.monotonic()
        token_count = 0

        try:
            stream = await self._client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=kwargs.get('max_tokens', settings.MAX_TOKENS),
                temperature=kwargs.get('temperature', settings.TEMPERATURE),
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices:
                    delta = chunk.choices[0].delta
                    content = delta.content if delta else None
                    if content:
                        token_count += 1
                        yield content

            elapsed = time.monotonic() - start
            logger.info(
                'Stream: model=%s | %.2fs | %d chunks',
                model, elapsed, token_count,
            )
        except GroqError as e:
            elapsed = time.monotonic() - start
            logger.error('stream failed [%s] after %.2fs: %s', model, elapsed, str(e))
            raise

    async def generate(
        self,
        messages: list[dict],
        **kwargs,
    ) -> str:
        if not self._client:
            return 'AI service is not configured. Please set the GROQ_API_KEY environment variable.'

        model = kwargs.get('model', self._model)
        start = time.monotonic()

        try:
            completion = await self._client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=kwargs.get('max_tokens', settings.MAX_TOKENS),
                temperature=kwargs.get('temperature', settings.TEMPERATURE),
                stream=False,
            )
            elapsed = time.monotonic() - start
            content = completion.choices[0].message.content or ''
            _log_success('Generate', model, elapsed, completion.usage)
            return content
        except GroqError as e:
            elapsed = time.monotonic() - start
            logger.error('generate failed [%s] after %.2fs: %s', model, elapsed, str(e))
            raise


def _log_success(method: str, model: str, elapsed: float, usage: Any) -> None:
    token_info = f' | {usage.total_tokens} tokens' if usage else ''
    logger.info('%s: model=%s | %.2fs%s', method, model, elapsed, token_info)
