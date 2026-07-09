import logging
from collections.abc import AsyncGenerator

from core.llm import GroqLLMClient
from memory.memory_service import MemoryService
from orchestrator.executor import Executor
from orchestrator.planner import Planner
from orchestrator.router import Router
from orchestrator.verifier import Verifier
from rag.context_builder import RAGContextBuilder
from rag.retriever import HybridRetriever
from skills.registry import SkillRegistry
from tools.base import BaseTool

logger = logging.getLogger(__name__)


class Orchestrator:
    """Main agent loop: router -> planner -> executor -> verifier."""

    def __init__(
        self,
        llm: GroqLLMClient,
        tools: dict[str, BaseTool],
        skills: SkillRegistry,
        memory_service: MemoryService | None = None,
    ):
        self.llm = llm
        self.router = Router()
        self.planner = Planner()
        self.executor = Executor(tools=tools, skills=skills, llm=llm)
        self.verifier = Verifier(llm=llm)
        self.memory = memory_service

        retriever = HybridRetriever()
        self.rag_builder = RAGContextBuilder(retriever)

    async def chat_stream(
        self,
        messages: list[dict],
        user_id: int | None = None,
    ) -> AsyncGenerator[str, None]:
        query = self._last_user_message(messages)

        if not query:
            async for t in self.llm.generate_stream(messages):
                yield t
            return

        context = await self._build_context(query, user_id, messages)

        intent = self.router.route(query)
        logger.info('Orchestrator: intent=%s, query="%s"', intent, query[:100])

        self._inject_intent_instruction(messages, intent)

        plan = self.planner.plan(intent, query, context)

        response = await self.executor.execute(plan, query, messages)

        ok, final = await self.verifier.verify(query, response)
        if not ok:
            logger.info('Orchestrator: verifier caught issue, re-requesting')
            messages_with_context = list(messages)
            messages_with_context.append({'role': 'user', 'content': response})
            corrected = ''
            async for t in self.llm.generate_stream(messages_with_context):
                corrected += t
            response = corrected

        async for token in self._stream_text(response):
            yield token

        if self.memory and user_id:
            try:
                await self.memory.update_from_conversation(
                    user_id, query, response,
                )
            except Exception as e:
                logger.warning('Memory update failed: %s', e)

    async def _build_context(
        self,
        query: str,
        user_id: int | None,
        messages: list[dict],
    ) -> dict:
        rag_context = ''
        try:
            rag_context = await self.rag_builder.build_context(query)
        except Exception as e:
            logger.warning('RAG build failed: %s', e)

        user_prefs = {}
        if self.memory and user_id:
            try:
                user_prefs = await self.memory.load_preferences(user_id)
            except Exception as e:
                logger.warning('Memory load failed: %s', e)

        return {
            'rag_context': rag_context,
            'user_preferences': user_prefs,
            'trip_state': None,
            'conversation_summary': '',
        }

    @staticmethod
    def _inject_intent_instruction(messages: list[dict], intent: str) -> None:
        instructions = {
            'chitchat': '\n[Respond in 1-3 short sentences. No structure, no headers.]',
            'general_ev_knowledge': '\n[Answer from your knowledge + RAG context below. Be concise.]',
            'trip_planning': '\n[Gather origin, destination, vehicle, battery% if any missing, then use trip_planner.]',
            'station_search': '\n[Use station_tool to find chargers. Do not invent stations.]',
            'weather': '\n[Use weather_tool for conditions. Add EV-relevant advice.]',
            'booking': '\n[Use booking_tool to fetch bookings.]',
            'explain_route': '\n[Explain the planner decision using RAG context about the planner algorithm.]',
        }
        hint = instructions.get(intent, '')
        if hint:
            for i in range(len(messages) - 1, -1, -1):
                if messages[i].get('role') == 'user':
                    messages[i]['content'] += hint
                    break

    @staticmethod
    def _last_user_message(messages: list[dict]) -> str:
        for msg in reversed(messages):
            if msg.get('role') == 'user':
                return msg.get('content', '')
        return ''

    @staticmethod
    async def _stream_text(text: str) -> AsyncGenerator[str, None]:
        words = text.split(' ')
        for i, word in enumerate(words):
            yield word + (' ' if i < len(words) - 1 else '')
