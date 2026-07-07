import logging

import httpx
from sentence_transformers import SentenceTransformer

from config import settings

logger = logging.getLogger(__name__)

_model: SentenceTransformer | None = None


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info('Loading embedding model: all-MiniLM-L6-v2')
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model


async def ingest_all_documents():
    """Fetch all documents from Django and generate embeddings."""
    model = get_embedding_model()
    url = f'{settings.DJANGO_BASE}/api/knowledge/documents/'
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            docs = resp.json()
    except Exception as e:
        logger.warning('Failed to fetch documents for ingestion: %s', e)
        return

    for doc in docs:
        doc_id = doc.get('id')
        content = doc.get('content', '')
        if not content or doc.get('embedding'):
            continue

        emb = model.encode(content).tolist()
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                await client.post(
                    f'{settings.DJANGO_BASE}/api/knowledge/documents/embedding/',
                    json={'id': doc_id, 'embedding': emb},
                )
        except Exception as e:
            logger.warning('Failed to update embedding for %s: %s', doc_id, e)

    logger.info('Ingested embeddings for %d documents', len(docs))
