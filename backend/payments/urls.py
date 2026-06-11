# payments/urls.py
# ==========================================
# Payments & Donations URL routing
# Standard: Enterprise SaaS 2026
# ==========================================
from django.urls import path

from .views import (
    AxeptaWebhookView,
    DonationProgressView,
    DonationStatusView,
    InitiateDonationView,
    PatronInterestView,
)

app_name = 'payments'

urlpatterns = [
    path('donations/initiate/', InitiateDonationView.as_view(), name='donation-initiate'),
    path('donations/progress/', DonationProgressView.as_view(), name='donation-progress'),
    path('donations/<uuid:pk>/', DonationStatusView.as_view(), name='donation-status'),
    path('patronage/interest/', PatronInterestView.as_view(), name='patron-interest'),
    path('webhooks/axepta/', AxeptaWebhookView.as_view(), name='axepta-webhook'),
]
