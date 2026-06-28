from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from typing import Any


class LLMClient(ABC):

    @abstractmethod
    async def complete(
        self,
        messages: list[dict],
        tools: list[dict[str, Any]] | None = None,
        **kwargs,
    ) -> Any:
        """Non-streaming completion that supports tool/function calling.
        Returns the full message object (including tool_calls).
        """
        pass

    @abstractmethod
    async def generate_stream(
        self,
        messages: list[dict],
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        pass

    @abstractmethod
    async def generate(
        self,
        messages: list[dict],
        **kwargs,
    ) -> str:
        pass
