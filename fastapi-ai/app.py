from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routes.chat import router as chat_router
from utils import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)

app = FastAPI(
    title='EcoCharge AI Service',
    version='0.1.0',
    description='AI-powered EV assistant for the EcoCharge platform',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(chat_router)


@app.get('/health')
async def health():
    return {
        'status': 'ok',
        'service': 'EcoCharge AI',
        'model': settings.OPENAI_MODEL,
        'configured': bool(settings.OPENAI_API_KEY),
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception('Unhandled error: %s', exc)
    return JSONResponse(
        status_code=500,
        content={'detail': 'An unexpected error occurred. Please try again later.'},
    )
