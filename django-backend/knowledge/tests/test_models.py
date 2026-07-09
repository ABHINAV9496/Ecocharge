from knowledge.models import KnowledgeDocument


class TestKnowledgeDocument:
    def test_create_document(self, db):
        doc = KnowledgeDocument.objects.create(
            id='doc-001',
            title='What is EV Range?',
            content='EV range depends on battery capacity, driving habits, and weather.',
            source='faq',
        )
        assert doc.title == 'What is EV Range?'
        assert doc.source == 'faq'
        assert str(doc) == 'What is EV Range? [faq]'

    def test_document_defaults(self, db):
        doc = KnowledgeDocument.objects.create(
            id='doc-002',
            title='Battery Care',
            content='Tips for maintaining battery health.',
        )
        assert doc.source == 'manual'
        assert doc.chunk_index == 0
        assert doc.embedding is None

    def test_document_ordering(self, db):
        KnowledgeDocument.objects.create(
            id='a-1', title='A Doc', content='...', source='faq'
        )
        KnowledgeDocument.objects.create(
            id='b-1', title='B Doc', content='...', source='ev_knowledge'
        )
        docs = KnowledgeDocument.objects.all()
        for i in range(len(docs) - 1):
            assert (docs[i].source, docs[i].title) <= (docs[i + 1].source, docs[i + 1].title)
