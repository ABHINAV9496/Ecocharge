from django.db import migrations

VEHICLES = [
    {'id': 'tata-nexon-ev', 'make': 'Tata', 'model': 'Nexon EV', 'year': 2025, 'battery_kwh': 45.0, 'consumption_wh_per_km': 155, 'fast_charge_kw': 60, 'ac_charge_kw': 7.2},
    {'id': 'tata-tiago-ev', 'make': 'Tata', 'model': 'Tiago EV', 'year': 2024, 'battery_kwh': 24.0, 'consumption_wh_per_km': 155, 'fast_charge_kw': 25, 'ac_charge_kw': 3.3},
    {'id': 'tata-punch-ev', 'make': 'Tata', 'model': 'Punch EV', 'year': 2025, 'battery_kwh': 40.0, 'consumption_wh_per_km': 140, 'fast_charge_kw': 65, 'ac_charge_kw': 7.2},
    {'id': 'tata-curvv-ev', 'make': 'Tata', 'model': 'Curvv EV', 'year': 2025, 'battery_kwh': 55.0, 'consumption_wh_per_km': 150, 'fast_charge_kw': 70, 'ac_charge_kw': 7.2},
    {'id': 'tata-harrier-ev', 'make': 'Tata', 'model': 'Harrier EV', 'year': 2025, 'battery_kwh': 75.0, 'consumption_wh_per_km': 160, 'fast_charge_kw': 120, 'ac_charge_kw': 7.2},
    {'id': 'mg-zs-ev', 'make': 'MG', 'model': 'ZS EV', 'year': 2024, 'battery_kwh': 50.3, 'consumption_wh_per_km': 150, 'fast_charge_kw': 50, 'ac_charge_kw': 7.2},
    {'id': 'mg-comet-ev', 'make': 'MG', 'model': 'Comet EV', 'year': 2024, 'battery_kwh': 17.3, 'consumption_wh_per_km': 135, 'fast_charge_kw': 0, 'ac_charge_kw': 3.3},
    {'id': 'mg-windsor-ev', 'make': 'MG', 'model': 'Windsor EV', 'year': 2025, 'battery_kwh': 38.0, 'consumption_wh_per_km': 130, 'fast_charge_kw': 50, 'ac_charge_kw': 7.2},
    {'id': 'hyundai-kona', 'make': 'Hyundai', 'model': 'Kona Electric', 'year': 2024, 'battery_kwh': 39.2, 'consumption_wh_per_km': 155, 'fast_charge_kw': 100, 'ac_charge_kw': 7.2},
    {'id': 'hyundai-ioniq-5', 'make': 'Hyundai', 'model': 'Ioniq 5', 'year': 2024, 'battery_kwh': 72.6, 'consumption_wh_per_km': 165, 'fast_charge_kw': 350, 'ac_charge_kw': 11},
    {'id': 'kia-ev6', 'make': 'Kia', 'model': 'EV6', 'year': 2024, 'battery_kwh': 77.4, 'consumption_wh_per_km': 170, 'fast_charge_kw': 240, 'ac_charge_kw': 11},
    {'id': 'byd-atto-3', 'make': 'BYD', 'model': 'Atto 3', 'year': 2024, 'battery_kwh': 49.9, 'consumption_wh_per_km': 135, 'fast_charge_kw': 80, 'ac_charge_kw': 7.2},
    {'id': 'byd-e6', 'make': 'BYD', 'model': 'e6', 'year': 2024, 'battery_kwh': 71.7, 'consumption_wh_per_km': 170, 'fast_charge_kw': 60, 'ac_charge_kw': 7.2},
    {'id': 'byd-seal', 'make': 'BYD', 'model': 'Seal', 'year': 2025, 'battery_kwh': 82.6, 'consumption_wh_per_km': 150, 'fast_charge_kw': 150, 'ac_charge_kw': 11},
    {'id': 'byd-dolphin', 'make': 'BYD', 'model': 'Dolphin', 'year': 2025, 'battery_kwh': 45.0, 'consumption_wh_per_km': 145, 'fast_charge_kw': 60, 'ac_charge_kw': 7.2},
    {'id': 'mahindra-xuv400', 'make': 'Mahindra', 'model': 'XUV400', 'year': 2024, 'battery_kwh': 39.4, 'consumption_wh_per_km': 165, 'fast_charge_kw': 50, 'ac_charge_kw': 7.2},
    {'id': 'mahindra-be-6e', 'make': 'Mahindra', 'model': 'BE 6e', 'year': 2025, 'battery_kwh': 79.0, 'consumption_wh_per_km': 165, 'fast_charge_kw': 175, 'ac_charge_kw': 11},
    {'id': 'mahindra-xev-9e', 'make': 'Mahindra', 'model': 'XEV 9e', 'year': 2025, 'battery_kwh': 79.0, 'consumption_wh_per_km': 170, 'fast_charge_kw': 175, 'ac_charge_kw': 11},
    {'id': 'citroen-ec3', 'make': 'Citroen', 'model': 'eC3', 'year': 2024, 'battery_kwh': 29.2, 'consumption_wh_per_km': 160, 'fast_charge_kw': 25, 'ac_charge_kw': 3.3},
    {'id': 'bmw-i4', 'make': 'BMW', 'model': 'i4', 'year': 2025, 'battery_kwh': 83.9, 'consumption_wh_per_km': 180, 'fast_charge_kw': 205, 'ac_charge_kw': 11},
    {'id': 'bmw-ix1', 'make': 'BMW', 'model': 'iX1', 'year': 2025, 'battery_kwh': 66.5, 'consumption_wh_per_km': 170, 'fast_charge_kw': 130, 'ac_charge_kw': 11},
    {'id': 'bmw-ix', 'make': 'BMW', 'model': 'iX', 'year': 2025, 'battery_kwh': 111.5, 'consumption_wh_per_km': 210, 'fast_charge_kw': 195, 'ac_charge_kw': 11},
    {'id': 'mercedes-eqs', 'make': 'Mercedes', 'model': 'EQS', 'year': 2025, 'battery_kwh': 108.4, 'consumption_wh_per_km': 190, 'fast_charge_kw': 200, 'ac_charge_kw': 22},
    {'id': 'mercedes-eqb', 'make': 'Mercedes', 'model': 'EQB', 'year': 2025, 'battery_kwh': 66.5, 'consumption_wh_per_km': 170, 'fast_charge_kw': 100, 'ac_charge_kw': 11},
    {'id': 'volvo-xc40-recharge', 'make': 'Volvo', 'model': 'XC40 Recharge', 'year': 2025, 'battery_kwh': 69.0, 'consumption_wh_per_km': 185, 'fast_charge_kw': 150, 'ac_charge_kw': 11},
    {'id': 'volvo-c40-recharge', 'make': 'Volvo', 'model': 'C40 Recharge', 'year': 2025, 'battery_kwh': 69.0, 'consumption_wh_per_km': 180, 'fast_charge_kw': 150, 'ac_charge_kw': 11},
    {'id': 'audi-q8-etron', 'make': 'Audi', 'model': 'Q8 e-tron', 'year': 2025, 'battery_kwh': 114.0, 'consumption_wh_per_km': 205, 'fast_charge_kw': 170, 'ac_charge_kw': 22},
    {'id': 'porsche-taycan', 'make': 'Porsche', 'model': 'Taycan', 'year': 2024, 'battery_kwh': 93.4, 'consumption_wh_per_km': 200, 'fast_charge_kw': 350, 'ac_charge_kw': 11},
    {'id': 'tesla-model-3', 'make': 'Tesla', 'model': 'Model 3', 'year': 2025, 'battery_kwh': 60.0, 'consumption_wh_per_km': 145, 'fast_charge_kw': 170, 'ac_charge_kw': 11},
    {'id': 'tesla-model-y', 'make': 'Tesla', 'model': 'Model Y', 'year': 2025, 'battery_kwh': 75.0, 'consumption_wh_per_km': 155, 'fast_charge_kw': 175, 'ac_charge_kw': 11},
]

def seed_vehicles(apps, schema_editor):
    VehicleProfile = apps.get_model('vehicles', 'VehicleProfile')
    for v in VEHICLES:
        VehicleProfile.objects.create(**v)

def delete_vehicles(apps, schema_editor):
    VehicleProfile = apps.get_model('vehicles', 'VehicleProfile')
    VehicleProfile.objects.filter(is_builtin=True).delete()

class Migration(migrations.Migration):
    dependencies = [
        ('vehicles', '0001_initial'),
    ]
    operations = [
        migrations.RunPython(seed_vehicles, delete_vehicles),
    ]
