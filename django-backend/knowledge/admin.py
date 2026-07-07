from django.contrib import admin

from .models import KnowledgeDocument


@admin.register(KnowledgeDocument)
class KnowledgeDocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'source', 'chunk_index', 'created_at')
    list_filter = ('source',)
    search_fields = ('title', 'content')
