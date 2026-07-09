from __future__ import annotations

import logging
from typing import Any

from core.llm import GroqLLMClient
from memory.memory_retriever import build_memory_context
from memory.memory_store import MemoryStore
from memory.memory_updater import MemoryUpdater

logger = logging.getLogger(__name__)


class MemoryService:
    """Orchestrates the full memory lifecycle for a chat session.

    Flow per request:
      1. load(user_id) → existing preferences from Redis
      2. build_context(preferences) → natural-language block for system prompt
      3. After LLM responds:
         extract(user_msg, assistant_reply) → detected new/changed preferences
         merge(user_id, updates) → persist to Redis
    """

    def __init__(self, llm: GroqLLMClient) -> None:
        self._store = MemoryStore()
        self._updater = MemoryUpdater(llm)

    async def load_preferences(self, user_id: int) -> dict[str, Any]:
        """Retrieve stored preferences for a user from Redis."""
        return await self._store.load(user_id)

    def build_context(self, preferences: dict[str, Any]) -> str:
        """Build a user-facing memory context block for prompt injection."""
        return build_memory_context(preferences)

    async def update_from_conversation(
        self,
        user_id: int,
        user_message: str,
        assistant_reply: str,
    ) -> None:
        """Analyse the latest exchange and persist any new preferences."""
        if user_id is None:
            return
        updates = await self._updater.extract(user_message, assistant_reply)
        if updates:
            logger.info(
                'Memory updates for user %s: %s',
                user_id, updates,
            )
            await self._store.merge(user_id, updates)
