import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config import settings
from core.llm import GroqLLMClient
from memory import MemoryService
from orchestrator.orchestrator import Orchestrator
from prompts.system_prompt import SYSTEM_PROMPT
from schemas import ChatRequest
from skills.general_ev_knowledge_skill import GeneralEVKnowledgeSkill
from skills.registry import SkillRegistry
from skills.route_planner_skill import RoutePlannerSkill
from skills.trip_explainer_skill import TripExplainerSkill
from skills.weather_adaptation_skill import WeatherAdaptationSkill
from tools.context import auth_token_var
from tools.real_booking_tool import RealBookingTool
from tools.real_station_tool import RealStationTool
from tools.real_trip_tool import RealTripTool
from tools.real_weather_tool import RealWeatherTool
from utils import extract_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/api', tags=['Chat'])

llm = GroqLLMClient()

tools: dict[str, any] = {
    'trip_planner': RealTripTool(),
    'weather_tool': RealWeatherTool(),
    'station_tool': RealStationTool(),
    'booking_tool': RealBookingTool(),
}

skill_registry = SkillRegistry()
for skill in [
    RoutePlannerSkill(),
    TripExplainerSkill(),
    WeatherAdaptationSkill(),
    GeneralEVKnowledgeSkill(),
]:
    skill_registry.register(skill)

memory_service: MemoryService | None = None


def _get_memory_service() -> MemoryService | None:
    global memory_service
    if memory_service is None:
        try:
            memory_service = MemoryService(llm)
        except Exception as e:
            logger.warning('Memory service unavailable: %s', e)
            return None
    return memory_service


orchestrator = Orchestrator(
    llm=llm,
    tools=tools,
    skills=skill_registry,
    memory_service=_get_memory_service(),
)


def _build_messages(body: ChatRequest) -> list[dict]:
    messages = [{'role': 'system', 'content': SYSTEM_PROMPT}]
    for msg in body.history:
        messages.append(msg)
    messages.append({'role': 'user', 'content': body.message})
    return messages


@router.post('/chat')
async def chat(body: ChatRequest):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail='Message cannot be empty')

    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail='AI service is not configured. Please set the GROQ_API_KEY environment variable.',
        )

    auth_token_var.set(body.token)

    user_id = extract_user_id(body.token)
    messages = _build_messages(body)

    logger.info(
        'Incoming: %s | history=%d | user_id=%s',
        body.message[:120],
        len(body.history),
        user_id,
    )

    async def stream():
        full_reply = ''
        try:
            async for token in orchestrator.chat_stream(messages, user_id):
                full_reply += token
                yield f'data: {token}\n\n'
            yield 'data: [DONE]\n\n'
            logger.info(
                'Response complete | in=%d chars | out=%d chars',
                len(body.message),
                len(full_reply),
            )
        except Exception as e:
            logger.error('Streaming error: %s', str(e))
            yield 'data: Sorry, I encountered an error. Please try again.\n\n'
            yield 'data: [DONE]\n\n'

    return StreamingResponse(
        stream(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    )


@router.post('/chat/simple')
async def chat_simple(body: ChatRequest):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail='Message cannot be empty')

    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail='AI service is not configured.',
        )

    auth_token_var.set(body.token)

    user_id = extract_user_id(body.token)
    messages = _build_messages(body)

    try:
        reply = ''
        async for token in orchestrator.chat_stream(messages, user_id):
            reply += token
        return {'reply': reply}
    except Exception as e:
        logger.error('Generation error: %s', str(e))
        raise HTTPException(
            status_code=502,
            detail='AI service error. Please try again later.',
        )
