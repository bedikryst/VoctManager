"""
@file factories.py
@description Builders for the finance tests: people with the three kinds of
             access (singer, manager, board), a project with a cast and a crew,
             and a one-line way to price a row through the real service.
@architecture Enterprise SaaS 2026
@module finance/tests/factories
"""
from datetime import timedelta
from decimal import Decimal
from itertools import count
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from core.constants import AppRole
from core.models import UserProfile
from roster.models import Artist, Collaborator, CrewAssignment, Participation, Project, VoiceType

from ..dtos import FeeBatchDTO
from ..models import CostItem
from ..services.ledger import LedgerService

_sequence = count(1)


def make_user(*, role: str = AppRole.MANAGER, staff: bool = False) -> User:
    n = next(_sequence)
    user = User.objects.create_user(
        username=f"fin-user-{n}", email=f"fin-user-{n}@test.pl", password="pw123456", is_staff=staff,
    )
    UserProfile.objects.create(user=user, role=role)
    return user


def make_project(*, days: float = 30, status: str = Project.Status.ACTIVE, title: str = "Koncert") -> Project:
    return Project.objects.create(
        title=title, date_time=timezone.now() + timedelta(days=days), status=status,
    )


def make_seat(
    project: Project,
    first_name: str = "Anna",
    last_name: str = "Nowak",
    *,
    voice_type: str = VoiceType.SOPRANO,
    status: str = Participation.Status.CONFIRMED,
    user: User | None = None,
) -> Participation:
    n = next(_sequence)
    artist = Artist.objects.create(
        user=user, first_name=first_name, last_name=last_name,
        email=f"artist-{n}@test.pl", voice_type=voice_type,
    )
    return Participation.objects.create(artist=artist, project=project, status=status)


def make_crew(
    project: Project,
    first_name: str = "Jan",
    last_name: str = "Kowalski",
    *,
    specialty: str = Collaborator.Specialty.SOUND,
    company_name: str = "",
    email: str | None = None,
) -> CrewAssignment:
    collaborator = Collaborator.objects.create(
        first_name=first_name, last_name=last_name, specialty=specialty,
        company_name=company_name, email=email,
    )
    return CrewAssignment.objects.create(collaborator=collaborator, project=project)


def price(
    project: Project,
    *,
    participation: Participation | None = None,
    crew: CrewAssignment | None = None,
    item: CostItem | None = None,
    amount: Decimal | str | int | None,
    actor: User | None = None,
    **extra: Any,
) -> CostItem:
    """Prices one row through the ledger service and returns its item."""
    ref: dict[str, str] = {}
    if participation is not None:
        ref["participation"] = str(participation.pk)
    elif crew is not None:
        ref["crew_assignment"] = str(crew.pk)
    elif item is not None:
        ref["cost_item"] = str(item.pk)
    row = {"ref": ref, "contract_amount": None if amount is None else str(amount), **extra}
    LedgerService.apply_fee_batch(project, FeeBatchDTO.model_validate({"items": [row]}), actor=actor)
    if participation is not None:
        return CostItem.objects.get(participation=participation)
    if crew is not None:
        return CostItem.objects.get(crew_assignment=crew)
    assert item is not None
    return CostItem.objects.get(pk=item.pk)
