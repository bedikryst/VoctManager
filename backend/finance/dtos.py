"""
@file dtos.py
@description Input contracts of the finance API (Pydantic V2, frozen, extra
             fields forbidden). They check shape only — types, ranges, one ref
             per row. Every money rule (0 ⇔ volunteer, the paid and contract
             locks, what a row may change) is the ledger service's, so a second
             write path cannot skip it by skipping a DTO.
@architecture Enterprise SaaS 2026
@module finance/dtos
"""
from datetime import date
from decimal import Decimal
from typing import Annotated, Self
from uuid import UUID

from pydantic import BeforeValidator, Field, field_validator, model_validator

from roster.dtos import EnterpriseBaseDTO

from .models import EXPENSE_CATEGORIES, FEE_CATEGORIES, CostCategory, ExpenseDocumentType, FeeForm, PlanUnit
from .rules import finance_today, is_valid_nip

FEE_FORM_VALUES = frozenset(FeeForm.values)
FEE_CATEGORY_VALUES = frozenset(str(category) for category in FEE_CATEGORIES)
EXPENSE_CATEGORY_VALUES = frozenset(str(category) for category in EXPENSE_CATEGORIES)
CATEGORY_VALUES = frozenset(CostCategory.values)
PLAN_UNIT_VALUES = frozenset(PlanUnit.values)
DOCUMENT_TYPE_VALUES = frozenset(ExpenseDocumentType.values)


def _require_choice(value: str, allowed: frozenset[str], field_name: str) -> str:
    if value not in allowed:
        raise ValueError(f"{field_name} must be one of: {', '.join(sorted(allowed))}.")
    return value


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _normalize_nip(value: object) -> object:
    """Accepts the NIP however it was copied ("676-271-89-92", "PL6762718992")
    and stores the ten digits, or nothing."""
    if not isinstance(value, str):
        return value
    digits = "".join(character for character in value if character.isdigit())
    if not digits:
        return ""
    if not is_valid_nip(digits):
        raise ValueError("vendor_nip is not a valid NIP.")
    return digits


MoneyAmount = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]
PositiveAmount = Annotated[Decimal, Field(gt=0, max_digits=10, decimal_places=2)]
Hours = Annotated[Decimal, Field(gt=0, max_digits=6, decimal_places=2)]
Quantity = Annotated[Decimal, Field(gt=0, max_digits=8, decimal_places=2)]
Text = Annotated[str, BeforeValidator(_strip)]
Nip = Annotated[str, BeforeValidator(_normalize_nip)]


def _not_in_future(value: date | None, field_name: str) -> date | None:
    if value is not None and value > finance_today():
        raise ValueError(f"{field_name} cannot be in the future.")
    return value


class FeeRefDTO(EnterpriseBaseDTO):
    """Which ledger row an edit is about: a cast seat, a crew assignment, or an
    existing item (the only handle a one-off payee has)."""

    participation: UUID | None = None
    crew_assignment: UUID | None = None
    cost_item: UUID | None = None

    @model_validator(mode="after")
    def exactly_one(self) -> Self:
        named = [value for value in (self.participation, self.crew_assignment, self.cost_item) if value is not None]
        if len(named) != 1:
            raise ValueError("ref must name exactly one of participation, crew_assignment, cost_item.")
        return self

    @property
    def key(self) -> UUID:
        key = self.participation or self.crew_assignment or self.cost_item
        assert key is not None  # `exactly_one` has already refused anything else
        return key


class FeeItemDTO(EnterpriseBaseDTO):
    """One row of a pricing batch. `contract_amount` must be sent (null clears
    the price); `form` may be omitted to keep the row's form. The optional money
    fields are only touched when present, so a client can send what it edited."""

    ref: FeeRefDTO
    contract_amount: MoneyAmount | None
    form: str | None = None
    employer_contributions: MoneyAmount | None = None
    in_kind_hours: Hours | None = None
    in_kind_hourly_rate: MoneyAmount | None = None

    @field_validator("form")
    @classmethod
    def validate_form(cls, value: str | None) -> str | None:
        return None if value is None else _require_choice(value, FEE_FORM_VALUES, "form")


class StandardRateDTO(EnterpriseBaseDTO):
    cast: MoneyAmount | None = None
    crew: MoneyAmount | None = None


class FeeBatchDTO(EnterpriseBaseDTO):
    """The whole pricing edit, applied in one transaction: the standard rate
    first, then the rows. One refused row rolls back everything."""

    standard_rate: StandardRateDTO | None = None
    items: tuple[FeeItemDTO, ...] = ()

    @model_validator(mode="after")
    def reject_repeated_rows(self) -> Self:
        seen: set[UUID] = set()
        for item in self.items:
            if item.ref.key in seen:
                raise ValueError("items must name each row at most once.")
            seen.add(item.ref.key)
        return self


class OneOffFeeDTO(EnterpriseBaseDTO):
    """A payee from outside the panel — one concert, no roster record. They
    state which side they are on, and the form is chosen here: there is no
    roster record to derive a default from."""

    payee_name: Text = Field(..., min_length=1, max_length=200)
    payee_role: Text = Field(default="", max_length=150)
    category: str
    form: str
    contract_amount: MoneyAmount | None = None
    employer_contributions: MoneyAmount | None = None
    in_kind_hours: Hours | None = None
    in_kind_hourly_rate: MoneyAmount | None = None
    due_on: date | None = None
    note: Text = Field(default="", max_length=2000)
    document_number: Text = Field(default="", max_length=100)
    document_date: date | None = None
    vendor_nip: Nip = ""

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        return _require_choice(value, FEE_CATEGORY_VALUES, "category")

    @field_validator("form")
    @classmethod
    def validate_form(cls, value: str) -> str:
        return _require_choice(value, FEE_FORM_VALUES, "form")


class CostItemDetailsDTO(EnterpriseBaseDTO):
    """Bookkeeping details of one fee. Only the fields sent are changed. The
    payee and side of a one-off are here too; the service refuses them on a
    roster row (the roster is their source) and on a paid or contracted one.
    `budget_line` sent as null takes the fee out of the plan."""

    payee_name: Text | None = Field(default=None, min_length=1, max_length=200)
    payee_role: Text | None = Field(default=None, max_length=150)
    category: str | None = None
    budget_line: UUID | None = None
    due_on: date | None = None
    note: Text | None = Field(default=None, max_length=2000)
    document_number: Text | None = Field(default=None, max_length=100)
    document_date: date | None = None
    vendor_nip: Nip | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str | None) -> str | None:
        return None if value is None else _require_choice(value, FEE_CATEGORY_VALUES, "category")


class PayFeesDTO(EnterpriseBaseDTO):
    """Marks items paid on the date the office reports. All or nothing."""

    ids: tuple[UUID, ...] = Field(..., min_length=1)
    paid_on: date

    @field_validator("ids")
    @classmethod
    def unique_ids(cls, value: tuple[UUID, ...]) -> tuple[UUID, ...]:
        if len(set(value)) != len(value):
            raise ValueError("ids must not repeat.")
        return value

    @field_validator("paid_on")
    @classmethod
    def paid_on_not_in_future(cls, value: date) -> date:
        _not_in_future(value, "paid_on")
        return value


class ReasonDTO(EnterpriseBaseDTO):
    """Every act that undoes a settled fact states why; the reason is logged."""

    reason: Text = Field(..., min_length=1, max_length=1000)


class SignContractDTO(EnterpriseBaseDTO):
    signed_on: date
    signed_copy_location: Text = Field(default="", max_length=300)

    @field_validator("signed_on")
    @classmethod
    def signed_on_not_in_future(cls, value: date) -> date:
        _not_in_future(value, "signed_on")
        return value


class ContractHoursDTO(EnterpriseBaseDTO):
    hours_confirmed: Hours


class BudgetLineDTO(EnterpriseBaseDTO):
    """A new plan line. Its planned amount is quantity times unit cost, computed by
    the server; its kosztorys number comes from its category and position."""

    category: str
    name: Text = Field(..., min_length=1, max_length=200)
    unit: str
    quantity: Quantity
    unit_cost: MoneyAmount
    note: Text = Field(default="", max_length=2000)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        return _require_choice(value, CATEGORY_VALUES, "category")

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, value: str) -> str:
        return _require_choice(value, PLAN_UNIT_VALUES, "unit")


class BudgetLineUpdateDTO(EnterpriseBaseDTO):
    """A plan line's edit; only the fields sent change, and none may be null."""

    category: str | None = None
    name: Text | None = Field(default=None, min_length=1, max_length=200)
    unit: str | None = None
    quantity: Quantity | None = None
    unit_cost: MoneyAmount | None = None
    note: Text | None = Field(default=None, max_length=2000)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str | None) -> str | None:
        return None if value is None else _require_choice(value, CATEGORY_VALUES, "category")

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, value: str | None) -> str | None:
        return None if value is None else _require_choice(value, PLAN_UNIT_VALUES, "unit")

    @model_validator(mode="after")
    def no_nulls(self) -> Self:
        cleared = [name for name in self.model_fields_set if getattr(self, name) is None]
        if cleared:
            raise ValueError(f"{', '.join(sorted(cleared))} cannot be cleared.")
        return self


class LineOrderDTO(EnterpriseBaseDTO):
    """Every live line of the budget, in its new order."""

    ids: tuple[UUID, ...] = Field(..., min_length=1)

    @field_validator("ids")
    @classmethod
    def unique_ids(cls, value: tuple[UUID, ...]) -> tuple[UUID, ...]:
        if len(set(value)) != len(value):
            raise ValueError("ids must not repeat.")
        return value


class ExpenseDTO(EnterpriseBaseDTO):
    """A cost that is not a person's fee: the vendor, their document and its
    gross, which is the foundation's cost. `incurred_on` defaults to the
    document's date, then to the concert day."""

    category: str
    vendor_name: Text = Field(..., min_length=1, max_length=200)
    vendor_nip: Nip = ""
    document_type: str
    document_number: Text = Field(default="", max_length=100)
    document_date: date | None = None
    description: Text = Field(default="", max_length=300)
    cost_amount: PositiveAmount
    budget_line: UUID | None = None
    incurred_on: date | None = None
    due_on: date | None = None
    note: Text = Field(default="", max_length=2000)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        return _require_choice(value, EXPENSE_CATEGORY_VALUES, "category")

    @field_validator("document_type")
    @classmethod
    def validate_document_type(cls, value: str) -> str:
        return _require_choice(value, DOCUMENT_TYPE_VALUES, "document_type")


class ExpenseUpdateDTO(EnterpriseBaseDTO):
    """An expense's edit; only the fields sent change. The dates, the line, the
    NIP and the text fields may be cleared; the rest may not."""

    category: str | None = None
    vendor_name: Text | None = Field(default=None, min_length=1, max_length=200)
    vendor_nip: Nip | None = None
    document_type: str | None = None
    document_number: Text | None = Field(default=None, max_length=100)
    document_date: date | None = None
    description: Text | None = Field(default=None, max_length=300)
    cost_amount: PositiveAmount | None = None
    budget_line: UUID | None = None
    incurred_on: date | None = None
    due_on: date | None = None
    note: Text | None = Field(default=None, max_length=2000)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str | None) -> str | None:
        return None if value is None else _require_choice(value, EXPENSE_CATEGORY_VALUES, "category")

    @field_validator("document_type")
    @classmethod
    def validate_document_type(cls, value: str | None) -> str | None:
        return None if value is None else _require_choice(value, DOCUMENT_TYPE_VALUES, "document_type")

    @model_validator(mode="after")
    def required_stay_set(self) -> Self:
        required = {"category", "vendor_name", "document_type", "cost_amount", "incurred_on"}
        cleared = [name for name in self.model_fields_set & required if getattr(self, name) is None]
        if cleared:
            raise ValueError(f"{', '.join(sorted(cleared))} cannot be cleared.")
        return self


class HistoryPageDTO(EnterpriseBaseDTO):
    """A page of the budget's history (`?limit=&offset=`)."""

    limit: int = Field(default=30, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class LedgerRangeDTO(EnterpriseBaseDTO):
    """The office's export window, both ends inclusive (`?from=&to=`)."""

    date_from: date = Field(..., alias="from")
    date_to: date = Field(..., alias="to")

    @model_validator(mode="after")
    def ordered(self) -> Self:
        if self.date_from > self.date_to:
            raise ValueError("from must not be later than to.")
        return self
