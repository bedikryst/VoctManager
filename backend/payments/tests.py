# payments/tests.py
# ==========================================
# Payments & Donations — endpoint tests
# Standard: Enterprise SaaS 2026
# ==========================================
from decimal import Decimal

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Donation, DonationCurrency, DonationStatus


@override_settings(DONATION_GOAL_PLN=20000, DONATION_EUR_TO_PLN_RATE='4.00')
class DonationProgressViewTests(APITestCase):
    """
    The public progress aggregate must count ONLY settled, non-deleted donations,
    fold EUR in at the configured display rate, and count donors by distinct email.
    """

    url = reverse('payments:donation-progress')

    def setUp(self):
        # The view caches its response for 60s — isolate every test.
        cache.clear()

    @staticmethod
    def _donation(amount: str, *, status_: str = DonationStatus.SETTLED,
                  currency: str = DonationCurrency.PLN,
                  email: str = 'donor@example.com') -> Donation:
        return Donation.objects.create(
            email=email,
            amount=Decimal(amount),
            currency=currency,
            status=status_,
        )

    def test_empty_state_returns_zeroes_and_goal(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {
            'raised': 0,
            'donors': 0,
            'goal': 20000,
            'currency': 'PLN',
        })

    def test_only_settled_donations_count(self):
        self._donation('100.00', email='a@example.com')
        self._donation('250.00', status_=DonationStatus.PENDING, email='b@example.com')
        self._donation('500.00', status_=DonationStatus.FAILED, email='c@example.com')

        response = self.client.get(self.url)
        self.assertEqual(response.data['raised'], 100)
        self.assertEqual(response.data['donors'], 1)

    def test_soft_deleted_donations_are_excluded(self):
        kept = self._donation('100.00', email='a@example.com')
        removed = self._donation('900.00', email='b@example.com')
        removed.delete()  # soft delete — Donation.objects no longer sees it

        response = self.client.get(self.url)
        self.assertEqual(response.data['raised'], int(kept.amount))
        self.assertEqual(response.data['donors'], 1)

    def test_eur_donations_fold_in_at_display_rate(self):
        self._donation('100.00', email='a@example.com')
        self._donation('50.00', currency=DonationCurrency.EUR, email='b@example.com')

        response = self.client.get(self.url)
        # 100 PLN + 50 EUR * 4.00 = 300 PLN
        self.assertEqual(response.data['raised'], 300)
        self.assertEqual(response.data['donors'], 2)

    def test_donors_are_counted_by_distinct_email(self):
        self._donation('100.00', email='same@example.com')
        self._donation('200.00', email='same@example.com')
        self._donation('50.00', email='other@example.com')

        response = self.client.get(self.url)
        self.assertEqual(response.data['raised'], 350)
        self.assertEqual(response.data['donors'], 2)
