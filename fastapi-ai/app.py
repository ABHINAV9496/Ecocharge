import asyncio
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from rag.pipeline import ingest_all_documents
from routes.admin import router as admin_router
from routes.chat import router as chat_router
from routes.rag import router as rag_router
from utils import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)

app = FastAPI(
    title='EcoCharge AI Service',
    version='2.0.0',
    description='AI-powered EV assistant — RAG, skills, orchestrator',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(chat_router)
app.include_router(rag_router)
app.include_router(admin_router)


@app.on_event('startup')
async def startup():
    logger.info('Starting EcoCharge AI Service v2...')
    try:
        asyncio.create_task(ingest_all_documents())
        logger.info('RAG document ingestion scheduled')
    except Exception as e:
        logger.warning('RAG ingestion startup failed: %s', e)


@app.get('/health')
async def health():
    return {
        'status': 'ok',
        'service': 'EcoCharge AI',
        'version': '2.0.0',
        'model': settings.GROQ_MODEL,
        'configured': bool(settings.GROQ_API_KEY),
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception('Unhandled error: %s', exc)
    return JSONResponse(
        status_code=500,
        content={'detail': 'An unexpected error occurred. Please try again later.'},
    )
