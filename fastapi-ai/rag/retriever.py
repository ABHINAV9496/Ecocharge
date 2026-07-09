import json
import logging

import httpx

from config import settings
from rag.pipeline import get_embedding_model

logger = logging.getLogger(__name__)


class HybridRetriever:
    """Hybrid retriever using dense (pgvector) + sparse (full-text) search."""

    def __init__(self):
        self._model = get_embedding_model()

    async def search(self, query: str, top_k: int = 5) -> list[dict]:
        query_emb = self._model.encode(query).tolist()
        emb_json = json.dumps(query_emb)
        url = f'{settings.DJANGO_BASE}/api/knowledge/search/'
        params = {'embedding': emb_json, 'q': query, 'top_k': str(top_k * 4)}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
                results = data.get('results', [])
        except Exception as e:
            logger.warning('RAG search failed: %s', e)
            return []

        results.sort(key=lambda r: r.get('score', 0), reverse=True)
        return results[:top_k]
