"""
@file audit.py
@description The single writer of `FinanceEvent`. Every service act that changes
             a settled fact records who did it, when, what the row looked like
             before and after, and why — in JSON a person can read in the admin.
             An act on a funding source belongs to no single budget and is
             recorded without one.
@architecture Enterprise SaaS 2026
@module finance/services/audit
"""
from collections.abc import Mapping
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.contrib.auth.models import User

from ..models import (
    BudgetLine,
    Contract,
    CostItem,
    FinanceAction,
    FinanceAttachment,
    FinanceEvent,
    FundingSource,
    ProjectBudget,
    ProjectFunding,
)

Subject = CostItem | Contract | ProjectBudget | BudgetLine | FinanceAttachment | FundingSource | ProjectFunding

SUBJECT_COST_ITEM = "cost_item"
SUBJECT_CONTRACT = "contract"
SUBJECT_BUDGET = "budget"
SUBJECT_LINE = "budget_line"
SUBJECT_ATTACHMENT = "attachment"
SUBJECT_SOURCE = "funding_source"
SUBJECT_FUNDING = "project_funding"

_SUBJECT_TYPES: dict[type, str] = {
    CostItem: SUBJECT_COST_ITEM,
    Contract: SUBJECT_CONTRACT,
    ProjectBudget: SUBJECT_BUDGET,
    BudgetLine: SUBJECT_LINE,
    FinanceAttachment: SUBJECT_ATTACHMENT,
    FundingSource: SUBJECT_SOURCE,
    ProjectFunding: SUBJECT_FUNDING,
}


def json_value(value: object) -> Any:
    """Decimals as strings (a float would lose the grosz), dates as ISO, and
    the same inside lists and mappings (an allocation set is a list)."""
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): json_value(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [json_value(item) for item in value]
    return value


def snapshot(values: Mapping[str, object]) -> dict[str, Any]:
    return {key: json_value(value) for key, value in values.items()}


def record(
    budget: ProjectBudget | None,
    *,
    actor: User | None,
    subject: Subject,
    action: FinanceAction,
    before: Mapping[str, object] | None = None,
    after: Mapping[str, object] | None = None,
    reason: str = "",
) -> FinanceEvent:
    return FinanceEvent.objects.create(
        budget=budget,
        actor=actor,
        subject_type=_SUBJECT_TYPES[type(subject)],
        subject_id=subject.pk,
        action=action,
        before=snapshot(before or {}),
        after=snapshot(after or {}),
        reason=reason,
    )
