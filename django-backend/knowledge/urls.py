from django.urls import path

from . import views

urlpatterns = [
    path('search/', views.search_documents, name='knowledge-search'),
    path('documents/', views.list_documents, name='knowledge-list'),
    path('documents/upsert/', views.upsert_document, name='knowledge-upsert'),
    path('documents/embedding/', views.update_embedding, name='knowledge-embedding'),
    path('documents/bulk/', views.bulk_upsert, name='knowledge-bulk'),
]
