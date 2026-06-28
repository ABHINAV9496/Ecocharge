import json
import logging
from typing import Any

from agent.tool_registry import ToolRegistry
from services.openai_service import OpenAIService

logger = logging.getLogger(__name__)


class ToolRouter:
    """Determines whether the user's message requires a tool.

    Uses OpenAI function calling to let the model decide.
    If the model returns a tool_call, the route is resolved.
    Otherwise the LLM answers directly.
    """

    def __init__(self, llm: OpenAIService, registry: ToolRegistry):
        self._llm = llm
        self._registry = registry

    async def route(self, messages: list[dict]) -> dict[str, Any] | None:
        """Send messages to the LLM with tool definitions.

        Returns None if no tool is needed (LLM answered directly).
        Returns a dict with 'tool' and 'arguments' if a tool was selected.
        """
        tool_defs = self._registry.get_openai_tool_definitions()

        response = await self._llm.complete(
            messages=messages,
            tools=tool_defs,
        )

        if not response.tool_calls:
            logger.info('ToolRouter: no tool call — LLM answered directly')
            return None

        tool_call = response.tool_calls[0]
        tool_name = tool_call.function.name
        try:
            arguments = json.loads(tool_call.function.arguments)
        except json.JSONDecodeError:
            logger.error('ToolRouter: failed to parse arguments for %s', tool_name)
            arguments = {}

        tool = self._registry.get(tool_name)
        if not tool:
            logger.warning('ToolRouter: unknown tool requested: %s', tool_name)
            return None

        logger.info(
            'ToolRouter: selected tool=%s args=%s',
            tool_name,
            arguments,
        )
        return {
            'tool': tool,
            'tool_name': tool_name,
            'tool_call_id': tool_call.id,
            'arguments': arguments,
        }
