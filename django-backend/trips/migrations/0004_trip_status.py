from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trips', '0003_add_trip_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='trip',
            name='status',
            field=models.CharField(
                choices=[('PLANNED', 'Planned'), ('IN_PROGRESS', 'In Progress'), ('COMPLETED', 'Completed')],
                default='PLANNED',
                max_length=20,
            ),
        ),
    ]
