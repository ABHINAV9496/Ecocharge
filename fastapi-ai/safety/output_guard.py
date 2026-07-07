import logging
import re

logger = logging.getLogger(__name__)


class OutputGuard:
    """Sanitizes LLM output before returning to the user."""

    EMAIL_PATTERN = re.compile(r'\b[\w.-]+@[\w.-]+\.\w{2,}\b')
    PHONE_PATTERN = re.compile(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
    AADHAAR_PATTERN = re.compile(r'\b\d{4}\s?\d{4}\s?\d{4}\b')

    def sanitize(self, response: str) -> str:
        response = self.EMAIL_PATTERN.sub('[EMAIL REDACTED]', response)
        response = self.PHONE_PATTERN.sub('[PHONE REDACTED]', response)
        response = self.AADHAAR_PATTERN.sub('[AADHAAR REDACTED]', response)
        return response
