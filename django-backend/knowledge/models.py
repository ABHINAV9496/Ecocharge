from django.contrib.postgres.indexes import GinIndex
from django.db import models


class KnowledgeDocument(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    title = models.CharField(max_length=255)
    content = models.TextField()
    source = models.CharField(
        max_length=50,
        choices=[
            ('manual', 'Manual Entry'),
            ('api_docs', 'API Documentation'),
            ('faq', 'FAQ'),
            ('vehicle_spec', 'Vehicle Specification'),
            ('ev_knowledge', 'EV Knowledge Base'),
        ],
        default='manual',
    )
    chunk_index = models.IntegerField(default=0)
    embedding = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            GinIndex(fields=['content'], name='knowledge_content_gin', opclasses=['gin_trgm_ops']),
        ]
        ordering = ['source', 'title']

    def __str__(self):
        return f'{self.title} [{self.source}]'
