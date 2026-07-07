import logging
import re

logger = logging.getLogger(__name__)


class InputGuard:
    """Validates and sanitizes user input before processing."""

    MAX_LENGTH = 2000
    MIN_LENGTH = 1

    BLOCKED_PATTERNS = [
        r'ignore\s+all\s+previous\s+instructions',
        r'ignore\s+all\s+prior\s+ directives',
        r'system\s+prompt',
        r'you\s+are\s+(an\s+)?AI',
        r'reveal\s+your\s+prompt',
        r'forget\s+(everything|all)',
        r'output\s+your\s+(instructions|prompt)',
        r'print\s+your\s+(instructions|prompt)',
    ]

    MAX_LINE_LENGTH = 500

    def validate(self, message: str) -> tuple[bool, str]:
        if not message or not message.strip():
            return False, 'Message cannot be empty.'

        if len(message) > self.MAX_LENGTH:
            return False, f'Message too long ({len(message)} chars, max {self.MAX_LENGTH}).'

        for pattern in self.BLOCKED_PATTERNS:
            if re.search(pattern, message, re.IGNORECASE):
                logger.warning('Input guard blocked: pattern=%s', pattern)
                return False, 'Message contains disallowed content.'

        for line in message.split('\n'):
            if len(line) > self.MAX_LINE_LENGTH:
                return False, 'Message contains unreasonably long lines.'

        return True, message.strip()
