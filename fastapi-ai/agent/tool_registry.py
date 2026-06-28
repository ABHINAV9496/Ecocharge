import logging
from typing import Any

from tools.base import BaseTool

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Registry of all available tools.

    The AI never directly instantiates tools.
    Instead: AI → Registry → Tool.
    """

    def __init__(self):
        self._tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        if tool.name in self._tools:
            logger.warning('Overwriting existing tool: %s', tool.name)
        self._tools[tool.name] = tool
        logger.info('Registered tool: %s — %s', tool.name, tool.description[:60])

    def get(self, name: str) -> BaseTool | None:
        return self._tools.get(name)

    def get_all(self) -> dict[str, BaseTool]:
        return dict(self._tools)

    def get_openai_tool_definitions(self) -> list[dict[str, Any]]:
        """Return an array of OpenAI-compatible tool definitions."""
        return [tool.to_openai_tool() for tool in self._tools.values()]

    def get_tool_summaries(self) -> list[dict[str, str]]:
        """Return a lightweight summary for routing decisions."""
        return [
            {'name': tool.name, 'description': tool.description}
            for tool in self._tools.values()
        ]
