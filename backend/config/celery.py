import os
from celery import Celery

# ZMIANA: wskazujemy na config.settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# ZMIANA: nazwa aplikacji to config
app = Celery('config')

app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()