import json
import logging

import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

SESSION_TTL = 3600  # 1 hour


class SessionStore:
    """Per-session state in Redis (active trips, recent context)."""

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None

    async def _conn(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
        return self._redis

    async def set_active_trip(self, session_id: str, trip_data: dict) -> None:
        try:
            r = await self._conn()
            await r.setex(
                f'session:{session_id}:trip',
                SESSION_TTL,
                json.dumps(trip_data),
            )
        except Exception as e:
            logger.warning('Session set failed: %s', e)

    async def get_active_trip(self, session_id: str) -> dict | None:
        try:
            r = await self._conn()
            raw = await r.get(f'session:{session_id}:trip')
            if raw:
                return json.loads(raw)
        except Exception as e:
            logger.warning('Session get failed: %s', e)
        return None

    async def clear_session(self, session_id: str) -> None:
        try:
            r = await self._conn()
            await r.delete(f'session:{session_id}:trip')
        except Exception as e:
            logger.warning('Session clear failed: %s', e)
