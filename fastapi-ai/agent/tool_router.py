import json
import logging
from typing import Any

from agent.tool_registry import ToolRegistry
from core.llm import GroqLLMClient

logger = logging.getLogger(__name__)


class ToolRouter:
    """Determines whether the user's message requires a tool."""

    def __init__(self, llm: GroqLLMClient, registry: ToolRegistry):
        self._llm = llm
        self._registry = registry

    async def route(self, messages: list[dict]) -> list[dict[str, Any]] | None:
        user_msg = ''
        for m in reversed(messages):
            if m.get('role') == 'user':
                user_msg = m.get('content', '')
                break

        tool_defs = self._registry.get_openai_tool_definitions()

        response = await self._llm.complete(
            messages=messages,
            tools=tool_defs,
        )

        logger.info('--- TOOL ROUTER ---')
        logger.info('User: %s', user_msg[:200])

        if not response.tool_calls:
            logger.info('Tool: none (LLM answered directly)')
            logger.info('--- END TOOL ROUTER ---')
            return None

        routes: list[dict[str, Any]] = []
        for tc in response.tool_calls:
            tool_name = tc.function.name
            raw_args = tc.function.arguments
            logger.info('Tool: %s', tool_name)
            logger.info('Raw arguments: %s', raw_args)
            try:
                arguments = json.loads(raw_args)
                logger.info('Parsed arguments: %s', json.dumps(arguments, indent=2))
            except json.JSONDecodeError:
                logger.error('ToolRouter: failed to parse arguments for %s', tool_name)
                arguments = {}

            tool = self._registry.get(tool_name)
            if not tool:
                logger.warning('ToolRouter: unknown tool requested: %s', tool_name)
                continue

            routes.append({
                'tool': tool,
                'tool_name': tool_name,
                'tool_call_id': tc.id,
                'arguments': arguments,
            })

        logger.info('--- END TOOL ROUTER ---')

        if not routes:
            return None

        return routes
