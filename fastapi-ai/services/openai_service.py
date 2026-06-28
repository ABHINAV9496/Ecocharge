from collections.abc import AsyncGenerator
from typing import Any

from openai import AsyncOpenAI
from openai.types.chat.chat_completion_chunk import ChoiceDelta
from openai.types.chat.chat_completion_message import ChatCompletionMessage

from config import settings
from llm import LLMClient
from utils import get_logger

logger = get_logger(__name__)


class OpenAIService(LLMClient):
    """OpenAI-backed LLM client with streaming and function-calling support.

    Uses the latest OpenAI Chat Completions API (v1+).
    Model and parameters are read from environment configuration.
    """

    def __init__(self) -> None:
        self._client: AsyncOpenAI = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self._model: str = settings.OPENAI_MODEL

    async def complete(
        self,
        messages: list[dict],
        tools: list[dict[str, Any]] | None = None,
        **kwargs,
    ) -> ChatCompletionMessage:
        """Non-streaming completion that supports tool/function calling.

        Returns the full message object so callers can inspect
        tool_calls, content, etc.
        """
        if not settings.OPENAI_API_KEY:
            msg = ChatCompletionMessage(
                role='assistant',
                content='AI service is not configured. Please set the OPENAI_API_KEY environment variable.',
            )
            return msg

        params = {
            'model': kwargs.get('model', self._model),
            'messages': messages,
            'max_tokens': kwargs.get('max_tokens', settings.MAX_TOKENS),
            'temperature': kwargs.get('temperature', settings.TEMPERATURE),
        }
        if tools:
            params['tools'] = tools
            params['tool_choice'] = 'auto'

        completion = await self._client.chat.completions.create(**params)
        return completion.choices[0].message

    async def generate_stream(
        self,
        messages: list[dict],
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        if not settings.OPENAI_API_KEY:
            yield 'AI service is not configured. Please set the OPENAI_API_KEY environment variable.'
            return

        stream = await self._client.chat.completions.create(
            model=kwargs.get('model', self._model),
            messages=messages,
            max_tokens=kwargs.get('max_tokens', settings.MAX_TOKENS),
            temperature=kwargs.get('temperature', settings.TEMPERATURE),
            stream=True,
        )

        async for chunk in stream:
            delta: ChoiceDelta = chunk.choices[0].delta if chunk.choices else None
            content = delta.content if delta else None
            if content:
                yield content

    async def generate(
        self,
        messages: list[dict],
        **kwargs,
    ) -> str:
        if not settings.OPENAI_API_KEY:
            return 'AI service is not configured. Please set the OPENAI_API_KEY environment variable.'

        completion = await self._client.chat.completions.create(
            model=kwargs.get('model', self._model),
            messages=messages,
            max_tokens=kwargs.get('max_tokens', settings.MAX_TOKENS),
            temperature=kwargs.get('temperature', settings.TEMPERATURE),
            stream=False,
        )

        return completion.choices[0].message.content or ''
