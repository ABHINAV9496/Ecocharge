import logging
from typing import Any

from memory.memory_service import MemoryService
from rag.context_builder import RAGContextBuilder

logger = logging.getLogger(__name__)


class ContextAssembler:
    """Assembles all context sources into a structured prompt context."""

    def __init__(
        self,
        rag_builder: RAGContextBuilder,
        memory_service: MemoryService | None = None,
    ):
        self.rag = rag_builder
        self.memory = memory_service

    async def assemble(
        self,
        query: str,
        user_id: str | None,
        conversation_history: list[dict],
        active_trip_id: str | None = None,
    ) -> dict:
        rag_context = await self.rag.build_context(query)

        user_prefs = {}
        if self.memory and user_id:
            try:
                user_prefs = await self.memory.load_preferences(user_id)
            except Exception as e:
                logger.warning('Memory load failed: %s', e)

        return {
            'rag_context': rag_context,
            'user_preferences': user_prefs,
            'trip_state': None,
            'conversation_summary': '',
        }
