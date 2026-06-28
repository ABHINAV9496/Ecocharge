import asyncio
import json
from collections.abc import AsyncGenerator

from agent.tool_registry import ToolRegistry
from agent.tool_router import ToolRouter
from agent.tool_executor import ToolExecutor
from services.openai_service import OpenAIService
from services.reasoning_service import ReasoningService
from utils import get_logger

logger = get_logger(__name__)

MAX_TOOL_LOOPS = 5


class Agent:
    """Orchestrates the AI conversation loop with reasoning.

    Flow:
    1. Receive user message + conversation history.
    2. ToolRouter decides if one or more tools are needed.
    3. If no tools needed → stream LLM response directly.
    4. If tools needed → execute ALL in parallel → log results.
    5. After all tool rounds complete → ReasoningService analyses
       combined tool outputs → inject reasoning into messages.
    6. Stream final natural language response with EV advisor insights.
    """

    def __init__(
        self,
        llm: OpenAIService,
        registry: ToolRegistry,
        reasoner: ReasoningService | None = None,
    ):
        self._llm = llm
        self._router = ToolRouter(llm=llm, registry=registry)
        self._executor = ToolExecutor()
        self._reasoner = reasoner

    async def chat_stream(
        self,
        messages: list[dict],
    ) -> AsyncGenerator[str, None]:
        tool_results_log: list[dict] = []
        tool_round = 0

        while tool_round < MAX_TOOL_LOOPS:
            routes = await self._router.route(messages)

            if routes is None:
                await self._maybe_reason(messages, tool_results_log)
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

            # Log tool results for reasoning
            for r, result in zip(routes, results):
                tool_results_log.append({
                    'tool': r['tool_name'],
                    'arguments': r['arguments'],
                    'result': result,
                })

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
        await self._maybe_reason(messages, tool_results_log)
        async for token in self._llm.generate_stream(messages):
            yield token

    # ------------------------------------------------------------------
    # Reasoning integration
    # ------------------------------------------------------------------

    async def _maybe_reason(
        self,
        messages: list[dict],
        tool_results_log: list[dict],
    ) -> None:
        """If tools were used and a reasoner is available, run reasoning
        and inject the analysis into the conversation."""
        if not tool_results_log or not self._reasoner:
            return

        user_message = self._extract_user_message(messages)
        if not user_message:
            return

        logger.info(
            'Agent: running reasoning over %d tool result(s)',
            len(tool_results_log),
        )
        reasoning = await self._reasoner.reason(
            tool_results=tool_results_log,
            user_message=user_message,
        )

        if reasoning:
            messages.append({
                'role': 'system',
                'content': f'## Reasoning Analysis\n\n{reasoning}',
            })
            logger.info(
                'Agent: injected reasoning (%d chars) into conversation',
                len(reasoning),
            )
        else:
            logger.info('Agent: reasoning produced no output — skipping')

    @staticmethod
    def _extract_user_message(messages: list[dict]) -> str:
        for msg in reversed(messages):
            if msg.get('role') == 'user':
                return msg.get('content', '')
        return ''
