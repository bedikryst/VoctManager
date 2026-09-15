# outreach/views.py
# ==========================================
# Outreach — public API views (thin HTTP layer)
# Standard: Enterprise SaaS 2026
# ==========================================
from django.http import HttpResponseRedirect
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .serializers import (
    NoticePreferencesSerializer,
    NoticeSubscribeSerializer,
    NoticeTokenSerializer,
)
from .services import NoticeListService, unsubscribe_page_url


class _PublicOutreachView(APIView):
    """
    The stance every endpoint here shares, mirroring `payments`' public views:
    `AllowAny`, and `authentication_classes` cleared so correctness never depends on the
    client omitting cookies (SessionAuthentication would otherwise trigger CSRF on these
    cross-origin POSTs from the Astro site). Each subclass names its own throttle scope.
    """
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]


class NoticeSubscribeView(_PublicOutreachView):
    """
    Takes a sign-up for the concert notice list and sends the confirmation request.

    IT ANSWERS 202 FOR EVERY OUTCOME, including an address already on the list. Any other
    shape turns a public form into a membership oracle: type an address, read the status,
    learn whether that person subscribed. The reader is told to check their mailbox, which
    is true in the only case that concerns them.

    The mail failing is survivable and the service says so by returning normally — like
    `PatronInterestView`, the row is saved and the recovery path is the reader asking again
    after the cooldown, not a 500 that reads as "your address was rejected". A failure to
    WRITE the row is not survivable and still raises here, which is why this layer holds no
    `except` of its own: one wide enough to cover the send would have covered the save too.
    """
    throttle_scope = 'notice_subscribe'

    def post(self, request: Request) -> Response:
        serializer = NoticeSubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        NoticeListService.subscribe(
            email=serializer.validated_data['email'],
            name=serializer.validated_data['name'],
            locale=serializer.validated_data['locale'],
            surface=serializer.validated_data['surface'],
        )
        return Response(status=status.HTTP_202_ACCEPTED)


class NoticeConfirmView(_PublicOutreachView):
    """
    Closes a double opt-in.

    EVERY KNOWN OUTCOME IS A 200, `invalid` included: "this link is no longer valid" is a
    truthful answer to a well-formed question, not a failed request, and the page renders
    it as one of its four states. A 4xx here would only push the client into an error path
    to say the same thing.
    """
    throttle_scope = 'notice_manage'

    def post(self, request: Request) -> Response:
        serializer = NoticeTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        outcome = NoticeListService.confirm(serializer.validated_data['token'])
        return Response({'status': outcome.value.lower()})


class NoticeUnsubscribeView(_PublicOutreachView):
    """
    Withdraws the consent. Shares `notice_manage` with confirmation: both are link
    follow-ups from a mailbox, and a reader has no reason to do either more than a few
    times an hour.
    """
    throttle_scope = 'notice_manage'

    def post(self, request: Request) -> Response:
        serializer = NoticeTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        outcome = NoticeListService.unsubscribe(serializer.validated_data['token'])
        return Response({'status': outcome.value.lower()})


class NoticePreferencesView(_PublicOutreachView):
    """
    Reads and rewrites the one field on the row that is a preference rather than evidence:
    how the letter greets its reader. It is the rectification route art. 16 requires and § 8
    of the privacy policy promises, reachable by the person themselves instead of by a mail
    to `rodo@` and somebody's hands in a shell.

    THE GET READS AND THE POST WRITES, which is the ordinary division and here also the safe
    one: a link scanner opening this learns only what is already in the mail it is scanning.
    That is why this endpoint, alone among the four, answers a GET at all — the others act,
    and acting on a GET is what would let a scanner spend a consent (RFC 8058 § 4).

    It shares `notice_manage` with the confirmation and unsubscribe views: like them, this is
    a link follow-up from a mailbox, and nobody has a reason to rename themselves more than a
    few times an hour.
    """
    throttle_scope = 'notice_manage'

    def get(self, request: Request) -> Response:
        outcome, name = NoticeListService.read_preferences(
            request.query_params.get('token', ''),
        )
        return Response({'status': outcome.value.lower(), 'name': name})

    def post(self, request: Request) -> Response:
        serializer = NoticePreferencesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        outcome, name = NoticeListService.update_name(
            serializer.validated_data['token'],
            serializer.validated_data['name'],
        )
        return Response({'status': outcome.value.lower(), 'name': name})


class NoticeOneClickUnsubscribeView(_PublicOutreachView):
    """
    RFC 8058 one-click unsubscribe — what the mail's `List-Unsubscribe` header points at,
    and the one endpoint here a person never sees.

    IT EXISTS BECAUSE `/nuntius` CANNOT ANSWER A POST. A mail client honouring
    `List-Unsubscribe-Post` posts to the URI itself and reads the status code; the page is
    a static document whose island does the work in a browser, so a header aimed at it
    would promise a withdrawal nginx refuses while the client reports success.

    THE TOKEN IS IN THE PATH. The one-click body is fixed by the RFC — `List-Unsubscribe=
    One-Click` — and carries nothing of ours, so the request is never parsed at all; that
    also keeps a client sending it as form data, JSON, or nothing from mattering.

    A GET MUST NOT ACT (RFC 8058 § 4), which here happens to be the same rule the rest of
    this app already lives by: the scanners that fetch every URL in a mail would otherwise
    withdraw consents nobody withdrew. It redirects to the page instead, so a client that
    merely opens the link still lands somewhere a human can read — and the withdrawal
    happens there, in a real browser, exactly as the link in the mail body works.
    """
    throttle_scope = 'notice_manage'

    def post(self, request: Request, token: str) -> Response:
        outcome = NoticeListService.unsubscribe(token)
        return Response({'status': outcome.value.lower()})

    def get(self, request: Request, token: str) -> HttpResponseRedirect:
        return HttpResponseRedirect(unsubscribe_page_url(token))
