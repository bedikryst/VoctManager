"""
Celery configuration for asynchronous task processing.
Author: Krystian Bugalski

This module initializes the Celery application and binds it to the 
Django settings, allowing background tasks (like bulk PDF generation) 
to run independently from the main web server threads.
"""

import os
from celery import Celery

__author__ = "Krystian Bugalski"

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Initialize the Celery application
app = Celery('config')

# Load task modules from all registered Django apps.
# namespace='CELERY' means all celery-related configuration keys
# should have a `CELERY_` prefix in settings.py.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Automatically discover tasks.py modules inside all installed apps
app.autodiscover_tasks()