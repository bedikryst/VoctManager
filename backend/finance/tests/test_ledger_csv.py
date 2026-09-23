"""
The office's ledger CSV: the Polish-Excel shape, only the fees the budget
counts, the sources each cost is charged to, the date window across projects,
and a typed name that cannot run as a formula.
"""
import csv
import io
from datetime import timedelta
from typing import Any

from rest_framework.test import APITestCase

from core.constants import AppRole
from roster.models import Participation

from ..dtos import AllocationSetDTO, FundingSourceDTO, ProjectFundingDTO
from ..rules import local_date
from ..services.contracts import ContractService
from ..services.funding import FundingService
from .factories import make_crew, make_project, make_seat, make_user, price


def _rows(response: Any) -> list[list[str]]:
    body = b"".join(response.streaming_content).decode("utf-8")
    assert body.startswith("﻿")
    return list(csv.reader(io.StringIO(body[1:]), delimiter=";"))


class LedgerCsvTests(APITestCase):
    def setUp(self) -> None:
        self.manager = make_user()
        self.client.force_authenticate(self.manager)

    def test_the_project_export_lists_counted_fees_in_the_offices_format(self) -> None:
        project = make_project(title="Nieszpory")
        item = price(project, participation=make_seat(project, "Anna", "Nowak"), amount="1250.5")
        contract = ContractService.issue(item, actor=self.manager)
        price(project, crew=make_crew(project, "Jan", "Kowalski"), amount="400", employer_contributions="80.25")
        declined = make_seat(project, "Ewa", "Zawada")
        price(project, participation=declined, amount="300")
        declined.status = Participation.Status.DECLINED
        declined.save()
        make_seat(project, "Piotr", "Bez-Stawki")

        response = self.client.get(f"/api/finance/projects/{project.pk}/export/ledger.csv")

        self.assertEqual(response.status_code, 200)
        self.assertIn("Rozliczenie-Nieszpory.csv", response["Content-Disposition"])
        header, *rows = _rows(response)
        self.assertEqual(header[0], "Projekt")
        by_payee = {row[2]: row for row in rows}
        self.assertEqual(set(by_payee), {"Anna Nowak", "Jan Kowalski"})
        anna = by_payee["Anna Nowak"]
        self.assertEqual(anna[5], "Umowa o dzieło")
        self.assertEqual(anna[6], contract.number)
        self.assertEqual(anna[8], "Wystawiona")
        self.assertEqual(anna[10], "1250,50")
        self.assertEqual(anna[1], local_date(project.date_time, project.timezone).strftime("%d.%m.%Y"))
        jan = by_payee["Jan Kowalski"]
        self.assertEqual((jan[5], jan[11], jan[12]), ("Umowa zlecenia", "80,25", "480,25"))

    def test_the_range_export_crosses_projects_and_keeps_to_the_window(self) -> None:
        inside = make_project(days=3, title="W środku")
        later = make_project(days=60, title="Później")
        price(inside, participation=make_seat(inside), amount="100")
        price(later, participation=make_seat(later), amount="200")
        start = local_date(inside.date_time, inside.timezone) - timedelta(days=1)
        end = start + timedelta(days=10)

        response = self.client.get(f"/api/finance/export/ledger.csv?from={start.isoformat()}&to={end.isoformat()}")

        self.assertEqual(response.status_code, 200)
        _, *rows = _rows(response)
        self.assertEqual([row[0] for row in rows], ["W środku"])

    def test_a_reversed_or_missing_range_is_refused(self) -> None:
        self.assertEqual(self.client.get("/api/finance/export/ledger.csv?from=2026-09-30&to=2026-09-01").status_code, 400)
        self.assertEqual(self.client.get("/api/finance/export/ledger.csv").status_code, 400)

    def test_a_typed_formula_is_written_as_text(self) -> None:
        project = make_project()
        self.client.post(
            f"/api/finance/projects/{project.pk}/fees/one-off/",
            {"payee_name": "=HYPERLINK(1)", "category": "PERSONNEL_TECHNICAL", "form": "OTHER", "contract_amount": "10"},
            format="json",
        )

        _, row = _rows(self.client.get(f"/api/finance/projects/{project.pk}/export/ledger.csv"))

        self.assertEqual(row[2], "'=HYPERLINK(1)")

    def test_each_cost_names_the_sources_it_is_charged_to(self) -> None:
        project = make_project()
        item = price(project, participation=make_seat(project), amount="1000")
        grant = FundingService.create_source(
            FundingSourceDTO.model_validate({"kind": "PUBLIC_GRANT", "name": "Mecenat"}), actor=None,
        )
        tickets = FundingService.create_source(
            FundingSourceDTO.model_validate({"kind": "TICKETS", "name": "Bilety"}), actor=None,
        )
        fundings = [
            FundingService.add_funding(project, ProjectFundingDTO(source=source.pk), actor=None)
            for source in (grant, tickets)
        ]
        FundingService.set_cost_allocations(item, AllocationSetDTO.model_validate({"allocations": [
            {"funding": str(fundings[0].pk), "amount": "600"},
            {"funding": str(fundings[1].pk), "amount": "150.5"},
        ]}), actor=None)

        header, row = _rows(self.client.get(f"/api/finance/projects/{project.pk}/export/ledger.csv"))

        self.assertEqual(header[-2:], ["Źródła finansowania", "Kwota ze źródeł"])
        self.assertEqual(row[-2:], ["Mecenat: 600,00 / Bilety: 150,50", "750,50"])

    def test_a_singer_cannot_export(self) -> None:
        self.client.force_authenticate(make_user(role=AppRole.ARTIST))
        project = make_project()

        self.assertEqual(self.client.get(f"/api/finance/projects/{project.pk}/export/ledger.csv").status_code, 403)
