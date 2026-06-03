# payments/models.py
# ==========================================
# Payments & Donations Domain Models
# Axepta BNP Paribas Integration — Standard: Enterprise SaaS 2026
# ==========================================
from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _

from core.models import EnterpriseBaseModel


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


class Donation(EnterpriseBaseModel):
    """
    A monetary donation processed through the Axepta BNP Paribas gateway.

    Inherits the UUID primary key, `created_at`, `updated_at` and soft-delete
    semantics from `EnterpriseBaseModel`. That UUID is intentionally reused as
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
            # not inherit EnterpriseBaseModel.Meta's equivalent composite index.
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


class PatronLead(EnterpriseBaseModel):
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
            # not inherit EnterpriseBaseModel.Meta's equivalent composite index.
            models.Index(fields=['is_deleted', '-created_at'], name='payments_patron_isdel_idx'),
        ]

    def __str__(self) -> str:
        return f"PatronLead {self.first_name} {self.last_name} <{self.email}> ({self.status})"
