import json
from collections.abc import AsyncGenerator

from agent.tool_registry import ToolRegistry
from agent.tool_router import ToolRouter
from agent.tool_executor import ToolExecutor
from services.openai_service import OpenAIService
from utils import get_logger

logger = get_logger(__name__)


class Agent:
    """Orchestrates the AI conversation loop.

    Flow:
    1. Receive user message + conversation history.
    2. ToolRouter decides if a tool is needed.
    3. If no tool needed → stream LLM response directly.
    4. If tool needed → ToolExecutor runs it → pass JSON back
       to LLM → stream final natural language response.
    """

    def __init__(
        self,
        llm: OpenAIService,
        registry: ToolRegistry,
    ):
        self._llm = llm
        self._router = ToolRouter(llm=llm, registry=registry)
        self._executor = ToolExecutor()

    async def chat_stream(
        self,
        messages: list[dict],
    ) -> AsyncGenerator[str, None]:
        route = await self._router.route(messages)

        if route is None:
            logger.info('Agent: no tool needed — streaming direct response')
            async for token in self._llm.generate_stream(messages):
                yield token
            return

        # --- Tool path ---
        tool = route['tool']
        tool_name = route['tool_name']
        tool_call_id = route['tool_call_id']
        arguments = route['arguments']

        result = await self._executor.execute(tool, arguments)

        if result.get('error'):
            yield result['message']
            return

        # Append assistant's tool call + tool result to conversation
        messages.append({
            'role': 'assistant',
            'content': None,
            'tool_calls': [
                {
                    'id': tool_call_id,
                    'type': 'function',
                    'function': {
                        'name': tool_name,
                        'arguments': json.dumps(arguments),
                    },
                },
            ],
        })
        messages.append({
            'role': 'tool',
            'tool_call_id': tool_call_id,
            'content': json.dumps(result),
        })

        logger.info('Agent: tool executed — streaming NL response')
        async for token in self._llm.generate_stream(messages):
            yield token
