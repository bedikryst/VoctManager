"""
@file finance_sample_documents.py
@description Renders one of each finance document from a throwaway concert, for
    the printed check a template change needs before it ships. Everything the run
    creates — venue, programme, people, fees, contracts and their numbers — lives
    in a transaction that is rolled back, so no row and no contract number
    survives it. The PDFs land in MEDIA_ROOT/finance/samples/, which nginx never
    serves. Needs WeasyPrint's native libraries, so it runs in the web container.
@architecture Enterprise SaaS 2026
@module finance/management/commands/finance_sample_documents
"""
import uuid
from datetime import timedelta
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from archive.models import Composer, Piece
from logistics.models import Location, LocationCategory
from roster.models import (
    Artist,
    Collaborator,
    CrewAssignment,
    Participation,
    ProgramItem,
    Project,
    Rehearsal,
    VoiceType,
)

from ...dtos import FeeBatchDTO
from ...infrastructure.documents import render_bill_pdf, render_contract_pdf
from ...models import Contract, CostItem
from ...services.contracts import ContractService
from ...services.ledger import LedgerService


class _RollBack(Exception):
    """Raised on purpose to undo the sample concert once its PDFs are written."""


def _artist(first_name: str, last_name: str, voice_type: str, instrument: str = "") -> Artist:
    return Artist.objects.create(
        first_name=first_name, last_name=last_name, voice_type=voice_type, instrument=instrument,
        email=f"sample-{uuid.uuid4().hex[:12]}@example.invalid",
    )


def _issue(project: Project, source: Participation | CrewAssignment, amount: str, **extra: str) -> Contract:
    """Prices one row and issues its contract through the real services."""
    key = "participation" if isinstance(source, Participation) else "crew_assignment"
    row = {"ref": {key: str(source.pk)}, "contract_amount": amount, **extra}
    LedgerService.apply_fee_batch(project, FeeBatchDTO.model_validate({"items": [row]}), actor=None)
    return ContractService.issue(CostItem.objects.get(**{key: source}), actor=None)


def _sample_concert() -> list[tuple[str, bytes]]:
    venue = Location.objects.create(
        name="Kościół św. Katarzyny Aleksandryjskiej", category=LocationCategory.CHURCH,
        formatted_address="ul. Augustiańska 7, 31-064 Kraków, Polska",
    )
    project = Project.objects.create(
        title="Lux Aeterna", date_time=timezone.now() + timedelta(days=30),
        status=Project.Status.ACTIVE, location=venue,
    )
    # A first rehearsal two weeks before the concert: a short engagement, so the
    # volunteer agreement prints its insurance clause.
    Rehearsal.objects.create(project=project, date_time=project.date_time - timedelta(days=14))
    composer = Composer.objects.create(first_name="Tomás Luis", last_name="de Victoria")
    for order, title in enumerate(("Officium defunctorum: Introitus", "Kyrie", "Versa est in luctum"), start=1):
        ProgramItem.objects.create(project=project, piece=Piece.objects.create(title=title, composer=composer),
                                   order=order)
    ProgramItem.objects.create(project=project, piece=Piece.objects.create(title="Ave verum corpus"),
                               order=4, is_encore=True)

    singer = Participation.objects.create(artist=_artist("Zofia", "Przykładowa", VoiceType.SOPRANO), project=project)
    conductor = Participation.objects.create(
        artist=_artist("Florent", "de Bazelaire", VoiceType.CONDUCTOR), project=project,
    )
    volunteer = Participation.objects.create(artist=_artist("Jan", "Organista", VoiceType.INSTRUMENTALIST, "Organy"),
                                             project=project)
    engineer = Collaborator.objects.create(
        first_name="Piotr", last_name="Dźwiękowiec", specialty=Collaborator.Specialty.SOUND,
    )
    crew = CrewAssignment.objects.create(collaborator=engineer, project=project, role_description="Realizacja dźwięku")

    dzielo = _issue(project, singer, "1500.50")
    conductor_dzielo = _issue(project, conductor, "3000")
    zlecenie = _issue(project, crew, "800")
    agreement = _issue(project, volunteer, "0", in_kind_hours="12", in_kind_hourly_rate="45")

    return [
        ("1-umowa-o-dzielo.pdf", render_contract_pdf(dzielo)),
        ("2-umowa-o-dzielo-dyrygent.pdf", render_contract_pdf(conductor_dzielo)),
        ("3-umowa-zlecenia.pdf", render_contract_pdf(zlecenie)),
        ("4-porozumienie-wolontariackie.pdf", render_contract_pdf(agreement)),
        ("5-rachunek-do-umowy-o-dzielo.pdf", render_bill_pdf(dzielo)),
        ("6-rachunek-do-umowy-zlecenia.pdf", render_bill_pdf(zlecenie)),
    ]


class Command(BaseCommand):
    help = (
        "Renders one of each finance document (contracts, volunteer agreement, bills) from a "
        "throwaway concert into MEDIA_ROOT/finance/samples/, then rolls the concert back."
    )

    def handle(self, *args: Any, **options: Any) -> None:
        folder = Path(settings.MEDIA_ROOT) / "finance" / "samples"
        folder.mkdir(parents=True, exist_ok=True)
        written: list[Path] = []
        try:
            with transaction.atomic():
                for filename, pdf in _sample_concert():
                    path = folder / filename
                    path.write_bytes(pdf)
                    written.append(path)
                raise _RollBack
        except _RollBack:
            pass
        self.stdout.write(self.style.SUCCESS(f"{len(written)} documents, nothing kept in the database:"))
        for path in written:
            self.stdout.write(f"  {path}")
