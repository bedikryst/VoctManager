# payments/models.py
# ==========================================
# Payments & Donations Domain Models
# Axepta BNP Paribas Integration, plus the hand-kept offline
# tallies and settings behind the public collection figure
# ==========================================
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from core.models import SoftDeleteModel


class DonationStatus(models.TextChoices):
    """Lifecycle states for a single donation payment."""
    PENDING = 'PENDING', _('Pending')
    SETTLED = 'SETTLED', _('Settled')
    FAILED = 'FAILED', _('Failed')


class DonationCurrency(models.TextChoices):
    """ISO-4217 currencies accepted by the donation flow."""
    PLN = 'PLN', _('Polish Złoty')
    EUR = 'EUR', _('Euro')


# ISO-4217 minor-unit exponents for the supported currencies (PLN and EUR are
# both 2). Centralised so the amount -> minor-unit conversion never silently
# assumes "x100"; adding a 0- or 3-decimal currency forces an entry here.
CURRENCY_MINOR_UNIT_EXPONENT: dict[str, int] = {
    DonationCurrency.PLN: 2,
    DonationCurrency.EUR: 2,
}


class Donation(SoftDeleteModel):
    """
    A monetary donation processed through the Axepta BNP Paribas gateway.

    Inherits the UUID primary key, `created_at`, `updated_at` and soft-delete
    semantics from `SoftDeleteModel`. That UUID is intentionally reused as
    the Axepta `orderId`, so the status webhook can resolve a donation directly
    from the gateway callback without an extra correlation table.
    """
    email = models.EmailField(verbose_name=_("Donor Email"))
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name=_("Amount"),
        help_text=_("Gross donation amount, expressed in `currency`."),
    )
    currency = models.CharField(
        max_length=3,
        choices=DonationCurrency.choices,
        default=DonationCurrency.PLN,
        db_index=True,
        verbose_name=_("Currency"),
    )
    status = models.CharField(
        max_length=10,
        choices=DonationStatus.choices,
        default=DonationStatus.PENDING,
        db_index=True,
        verbose_name=_("Status"),
    )
    axepta_payment_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        verbose_name=_("Axepta Payment ID"),
        help_text=_("Gateway-side payment identifier, captured from the webhook when available."),
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = _('Donation')
        verbose_name_plural = _('Donations')
        indexes = [
            # Declared explicitly because this model overrides Meta and so does
            # not inherit SoftDeleteModel.Meta's equivalent composite index.
            models.Index(fields=['is_deleted', '-created_at'], name='payments_don_isdel_creat_idx'),
            # Backs the reconciliation sweep (status=PENDING, ordered by age).
            models.Index(fields=['status', '-created_at'], name='payments_don_status_creat_idx'),
        ]

    def __str__(self) -> str:
        return f"Donation {self.id} — {self.amount} {self.currency} ({self.status})"

    def get_amount_in_minor_units(self) -> int:
        """
        Converts `amount` to the gateway's integer minor-unit convention
        (100.00 PLN -> 10000 grosze; 25.00 EUR -> 2500 cents).

        Raises `KeyError` for a currency with no declared exponent — a
        deliberate fail-fast so a new currency cannot ship without its
        minor-unit scale being defined in `CURRENCY_MINOR_UNIT_EXPONENT`.
        """
        factor = Decimal(10) ** CURRENCY_MINOR_UNIT_EXPONENT[self.currency]
        return int((self.amount * factor).quantize(Decimal('1')))


class PatronLeadStatus(models.TextChoices):
    """Lifecycle of a patronage expression of interest — advanced by hand."""
    NEW = 'NEW', _('New')
    CONTACTED = 'CONTACTED', _('Contacted')
    ACTIVE = 'ACTIVE', _('Active patron')
    ARCHIVED = 'ARCHIVED', _('Archived')


class PatronLead(SoftDeleteModel):
    """
    A visitor's expression of interest in becoming a recurring patron (mecenat),
    captured from the public donation vault.

    Holds NO payment data — patronage runs on a donor-controlled bank standing
    order — only the contact details the person volunteered, plus a hand-managed
    `status` and free-text `note`. A row only ever exists because the visitor gave
    explicit consent to be contacted (enforced by `PatronInterestSerializer`), so
    `created_at` doubles as the consent timestamp for RODO accountability.
    """
    first_name = models.CharField(max_length=100, verbose_name=_("First Name"))
    last_name = models.CharField(max_length=100, verbose_name=_("Last Name"))
    email = models.EmailField(verbose_name=_("Email"))
    status = models.CharField(
        max_length=10,
        choices=PatronLeadStatus.choices,
        default=PatronLeadStatus.NEW,
        db_index=True,
        verbose_name=_("Status"),
    )
    note = models.TextField(blank=True, verbose_name=_("Internal note"))

    class Meta:
        ordering = ['-created_at']
        verbose_name = _('Patron Lead')
        verbose_name_plural = _('Patron Leads')
        indexes = [
            # Declared explicitly because this model overrides Meta and so does
            # not inherit SoftDeleteModel.Meta's equivalent composite index.
            models.Index(fields=['is_deleted', '-created_at'], name='payments_patron_isdel_idx'),
        ]

    def __str__(self) -> str:
        return f"PatronLead {self.first_name} {self.last_name} <{self.email}> ({self.status})"


class OfflineTallySource(models.TextChoices):
    """The roads money reaches the collection by without passing the gateway."""
    ZRZUTKA = 'ZRZUTKA', _('Zrzutka')
    BANK_TRANSFER = 'BANK_TRANSFER', _('Bank transfers')
    OTHER = 'OTHER', _('Other')


class OfflineTally(models.Model):
    """
    The running total of one offline road into the collection, typed by hand
    from wherever that road is visible (the Zrzutka panel, the bank statement).

    One row per source, holding the source's whole figure rather than a delta,
    so two people bringing two sources up to date never overwrite each other and
    a mistyped save is corrected by typing the right figure, not by arithmetic.
    Gateway donations are never entered here: the public progress line adds the
    SETTLED `Donation` aggregate to these rows itself.
    """
    source = models.CharField(
        max_length=16,
        choices=OfflineTallySource.choices,
        unique=True,
        verbose_name=_("Source"),
    )
    amount = models.PositiveIntegerField(
        default=0,
        verbose_name=_("Amount (PLN)"),
        help_text=_("Running total for this source, in whole złoty."),
    )
    donors = models.PositiveIntegerField(default=0, verbose_name=_("Donors"))
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        verbose_name=_("Updated by"),
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated at"))

    class Meta:
        ordering = ['source']
        verbose_name = _('Offline tally')
        verbose_name_plural = _('Offline tallies')

    def __str__(self) -> str:
        return f"{self.get_source_display()}: {self.amount} PLN / {self.donors}"


class OfflineTallyRevision(models.Model):
    """
    One save of one `OfflineTally`, kept forever. A public money figure typed
    by hand needs a trail: the trail is the control that lets a save go live
    without anybody approving it first.
    """
    source = models.CharField(
        max_length=16,
        choices=OfflineTallySource.choices,
        verbose_name=_("Source"),
    )
    amount = models.PositiveIntegerField(verbose_name=_("Amount (PLN)"))
    donors = models.PositiveIntegerField(verbose_name=_("Donors"))
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        verbose_name=_("User"),
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Saved at"))

    class Meta:
        ordering = ['-created_at', '-id']
        verbose_name = _('Offline tally revision')
        verbose_name_plural = _('Offline tally revisions')

    def __str__(self) -> str:
        return f"{self.source} → {self.amount} PLN / {self.donors} ({self.created_at:%Y-%m-%d %H:%M})"


class CollectionSettings(models.Model):
    """
    The collection's two editable presentation choices, as a single row (pk=1).

    `goal` stays empty until somebody sets it, and the public line then reports
    `settings.DONATION_GOAL_PLN`, so the environment default keeps working on a
    database nobody has touched.
    """
    SINGLETON_PK = 1

    goal = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name=_("Goal (PLN)"),
        help_text=_("Empty means the deployment default (DONATION_GOAL_PLN)."),
    )
    show_rail = models.BooleanField(
        default=False,
        verbose_name=_("Show progress rail"),
        help_text=_("Whether the donation sheet on the site draws the fill rail."),
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        verbose_name=_("Updated by"),
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated at"))

    class Meta:
        verbose_name = _('Collection settings')
        verbose_name_plural = _('Collection settings')

    def __str__(self) -> str:
        return f"Collection settings (goal={self.goal}, rail={'on' if self.show_rail else 'off'})"

    def save(self, *args, **kwargs) -> None:
        self.pk = self.SINGLETON_PK
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> 'CollectionSettings':
        """The one row, or an unsaved default carrying its pk.

        Never writes: the public progress endpoint reads this on every uncached
        hit, and a read that inserts is a write path an anonymous visitor owns.
        `save()` on the unsaved default inserts the row under the singleton pk.
        """
        return cls.objects.filter(pk=cls.SINGLETON_PK).first() or cls(pk=cls.SINGLETON_PK)

    @property
    def effective_goal(self) -> int:
        return self.goal if self.goal is not None else int(settings.DONATION_GOAL_PLN)
