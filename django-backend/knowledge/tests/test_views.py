
class TestKnowledgeList:
    def test_list_documents(self, api_client, db):
        from knowledge.models import KnowledgeDocument
        KnowledgeDocument.objects.create(
            id='doc-1', title='Test Doc', content='Content', source='manual'
        )
        resp = api_client.get('/api/knowledge/documents/')
        assert resp.status_code == 200
        assert isinstance(resp.data, list)


class TestKnowledgeSearch:
    def test_search_returns_results(self, api_client, db):
        from knowledge.models import KnowledgeDocument
        KnowledgeDocument.objects.create(
            id='doc-2', title='EV Battery',
            content='Lithium-ion battery information', source='ev_knowledge',
        )
        resp = api_client.get('/api/knowledge/search/?q=battery')
        assert resp.status_code == 200


class TestKnowledgeUpsert:
    def test_upsert_document(self, auth_client, db):
        resp = auth_client.post('/api/knowledge/documents/upsert/', {
            'id': 'new-doc',
            'title': 'New Document',
            'content': 'Brand new content',
            'source': 'manual',
        })
        assert resp.status_code in [200, 201]
