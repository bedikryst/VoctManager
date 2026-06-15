# payments/tests.py
# ==========================================
# Payments & Donations — endpoint tests
# Standard: Enterprise SaaS 2026
# ==========================================
import hashlib
import json
from decimal import Decimal
from unittest.mock import patch

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


_TEST_MAC_KEY = 'unit-test-mac-key'


@override_settings(AXEPTA_MAC_KEY=_TEST_MAC_KEY, AXEPTA_WEBHOOK_ALLOWED_IPS=[])
class AxeptaWebhookSecurityTests(APITestCase):
    """
    The webhook is an unauthenticated, public money-mutating endpoint: its only
    trust anchor is the secret-suffix SHA-256 signature. These tests pin that
    contract — a forged/absent signature can never move a donation, a verified
    one settles/fails it exactly once, and amount reconciliation blocks
    tampered settlements.
    """

    url = reverse('payments:axepta-webhook')

    def _pending(self, amount='100.00', currency=DonationCurrency.PLN):
        return Donation.objects.create(
            email='donor@example.com', amount=Decimal(amount),
            currency=currency, status=DonationStatus.PENDING,
        )

    @staticmethod
    def _sign(raw_body: bytes) -> str:
        digest = hashlib.sha256(raw_body + _TEST_MAC_KEY.encode('utf-8')).hexdigest()
        return f'merchantid=m;serviceid=s;signature={digest};alg=sha256'

    def _post(self, payload: dict, *, signed: bool = True,
              signature: str | None = None, remote_addr: str | None = None):
        raw_body = json.dumps(payload).encode('utf-8')
        sig = signature if signature is not None else (self._sign(raw_body) if signed else None)
        headers = {'X-Axepta-Signature': sig} if sig is not None else {}
        if remote_addr is not None:
            return self.client.post(
                self.url, data=raw_body, content_type='application/json',
                headers=headers, REMOTE_ADDR=remote_addr,
            )
        return self.client.post(
            self.url, data=raw_body, content_type='application/json', headers=headers,
        )

    @staticmethod
    def _settled_payload(donation, *, status_str='settled', amount=None, currency=None):
        return {
            'payment': {
                'orderId': str(donation.id),
                'status': status_str,
                'amount': donation.get_amount_in_minor_units() if amount is None else amount,
                'currency': donation.currency if currency is None else currency,
                'id': 'axepta-pay-123',
            }
        }

    # --- signature gate ------------------------------------------------- #

    def test_valid_signature_settles_donation(self):
        donation = self._pending()
        resp = self._post(self._settled_payload(donation))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.SETTLED)
        self.assertEqual(donation.axepta_payment_id, 'axepta-pay-123')

    def test_forged_signature_is_rejected_and_donation_untouched(self):
        donation = self._pending()
        resp = self._post(
            self._settled_payload(donation),
            signature='signature=deadbeef;alg=sha256',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.PENDING)

    def test_missing_signature_header_is_rejected(self):
        donation = self._pending()
        resp = self._post(self._settled_payload(donation), signed=False)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.PENDING)

    def test_tampered_body_breaks_signature(self):
        """A signature valid for one body must not validate a different body."""
        donation = self._pending()
        good_sig = self._sign(json.dumps(self._settled_payload(donation)).encode('utf-8'))
        tampered = self._settled_payload(donation, amount=999999)
        resp = self._post(tampered, signature=good_sig)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.PENDING)

    # --- reconciliation ------------------------------------------------- #

    def test_amount_mismatch_is_acknowledged_but_not_settled(self):
        donation = self._pending('100.00')
        # Correctly signed, but the reported minor-units do not match our record.
        resp = self._post(self._settled_payload(donation, amount=5000))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)  # ack to stop retries
        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.PENDING)  # money NOT recorded

    def test_currency_mismatch_is_not_settled(self):
        donation = self._pending('100.00', currency=DonationCurrency.PLN)
        resp = self._post(self._settled_payload(donation, currency='EUR'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.PENDING)

    # --- lifecycle ------------------------------------------------------ #

    def test_rejected_status_marks_failed(self):
        donation = self._pending()
        resp = self._post(self._settled_payload(donation, status_str='rejected'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.FAILED)

    def test_settlement_is_idempotent(self):
        donation = self._pending()
        first = self._post(self._settled_payload(donation))
        second = self._post(self._settled_payload(donation))
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.SETTLED)

    def test_settled_donation_is_never_reverted_to_failed(self):
        donation = self._pending()
        self._post(self._settled_payload(donation))            # -> SETTLED
        self._post(self._settled_payload(donation, status_str='rejected'))
        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.SETTLED)  # terminal

    def test_unknown_order_is_acknowledged_without_error(self):
        # Valid signature, but no donation with that orderId — ack so the gateway
        # stops retrying bytes that can never resolve.
        payload = {'payment': {'orderId': '00000000-0000-0000-0000-000000000000',
                               'status': 'settled', 'amount': 10000, 'currency': 'PLN'}}
        resp = self._post(payload)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_soft_deleted_donation_still_settles(self):
        donation = self._pending()
        donation.delete()  # soft delete — Donation.objects can no longer see it
        resp = self._post(self._settled_payload(donation))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        refreshed = Donation.all_objects.get(id=donation.id)
        self.assertEqual(refreshed.status, DonationStatus.SETTLED)

    # --- defence-in-depth IP allowlist ---------------------------------- #

    @override_settings(AXEPTA_WEBHOOK_ALLOWED_IPS=['203.0.113.7'])
    def test_source_ip_allowlist_blocks_foreign_ip(self):
        donation = self._pending()
        resp = self._post(self._settled_payload(donation), remote_addr='198.51.100.1')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.PENDING)

    @override_settings(AXEPTA_WEBHOOK_ALLOWED_IPS=['203.0.113.7'])
    def test_source_ip_allowlist_admits_listed_ip(self):
        donation = self._pending()
        resp = self._post(self._settled_payload(donation), remote_addr='203.0.113.7')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        donation.refresh_from_db()
        self.assertEqual(donation.status, DonationStatus.SETTLED)


@override_settings(AXEPTA_MAC_KEY=_TEST_MAC_KEY)
class InitiateDonationValidationTests(APITestCase):
    """
    The public initiate endpoint must reject malformed money before it ever
    creates a row or calls the gateway. The gateway client is patched so a
    passing validation cannot make a real network call.
    """

    url = reverse('payments:donation-initiate')

    @patch('payments.views.AxeptaPaymentService.create_payment_link', return_value='https://pay.example/x')
    def test_valid_donation_persists_and_redirects(self, link_mock):
        resp = self.client.post(
            self.url, {'email': 'donor@example.com', 'amount': '100.00', 'currency': 'PLN'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('redirectUrl', resp.data)
        self.assertEqual(Donation.objects.count(), 1)
        link_mock.assert_called_once()

    @patch('payments.views.AxeptaPaymentService.create_payment_link')
    def test_zero_amount_is_rejected_before_gateway(self, link_mock):
        resp = self.client.post(
            self.url, {'email': 'donor@example.com', 'amount': '0.00', 'currency': 'PLN'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        link_mock.assert_not_called()
        self.assertEqual(Donation.objects.count(), 0)

    @patch('payments.views.AxeptaPaymentService.create_payment_link')
    def test_excessive_amount_is_rejected(self, link_mock):
        resp = self.client.post(
            self.url, {'email': 'donor@example.com', 'amount': '100001.00', 'currency': 'PLN'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        link_mock.assert_not_called()

    @patch('payments.views.AxeptaPaymentService.create_payment_link')
    def test_invalid_email_is_rejected(self, link_mock):
        resp = self.client.post(
            self.url, {'email': 'not-an-email', 'amount': '50.00', 'currency': 'PLN'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        link_mock.assert_not_called()

    @patch('payments.views.AxeptaPaymentService.create_payment_link')
    def test_status_field_cannot_be_client_supplied(self, link_mock):
        link_mock.return_value = 'https://pay.example/x'
        self.client.post(
            self.url,
            {'email': 'donor@example.com', 'amount': '50.00', 'currency': 'PLN',
             'status': 'SETTLED'},
            format='json',
        )
        donation = Donation.objects.get()
        # The injected status is ignored — a donation always opens as PENDING.
        self.assertEqual(donation.status, DonationStatus.PENDING)
