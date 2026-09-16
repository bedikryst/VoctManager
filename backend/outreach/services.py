# outreach/services.py
# ==========================================
# Outreach — the concert notice list's state machine
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
from enum import Enum
from urllib.parse import quote

from django.conf import settings
from django.db import transaction
from django.urls import reverse
from django.utils import timezone

from notifications.email_service import EmailDispatcherService, EmailType

from .consent import NOTICE_CLAUSE_VERSION
from .copy import NOTICE_CONFIRM, POLICY_PATH
from .models import (
    ConcertNoticeSubscription,
    NoticeConsentEvent,
    NoticeConsentEventKind,
    NoticeLocale,
    NoticeStatus,
    new_token,
)

logger = logging.getLogger(__name__)

#: Where the confirmation and unsubscribe links land, per locale. Polish is the site's
#: un-prefixed default (web/src/i18n/config.ts); a Latin route name so one word serves
#: all three languages.
NOTICE_PATH: dict[str, str] = {
    NoticeLocale.PL: "/nuntius",
    NoticeLocale.EN: "/en/nuntius",
    NoticeLocale.FR: "/fr/nuntius",
}


class SubscribeOutcome(Enum):
    """
    What `subscribe()` did. The HTTP layer answers identically for all of them — see
    `NoticeSubscribeView` — so this exists for the log and the tests, never for a
    response body.
    """
    CONFIRMATION_SENT = 'CONFIRMATION_SENT'
    #: The address is already on the list. Nothing is sent: a "you are already
    #: subscribed" mail is an unsolicited mail to whoever really owns the address.
    ALREADY_CONFIRMED = 'ALREADY_CONFIRMED'
    #: A confirmation went out moments ago; the cooldown swallowed this one.
    THROTTLED = 'THROTTLED'


class ConfirmOutcome(Enum):
    """The answer to a confirmation link. Every value is a state the reader is shown."""
    CONFIRMED = 'CONFIRMED'
    #: Clicked twice, or prefetched and then clicked. Idempotent, and reads the same.
    ALREADY_CONFIRMED = 'ALREADY_CONFIRMED'
    EXPIRED = 'EXPIRED'
    INVALID = 'INVALID'


class UnsubscribeOutcome(Enum):
    """The answer to an unsubscribe link."""
    UNSUBSCRIBED = 'UNSUBSCRIBED'
    ALREADY_UNSUBSCRIBED = 'ALREADY_UNSUBSCRIBED'
    INVALID = 'INVALID'


class PreferenceOutcome(Enum):
    """
    The answer to a request to read or change how the letter greets someone.

    `WITHDRAWN` is separate from `INVALID` because the two are different facts and the page
    says different things about them: an unknown token is a dead link, while a withdrawn
    consent is a live token belonging to somebody we no longer write to — for whom a
    greeting has nothing left to greet.
    """
    OK = 'OK'
    WITHDRAWN = 'WITHDRAWN'
    INVALID = 'INVALID'


def _public_url(locale: str, param: str, token: str) -> str:
    """
    An absolute link into the public site's notice page. `quote` is belt-and-braces —
    `secrets.token_urlsafe` emits nothing that needs escaping — and states that the
    token is data in a URL, so a future token scheme cannot silently break the link.
    """
    base = settings.PUBLIC_SITE_URL.rstrip('/')
    path = NOTICE_PATH.get(locale, NOTICE_PATH[NoticeLocale.PL])
    return f"{base}{path}?{param}={quote(token)}"


def confirmation_url(subscription: ConcertNoticeSubscription) -> str:
    """The double opt-in link. Empty token is impossible on a PENDING row (the service sets it)."""
    return _public_url(subscription.locale, 'confirm', subscription.confirm_token or '')


def unsubscribe_url(subscription: ConcertNoticeSubscription) -> str:
    """The withdrawal link. It goes in every mail this list ever sends."""
    return _public_url(subscription.locale, 'unsubscribe', subscription.unsubscribe_token)


def preferences_url(subscription: ConcertNoticeSubscription) -> str:
    """
    Where a subscriber changes how the letter greets them. IT CARRIES THE UNSUBSCRIBE TOKEN,
    not a third secret: that token already proves control of the mailbox, already travels in
    every mail, and the worst a leaked one can do here — set or clear a greeting in somebody
    else's letter — is strictly less than the withdrawal it could already perform.

    A SEPARATE PARAMETER FROM `unsubscribe`, though, and that part is not cosmetic. The
    unsubscribe link acts the moment the page runs; a reader sent to it to fix their name
    would be removed from the list before the form appeared.
    """
    return _public_url(subscription.locale, 'preferences', subscription.unsubscribe_token)


def unsubscribe_page_url(token: str) -> str:
    """
    The same page, reached from a token alone — for a client that merely OPENS the
    one-click URI. An unknown token still lands somewhere a reader can read: the page
    answers `invalid`, in Polish, which is the site's un-prefixed default.
    """
    subscription = ConcertNoticeSubscription.all_objects.filter(
        unsubscribe_token=token,
    ).first()
    locale = subscription.locale if subscription else NoticeLocale.PL
    return _public_url(locale, 'unsubscribe', token)


def one_click_unsubscribe_url(subscription: ConcertNoticeSubscription) -> str:
    """
    The URI the mail's `List-Unsubscribe` header carries — RFC 8058's one-click target,
    and NOT the page `unsubscribe_url` builds.

    THE PAGE CANNOT ANSWER A POST, which is the whole of the reason. `/nuntius` is a static
    Astro document whose island does the work once a real browser has run it; a client
    honouring `List-Unsubscribe-Post` posts to the URI itself and reads the status code, so
    a header pointing at the page would advertise a withdrawal that nginx answers with 405
    — while Gmail reports success to the reader. The header therefore names the API, and
    the route is resolved rather than spelled out so renaming it here cannot silently
    invalidate every link already sitting in an inbox.
    """
    base = settings.PUBLIC_SITE_URL.rstrip('/')
    # `reverse` escapes its arguments itself, so the token is handed over raw — quoting it
    # first would encode the escapes.
    path = reverse('outreach:notice-unsubscribe-one-click', args=[subscription.unsubscribe_token])
    return f"{base}{path}"


def unsubscribe_headers(subscription: ConcertNoticeSubscription) -> dict[str, str]:
    """
    What every mail this list sends carries for the reader's CLIENT rather than for the
    reader: one-click withdrawal, as Gmail and Yahoo have required of bulk senders since
    2024 and as § 11 of the RoPA promises ("link w każdej wiadomości — jedno kliknięcie").

    It goes on the confirmation request too, PENDING though that row is. The mail is the
    one case this list has where the recipient may not be the person who typed the
    address: for them "stop asking" is the only useful answer, and a withdrawal costs
    nothing that exists yet — the row is not on the list, and the real owner signing up
    later resets it to a fresh double opt-in.
    """
    return {
        'List-Unsubscribe': f"<{one_click_unsubscribe_url(subscription)}>",
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }


class NoticeListService:
    """
    The concert invitation list — double opt-in, one mail per concert, nothing else.

    THE LIST IS NOT A MAILING TOOL. Everything here is about establishing and ending a
    consent; sending the notice itself is deliberately absent, because the evening it
    would announce does not exist yet (that is what /koncerty's `Nondum` station says).
    See docs/specs/web-notice-list-2026-09.md for why that is a decision rather than an omission.
    """

    @staticmethod
    def _normalise(email: str) -> str:
        """
        Lower-cased, because `email` is unique and uniqueness has to mean what the reader
        means by "the same address". RFC 5321 leaves the local part case-sensitive, but no
        mail provider a concert-goer uses honours that, and the alternative is one person
        holding two rows and two consents that differ by a capital letter.
        """
        return email.strip().lower()

    @classmethod
    def subscribe(
        cls, *, email: str, locale: str, surface: str, name: str = '',
    ) -> SubscribeOutcome:
        """
        Takes a sign-up and, where it is a new one, sends the confirmation request.

        NOTHING IS A CONSENT UNTIL THE LINK IS CLICKED. The row this writes is PENDING —
        it licenses exactly one mail, the confirmation request itself.

        The mail is sent AFTER the transaction commits. Inside it, a rollback would leave
        a confirmation link in somebody's inbox pointing at a row that never existed.

        A TRANSPORT FAILURE IS SWALLOWED HERE, and only here — around the send itself. The
        row is already committed and the reader has been told to expect a mail, so asking
        again after the cooldown is the recovery path rather than a 500 that reads as "your
        address was rejected". The catch is this narrow on purpose: held one caller up, in
        the view, it would have covered the writes as well and turned a failure to SAVE the
        sign-up into the same silent 202.
        """
        address = cls._normalise(email)

        with transaction.atomic():
            subscription, created = ConcertNoticeSubscription.all_objects.select_for_update(
            ).get_or_create(
                email=address,
                defaults={
                    'name': name,
                    'locale': locale,
                    'status': NoticeStatus.PENDING,
                    'clause_version': NOTICE_CLAUSE_VERSION,
                    'surface': surface,
                    'confirm_token': new_token(),
                    'confirm_sent_at': timezone.now(),
                },
            )

            if not created:
                if subscription.status == NoticeStatus.CONFIRMED:
                    logger.info("Notice sign-up for an address already on the list; nothing sent.")
                    return SubscribeOutcome.ALREADY_CONFIRMED

                # The cooldown guards ONE case: an address being asked to confirm over and
                # over by somebody who does not own it. That case is always a PENDING row —
                # reaching UNSUBSCRIBED needs the unsubscribe token, which only arrives in
                # the mailbox itself. So a reader who withdraws and changes their mind is
                # not made to wait for a protection that was never about them.
                if (
                    subscription.status == NoticeStatus.PENDING
                    and subscription.confirm_resend_blocked
                ):
                    logger.info("Notice sign-up throttled by the resend cooldown.")
                    return SubscribeOutcome.THROTTLED

                # A repeat ask, an expired link, or a return after unsubscribing: the row
                # is reset to a fresh PENDING with a fresh secret, and the clause version
                # is re-stamped — what the person agreed to is what was on screen NOW.
                #
                # The name follows that rule rather than being merged into it: somebody who
                # signs up again and leaves the field empty has asked for an unnamed letter,
                # and keeping a name they did not re-enter would make the row say more about
                # them than the form they just filled in did.
                subscription.name = name
                subscription.locale = locale
                subscription.status = NoticeStatus.PENDING
                subscription.clause_version = NOTICE_CLAUSE_VERSION
                subscription.surface = surface
                subscription.confirm_token = new_token()
                subscription.confirm_sent_at = timezone.now()
                subscription.confirmed_at = None
                subscription.unsubscribed_at = None
                subscription.is_deleted = False
                subscription.save(update_fields=[
                    'name', 'locale', 'status', 'clause_version', 'surface', 'confirm_token',
                    'confirm_sent_at', 'confirmed_at', 'unsubscribed_at', 'is_deleted',
                    'updated_at',
                ])

        try:
            cls.send_confirmation(subscription)
        except Exception:
            logger.exception("Concert notice sign-up saved but the confirmation mail failed.")
        return SubscribeOutcome.CONFIRMATION_SENT

    @staticmethod
    def send_confirmation(subscription: ConcertNoticeSubscription) -> None:
        """
        The one mail this app sends. Raises on transport failure; `subscribe` is what
        decides that is survivable, and anything else calling this — a resend from the
        admin, say — should be told the mail did not go out.

        IT DOES NOT GREET BY NAME, THOUGH THE ROW MAY HOLD ONE. This mail is the only one
        on this list whose recipient may not be the person who typed the address — its own
        body says so ("somebody gave this address") — and a salutation would both contradict
        that sentence and hand a stranger the first name of whoever typed their address. The
        name's one use is the notice itself, where the recipient is by then proven.
        """
        copy = NOTICE_CONFIRM.get(subscription.locale, NOTICE_CONFIRM[NoticeLocale.PL])
        base = settings.PUBLIC_SITE_URL.rstrip('/')
        EmailDispatcherService.dispatch(
            recipient_email=subscription.email,
            subject=copy.subject,
            template_name='notice_confirm',
            context={
                'copy': copy,
                'confirm_url': confirmation_url(subscription),
                'policy_url': f"{base}{POLICY_PATH.get(subscription.locale, POLICY_PATH['pl'])}",
            },
            fallback_language=subscription.locale,
            # Not the panel's sender: the recipient is not a member and has never heard
            # of VoctManager, whose name would otherwise be the first thing they read.
            from_email=settings.PUBLIC_FROM_EMAIL,
            # The sender above is a noreply address, and the footer of this very mail
            # tells the reader they may withdraw their consent by writing to us. A reply
            # has to reach a person for that sentence to be true.
            reply_to=[settings.PUBLIC_REPLY_TO_EMAIL],
            headers=unsubscribe_headers(subscription),
            # On this path the classification is an ESP tag and nothing more: the opt-out
            # and undeliverable gates live in `dispatch_from_notification`, which resolves
            # a panel user, and a public subscriber has no such row.
            email_type=EmailType.OPERATIONAL,
        )

    @staticmethod
    def confirm(token: str) -> ConfirmOutcome:
        """
        Spends a confirmation link. The token is NOT cleared on success: clicking twice,
        or a mail client that prefetched the page before the reader clicked, must read as
        "already confirmed" rather than "invalid link". What stops an old link from
        resurrecting a withdrawn consent is the status check, not the absence of a secret.
        """
        subscription = ConcertNoticeSubscription.all_objects.filter(confirm_token=token).first()
        if subscription is None or not token:
            return ConfirmOutcome.INVALID

        if subscription.status == NoticeStatus.CONFIRMED:
            return ConfirmOutcome.ALREADY_CONFIRMED
        if subscription.status == NoticeStatus.UNSUBSCRIBED:
            # A consent that was withdrawn is not re-granted by a link printed before it.
            return ConfirmOutcome.INVALID
        if subscription.confirm_token_expired:
            return ConfirmOutcome.EXPIRED

        with transaction.atomic():
            subscription.status = NoticeStatus.CONFIRMED
            subscription.confirmed_at = timezone.now()
            subscription.save(update_fields=['status', 'confirmed_at', 'updated_at'])
            # The row carries the CURRENT consent; the log carries every consent this
            # address ever gave, including ones a later sign-up would otherwise overwrite.
            NoticeConsentEvent.objects.create(
                subscription=subscription,
                kind=NoticeConsentEventKind.GRANTED,
                clause_version=subscription.clause_version,
                surface=subscription.surface,
                locale=subscription.locale,
            )
        logger.info("Concert notice subscription %s confirmed.", subscription.id)
        return ConfirmOutcome.CONFIRMED

    @classmethod
    def unsubscribe(cls, token: str) -> UnsubscribeOutcome:
        """
        Ends the processing the consent licensed. The row stays — it is the evidence that
        the consent was lawfully obtained, and that duty outlives the consent itself.
        """
        subscription = cls._by_unsubscribe_token(token)
        if subscription is None:
            return UnsubscribeOutcome.INVALID

        if subscription.status == NoticeStatus.UNSUBSCRIBED:
            return UnsubscribeOutcome.ALREADY_UNSUBSCRIBED

        cls._withdraw(subscription)
        return UnsubscribeOutcome.UNSUBSCRIBED

    @classmethod
    def withdraw_by_address(cls, email: str) -> bool:
        """
        The same withdrawal, reached without a token: the ESP telling us this address
        complained about our mail or cannot receive it at all.

        IT IS A WITHDRAWAL, NOT A SUPPRESSION FLAG, because on this list there is nothing
        else it could honestly be. A member's bounce sets `email_undeliverable` and leaves
        the account intact — the relationship survives a dead mailbox. Here the mailbox IS
        the relationship, and a spam complaint is a person saying they did not want this;
        answering it with anything short of ending the consent would keep an address whose
        owner has told a third party they never agreed to it.

        Returns whether anything changed, so the caller can log the one case worth reading.
        """
        subscription = ConcertNoticeSubscription.all_objects.filter(
            email=cls._normalise(email),
        ).first()
        if subscription is None or subscription.status == NoticeStatus.UNSUBSCRIBED:
            return False

        cls._withdraw(subscription)
        return True

    @classmethod
    def read_preferences(cls, token: str) -> tuple[PreferenceOutcome, str]:
        """
        What the greeting currently says, for the holder of the unsubscribe token.

        A READ, AND ONLY A READ, so the page may fetch it on arrival with a GET. RFC 8058's
        rule that a GET must not act is about acting; a link scanner that opens this learns
        nothing it could not already read in the mail it is scanning, and changes nothing.
        """
        subscription = cls._by_unsubscribe_token(token)
        if subscription is None:
            return PreferenceOutcome.INVALID, ''
        if subscription.status == NoticeStatus.UNSUBSCRIBED:
            return PreferenceOutcome.WITHDRAWN, ''
        return PreferenceOutcome.OK, subscription.name

    @classmethod
    def update_name(cls, token: str, name: str) -> tuple[PreferenceOutcome, str]:
        """
        Rectification under art. 16, which § 8 of the privacy policy promises for data that is
        incomplete as well as data that is wrong — an address with no name is the first case,
        and until now the form had no way to say so: `subscribe()` returns early on a CONFIRMED
        row and the typed name was dropped on the floor.

        THE EMPTY STRING IS A REAL ANSWER, not a missing one. Clearing the field is how a
        subscriber asks not to be greeted by name, and it has to be as reachable as setting
        one; `''` is also the only spelling of "no name" the column allows.

        IT REFUSES A WITHDRAWN CONSENT. There is no letter left to greet, so writing a name
        onto that row would be collecting personal data for a purpose that has ended — which
        is the state `purge_notice_records` exists to end, not to enrich.

        NO CONSENT EVENT IS WRITTEN. The log records consents granted and withdrawn; a
        greeting is neither, and an event that said otherwise would make the evidence harder
        to read, not easier.
        """
        subscription = cls._by_unsubscribe_token(token)
        if subscription is None:
            return PreferenceOutcome.INVALID, ''
        if subscription.status == NoticeStatus.UNSUBSCRIBED:
            return PreferenceOutcome.WITHDRAWN, ''

        subscription.name = name
        subscription.save(update_fields=['name', 'updated_at'])
        logger.info("Concert notice subscription %s updated its greeting.", subscription.id)
        return PreferenceOutcome.OK, subscription.name

    @staticmethod
    def _by_unsubscribe_token(token: str) -> ConcertNoticeSubscription | None:
        """
        The row a mail's token names. `all_objects`, like every other lookup here: a
        soft-deleted row is still a row somebody holds a live link into.
        """
        if not token:
            return None
        return ConcertNoticeSubscription.all_objects.filter(unsubscribe_token=token).first()

    @staticmethod
    def _withdraw(subscription: ConcertNoticeSubscription) -> None:
        """
        The state change itself, shared by the link and the ESP webhook so the two cannot
        drift into recording a withdrawal differently.
        """
        with transaction.atomic():
            subscription.status = NoticeStatus.UNSUBSCRIBED
            subscription.unsubscribed_at = timezone.now()
            subscription.save(update_fields=['status', 'unsubscribed_at', 'updated_at'])
            # Logged even when the row was still PENDING — "this address asked us to stop
            # before it ever confirmed" is a fact worth being able to show.
            #
            # `surface` stays the SUBSCRIPTION's: the field names where the consent this
            # event ends was given, so that one row reads without a join back to its grant.
            # How the withdrawal arrived is a different question, and it is in the log line.
            NoticeConsentEvent.objects.create(
                subscription=subscription,
                kind=NoticeConsentEventKind.WITHDRAWN,
                clause_version=subscription.clause_version,
                surface=subscription.surface,
                locale=subscription.locale,
            )
        logger.info("Concert notice subscription %s unsubscribed.", subscription.id)
