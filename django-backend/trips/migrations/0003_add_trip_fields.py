from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trips', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='trip',
            name='dest_lat',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='trip',
            name='dest_lng',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='trip',
            name='duration_minutes',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='trip',
            name='energy_consumed_kwh',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='trip',
            name='origin_lat',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='trip',
            name='origin_lng',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='trip',
            name='route_geometry',
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name='trip',
            name='stops',
            field=models.JSONField(default=list),
        ),
    ]
