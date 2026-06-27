from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config import settings
from prompts import SYSTEM_PROMPT
from schemas import ChatRequest
from services.openai_service import OpenAIService
from utils import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix='/api', tags=['Chat'])

llm = OpenAIService()


@router.post('/chat')
async def chat(body: ChatRequest):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail='Message cannot be empty')

    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail='AI service is not configured. Please set the OPENAI_API_KEY environment variable.',
        )

    messages = [
        {'role': 'system', 'content': SYSTEM_PROMPT},
        {'role': 'user', 'content': body.message},
    ]

    logger.info('Incoming prompt: %s', body.message[:120])

    async def stream():
        full_reply = ''
        try:
            async for token in llm.generate_stream(messages):
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
            logger.error('OpenAI streaming error: %s', str(e))
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

    messages = [
        {'role': 'system', 'content': SYSTEM_PROMPT},
        {'role': 'user', 'content': body.message},
    ]

    try:
        reply = await llm.generate(messages)
        return {'reply': reply}
    except Exception as e:
        logger.error('OpenAI generation error: %s', str(e))
        raise HTTPException(
            status_code=502,
            detail='AI service error. Please try again later.',
        )
