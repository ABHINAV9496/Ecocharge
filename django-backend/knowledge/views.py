import json
import logging

from django.db import connection
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import KnowledgeDocument
from .serializers import KnowledgeDocumentSerializer

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def search_documents(request):
    query = request.query_params.get('q', '').strip()
    embedding_json = request.query_params.get('embedding')
    top_k = int(request.query_params.get('top_k', 20))

    if not query and not embedding_json:
        return Response({'error': 'Provide q (text query) or embedding (JSON array)'}, status=400)

    results = []

    if embedding_json:
        try:
            query_emb = json.loads(embedding_json)
            emb_str = ','.join(str(x) for x in query_emb)
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, title, content, source,
                           1 - (embedding::vector <=> ARRAY[{emb_str}]::vector) AS score
                    FROM knowledge_knowledgedocument
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding::vector <=> ARRAY[{emb_str}]::vector
                    LIMIT %s
                    """,
                    [top_k],
                )
                rows = cursor.fetchall()
                for row in rows:
                    results.append({
                        'id': row[0],
                        'title': row[1],
                        'content': row[2],
                        'source': row[3],
                        'score': float(row[4]),
                    })
        except Exception as e:
            logger.warning('Vector search failed: %s', e)

    if query and not results:
        docs = KnowledgeDocument.objects.filter(content__icontains=query)[:top_k]
        results = [
            {
                'id': d.id,
                'title': d.title,
                'content': d.content,
                'source': d.source,
                'score': 1.0,
            }
            for d in docs
        ]

    return Response({'results': results, 'total': len(results)})


@api_view(['GET'])
@permission_classes([AllowAny])
def list_documents(request):
    docs = KnowledgeDocument.objects.all().order_by('source', 'title')
    serializer = KnowledgeDocumentSerializer(docs, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upsert_document(request):
    doc_id = request.data.get('id')
    try:
        doc = KnowledgeDocument.objects.get(pk=doc_id)
        serializer = KnowledgeDocumentSerializer(doc, data=request.data, partial=True)
    except KnowledgeDocument.DoesNotExist:
        serializer = KnowledgeDocumentSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_embedding(request):
    doc_id = request.data.get('id')
    embedding = request.data.get('embedding')

    try:
        doc = KnowledgeDocument.objects.get(pk=doc_id)
        doc.embedding = embedding
        doc.save(update_fields=['embedding'])
        return Response({'status': 'ok'})
    except KnowledgeDocument.DoesNotExist:
        return Response({'error': 'Document not found'}, status=404)


@api_view(['POST'])
@permission_classes([AllowAny])
def bulk_upsert(request):
    documents = request.data.get('documents', [])
    created = 0
    updated = 0
    for doc_data in documents:
        doc_id = doc_data.get('id')
        try:
            doc = KnowledgeDocument.objects.get(pk=doc_id)
            for key, value in doc_data.items():
                setattr(doc, key, value)
            doc.save()
            updated += 1
        except KnowledgeDocument.DoesNotExist:
            KnowledgeDocument.objects.create(**doc_data)
            created += 1
    return Response({'created': created, 'updated': updated, 'total': len(documents)})
