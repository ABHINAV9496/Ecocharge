import logging

import httpx
from fastapi import APIRouter

from config import settings
from rag.pipeline import ingest_all_documents

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/api/rag', tags=['RAG'])


@router.post('/reindex')
async def reindex():
    """Trigger full re-indexing of all knowledge documents."""
    try:
        await ingest_all_documents()
        return {'status': 'ok', 'message': 'Re-indexing complete'}
    except Exception as e:
        logger.error('Re-index failed: %s', e)
        return {'status': 'error', 'message': str(e)}


@router.get('/search')
async def search(q: str = '', top_k: int = 5):
    """Proxy search to Django knowledge API."""
    url = f'{settings.DJANGO_BASE}/api/knowledge/search/'
    params = {'q': q, 'top_k': str(top_k)}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.warning('RAG search proxy failed: %s', e)
        return {'results': [], 'total': 0}
