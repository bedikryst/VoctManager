"""
@file models.py
@description The project money ledger: one budget per project, its plan (the
             kosztorys lines), one row per actual cost — fees and expenses in one
             table — the files kept with an expense, the contracts the foundation
             issues for fees, their numbering, where the money comes from (funding
             sources, what each project expects of them, and how plan lines and
             actual costs are split between them), and an append-only log of
             every act that changed a settled fact. Amounts are the foundation's
             cost in PLN; no VAT is modelled because the foundation is not a VAT
             payer.
@architecture Enterprise SaaS 2026
@module finance/models
"""
import uuid
from pathlib import PurePosixPath

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from core.models import EnterpriseBaseModel

# Every amount the ledger stores. Ten digits leave room for a grant-sized total
# without letting a typo of a zero too many pass as a plausible number. The
# fields spell these out rather than going through a helper, because the
# django-stubs plugin reads `null=True` only from a direct field call.
MONEY_DIGITS = 10
MONEY_DECIMALS = 2


class BudgetStatus(models.TextChoices):
    PLANNING = 'PLANNING', _('Planning')
    APPROVED = 'APPROVED', _('Approved')
    CLOSED = 'CLOSED', _('Closed')


class CostKind(models.TextChoices):
    FEE = 'FEE', _('Fee')
    EXPENSE = 'EXPENSE', _('Expense')


class CostCategory(models.TextChoices):
    """Fixed and translated on the client. Grantor-specific wording lives in plan
    line names, never here, so a kosztorys never needs a new category."""

    PERSONNEL_ARTISTIC = 'PERSONNEL_ARTISTIC', _('Artistic personnel')
    PERSONNEL_TECHNICAL = 'PERSONNEL_TECHNICAL', _('Technical personnel')
    VENUE = 'VENUE', _('Venue')
    TRAVEL = 'TRAVEL', _('Travel')
    ACCOMMODATION = 'ACCOMMODATION', _('Accommodation')
    CATERING = 'CATERING', _('Catering')
    MATERIALS = 'MATERIALS', _('Materials and rights')
    EQUIPMENT = 'EQUIPMENT', _('Equipment')
    PROMOTION = 'PROMOTION', _('Promotion')
    RECORDING = 'RECORDING', _('Recording')
    ADMINISTRATION = 'ADMINISTRATION', _('Administration')
    OTHER = 'OTHER', _('Other')


# The two sides a fee can sit on. A one-off payee states which one it is.
FEE_CATEGORIES = (CostCategory.PERSONNEL_ARTISTIC, CostCategory.PERSONNEL_TECHNICAL)

# Everything else is an expense. Paying a person is a fee, whoever invoices it,
# so the personnel categories never hold an expense and Honoraria stays the one
# place a person's money is read.
EXPENSE_CATEGORIES = tuple(category for category in CostCategory if category not in FEE_CATEGORIES)


class PlanUnit(models.TextChoices):
    """The unit a kosztorys line is counted in ("Rodzaj miary")."""

    PERSON = 'PERSON', _('Person')
    PIECE = 'PIECE', _('Piece')
    SERVICE = 'SERVICE', _('Service')
    HOUR = 'HOUR', _('Hour')
    DAY = 'DAY', _('Day')
    NIGHT = 'NIGHT', _('Night')
    KM = 'KM', _('Kilometre')
    LUMP_SUM = 'LUMP_SUM', _('Lump sum')


class ExpenseDocumentType(models.TextChoices):
    """The vendor's document an expense is booked from."""

    INVOICE = 'INVOICE', _('Invoice')
    BILL = 'BILL', _('Bill')
    RECEIPT = 'RECEIPT', _('Receipt')
    OTHER = 'OTHER', _('Other document')


class FeeForm(models.TextChoices):
    """How a person is settled. `VOLUNTEER` is the one form whose amount is 0,
    and 0 is the one amount whose form is `VOLUNTEER` (see `finance.rules`)."""

    DZIELO = 'DZIELO', _('Contract for a specific work')
    ZLECENIE = 'ZLECENIE', _('Contract of mandate')
    INVOICE = 'INVOICE', _('Invoice')
    VOLUNTEER = 'VOLUNTEER', _('Volunteer')
    OTHER = 'OTHER', _('Other')


# Forms the foundation issues a document of its own for. An invoice is the
# vendor's document, and OTHER has none by definition.
CONTRACT_FORMS = (FeeForm.DZIELO, FeeForm.ZLECENIE, FeeForm.VOLUNTEER)


class ContractStatus(models.TextChoices):
    ISSUED = 'ISSUED', _('Issued')
    SIGNED = 'SIGNED', _('Signed')
    ANNULLED = 'ANNULLED', _('Annulled')


class FinanceAction(models.TextChoices):
    IMPORTED = 'IMPORTED', _('Imported from the roster')
    CREATED = 'CREATED', _('Created')
    PRICED = 'PRICED', _('Priced')
    FORM_CHANGED = 'FORM_CHANGED', _('Form changed')
    DETAILS_CHANGED = 'DETAILS_CHANGED', _('Details changed')
    PAID = 'PAID', _('Marked paid')
    UNPAID = 'UNPAID', _('Payment reverted')
    REMOVED = 'REMOVED', _('Removed')
    CONTRACT_ISSUED = 'CONTRACT_ISSUED', _('Contract issued')
    CONTRACT_SIGNED = 'CONTRACT_SIGNED', _('Contract signed')
    CONTRACT_HOURS = 'CONTRACT_HOURS', _('Hours confirmed')
    CONTRACT_ANNULLED = 'CONTRACT_ANNULLED', _('Contract annulled')
    BUDGET_APPROVED = 'BUDGET_APPROVED', _('Budget approved')
    BUDGET_REOPENED = 'BUDGET_REOPENED', _('Budget reopened')
    BUDGET_CLOSED = 'BUDGET_CLOSED', _('Budget closed')
    PLAN_CHANGED = 'PLAN_CHANGED', _('Plan changed')
    ALLOCATION_CHANGED = 'ALLOCATION_CHANGED', _('Allocation changed')


class FundingKind(models.TextChoices):
    """Where money comes from. The last two bring no money at all: a gift in
    kind ("wkład rzeczowy" — a venue lent free) and volunteer work valued for a
    grant ("wkład osobowy")."""

    PUBLIC_GRANT = 'PUBLIC_GRANT', _('Public grant')
    PRIVATE_GRANT = 'PRIVATE_GRANT', _('Private grant')
    SPONSOR = 'SPONSOR', _('Sponsor')
    DONATIONS = 'DONATIONS', _('Donations')
    TICKETS = 'TICKETS', _('Tickets')
    OWN_FUNDS = 'OWN_FUNDS', _('Own funds')
    IN_KIND = 'IN_KIND', _('Contribution in kind')
    VOLUNTEER_WORK = 'VOLUNTEER_WORK', _('Volunteer work')


# Sources that bring no money. A cost is never charged to them: volunteer work
# is charged its valuation instead, and a gift in kind has no cost row at all.
NON_CASH_FUNDING_KINDS = (FundingKind.IN_KIND, FundingKind.VOLUNTEER_WORK)


class FundingStatus(models.TextChoices):
    PLANNED = 'PLANNED', _('Planned')
    APPLIED = 'APPLIED', _('Applied for')
    AWARDED = 'AWARDED', _('Awarded')
    REJECTED = 'REJECTED', _('Rejected')
    SETTLED = 'SETTLED', _('Settled')


# The words a document note may interpolate (spec §10.4). Values are printed
# after a colon or as figures, never in a slot Polish grammar would inflect.
DOCUMENT_NOTE_PLACEHOLDERS = (
    'document_number',
    'document_amount',
    'source_amount',
    'source_name',
    'grantor',
    'agreement_number',
    'agreement_date',
    'plan_line',
)

DEFAULT_DOCUMENT_NOTE_TEMPLATE = (
    'Wydatek w kwocie {document_amount} zł (dokument nr {document_number}) został sfinansowany '
    'w kwocie {source_amount} zł ze środków: {source_name}, zgodnie z umową nr {agreement_number} '
    'z dnia {agreement_date}. Pozycja kosztorysu: {plan_line}.'
)


class ProjectBudget(EnterpriseBaseModel):
    """One per project, created lazily by `BudgetService.get_or_create`.

    A cancelled project keeps its budget: cancellation has costs of its own
    (deposits, fees already earned), so finance never filters `CANC` out.
    """

    project = models.OneToOneField(
        'roster.Project', on_delete=models.PROTECT, related_name='budget', verbose_name=_("Project"),
    )
    status = models.CharField(
        max_length=10, choices=BudgetStatus.choices, default=BudgetStatus.PLANNING, verbose_name=_("Status"),
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name=_("Approved at"))
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+', verbose_name=_("Approved by"),
    )
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name=_("Closed at"))
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+', verbose_name=_("Closed by"),
    )
    internal_note = models.TextField(blank=True, verbose_name=_("Internal note"))
    # Two or three sentences the manager writes for the patron report.
    patron_summary = models.TextField(blank=True, verbose_name=_("Summary for patrons"))

    class Meta:
        verbose_name = _("Project budget")
        verbose_name_plural = _("Project budgets")

    def __str__(self) -> str:
        return f"{self.project} ({self.status})"


class BudgetLine(EnterpriseBaseModel):
    """One line of the plan — the kosztorys: "Honoraria chórzystów", 8 persons
    at 400 zł.

    The planned amount is quantity times unit cost, computed and never stored, so it
    cannot drift from its factors. The kosztorys number ("I.3") is derived from
    the category order and `position` when the plan is read, never stored either:
    moving a line renumbers every line after it, and a stored number would lie.
    """

    budget = models.ForeignKey(
        ProjectBudget, on_delete=models.PROTECT, related_name='lines', verbose_name=_("Budget"),
    )
    category = models.CharField(max_length=24, choices=CostCategory.choices, verbose_name=_("Category"))
    name = models.CharField(max_length=200, verbose_name=_("Name"))
    # Order within the budget; lines are shown grouped by category, so this is
    # effectively the order within a category.
    position = models.PositiveIntegerField(default=0, verbose_name=_("Position"))
    unit = models.CharField(max_length=10, choices=PlanUnit.choices, verbose_name=_("Unit"))
    quantity = models.DecimalField(max_digits=8, decimal_places=2, verbose_name=_("Quantity"))
    unit_cost = models.DecimalField(
        max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, verbose_name=_("Unit cost"),
    )
    note = models.TextField(blank=True, verbose_name=_("Note"))

    class Meta:
        verbose_name = _("Budget line")
        verbose_name_plural = _("Budget lines")
        ordering = ['position', 'created_at']
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name='finance_line_quantity_positive'),
            models.CheckConstraint(condition=models.Q(unit_cost__gte=0), name='finance_line_unit_cost_not_negative'),
        ]

    def __str__(self) -> str:
        return self.name


class CostItem(EnterpriseBaseModel):
    """One actual cost. Fees and expenses share the table so every total is one
    aggregate.

    `cost_amount` is written by the ledger service only: it is the foundation's
    cost derived from the contract amount and the form (`finance.rules`), never a
    client's figure. The invariants the database can state are check constraints
    below, so neither the admin nor a stray script can store an ambiguous row;
    the ones it cannot (a paid row is immutable, an issued contract freezes the
    amount) live in the service.
    """

    budget = models.ForeignKey(
        ProjectBudget, on_delete=models.PROTECT, related_name='cost_items', verbose_name=_("Budget"),
    )
    kind = models.CharField(max_length=8, choices=CostKind.choices, default=CostKind.FEE, verbose_name=_("Kind"))
    category = models.CharField(max_length=24, choices=CostCategory.choices, verbose_name=_("Category"))
    # The plan line the cost is charged to; null is "outside the plan". SET_NULL
    # for a raw delete only — the plan service detaches a line's costs, logged,
    # before it removes the line.
    budget_line = models.ForeignKey(
        BudgetLine, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cost_items', verbose_name=_("Plan line"),
    )
    cost_amount = models.DecimalField(
        max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, null=True, blank=True,
        verbose_name=_("Cost to the foundation"),
    )
    # The date the cost arises: the concert date for a fee. Grant eligibility
    # periods are checked against it.
    incurred_on = models.DateField(verbose_name=_("Incurred on"))
    due_on = models.DateField(null=True, blank=True, verbose_name=_("Due on"))
    # The date the office paid, as the office reports it — not when somebody
    # clicked. The click is `paid_marked_at`.
    paid_on = models.DateField(null=True, blank=True, verbose_name=_("Paid on"))
    paid_marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+', verbose_name=_("Marked paid by"),
    )
    paid_marked_at = models.DateTimeField(null=True, blank=True, verbose_name=_("Marked paid at"))
    # The roster marked this fee paid before the ledger existed (`finance.data_copy`). Its contract was printed by the old roster, on paper
    # only, so the ledger expects no contract of its own for this payment.
    # Reverting the payment clears it: a payment made again is the ledger's.
    paid_before_ledger = models.BooleanField(default=False, verbose_name=_("Paid before the ledger"))
    note = models.TextField(blank=True, verbose_name=_("Note"))

    # --- FEE: where the person comes from. Neither = a one-off payee. ---
    # PROTECT so a raw delete of a seat can never take a settled fee with it;
    # crew removal goes through `LedgerService.release_crew_assignment`.
    participation = models.ForeignKey(
        'roster.Participation', on_delete=models.PROTECT, null=True, blank=True,
        related_name='cost_items', verbose_name=_("Cast seat"),
    )
    crew_assignment = models.ForeignKey(
        'roster.CrewAssignment', on_delete=models.PROTECT, null=True, blank=True,
        related_name='cost_items', verbose_name=_("Crew assignment"),
    )
    # Snapshots, refreshed from the source while no contract is live and frozen
    # from issuance. A one-off payee's are typed by hand.
    payee_name = models.CharField(max_length=200, blank=True, verbose_name=_("Payee"))
    payee_role = models.CharField(max_length=150, blank=True, verbose_name=_("Payee role"))
    form = models.CharField(max_length=10, choices=FeeForm.choices, blank=True, verbose_name=_("Form"))
    # Null = nobody has decided yet; 0 = a decision (volunteer work).
    contract_amount = models.DecimalField(
        max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, null=True, blank=True,
        verbose_name=_("Contract amount"),
    )
    # The office's figure, entered because the panel never computes ZUS.
    employer_contributions = models.DecimalField(
        max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, null=True, blank=True,
        verbose_name=_("Employer contributions"),
    )
    # The valuation of volunteer work for a grant's in-kind contribution. Never a cost.
    in_kind_hours = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True, verbose_name=_("Volunteer hours"),
    )
    in_kind_hourly_rate = models.DecimalField(
        max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, null=True, blank=True,
        verbose_name=_("Volunteer hourly valuation"),
    )
    # The vendor's own document: an INVOICE fee's, and every expense's.
    document_number = models.CharField(max_length=100, blank=True, verbose_name=_("Document number"))
    document_date = models.DateField(null=True, blank=True, verbose_name=_("Document date"))
    vendor_nip = models.CharField(max_length=13, blank=True, verbose_name=_("Vendor NIP"))

    # --- EXPENSE: who is paid, against what, for what. The cost is the
    # document's gross, entered directly: no VAT is recoverable. ---
    vendor_name = models.CharField(max_length=200, blank=True, verbose_name=_("Vendor"))
    document_type = models.CharField(
        max_length=8, choices=ExpenseDocumentType.choices, blank=True, verbose_name=_("Document type"),
    )
    description = models.CharField(max_length=300, blank=True, verbose_name=_("Description"))

    class Meta:
        verbose_name = _("Cost item")
        verbose_name_plural = _("Cost items")
        indexes = [
            models.Index(fields=['budget', 'kind'], name='finance_item_budget_kind_idx'),
            models.Index(fields=['paid_on'], name='finance_item_paid_on_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                condition=~(models.Q(participation__isnull=False) & models.Q(crew_assignment__isnull=False)),
                name='finance_item_one_source',
                violation_error_message=_("A cost item comes from a cast seat or a crew assignment, not both."),
            ),
            models.UniqueConstraint(
                fields=['participation'],
                condition=models.Q(is_deleted=False, participation__isnull=False),
                name='finance_item_unique_participation',
            ),
            models.UniqueConstraint(
                fields=['crew_assignment'],
                condition=models.Q(is_deleted=False, crew_assignment__isnull=False),
                name='finance_item_unique_crew_assignment',
            ),
            # 0 ⇔ volunteer, both ways. A non-volunteer is unpriced or positive.
            models.CheckConstraint(
                condition=(
                    models.Q(form=FeeForm.VOLUNTEER, contract_amount=0)
                    | (
                        ~models.Q(form=FeeForm.VOLUNTEER)
                        & (models.Q(contract_amount__isnull=True) | models.Q(contract_amount__gt=0))
                    )
                ),
                name='finance_item_zero_is_volunteer',
                violation_error_message=_("An amount of 0 means volunteer work, and volunteer work is 0."),
            ),
            models.CheckConstraint(
                condition=models.Q(cost_amount__isnull=True) | models.Q(cost_amount__gte=0),
                name='finance_item_cost_not_negative',
            ),
            models.CheckConstraint(
                condition=models.Q(employer_contributions__isnull=True) | models.Q(form=FeeForm.ZLECENIE),
                name='finance_item_contributions_zlecenie_only',
                violation_error_message=_("Employer contributions apply to a contract of mandate only."),
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(in_kind_hours__isnull=True, in_kind_hourly_rate__isnull=True)
                    | models.Q(form=FeeForm.VOLUNTEER)
                ),
                name='finance_item_in_kind_volunteer_only',
                violation_error_message=_("Volunteer hours apply to volunteer work only."),
            ),
            # Paid means priced and not volunteer: 0 zł cannot be paid out.
            models.CheckConstraint(
                condition=(
                    models.Q(paid_on__isnull=True)
                    | models.Q(kind=CostKind.EXPENSE)
                    | models.Q(contract_amount__gt=0)
                ),
                name='finance_item_paid_is_priced',
                violation_error_message=_("Only a priced, non-volunteer fee can be paid."),
            ),
            # A person is paid through a fee, anything else is an expense.
            models.CheckConstraint(
                condition=(
                    models.Q(kind=CostKind.FEE, category__in=FEE_CATEGORIES)
                    | (models.Q(kind=CostKind.EXPENSE) & ~models.Q(category__in=FEE_CATEGORIES))
                ),
                name='finance_item_category_matches_kind',
                violation_error_message=_("Personnel costs are fees; every other category is an expense."),
            ),
            # An expense has no person, no form and no contract amount: its cost
            # is the document's gross, and it is never zero.
            models.CheckConstraint(
                condition=(
                    models.Q(kind=CostKind.FEE)
                    | models.Q(
                        participation__isnull=True,
                        crew_assignment__isnull=True,
                        form='',
                        contract_amount__isnull=True,
                        cost_amount__gt=0,
                    )
                ),
                name='finance_item_expense_shape',
                violation_error_message=_("An expense carries its cost directly and belongs to no person."),
            ),
        ]

    def __str__(self) -> str:
        return f"{self.payee_name or self.get_kind_display()} — {self.cost_amount}"

    @property
    def is_priced(self) -> bool:
        return self.contract_amount is not None

    @property
    def is_paid(self) -> bool:
        return self.paid_on is not None

    @property
    def is_one_off(self) -> bool:
        return self.kind == CostKind.FEE and self.participation_id is None and self.crew_assignment_id is None


# What an expense's attachment may be: a scanned or photographed document, or
# the PDF a vendor sent. Detected from the file's bytes, never from its name.
ATTACHMENT_MIME_TYPES: frozenset[str] = frozenset({
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
})
ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024


def attachment_upload_to(instance: 'FinanceAttachment', filename: str) -> str:
    """`finance/<year>/<uuid><ext>`. The stored name is random: an uploaded name
    carries a vendor's or a person's name into a path, and a guessable path is
    one step from a public one. The original name is kept on the row."""
    suffix = PurePosixPath(filename).suffix.lower()[:10]
    return f"finance/{timezone.now():%Y}/{uuid.uuid4().hex}{suffix}"


class FinanceAttachment(EnterpriseBaseModel):
    """A file kept with an expense — the vendor's invoice, a receipt.

    Expenses only: a signed contract or a bill carries a handwritten PESEL, and
    whether the app holds those is undecided (spec §4 Q6b), so the service
    refuses a fee. The file sits under `MEDIA_ROOT/finance/`, which nginx serves
    to nobody; the manager-only download view streams it.
    """

    cost_item = models.ForeignKey(
        CostItem, on_delete=models.PROTECT, related_name='attachments', verbose_name=_("Cost item"),
    )
    file = models.FileField(upload_to=attachment_upload_to, max_length=200, verbose_name=_("File"))
    original_name = models.CharField(max_length=255, verbose_name=_("Original name"))
    mime_type = models.CharField(max_length=100, verbose_name=_("MIME type"))
    size_bytes = models.PositiveIntegerField(verbose_name=_("Size in bytes"))
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+', verbose_name=_("Uploaded by"),
    )

    class Meta:
        verbose_name = _("Finance attachment")
        verbose_name_plural = _("Finance attachments")
        ordering = ['created_at']

    def __str__(self) -> str:
        return self.original_name


class Contract(EnterpriseBaseModel):
    """A document the foundation issues for a FEE item.

    Amount and payee are snapshots taken at issuance: the paper says what it says,
    and changing either means annulling this row and issuing a new one. Contracts
    are never deleted; an annulled one stays as the record of a number spent.
    """

    cost_item = models.ForeignKey(
        CostItem, on_delete=models.PROTECT, related_name='contracts', verbose_name=_("Cost item"),
    )
    number = models.CharField(max_length=32, unique=True, verbose_name=_("Number"))
    form = models.CharField(max_length=10, choices=FeeForm.choices, verbose_name=_("Form"))
    amount = models.DecimalField(max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, verbose_name=_("Amount"))
    payee_name = models.CharField(max_length=200, verbose_name=_("Payee"))
    issued_at = models.DateTimeField(default=timezone.now, verbose_name=_("Issued at"))
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+', verbose_name=_("Issued by"),
    )
    status = models.CharField(
        max_length=8, choices=ContractStatus.choices, default=ContractStatus.ISSUED, verbose_name=_("Status"),
    )
    # The date written on the paper, which is not the day somebody recorded it.
    signed_on = models.DateField(null=True, blank=True, verbose_name=_("Signed on"))
    # Where the signed copy is — "segregator 2026", a Drive link. Never the scan:
    # it carries a handwritten PESEL, and holding one is undecided.
    signed_copy_location = models.CharField(max_length=300, blank=True, verbose_name=_("Signed copy location"))
    # ZLECENIE: the hours from the signed confirmation, entered before payment.
    hours_confirmed = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True, verbose_name=_("Hours confirmed"),
    )
    annulled_at = models.DateTimeField(null=True, blank=True, verbose_name=_("Annulled at"))
    annulled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+', verbose_name=_("Annulled by"),
    )
    annul_reason = models.TextField(blank=True, verbose_name=_("Reason for annulment"))

    class Meta:
        verbose_name = _("Contract")
        verbose_name_plural = _("Contracts")
        constraints = [
            models.UniqueConstraint(
                fields=['cost_item'],
                condition=models.Q(is_deleted=False) & ~models.Q(status=ContractStatus.ANNULLED),
                name='finance_contract_one_live_per_item',
                violation_error_message=_("A cost item has at most one contract that is not annulled."),
            ),
            models.CheckConstraint(
                condition=models.Q(form__in=CONTRACT_FORMS),
                name='finance_contract_form_issuable',
            ),
        ]

    def __str__(self) -> str:
        return self.number

    @property
    def is_live(self) -> bool:
        return self.status != ContractStatus.ANNULLED


class ContractSequence(models.Model):
    """The last number spent per (year, form), read with `select_for_update()`
    inside the issuing transaction.

    A plain model, not an `EnterpriseBaseModel`: a soft-deleted counter row would
    be invisible to the next issue, which would restart the year at 1 and collide
    with numbers already on paper.
    """

    year = models.PositiveSmallIntegerField(verbose_name=_("Year"))
    form = models.CharField(max_length=10, choices=FeeForm.choices, verbose_name=_("Form"))
    last_number = models.PositiveIntegerField(default=0, verbose_name=_("Last number"))

    class Meta:
        verbose_name = _("Contract sequence")
        verbose_name_plural = _("Contract sequences")
        constraints = [
            models.UniqueConstraint(fields=['year', 'form'], name='finance_sequence_unique_year_form'),
        ]

    def __str__(self) -> str:
        return f"{self.form}/{self.year}: {self.last_number}"


# A percentage a grant's rules state: 0 to 100, two decimals ("7.5").
PCT_DIGITS = 5


class FundingSource(EnterpriseBaseModel):
    """Where money comes from — a grant, a sponsor, the ticket office.

    Organisation-level, not per project: one grant may fund a whole season, and
    a grant is settled per agreement, not per concert. Its rules are all
    optional, because a grantor's form is only known once there is a grantor;
    each rule a source does state becomes a warning on every project it funds.
    """

    kind = models.CharField(max_length=16, choices=FundingKind.choices, verbose_name=_("Kind"))
    name = models.CharField(max_length=200, verbose_name=_("Name"))
    grantor = models.CharField(max_length=200, blank=True, verbose_name=_("Grantor"))
    agreement_number = models.CharField(max_length=100, blank=True, verbose_name=_("Agreement number"))
    agreement_date = models.DateField(null=True, blank=True, verbose_name=_("Agreement date"))
    # Null until the grantor decides. A rejected source counts as awarded nothing.
    awarded_amount = models.DecimalField(
        max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, null=True, blank=True,
        verbose_name=_("Awarded amount"),
    )
    status = models.CharField(
        max_length=10, choices=FundingStatus.choices, default=FundingStatus.PLANNED, verbose_name=_("Status"),
    )
    # A cost charged to the source must arise inside this period (by its
    # `incurred_on`). Whether it must also be paid inside it differs between
    # grantors and is not checked.
    eligible_from = models.DateField(null=True, blank=True, verbose_name=_("Eligible from"))
    eligible_to = models.DateField(null=True, blank=True, verbose_name=_("Eligible to"))
    report_due_on = models.DateField(null=True, blank=True, verbose_name=_("Report due on"))
    # The share of the task's total that must come from anywhere but this source.
    required_own_share_pct = models.DecimalField(
        max_digits=PCT_DIGITS, decimal_places=2, null=True, blank=True, verbose_name=_("Required own share (%)"),
    )
    # Administration may take at most this share of what is charged to the source.
    admin_cost_cap_pct = models.DecimalField(
        max_digits=PCT_DIGITS, decimal_places=2, null=True, blank=True, verbose_name=_("Administration cap (%)"),
    )
    # How far a kosztorys line may overrun its plan without an annex.
    line_tolerance_pct = models.DecimalField(
        max_digits=PCT_DIGITS, decimal_places=2, null=True, blank=True, verbose_name=_("Line tolerance (%)"),
    )
    # The formula the grantor prescribes for the back of an accounting document,
    # with the placeholders of `DOCUMENT_NOTE_PLACEHOLDERS`.
    document_note_template = models.TextField(
        default=DEFAULT_DOCUMENT_NOTE_TEMPLATE, verbose_name=_("Document note template"),
    )
    note = models.TextField(blank=True, verbose_name=_("Note"))

    class Meta:
        verbose_name = _("Funding source")
        verbose_name_plural = _("Funding sources")
        ordering = ['name', 'created_at']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(awarded_amount__isnull=True) | models.Q(awarded_amount__gte=0),
                name='finance_source_awarded_not_negative',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(eligible_from__isnull=True)
                    | models.Q(eligible_to__isnull=True)
                    | models.Q(eligible_from__lte=models.F('eligible_to'))
                ),
                name='finance_source_eligibility_ordered',
                violation_error_message=_("The eligibility period ends before it starts."),
            ),
            *(
                models.CheckConstraint(
                    condition=models.Q(**{f'{name}__isnull': True}) | models.Q(
                        **{f'{name}__gte': 0, f'{name}__lte': 100},
                    ),
                    name=f'finance_source_{name}_range',
                )
                for name in ('required_own_share_pct', 'admin_cost_cap_pct', 'line_tolerance_pct')
            ),
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def brings_money(self) -> bool:
        return self.kind not in NON_CASH_FUNDING_KINDS


class ProjectFunding(EnterpriseBaseModel):
    """A source on one project: what the project expects of it and what has
    actually arrived (a tranche, the ticket takings, donations collected).

    The planned amount is part of the plan, so it changes while the budget is
    being planned; what arrives is a fact, recorded whenever it arrives.
    """

    budget = models.ForeignKey(
        ProjectBudget, on_delete=models.PROTECT, related_name='fundings', verbose_name=_("Budget"),
    )
    source = models.ForeignKey(
        FundingSource, on_delete=models.PROTECT, related_name='fundings', verbose_name=_("Funding source"),
    )
    planned_amount = models.DecimalField(
        max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, default=0, verbose_name=_("Planned amount"),
    )
    received_amount = models.DecimalField(
        max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, default=0, verbose_name=_("Received amount"),
    )

    class Meta:
        verbose_name = _("Project funding")
        verbose_name_plural = _("Project fundings")
        ordering = ['created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['budget', 'source'],
                condition=models.Q(is_deleted=False),
                name='finance_funding_unique_source_per_budget',
                violation_error_message=_("The source is already on this project."),
            ),
            models.CheckConstraint(
                condition=models.Q(planned_amount__gte=0, received_amount__gte=0),
                name='finance_funding_amounts_not_negative',
            ),
        ]

    def __str__(self) -> str:
        return f"{self.source} → {self.budget}"


class LineAllocation(EnterpriseBaseModel):
    """The plan's split: how much of a kosztorys line a source is to cover. The
    part of a line no source covers is the foundation's own — reported, never
    assigned to anyone silently."""

    budget_line = models.ForeignKey(
        BudgetLine, on_delete=models.PROTECT, related_name='allocations', verbose_name=_("Plan line"),
    )
    project_funding = models.ForeignKey(
        ProjectFunding, on_delete=models.PROTECT, related_name='line_allocations', verbose_name=_("Funding"),
    )
    amount = models.DecimalField(max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, verbose_name=_("Amount"))

    class Meta:
        verbose_name = _("Line allocation")
        verbose_name_plural = _("Line allocations")
        constraints = [
            models.UniqueConstraint(
                fields=['budget_line', 'project_funding'],
                condition=models.Q(is_deleted=False),
                name='finance_line_allocation_unique',
            ),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name='finance_line_allocation_positive'),
        ]

    def __str__(self) -> str:
        return f"{self.budget_line} ← {self.amount}"


class CostAllocation(EnterpriseBaseModel):
    """The actual split: how much of a cost is charged to a source — the figure
    a grant settlement reports and a document note prints. For volunteer work
    it is the work's valuation, charged to a volunteer-work source."""

    cost_item = models.ForeignKey(
        CostItem, on_delete=models.PROTECT, related_name='allocations', verbose_name=_("Cost item"),
    )
    project_funding = models.ForeignKey(
        ProjectFunding, on_delete=models.PROTECT, related_name='cost_allocations', verbose_name=_("Funding"),
    )
    amount = models.DecimalField(max_digits=MONEY_DIGITS, decimal_places=MONEY_DECIMALS, verbose_name=_("Amount"))

    class Meta:
        verbose_name = _("Cost allocation")
        verbose_name_plural = _("Cost allocations")
        constraints = [
            models.UniqueConstraint(
                fields=['cost_item', 'project_funding'],
                condition=models.Q(is_deleted=False),
                name='finance_cost_allocation_unique',
            ),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name='finance_cost_allocation_positive'),
        ]

    def __str__(self) -> str:
        return f"{self.cost_item} ← {self.amount}"


class FinanceEvent(models.Model):
    """Append-only audit log, written by the services only.

    A plain model on purpose: an audit row that can be soft-deleted is an audit
    row that can be hidden. `subject_id` is a bare UUID rather than a foreign key
    so the log outlives any row it describes. `budget` is null only for an act on
    something no single budget owns — a funding source.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    budget = models.ForeignKey(
        ProjectBudget, on_delete=models.PROTECT, null=True, blank=True,
        related_name='events', verbose_name=_("Budget"),
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+', verbose_name=_("Actor"),
    )
    at = models.DateTimeField(default=timezone.now, verbose_name=_("At"))
    subject_type = models.CharField(max_length=20, verbose_name=_("Subject type"))
    subject_id = models.UUIDField(verbose_name=_("Subject id"))
    action = models.CharField(max_length=20, choices=FinanceAction.choices, verbose_name=_("Action"))
    before = models.JSONField(default=dict, blank=True, verbose_name=_("Before"))
    after = models.JSONField(default=dict, blank=True, verbose_name=_("After"))
    reason = models.TextField(blank=True, verbose_name=_("Reason"))

    class Meta:
        verbose_name = _("Finance event")
        verbose_name_plural = _("Finance events")
        ordering = ['-at']
        indexes = [
            models.Index(fields=['budget', '-at'], name='finance_event_budget_at_idx'),
            models.Index(fields=['subject_type', 'subject_id'], name='finance_event_subject_idx'),
        ]

    def __str__(self) -> str:
        return f"{self.action} {self.subject_type}:{self.subject_id}"
