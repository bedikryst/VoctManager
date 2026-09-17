# outreach/models.py
# ==========================================
# Outreach — people who are NOT members and asked to hear from us
# Standard: Enterprise SaaS 2026
# ==========================================
import secrets
import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from core.models import EnterpriseBaseModel

# How long a confirmation link stays usable. Long enough to survive a weekend and a
# holiday; short enough that an address abandoned in a spam folder does not turn into
# a live consent months later.
CONFIRM_TOKEN_TTL = timedelta(days=7)

# Floor between two confirmation mails to one address. It is an anti-abuse measure
# aimed at the one case a public form has: somebody typing a stranger's address over
# and over. Ten minutes still lets the person who deleted the first mail ask again.
CONFIRM_RESEND_COOLDOWN = timedelta(minutes=10)

# How long the record of a FINISHED consent is kept after it was withdrawn. It is the
# period the privacy policy publishes (§ 7), so the two move together: the accountability
# duty outlives the consent, but not indefinitely, and the limitation period for a claim
# arising out of a mail we sent is the outer bound that makes sense of it.
EVIDENCE_RETENTION = timedelta(days=3 * 365)


def new_token() -> str:
    """An unguessable URL-safe secret (~43 chars from 32 bytes of entropy)."""
    return secrets.token_urlsafe(32)


class NoticeLocale(models.TextChoices):
    """The language the subscriber was reading when they signed up, and will be written to."""
    PL = 'pl', _('Polish')
    EN = 'en', _('English')
    FR = 'fr', _('French')


class NoticeStatus(models.TextChoices):
    """
    The three states of a double opt-in list. PENDING is not yet a consent — nothing
    may be sent to it but the confirmation request itself.
    """
    PENDING = 'PENDING', _('Awaiting confirmation')
    CONFIRMED = 'CONFIRMED', _('Confirmed')
    UNSUBSCRIBED = 'UNSUBSCRIBED', _('Unsubscribed')


class ConcertNoticeSubscription(EnterpriseBaseModel):
    """
    One address on the concert notice list: a person who asked to be written to when
    an evening gets a date. Concerts and nothing else — the promise made at the form
    is the boundary of what this row licenses, and it names a subject rather than a
    number of mails.

    IT STORES THE EVIDENCE, WHICH `PatronLead` DELIBERATELY DOES NOT. A donation lead
    is corroborated by the transaction that follows it, so its `created_at` can stand
    as the consent timestamp. A notice list leaves no other trace: if the consent is
    ever questioned, this row is the whole answer. Hence `confirmed_at` (art. 6(1)(a)
    RODO + art. 10 UŚUDE — the confirmation click is the proof), the clause version
    that was on screen, and the surface it was given on.

    WHAT IT DOES NOT STORE, on purpose: no IP, no user agent. Double opt-in already
    proves control of the mailbox, which is the fact in dispute; an IP would only add a
    second identifier to defend.

    THE NAME IS OPTIONAL AND HAS EXACTLY ONE USE — the greeting of the notice itself.
    That single use is what makes asking for it lawful: a field collected because a form
    usually has one is data minimisation's own example of what not to do. If the notice
    template ever stops greeting by name, this column stops having a purpose and comes
    out; it is not a general-purpose "who is this".

    A ROW IS NEVER DELETED ON UNSUBSCRIBE. Withdrawing consent ends the processing it
    licensed, not the duty to show the consent was lawfully obtained — so the row
    stays with `unsubscribed_at` set and nothing is ever sent to it again. Erasure
    (art. 17) is a hard delete, by hand, on request.
    """
    email = models.EmailField(
        unique=True,
        verbose_name=_("Email"),
        help_text=_("One row per address; re-subscribing reuses it rather than duplicating."),
    )
    # Blank rather than nullable, the convention this codebase keeps for optional text:
    # "gave no name" is one state, and a column that can be both `''` and `NULL` invites
    # two spellings of it.
    name = models.CharField(
        max_length=80,
        blank=True,
        verbose_name=_("First name"),
        help_text=_("Optional. Used for nothing but the greeting of the notice itself."),
    )
    locale = models.CharField(
        max_length=2,
        choices=NoticeLocale.choices,
        default=NoticeLocale.PL,
        verbose_name=_("Language"),
    )
    status = models.CharField(
        max_length=12,
        choices=NoticeStatus.choices,
        default=NoticeStatus.PENDING,
        db_index=True,
        verbose_name=_("Status"),
    )

    # ── The two secrets ──────────────────────────────────────────────────────────
    # They are separate because they have different lifetimes and different powers.
    # `confirm_token` grants a consent; `unsubscribe_token` travels in every mail
    # forever. One shared secret would mean a link printed in a dozen newsletters
    # could re-establish a consent that had been withdrawn.
    #
    # The confirmation token is NOT cleared when it is spent — clicking twice, or a
    # mail client that prefetched the page before the reader clicked, has to read as
    # "already confirmed" rather than "invalid link". What stops an old link from
    # resurrecting a withdrawn consent is the status check in `NoticeListService`.
    # Nullable so a row can exist without a live link at all.
    confirm_token = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        unique=True,
        verbose_name=_("Confirmation token"),
        help_text=_("The secret in the double opt-in link; re-issued on every fresh sign-up."),
    )
    confirm_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Confirmation requested at"),
        help_text=_("Start of the token's life, and the floor for the resend cooldown."),
    )
    unsubscribe_token = models.CharField(
        max_length=64,
        unique=True,
        default=new_token,
        editable=False,
        verbose_name=_("Unsubscribe token"),
    )

    # ── The evidence ─────────────────────────────────────────────────────────────
    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Confirmed at"),
        help_text=_("The moment the double opt-in closed. This is the consent itself."),
    )
    clause_version = models.CharField(
        max_length=16,
        verbose_name=_("Clause version"),
        help_text=_("Version of the information clause displayed at sign-up (outreach/consent.py)."),
    )
    # `surface`, not `source`: DRF's `Field` already owns an attribute called `source`,
    # and a serializer field of that name shadows it — the API and the column are kept in
    # step by naming the column after the word the API can safely use.
    surface = models.CharField(
        max_length=64,
        verbose_name=_("Surface"),
        help_text=_("Where the sign-up was given, e.g. `web:koncerty`."),
    )
    unsubscribed_at = models.DateTimeField(null=True, blank=True, verbose_name=_("Unsubscribed at"))

    class Meta:
        ordering = ['-created_at']
        verbose_name = _('Concert notice subscription')
        verbose_name_plural = _('Concert notice subscriptions')
        indexes = [
            # Declared explicitly because this model overrides Meta and so does not
            # inherit EnterpriseBaseModel.Meta's equivalent composite index.
            models.Index(fields=['is_deleted', '-created_at'], name='outreach_notice_isdel_idx'),
            # Backs the only bulk read there is: everyone a concert mail may go to.
            models.Index(fields=['status', 'locale'], name='outreach_notice_status_loc_idx'),
        ]

    def __str__(self) -> str:
        return f"{self.email} ({self.status})"

    @property
    def confirm_token_expired(self) -> bool:
        """
        True once the confirmation link is too old to spend. A row with no
        `confirm_sent_at` has no live link at all, which is the same answer.
        """
        if self.confirm_sent_at is None:
            return True
        return timezone.now() - self.confirm_sent_at > CONFIRM_TOKEN_TTL

    @property
    def confirm_resend_blocked(self) -> bool:
        """True while the cooldown since the last confirmation mail is still running."""
        if self.confirm_sent_at is None:
            return False
        return timezone.now() - self.confirm_sent_at < CONFIRM_RESEND_COOLDOWN


class NoticeConsentEventKind(models.TextChoices):
    """The two moments in a consent's life that have to be provable."""
    GRANTED = 'GRANTED', _('Consent granted')
    WITHDRAWN = 'WITHDRAWN', _('Consent withdrawn')


class NoticeConsentEvent(models.Model):
    """
    Append-only log of what happened to one address's consent. It exists because the
    subscription row alone cannot be the evidence: an address that unsubscribes and later
    signs up again RESETS that row, and with it `confirmed_at` and the clause version — so
    the record of the consent under which we had already sent mail would be overwritten by
    the record of a newer one. The accountability duty is about the mails already sent.

    NOT an `EnterpriseBaseModel`, deliberately, and the two departures are the same point:
    there is no soft delete (a soft-deleted proof is a proof that disappears with nothing
    saying so, and the default manager would stop returning it) and nothing here is
    editable — a row is written once, at the moment it describes.

    It CASCADES from the subscription, which is the one deletion that should take it: an
    erasure request under art. 17 must remove the personal data, and an event that pointed
    at a row that no longer exists would be a record of a person we claim not to hold.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(
        ConcertNoticeSubscription,
        on_delete=models.CASCADE,
        related_name='consent_events',
        verbose_name=_("Subscription"),
    )
    kind = models.CharField(
        max_length=12,
        choices=NoticeConsentEventKind.choices,
        verbose_name=_("Event"),
    )
    at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name=_("At"))
    #: What was on screen when the consent was given. Carried on the WITHDRAWN row too, so
    #: a single event says which consent ended without a join back to its own grant.
    clause_version = models.CharField(max_length=16, verbose_name=_("Clause version"))
    surface = models.CharField(max_length=64, blank=True, verbose_name=_("Surface"))
    locale = models.CharField(
        max_length=2,
        choices=NoticeLocale.choices,
        verbose_name=_("Language"),
    )

    class Meta:
        ordering = ['-at']
        verbose_name = _('Notice consent event')
        verbose_name_plural = _('Notice consent events')

    def __str__(self) -> str:
        return f"{self.kind} @ {self.at:%Y-%m-%d %H:%M}"
