import base64
import json
import logging
import sys

logger = logging.getLogger(__name__)


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        stream=sys.stdout,
    )


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        fmt = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s: %(message)s')
        handler.setFormatter(fmt)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


def decode_jwt_payload(token: str) -> dict | None:
    """Decode a JWT token payload WITHOUT signature verification.

    This is safe because the token comes from our own Django backend.
    We only extract the user_id for memory lookup purposes.
    """
    if not token:
        return None
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding
        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except Exception as e:
        logger.debug('JWT decode failed: %s', e)
        return None


def extract_user_id(token: str) -> int | None:
    """Extract user_id from a JWT access token."""
    payload = decode_jwt_payload(token)
    if payload is None:
        return None
    uid = payload.get('user_id')
    if uid is not None:
        return int(uid)
    return None
