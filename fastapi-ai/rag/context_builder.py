import logging
from typing import Any

from rag.retriever import HybridRetriever

logger = logging.getLogger(__name__)


class RAGContextBuilder:
    """Assembles retrieved chunks into a token-budgeted prompt context."""

    MAX_TOKENS = 4000
    AVG_CHARS_PER_TOKEN = 4

    def __init__(self, retriever: HybridRetriever):
        self.retriever = retriever

    async def build_context(self, query: str, max_tokens: int = MAX_TOKENS) -> str:
        if not query:
            return ''

        chunks = await self.retriever.search(query)

        if not chunks:
            return ''

        max_chars = max_tokens * self.AVG_CHARS_PER_TOKEN
        lines = ['## Retrieved Context', '']
        char_count = len(lines[0]) + len(lines[1])

        for chunk in chunks:
            title = chunk.get('title', '')
            content = chunk.get('content', '')
            score = chunk.get('score', 0)

            entry = f'### {title} (relevance: {score:.2f})\n{content}\n\n'
            if char_count + len(entry) > max_chars:
                remaining = max_chars - char_count
                entry = entry[:remaining]
                lines.append(entry)
                break

            lines.append(entry)
            char_count += len(entry)

        result = '\n'.join(lines)

        if result.strip() == '## Retrieved Context':
            return ''

        return result
