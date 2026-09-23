"""
@file gdpr.py
@description The person's own finance records for their data export (GDPR
             right of access): the fees the foundation owes or paid them and the
             contracts issued to them. What the person is owed and was paid —
             not the foundation's internal cost, which includes the employer's
             side of contributions and is the foundation's figure, not theirs.
@architecture Enterprise SaaS 2026
@module finance/gdpr
"""
from typing import Any

from django.contrib.auth.models import User
from django.db.models import Q

from .models import Contract, CostItem, CostKind
from .services.audit import json_value


def personal_finance_records(user: User) -> list[dict[str, Any]]:
    """A cast seat is theirs through their artist record; a crew assignment has
    no account link, so it is matched by the collaborator's e-mail address."""
    mine = Q(participation__artist__user=user)
    if user.email:
        mine |= Q(crew_assignment__collaborator__email__iexact=user.email)
    items = list(
        CostItem.objects.filter(kind=CostKind.FEE)
        .filter(mine)
        .select_related('budget__project')
        .order_by('incurred_on')
    )
    contracts: dict[Any, list[Contract]] = {}
    for contract in Contract.objects.filter(cost_item__in=items).order_by('issued_at'):
        contracts.setdefault(contract.cost_item_id, []).append(contract)
    return [
        {
            "project": item.budget.project.title,
            "incurred_on": json_value(item.incurred_on),
            "form": item.form,
            "contract_amount": json_value(item.contract_amount),
            "paid_on": json_value(item.paid_on),
            "contracts": [
                {
                    "number": contract.number,
                    "form": contract.form,
                    "amount": json_value(contract.amount),
                    "status": contract.status,
                    "issued_at": json_value(contract.issued_at),
                    "signed_on": json_value(contract.signed_on),
                }
                for contract in contracts.get(item.pk, [])
            ],
        }
        for item in items
    ]
