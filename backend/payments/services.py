# payments/services.py
# ==========================================
# Axepta BNP Paribas Payment Integration — Service Layer
# Standard: Enterprise SaaS 2026
# ==========================================
#
# SECURITY NOTE — webhook signature scheme:
# Axepta API v1.0.2 specifies a "secret-suffix" MAC — sha256(raw_body + MAC_KEY)
# — and NOT standard HMAC. This was verified against the official documentation:
# the construction in `handle_webhook` is intentional and contract-correct, not
# an oversight. The MAC_KEY is delivered as a plain-text string, hence the
# `.encode('utf-8')`. The comparison uses `hmac.compare_digest` to stay
# constant-time and remove the timing side-channel a naive `!=` would expose.
# ==========================================
import hashlib
import hmac
import json
import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction

from .models import Donation, DonationStatus

logger = logging.getLogger(__name__)

# Network budget for the outbound gateway call: (connect timeout, read timeout) in seconds.
# Kept short — this call sits in the request path of InitiateDonationView.
_AXEPTA_TIMEOUT = (5, 8)

# Webhook payment statuses (compared lower-cased) that terminate a donation as
# FAILED. Confirmed against Axepta API v1.0.2; extend here if new strings appear.
_FAILURE_STATUSES = frozenset({'rejected', 'cancelled'})


# --- Domain Exceptions -------------------------------------------------------
class PaymentsDomainException(Exception):
    """Base class for all recoverable payment-domain errors."""


class PaymentGatewayError(PaymentsDomainException):
    """The Axepta gateway was unreachable or returned an unusable response."""


class InvalidWebhookSignatureError(PaymentsDomainException):
    """The webhook signature header failed cryptographic verification."""


class WebhookPayloadError(PaymentsDomainException):
    """The webhook body was missing, malformed, or structurally invalid."""


class DonationNotFoundError(PaymentsDomainException):
    """No local Donation matches the orderId supplied by the gateway."""


class WebhookAmountMismatchError(PaymentsDomainException):
    """The gateway-reported settled amount/currency does not match our record."""


class AxeptaPaymentService:
    """
    Encapsulates every interaction with the Axepta BNP Paribas REST API.
    Views must go through this layer; they never talk to `requests` or to the
    crypto primitives directly.
    """

    @staticmethod
    def _build_return_url(donation_id, base_url: str | None = None) -> str:
        """
        Appends the donation id to a return URL without assuming the configured
        value is query-string-free — merges into any existing query rather than
        blindly concatenating "?donation=...". `base_url` defaults to the success
        surface (`AXEPTA_RETURN_URL`); callers pass `AXEPTA_FAILURE_RETURN_URL`
        for the declined / cancelled / abandoned path.
        """
        parts = urlsplit(base_url or settings.AXEPTA_RETURN_URL)
        query = dict(parse_qsl(parts.query))
        query['donation'] = str(donation_id)
        return urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
        )

    @staticmethod
    def create_payment_link(donation: Donation) -> str:
        """
        Registers `donation` with Axepta and returns the hosted payment-page URL.

        Currency and amount are taken straight from the `donation` row — the
        amount is converted to the gateway's integer minor-unit convention via
        `Donation.get_amount_in_minor_units()`. Raises `PaymentGatewayError` on
        any transport or contract failure; the caller turns that into an HTTP
        response.
        """
        url = (
            f"{settings.AXEPTA_API_URL.rstrip('/')}"
            f"/merchant/{settings.AXEPTA_MERCHANT_ID}/payment-link"
        )
        headers = {'Authorization': f'Bearer {settings.AXEPTA_TOKEN}'}
        success_url = AxeptaPaymentService._build_return_url(donation.id)
        failure_url = AxeptaPaymentService._build_return_url(
            donation.id, settings.AXEPTA_FAILURE_RETURN_URL
        )
        # The donor form only collects an email; its local-part is forwarded as
        # `firstName` purely so transactions are distinguishable in Axepta's
        # dashboard. A dedicated name field on the form would supersede this.
        customer_first_name = donation.email.split('@', 1)[0][:64] or 'Darczyńca'
        payload = {
            'serviceId': settings.AXEPTA_SERVICE_ID,
            'amount': donation.get_amount_in_minor_units(),
            'currency': donation.currency,
            'orderId': str(donation.id),
            'description': 'Darowizna na cele statutowe VoctFoundation',
            'successReturnUrl': success_url,
            'failureReturnUrl': failure_url,
            # A neutral / abandoned return also lands on the failure surface, so
            # the donor sees the retry path, not a thank-you they didn't earn.
            'returnUrl': failure_url,
            'customer': {
                'firstName': customer_first_name,
                'lastName': 'Darczyńca',
                'email': donation.email,
            },
        }

        try:
            response = requests.post(
                url, json=payload, headers=headers, timeout=_AXEPTA_TIMEOUT
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            logger.error(
                "Axepta payment-link request failed for donation %s: %s", donation.id, exc
            )
            raise PaymentGatewayError("Could not reach the payment gateway.") from exc

        try:
            body = response.json()
            payment_url = body['data']['paymentLink']['url']
        except (ValueError, KeyError, TypeError) as exc:
            logger.error(
                "Axepta payment-link response malformed for donation %s: %.500s",
                donation.id, response.text,
            )
            raise PaymentGatewayError("Unexpected response from the payment gateway.") from exc

        logger.info("Axepta payment link created for donation %s.", donation.id)
        return payment_url

    @staticmethod
    def _extract_signature(signature_header: str) -> str:
        """
        Pulls the `signature` token out of the X-Axepta-Signature header.

        Expected shape:
            merchantid=...;serviceid=...;signature=...;alg=sha256
        """
        if not signature_header:
            raise InvalidWebhookSignatureError("Missing X-Axepta-Signature header.")

        parts: dict[str, str] = {}
        for segment in signature_header.split(';'):
            key, sep, value = segment.partition('=')
            if sep:
                parts[key.strip().lower()] = value.strip()

        signature = parts.get('signature')
        if not signature:
            raise InvalidWebhookSignatureError("Signature token absent from header.")

        algorithm = parts.get('alg', 'sha256').lower()
        if algorithm != 'sha256':
            raise InvalidWebhookSignatureError(
                f"Unsupported signature algorithm: {algorithm}."
            )

        return signature

    @staticmethod
    def _assert_amount_matches(donation: Donation, payment: dict) -> None:
        """
        Defence-in-depth before recording money as received: the gateway-reported
        amount and currency must match what we registered. If the webhook omits
        these fields entirely, verification is skipped with a warning rather than
        blocking an otherwise valid settlement.
        """
        reported_amount = payment.get('amount')
        reported_currency = payment.get('currency')
        if reported_amount is None or reported_currency is None:
            logger.warning(
                "Axepta webhook for donation %s omitted amount/currency; "
                "settling without amount verification.", donation.id,
            )
            return

        try:
            reported_minor = int(reported_amount)
        except (TypeError, ValueError) as exc:
            logger.error(
                "Axepta webhook for donation %s carried non-numeric amount %r.",
                donation.id, reported_amount,
            )
            raise WebhookAmountMismatchError(
                f"Non-numeric settled amount for donation {donation.id}."
            ) from exc

        expected_minor = donation.get_amount_in_minor_units()
        if (reported_minor != expected_minor
                or str(reported_currency).upper() != donation.currency):
            logger.error(
                "Axepta webhook amount mismatch for donation %s: "
                "reported %s %s, expected %s %s.",
                donation.id, reported_minor, reported_currency,
                expected_minor, donation.currency,
            )
            raise WebhookAmountMismatchError(
                f"Settled amount/currency does not match donation {donation.id}."
            )

    @staticmethod
    def handle_webhook(raw_body: bytes, signature_header: str) -> None:
        """
        Verifies and applies an Axepta status-change webhook.

        Steps: (1) extract the signature, (2) recompute it over the *exact*
        received bytes and compare in constant time, (3) parse the payload,
        (4) under a row lock, cross-check the settled amount and transition the
        matching Donation. Idempotent — the gateway retries deliveries, so
        re-settling is a safe no-op.

        Raises `InvalidWebhookSignatureError` / `WebhookPayloadError` /
        `DonationNotFoundError` / `WebhookAmountMismatchError`; the view decides
        whether each is acknowledged.
        """
        expected_signature = AxeptaPaymentService._extract_signature(signature_header)

        calculated_signature = hashlib.sha256(
            raw_body + settings.AXEPTA_MAC_KEY.encode('utf-8')
        ).hexdigest()

        if not hmac.compare_digest(calculated_signature, expected_signature):
            logger.warning("Axepta webhook rejected: signature mismatch.")
            raise InvalidWebhookSignatureError("Webhook signature verification failed.")

        try:
            event = json.loads(raw_body)
            payment = event['payment']
            order_id = payment['orderId']
            payment_status = str(payment['status']).lower()
        except (ValueError, KeyError, TypeError) as exc:
            logger.error("Axepta webhook payload malformed: %s", exc)
            raise WebhookPayloadError("Webhook body could not be parsed.") from exc

        with transaction.atomic():
            # `all_objects` (not `objects`): a soft-deleted donation that still
            # received money MUST stay resolvable, otherwise the payment is lost.
            try:
                donation = Donation.all_objects.select_for_update().get(id=order_id)
            except (Donation.DoesNotExist, ValidationError, ValueError) as exc:
                logger.error("Axepta webhook references unknown donation '%s'.", order_id)
                raise DonationNotFoundError(
                    f"No donation found for orderId {order_id}."
                ) from exc

            if donation.is_deleted:
                logger.error(
                    "Axepta webhook is settling a soft-deleted donation %s.", donation.id
                )

            update_fields: set[str] = set()

            # Opportunistically capture the gateway-side id when present; the
            # v1.0.2 webhook contract does not strictly guarantee this field.
            gateway_payment_id = payment.get('id') or payment.get('paymentId')
            if gateway_payment_id and donation.axepta_payment_id != gateway_payment_id:
                donation.axepta_payment_id = gateway_payment_id
                update_fields.add('axepta_payment_id')

            if donation.status == DonationStatus.SETTLED:
                # Terminal state — a completed payment is never overridden.
                logger.info(
                    "Axepta webhook for donation %s ignored: already settled.", donation.id
                )
            elif payment_status == 'settled':
                # Refuse to record money as received unless it reconciles.
                AxeptaPaymentService._assert_amount_matches(donation, payment)
                donation.status = DonationStatus.SETTLED
                update_fields.add('status')
                logger.info("Donation %s marked SETTLED via Axepta webhook.", donation.id)
            elif payment_status in _FAILURE_STATUSES:
                if donation.status != DonationStatus.FAILED:
                    donation.status = DonationStatus.FAILED
                    update_fields.add('status')
                    logger.info(
                        "Donation %s marked FAILED via Axepta webhook (status '%s').",
                        donation.id, payment_status,
                    )
                else:
                    logger.info(
                        "Axepta webhook for donation %s ignored: already failed.", donation.id
                    )
            else:
                # Any other lifecycle state is logged for observability without a
                # transition; extend `_FAILURE_STATUSES` (or add a branch) once
                # further Axepta status strings are confirmed against the docs.
                logger.info(
                    "Axepta webhook for donation %s carried status '%s' — no transition applied.",
                    donation.id, payment_status,
                )

            if update_fields:
                update_fields.add('updated_at')
                donation.save(update_fields=list(update_fields))
