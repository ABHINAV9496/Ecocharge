from rest_framework import serializers

from .models import KnowledgeDocument


class KnowledgeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeDocument
        fields = '__all__'


class KnowledgeSearchResultSerializer(serializers.Serializer):
    id = serializers.CharField()
    title = serializers.CharField()
    content = serializers.CharField()
    source = serializers.CharField()
    score = serializers.FloatField()
