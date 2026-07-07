from django.contrib.postgres.operations import CreateExtension
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        CreateExtension('vector'),
        migrations.CreateModel(
            name='KnowledgeDocument',
            fields=[
                ('id', models.CharField(max_length=100, primary_key=True)),
                ('title', models.CharField(max_length=255)),
                ('content', models.TextField()),
                ('source', models.CharField(
                    choices=[
                        ('manual', 'Manual Entry'),
                        ('api_docs', 'API Documentation'),
                        ('faq', 'FAQ'),
                        ('vehicle_spec', 'Vehicle Specification'),
                        ('ev_knowledge', 'EV Knowledge Base'),
                    ],
                    default='manual',
                    max_length=50,
                )),
                ('chunk_index', models.IntegerField(default=0)),
                ('embedding', models.JSONField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['source', 'title'],
            },
        ),
        migrations.AddIndex(
            model_name='knowledgedocument',
            index=models.Index(fields=['source'], name='knowledge_source_idx'),
        ),
    ]
