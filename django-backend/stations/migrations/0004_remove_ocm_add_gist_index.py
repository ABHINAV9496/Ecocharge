from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('stations', '0003_cachedocmstation'),
    ]

    operations = [
        migrations.DeleteModel(
            name='CachedOCMStation',
        ),
        migrations.RunSQL(
            'CREATE INDEX IF NOT EXISTS stations_chargingstation_location_gist ON stations_chargingstation USING GIST (location);',
            reverse_sql='DROP INDEX IF EXISTS stations_chargingstation_location_gist;'
        ),
    ]
