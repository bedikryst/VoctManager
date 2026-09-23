"""
@file history.py
@description The budget's history as a manager reads it: the append-only log,
             newest first, each act naming who did it and what it was about.
             The log stores a bare subject id so it outlives every row; the
             names are looked up when the page is read, soft-deleted rows
             included, so a removed expense still reads as its vendor.
@architecture Enterprise SaaS 2026
@module finance/services/history
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from django.contrib.auth.models import User

from ..models import BudgetLine, Contract, CostItem, CostKind, FinanceAttachment, FinanceEvent, ProjectBudget
from .audit import SUBJECT_ATTACHMENT, SUBJECT_CONTRACT, SUBJECT_COST_ITEM, SUBJECT_LINE


@dataclass(frozen=True)
class HistoryEntry:
    id: UUID
    at: datetime
    action: str
    subject_type: str
    subject_id: UUID
    subject_label: str
    actor_name: str
    before: dict[str, Any]
    after: dict[str, Any]
    reason: str


def _actor_name(actor: User | None) -> str:
    if actor is None:
        return ""
    return actor.get_full_name().strip() or actor.username


def _labels(events: list[FinanceEvent]) -> dict[tuple[str, UUID], str]:
    ids: dict[str, set[UUID]] = {}
    for event in events:
        ids.setdefault(event.subject_type, set()).add(event.subject_id)
    labels: dict[tuple[str, UUID], str] = {}
    for item in CostItem.all_objects.filter(pk__in=ids.get(SUBJECT_COST_ITEM, set())):
        name = item.vendor_name if item.kind == CostKind.EXPENSE else item.payee_name
        labels[(SUBJECT_COST_ITEM, item.pk)] = name
    for contract in Contract.all_objects.filter(pk__in=ids.get(SUBJECT_CONTRACT, set())):
        labels[(SUBJECT_CONTRACT, contract.pk)] = f"{contract.number} · {contract.payee_name}"
    for line in BudgetLine.all_objects.filter(pk__in=ids.get(SUBJECT_LINE, set())):
        labels[(SUBJECT_LINE, line.pk)] = line.name
    for attachment in FinanceAttachment.all_objects.filter(pk__in=ids.get(SUBJECT_ATTACHMENT, set())):
        labels[(SUBJECT_ATTACHMENT, attachment.pk)] = attachment.original_name
    return labels


class HistoryService:
    @staticmethod
    def page(budget: ProjectBudget, *, limit: int, offset: int) -> tuple[int, list[HistoryEntry]]:
        events_query = FinanceEvent.objects.filter(budget=budget).select_related("actor").order_by("-at")
        events = list(events_query[offset:offset + limit])
        labels = _labels(events)
        entries = [
            HistoryEntry(
                id=event.pk,
                at=event.at,
                action=event.action,
                subject_type=event.subject_type,
                subject_id=event.subject_id,
                subject_label=labels.get((event.subject_type, event.subject_id), ""),
                actor_name=_actor_name(event.actor),
                before=event.before,
                after=event.after,
                reason=event.reason,
            )
            for event in events
        ]
        return events_query.count(), entries
