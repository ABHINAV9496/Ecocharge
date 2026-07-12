import os
from django.db import migrations, models
from django.conf import settings


def link_builtin_images(apps, schema_editor):
    VehicleProfile = apps.get_model('vehicles', 'VehicleProfile')
    vehicles_dir = os.path.join(settings.MEDIA_ROOT, 'vehicles')
    if not os.path.exists(vehicles_dir):
        return
    for vehicle in VehicleProfile.objects.filter(is_builtin=True):
        filename = f'{vehicle.id}.png'
        if os.path.exists(os.path.join(vehicles_dir, filename)):
            vehicle.image = f'vehicles/{filename}'
            vehicle.save(update_fields=['image'])


class Migration(migrations.Migration):
    dependencies = [
        ('vehicles', '0004_add_charging_curve'),
    ]

    operations = [
        migrations.AddField(
            model_name='vehicleprofile',
            name='image',
            field=models.ImageField(blank=True, null=True, upload_to='vehicles/'),
        ),
        migrations.RunPython(link_builtin_images, migrations.RunPython.noop),
    ]
