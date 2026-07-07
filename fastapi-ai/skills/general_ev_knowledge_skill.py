import logging

from duckduckgo_search import DDGS

from skills.base import BaseSkill, SkillContext, SkillMetadata

logger = logging.getLogger(__name__)


class GeneralEVKnowledgeSkill(BaseSkill):
    metadata = SkillMetadata(
        name='general_ev_knowledge',
        version='1.0.0',
        description='Answer general EV knowledge questions using LLM knowledge and web search',
    )

    async def execute(self, context: SkillContext) -> str:
        query = context.query
        rag_context = context.rag_context

        search_results = await self._web_search(query)

        parts = []
        if rag_context:
            parts.append(f'## Retrieved Knowledge\n\n{rag_context}\n')

        if search_results:
            parts.append(f'## Web Search Results\n\n{search_results}\n')

        if not rag_context and not search_results:
            return f'I will answer based on my general knowledge about: {query}'

        return '\n'.join(parts)

    async def _web_search(self, query: str, max_results: int = 3) -> str:
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                if results:
                    lines = []
                    for r in results:
                        title = r.get('title', '')
                        snippet = r.get('snippet', '')
                        href = r.get('href', '')
                        lines.append(f'**{title}**\n{snippet}\nSource: {href}')
                    return '\n\n'.join(lines)
        except Exception as e:
            logger.warning('Web search failed: %s', e)
            return ''
        return ''
