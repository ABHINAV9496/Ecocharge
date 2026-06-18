from stations.models import ChargingStation
active = ChargingStation.objects.filter(status='ACTIVE').count()
total = ChargingStation.objects.count()
print(f'Active stations: {active}')
print(f'Total: {total}')
