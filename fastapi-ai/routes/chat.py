from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from agent.agent import Agent
from agent.tool_registry import ToolRegistry
from config import settings
from prompts.system_prompt import SYSTEM_PROMPT
from schemas import ChatRequest
from services.openai_service import OpenAIService
from tools.context import auth_token_var
from tools.mock_station_tool import MockStationTool
from tools.mock_wallet_tool import MockWalletTool
from tools.mock_booking_tool import MockBookingTool
from tools.real_trip_tool import RealTripTool
from tools.real_weather_tool import RealWeatherTool
from utils import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix='/api', tags=['Chat'])

llm = OpenAIService()

# --- Build registry ---
registry = ToolRegistry()
for tool in [
    RealTripTool(),
    RealWeatherTool(),
    MockStationTool(),
    MockWalletTool(),
    MockBookingTool(),
]:
    registry.register(tool)

agent = Agent(llm=llm, registry=registry)


@router.post('/chat')
async def chat(body: ChatRequest):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail='Message cannot be empty')

    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail='AI service is not configured. Please set the OPENAI_API_KEY environment variable.',
        )

    # Store auth token for tool execution
    auth_token_var.set(body.token)

    messages = [{'role': 'system', 'content': SYSTEM_PROMPT}]
    for msg in body.history:
        messages.append(msg)
    messages.append({'role': 'user', 'content': body.message})

    logger.info(
        'Incoming prompt: %s | history=%d messages | has_token=%s',
        body.message[:120],
        len(body.history),
        bool(body.token),
    )

    async def stream():
        full_reply = ''
        try:
            async for token in agent.chat_stream(messages):
                full_reply += token
                yield f'data: {token}\n\n'
            yield 'data: [DONE]\n\n'
            logger.info(
                'Response complete | input=%d chars | output=%d chars | model=%s',
                len(body.message),
                len(full_reply),
                settings.OPENAI_MODEL,
            )
        except Exception as e:
            logger.error('Agent streaming error: %s', str(e))
            error_msg = 'Sorry, I encountered an error processing your request. Please try again.'
            yield f'data: {error_msg}\n\n'
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

    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail='AI service is not configured. Please set the OPENAI_API_KEY environment variable.',
        )

    auth_token_var.set(body.token)

    messages = [{'role': 'system', 'content': SYSTEM_PROMPT}]
    for msg in body.history:
        messages.append(msg)
    messages.append({'role': 'user', 'content': body.message})

    try:
        reply = ''
        async for token in agent.chat_stream(messages):
            reply += token
        return {'reply': reply}
    except Exception as e:
        logger.error('Agent generation error: %s', str(e))
        raise HTTPException(
            status_code=502,
            detail='AI service error. Please try again later.',
        )
