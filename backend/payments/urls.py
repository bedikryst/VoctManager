# payments/urls.py
# ==========================================
# Payments & Donations URL routing
# Standard: Enterprise SaaS 2026
# ==========================================
from django.urls import path

from .views import AxeptaWebhookView, DonationStatusView, InitiateDonationView

app_name = 'payments'

urlpatterns = [
    path('donations/initiate/', InitiateDonationView.as_view(), name='donation-initiate'),
    path('donations/<uuid:pk>/', DonationStatusView.as_view(), name='donation-status'),
    path('webhooks/axepta/', AxeptaWebhookView.as_view(), name='axepta-webhook'),
]
