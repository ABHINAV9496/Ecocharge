import logging
import sys
import time
from collections.abc import Callable
from functools import wraps


def setup_structured_logging() -> None:
    """Configure structured JSON logging."""
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)

    class JSONFormatter(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:
            import json
            from datetime import datetime, timezone

            log_entry = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'level': record.levelname,
                'logger': record.name,
                'message': record.getMessage(),
            }
            if hasattr(record, 'extra_fields'):
                log_entry.update(record.extra_fields)
            if record.exc_info and record.exc_info[0]:
                log_entry['exception'] = self.formatException(record.exc_info)
            return json.dumps(log_entry)

    handler.setFormatter(JSONFormatter())

    root_logger.handlers.clear()
    root_logger.addHandler(handler)


def log_execution_time(func: Callable) -> Callable:
    """Decorator that logs function execution time."""

    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        start = time.monotonic()
        try:
            result = await func(*args, **kwargs)
            elapsed = time.monotonic() - start
            logging.getLogger(func.__module__).info(
                '%s completed in %.2fs',
                func.__name__,
                elapsed,
            )
            return result
        except Exception as e:
            elapsed = time.monotonic() - start
            logging.getLogger(func.__module__).error(
                '%s failed after %.2fs: %s',
                func.__name__,
                elapsed,
                str(e),
            )
            raise

    return async_wrapper
