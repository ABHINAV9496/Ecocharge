import json
import logging
from typing import Any

from agent.tool_registry import ToolRegistry
from services.openai_service import OpenAIService

logger = logging.getLogger(__name__)


class ToolRouter:
    """Determines whether the user's message requires a tool.

    Uses OpenAI function calling to let the model decide.
    If the model returns tool_calls, routes are resolved.
    Otherwise the LLM answers directly.
    """

    def __init__(self, llm: OpenAIService, registry: ToolRegistry):
        self._llm = llm
        self._registry = registry

    async def route(self, messages: list[dict]) -> list[dict[str, Any]] | None:
        """Send messages to the LLM with tool definitions.

        Returns None if no tool is needed (LLM answered directly).
        Returns a list of route dicts (one per tool call) when tools are selected.
        """
        tool_defs = self._registry.get_openai_tool_definitions()

        response = await self._llm.complete(
            messages=messages,
            tools=tool_defs,
        )

        if not response.tool_calls:
            logger.info('ToolRouter: no tool call — LLM answered directly')
            return None

        routes: list[dict[str, Any]] = []
        for tc in response.tool_calls:
            tool_name = tc.function.name
            try:
                arguments = json.loads(tc.function.arguments)
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

        if not routes:
            return None

        logger.info(
            'ToolRouter: selected %d tool(s): %s',
            len(routes),
            [r['tool_name'] for r in routes],
        )
        return routes
