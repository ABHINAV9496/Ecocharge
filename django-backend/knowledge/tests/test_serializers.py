from knowledge.serializers import KnowledgeDocumentSerializer, KnowledgeSearchResultSerializer


class TestKnowledgeDocumentSerializer:
    def test_serializes_all_fields(self, db):
        from knowledge.models import KnowledgeDocument
        doc = KnowledgeDocument.objects.create(
            id='test-doc', title='Test', content='Content',
            source='manual',
        )
        serializer = KnowledgeDocumentSerializer(doc)
        assert serializer.data['id'] == 'test-doc'
        assert serializer.data['source'] == 'manual'


class TestKnowledgeSearchResultSerializer:
    def test_valid_data(self):
        data = {
            'id': 'doc-1', 'title': 'Result',
            'content': 'Content', 'source': 'faq', 'score': 0.95,
        }
        serializer = KnowledgeSearchResultSerializer(data=data)
        assert serializer.is_valid(), serializer.errors
