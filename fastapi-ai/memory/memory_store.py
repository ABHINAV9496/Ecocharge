import json
import logging

import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

PREFERENCES_KEY = 'user:{user_id}:preferences'
MEMORY_TTL_SECONDS = 60 * 60 * 24 * 90  # 90 days


class MemoryStore:
    """Low-level Redis persistence for user preferences."""

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None

    async def _conn(self) -> aioredis.Redis:
        if self._redis is None:
            logger.info('Connecting to Redis at %s', settings.REDIS_URL)
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
        return self._redis

    async def load(self, user_id: int) -> dict:
        try:
            r = await self._conn()
            raw = await r.get(PREFERENCES_KEY.format(user_id=user_id))
            if raw:
                return json.loads(raw)
            return {}
        except Exception as e:
            logger.warning('Redis load failed for user %s: %s', user_id, e)
            return {}

    async def save(self, user_id: int, preferences: dict) -> None:
        if not preferences:
            return
        try:
            r = await self._conn()
            key = PREFERENCES_KEY.format(user_id=user_id)
            await r.setex(key, MEMORY_TTL_SECONDS, json.dumps(preferences))
            logger.info(
                'Saved %d preference(s) for user %s',
                len(preferences), user_id,
            )
        except Exception as e:
            logger.warning('Redis save failed for user %s: %s', user_id, e)

    async def merge(self, user_id: int, updates: dict) -> dict:
        existing = await self.load(user_id)
        existing.update(updates)
        await self.save(user_id, existing)
        return existing

    async def clear(self, user_id: int) -> None:
        try:
            r = await self._conn()
            await r.delete(PREFERENCES_KEY.format(user_id=user_id))
            logger.info('Cleared preferences for user %s', user_id)
        except Exception as e:
            logger.warning('Redis clear failed for user %s: %s', user_id, e)
