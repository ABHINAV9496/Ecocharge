from django.db import migrations, models

DEFAULT_CHARGING_CURVE = [
    {'from_soc': 0, 'to_soc': 20, 'power_factor': 0.8},
    {'from_soc': 20, 'to_soc': 80, 'power_factor': 1.0},
    {'from_soc': 80, 'to_soc': 90, 'power_factor': 0.5},
    {'from_soc': 90, 'to_soc': 100, 'power_factor': 0.2},
]


def set_default_curves(apps, schema_editor):
    VehicleProfile = apps.get_model('vehicles', 'VehicleProfile')
    VehicleProfile.objects.update(charging_curve=DEFAULT_CHARGING_CURVE)


class Migration(migrations.Migration):
    dependencies = [
        ('vehicles', '0003_update_vehicle_specs'),
    ]

    operations = [
        migrations.AddField(
            model_name='vehicleprofile',
            name='charging_curve',
            field=models.JSONField(default=list, blank=True),
        ),
        migrations.RunPython(set_default_curves, migrations.RunPython.noop),
    ]
