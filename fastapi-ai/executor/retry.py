import asyncio
import functools
import logging
import random

import httpx

logger = logging.getLogger(__name__)


def with_retry(max_retries=3, base_delay=1.0, max_delay=30.0):
    """Async decorator: exponential backoff + jitter for reliable execution."""

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except (httpx.TimeoutException, httpx.HTTPStatusError) as e:
                    last_exc = e
                    if attempt < max_retries - 1:
                        delay = min(base_delay * (2 ** attempt), max_delay)
                        delay *= 0.5 + 0.5 * random.random()
                        logger.info(
                            'Retry %d/%d for %s after %.1fs: %s',
                            attempt + 1, max_retries,
                            getattr(func, '__name__', 'unknown'),
                            delay, str(e)[:100],
                        )
                        await asyncio.sleep(delay)
                except Exception as e:
                    last_exc = e
                    if attempt < max_retries - 1:
                        delay = min(base_delay * (2 ** attempt), max_delay)
                        delay *= 0.5 + 0.5 * random.random()
                        logger.info(
                            'Retry %d/%d for %s after %.1fs: %s',
                            attempt + 1, max_retries,
                            getattr(func, '__name__', 'unknown'),
                            delay, str(e)[:100],
                        )
                        await asyncio.sleep(delay)
            raise last_exc
        return wrapper
    return decorator
