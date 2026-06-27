from django.urls import path
from .views import SendTestEventView

urlpatterns = [
    path('test-event/', SendTestEventView.as_view(), name='send-test-event'),
]
