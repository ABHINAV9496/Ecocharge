from vehicles.models import DEFAULT_CHARGING_CURVE, VehicleProfile


class TestVehicleProfile:
    def test_create_builtin_vehicle(self, db):
        vehicle = VehicleProfile.objects.create(
            id='mg-comet-ev-test',
            make='MG',
            model='Comet EV',
            year=2024,
            battery_kwh=17.3,
            consumption_wh_per_km=100,
            fast_charge_kw=0,
            ac_charge_kw=3.3,
            is_builtin=True,
        )
        assert vehicle.is_builtin
        assert str(vehicle) == 'MG Comet EV (2024)'

    def test_effective_charging_curve_default(self, db):
        vehicle = VehicleProfile.objects.create(
            id='default-curve-test',
            make='Test', model='Car', year=2024,
            battery_kwh=40, consumption_wh_per_km=150,
            fast_charge_kw=50, ac_charge_kw=7.4,
        )
        assert vehicle.effective_charging_curve == DEFAULT_CHARGING_CURVE

    def test_effective_charging_curve_custom(self, db):
        custom_curve = [{'from_soc': 0, 'to_soc': 100, 'power_factor': 1.0}]
        vehicle = VehicleProfile.objects.create(
            id='custom-curve-test',
            make='Test', model='Car', year=2024,
            battery_kwh=40, consumption_wh_per_km=150,
            fast_charge_kw=50, ac_charge_kw=7.4,
            charging_curve=custom_curve,
        )
        assert vehicle.effective_charging_curve == custom_curve

    def test_ordering_by_make(self, db):
        VehicleProfile.objects.create(
            id='z-car', make='Audi', model='Q8', year=2024,
            battery_kwh=100, consumption_wh_per_km=200,
            fast_charge_kw=150, ac_charge_kw=11,
        )
        VehicleProfile.objects.create(
            id='a-car', make='BMW', model='i4', year=2024,
            battery_kwh=80, consumption_wh_per_km=180,
            fast_charge_kw=200, ac_charge_kw=11,
        )
        vehicles = list(VehicleProfile.objects.all())
        custom_ids = ['z-car', 'a-car']
        filtered = [v for v in vehicles if v.id in custom_ids]
        assert len(filtered) == 2
        assert filtered[0].make <= filtered[-1].make
