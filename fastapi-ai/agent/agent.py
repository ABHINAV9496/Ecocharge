import asyncio
import json
from collections.abc import AsyncGenerator

from agent.tool_registry import ToolRegistry
from agent.tool_router import ToolRouter
from agent.tool_executor import ToolExecutor
from services.openai_service import OpenAIService
from utils import get_logger

logger = get_logger(__name__)

MAX_TOOL_LOOPS = 5


class Agent:
    """Orchestrates the AI conversation loop.

    Flow:
    1. Receive user message + conversation history.
    2. ToolRouter decides if one or more tools are needed.
    3. If no tools needed → stream LLM response directly.
    4. If tools needed → execute ALL in parallel → feed JSON results
       back to LLM. If LLM asks for more tools, loop (up to MAX_TOOL_LOOPS).
    5. Stream final natural language response.
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
        tool_round = 0

        while tool_round < MAX_TOOL_LOOPS:
            routes = await self._router.route(messages)

            if routes is None:
                logger.info('Agent: no tool needed — streaming response')
                async for token in self._llm.generate_stream(messages):
                    yield token
                return

            tool_round += 1
            logger.info(
                'Agent: tool round %d — executing %d tool(s)',
                tool_round,
                len(routes),
            )

            results = await asyncio.gather(*[
                self._executor.execute(r['tool'], r['arguments'])
                for r in routes
            ])

            # Check for unrecoverable errors
            for r, result in zip(routes, results):
                if result.get('error'):
                    logger.error(
                        'Agent: tool %s returned error: %s',
                        r['tool_name'],
                        result.get('message'),
                    )
                    yield result['message']
                    return

            # Single assistant message listing all tool_calls
            messages.append({
                'role': 'assistant',
                'content': None,
                'tool_calls': [
                    {
                        'id': r['tool_call_id'],
                        'type': 'function',
                        'function': {
                            'name': r['tool_name'],
                            'arguments': json.dumps(r['arguments']),
                        },
                    }
                    for r in routes
                ],
            })

            # Per-tool result messages
            for r, result in zip(routes, results):
                messages.append({
                    'role': 'tool',
                    'tool_call_id': r['tool_call_id'],
                    'content': json.dumps(result),
                })

            # Loop back — LLM may call more tools or generate final response

        logger.warning('Agent: exceeded max tool loops (%d)', MAX_TOOL_LOOPS)
        async for token in self._llm.generate_stream(messages):
            yield token
