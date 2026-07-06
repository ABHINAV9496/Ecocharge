from django.db import migrations

UPDATES = {
    'tata-nexon-ev': {'year': 2025, 'battery_kwh': 45.0, 'consumption_wh_per_km': 155, 'fast_charge_kw': 60, 'ac_charge_kw': 7.2},
    'tata-tiago-ev': {'consumption_wh_per_km': 155},
    'tata-punch-ev': {'battery_kwh': 40.0, 'consumption_wh_per_km': 140, 'fast_charge_kw': 65, 'ac_charge_kw': 7.2},
    'tata-curvv-ev': {'battery_kwh': 55.0, 'consumption_wh_per_km': 150, 'ac_charge_kw': 7.2},
    'tata-harrier-ev': {'battery_kwh': 75.0, 'consumption_wh_per_km': 160, 'fast_charge_kw': 120, 'ac_charge_kw': 7.2},
    'mg-zs-ev': {'consumption_wh_per_km': 150, 'fast_charge_kw': 50, 'ac_charge_kw': 7.2},
    'mg-comet-ev': {'consumption_wh_per_km': 135},
    'mg-windsor-ev': {'consumption_wh_per_km': 130, 'ac_charge_kw': 7.2},
    'hyundai-kona': {'ac_charge_kw': 7.2},
    'hyundai-ioniq-5': {'consumption_wh_per_km': 165},
    'kia-ev6': {'consumption_wh_per_km': 170, 'fast_charge_kw': 240},
    'byd-atto-3': {'consumption_wh_per_km': 135, 'ac_charge_kw': 7.2},
    'byd-e6': {'consumption_wh_per_km': 170},
    'byd-seal': {'consumption_wh_per_km': 150},
    'byd-dolphin': {'consumption_wh_per_km': 145, 'ac_charge_kw': 7.2},
    'mahindra-xuv400': {'consumption_wh_per_km': 165, 'ac_charge_kw': 7.2},
    'mahindra-be-6e': {'consumption_wh_per_km': 165},
    'mahindra-xev-9e': {'consumption_wh_per_km': 170},
    'citroen-ec3': {'consumption_wh_per_km': 160},
    'bmw-i4': {'consumption_wh_per_km': 180},
    'bmw-ix1': {'consumption_wh_per_km': 170},
    'mercedes-eqs': {'consumption_wh_per_km': 190},
    'mercedes-eqb': {'consumption_wh_per_km': 170},
    'volvo-xc40-recharge': {'consumption_wh_per_km': 185},
    'volvo-c40-recharge': {'consumption_wh_per_km': 180},
    'audi-q8-etron': {'consumption_wh_per_km': 205},
    'porsche-taycan': {'consumption_wh_per_km': 200},
    'tesla-model-3': {'consumption_wh_per_km': 145},
    'tesla-model-y': {'consumption_wh_per_km': 155},
}


def update_vehicle_specs(apps, schema_editor):
    VehicleProfile = apps.get_model('vehicles', 'VehicleProfile')
    for vid, fields in UPDATES.items():
        VehicleProfile.objects.filter(id=vid, is_builtin=True).update(**fields)


def revert_update(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('vehicles', '0002_seed_vehicles'),
    ]
    operations = [
        migrations.RunPython(update_vehicle_specs, revert_update),
    ]
