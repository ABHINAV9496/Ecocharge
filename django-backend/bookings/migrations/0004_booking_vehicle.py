import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('vehicles', '0001_initial'),
        ('bookings', '0003_in_progress_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='vehicle',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bookings', to='vehicles.vehicleprofile'),
        ),
    ]
