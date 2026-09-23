"""
@file audit.py
@description The single writer of `FinanceEvent`. Every service act that changes
             a settled fact records who did it, when, what the row looked like
             before and after, and why — in JSON a person can read in the admin.
@architecture Enterprise SaaS 2026
@module finance/services/audit
"""
from collections.abc import Mapping
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.contrib.auth.models import User

from ..models import Contract, CostItem, FinanceAction, FinanceEvent, ProjectBudget

Subject = CostItem | Contract | ProjectBudget

_SUBJECT_TYPES: dict[type, str] = {
    CostItem: "cost_item",
    Contract: "contract",
    ProjectBudget: "budget",
}


def json_value(value: object) -> Any:
    """Decimals as strings (a float would lose the grosz), dates as ISO."""
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


def snapshot(values: Mapping[str, object]) -> dict[str, Any]:
    return {key: json_value(value) for key, value in values.items()}


def record(
    budget: ProjectBudget,
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
