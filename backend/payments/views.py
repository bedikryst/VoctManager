# payments/views.py
# ==========================================
# Payments & Donations API Views — thin HTTP layer
# ==========================================
import logging
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import status
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.renderers import JSONRenderer
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import CollectionSettings, Donation, DonationCurrency, OfflineTallyRevision
from .serializers import (
    CollectionWriteSerializer,
    DonationStatusSerializer,
    InitiateDonationSerializer,
    OfflineTallyRevisionSerializer,
    OfflineTallySerializer,
    PatronInterestSerializer,
)
from .services import (
    AxeptaPaymentService,
    CollectionService,
    DonationNotFoundError,
    InvalidWebhookSignatureError,
    PatronageService,
    PaymentGatewayError,
    WebhookAmountMismatchError,
    WebhookPayloadError,
)

logger = logging.getLogger(__name__)


class IgnoreClientContentNegotiation(BaseContentNegotiation):
    """
    Disables content negotiation for machine-to-machine callbacks.

    Payment gateways do not negotiate representations — Axepta posts a fixed
    JSON body and sends an `Accept` header DRF cannot satisfy, which rejected
    every webhook with HTTP 406 *before* the handler ran. A webhook receiver
    should ignore `Accept` entirely and always answer with its one mandated
    JSON body, so parser/renderer are pinned to the first configured class.
    """

    def select_parser(self, request, parsers):
        return parsers[0]

    def select_renderer(self, request, renderers, format_suffix=None):
        return renderers[0], renderers[0].media_type


class InitiateDonationView(APIView):
    """
    Public endpoint that opens a donation: persists a PENDING `Donation` and
    exchanges it for a hosted Axepta payment-page URL the SPA redirects to.

    `authentication_classes` is cleared so correctness never depends on the
    client omitting cookies (SessionAuthentication would otherwise trigger CSRF
    on this cross-origin POST). A dedicated `ScopedRateThrottle` caps abuse of
    this endpoint, which both writes a row and calls the gateway on every hit.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'donation_initiate'

    def post(self, request: Request) -> Response:
        serializer = InitiateDonationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        donation = Donation.objects.create(
            email=serializer.validated_data['email'],
            amount=serializer.validated_data['amount'],
            currency=serializer.validated_data['currency'],
        )

        try:
            redirect_url = AxeptaPaymentService.create_payment_link(
                donation, serializer.validated_data['locale']
            )
        except PaymentGatewayError as exc:
            logger.error("Donation %s could not be initiated: %s", donation.id, exc)
            return Response(
                {'detail': 'Payment gateway is currently unavailable. Please try again later.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({'redirectUrl': redirect_url}, status=status.HTTP_201_CREATED)


class PatronInterestView(APIView):
    """
    Public endpoint behind the vault's Mecenat form: persists a `PatronLead` and
    notifies the foundation so it can reach out. Mirrors `InitiateDonationView`'s
    stance — `AllowAny`, no authentication (cross-origin cookie-less POST), and a
    dedicated throttle scope. The notification e-mail is best-effort: the lead is
    saved first, so a transport failure never costs the capture or 500s the donor.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'patron_interest'

    def post(self, request: Request) -> Response:
        serializer = PatronInterestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lead = serializer.save()

        try:
            PatronageService.notify_foundation(lead)
        except Exception:
            # Best-effort: the lead is already persisted, so a notification
            # failure must never break capture or surface as an error to the donor.
            logger.exception(
                "Patron lead %s saved but the notification e-mail failed.", lead.id
            )

        return Response(status=status.HTTP_201_CREATED)


class DonationStatusView(APIView):
    """
    Public, PII-free status lookup backing the post-payment return page. Keyed
    by the donation UUID (unguessable); never exposes the donor email. The
    webhook remains the source of truth — this only reflects the stored state.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'donation_status'

    def get(self, request: Request, pk: UUID) -> Response:
        try:
            donation = Donation.objects.get(id=pk)
        except Donation.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(DonationStatusSerializer(donation).data)


class DonationProgressView(APIView):
    """
    Public, PII-free figure behind the landing vault's campaign line: SETTLED
    gateway donations plus the hand-kept offline tallies (Zrzutka, transfers,
    other), the goal, whether the sheet draws its fill rail, and when an
    offline tally was last edited. It is the vault's only source.

    EUR donations are folded in at a conservative static display rate
    (`DONATION_EUR_TO_PLN_RATE`) — this endpoint is presentation, not accounting.
    The response is cached for 60s: the donor who just paid, and the editor who
    just saved a tally, see the line move within a minute, while the aggregate
    runs at most once a minute.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'donation_progress'

    @method_decorator(cache_page(60))
    def get(self, request: Request) -> Response:
        total = (
            CollectionService.gateway_totals()
            + CollectionService.offline_totals(CollectionService.tallies())
        )
        collection = CollectionSettings.load()
        updated_at = CollectionService.last_offline_edit()

        return Response({
            'raised': total.raised,
            'donors': total.donors,
            'goal': collection.effective_goal,
            'currency': DonationCurrency.PLN.value,
            'showRail': collection.show_rail,
            'updatedAt': updated_at.isoformat() if updated_at else None,
        })


class CollectionDeskView(APIView):
    """
    The collection desk under `/redakcja/zbiorka`: the offline tallies, the
    gateway half shown read-only beside them, the total the site prints, the goal
    and rail switch, and the last changes.

    Staff only. A save goes live on the next uncached public read with no review
    in between — going live without the developer is the point — so the gate is
    narrow and every tally save leaves an `OfflineTallyRevision`.
    """
    permission_classes = [IsAdminUser]

    # How much of the trail the desk shows. The full trail stays in the admin.
    REVISIONS_SHOWN = 10

    def _payload(self) -> dict[str, Any]:
        tallies = CollectionService.tallies()
        gateway = CollectionService.gateway_totals()
        offline = CollectionService.offline_totals(tallies)
        total = gateway + offline
        collection = CollectionSettings.load()
        revisions = OfflineTallyRevision.objects.select_related('user')[:self.REVISIONS_SHOWN]
        return {
            'tallies': OfflineTallySerializer(tallies, many=True).data,
            'gateway': {'raised': gateway.raised, 'donors': gateway.donors},
            'total': {'raised': total.raised, 'donors': total.donors},
            'goal': collection.goal,
            'default_goal': int(settings.DONATION_GOAL_PLN),
            'show_rail': collection.show_rail,
            'revisions': OfflineTallyRevisionSerializer(revisions, many=True).data,
        }

    def get(self, request: Request) -> Response:
        return Response(self._payload())

    def patch(self, request: Request) -> Response:
        serializer = CollectionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # One save, one outcome: a form carrying two sources and the rail switch
        # never lands half-written.
        with transaction.atomic():
            for row in data.get('tallies', []):
                CollectionService.record_tally(
                    source=row['source'],
                    amount=row['amount'],
                    donors=row['donors'],
                    user=request.user,
                )
            CollectionService.update_settings(user=request.user, changes=data)

        return Response(self._payload())


class AxeptaWebhookView(APIView):
    """
    Public callback consumed by Axepta to report payment status changes.

    Authentication is intentionally disabled: the request is trusted only after
    the cryptographic signature check inside the service layer. Clearing
    `authentication_classes` also sidesteps DRF SessionAuthentication's CSRF
    enforcement, and `throttle_classes` is emptied so the project-wide anonymous
    rate limit can never drop a legitimate gateway delivery. When
    `AXEPTA_WEBHOOK_ALLOWED_IPS` is configured, an application-level source-IP
    allowlist runs first as defence-in-depth (the canonical control belongs at
    the nginx tier).
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []
    # Axepta's callback sends an `Accept` header DRF won't negotiate, which
    # rejected the webhook with HTTP 406 before it reached `handle_webhook`.
    # Pin the renderer and skip negotiation — the response body is fixed anyway.
    renderer_classes = [JSONRenderer]
    content_negotiation_class = IgnoreClientContentNegotiation

    @staticmethod
    def _is_allowed_source(request: Request) -> bool:
        allowed = settings.AXEPTA_WEBHOOK_ALLOWED_IPS
        if not allowed:
            return True  # allowlist disabled — rely on signature verification
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
        client_ip = (
            forwarded.split(',')[0].strip()
            if forwarded
            else request.META.get('REMOTE_ADDR', '')
        )
        return client_ip in allowed

    def post(self, request: Request) -> Response:
        if not self._is_allowed_source(request):
            logger.warning("Axepta webhook rejected: source IP not allowlisted.")
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        signature_header = request.headers.get('X-Axepta-Signature', '')

        try:
            AxeptaPaymentService.handle_webhook(request.body, signature_header)
        except InvalidWebhookSignatureError as exc:
            # Unverified data — never acknowledge. A non-200 also leaves the door
            # open for the gateway to retry if this was a transient edge.
            logger.warning("Axepta webhook rejected (signature): %s", exc)
            return Response({'detail': 'Invalid signature.'}, status=status.HTTP_400_BAD_REQUEST)
        except (WebhookPayloadError, DonationNotFoundError, WebhookAmountMismatchError) as exc:
            # Signature verified, but the payload is unprocessable, references an
            # unknown order, or fails reconciliation. Retrying identical bytes
            # cannot help, so acknowledge to stop the gateway's retry loop. Each
            # case is already logged at ERROR by the service (captured by Sentry).
            logger.warning("Axepta webhook acknowledged without action: %s", exc)

        # Axepta API v1.0.2 mandates this exact 200 OK body on acknowledgement.
        return Response({'status': 'ok'}, status=status.HTTP_200_OK)
