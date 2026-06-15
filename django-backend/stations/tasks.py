from celery import shared_task
from django.core.management import call_command


@shared_task
def fetch_ocm_stations_task():
    from django.conf import settings
    api_key = getattr(settings, 'OCM_API_KEY', None)
    if api_key:
        call_command('fetch_ocm_stations', api_key=api_key)
        return 'OCM stations refreshed successfully'
    return 'OCM_API_KEY not configured'
