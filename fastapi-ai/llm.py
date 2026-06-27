from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator


class LLMClient(ABC):

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
