from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = [
    ]
    operations = [
        migrations.CreateModel(
            name='VehicleProfile',
            fields=[
                ('id', models.CharField(max_length=50, primary_key=True, serialize=False)),
                ('make', models.CharField(max_length=100)),
                ('model', models.CharField(max_length=100)),
                ('year', models.IntegerField()),
                ('battery_kwh', models.FloatField()),
                ('consumption_wh_per_km', models.FloatField()),
                ('fast_charge_kw', models.FloatField()),
                ('ac_charge_kw', models.FloatField()),
                ('is_builtin', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(
                    blank=True, null=True, on_delete=models.CASCADE,
                    related_name='vehicles', to='users.CustomUser'
                )),
            ],
            options={
                'ordering': ['make', 'model'],
            },
        ),
    ]
