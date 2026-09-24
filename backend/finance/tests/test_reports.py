"""
Reports and exports (Stage 6): the patron report's privacy floor — no figure
derived from fees sums fewer than three people's, not even by subtraction
from the printed total — the board report, the kosztorys CSV and its split
between the public-benefit columns, the document notes in each source's
formula, and who may download them.
"""
import csv
import io
from decimal import Decimal
from typing import Any
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APITestCase

from core.constants import AppRole
from roster.models import Project

from ..dtos import (
    AllocationSetDTO,
    BudgetLineDTO,
    ExpenseDTO,
    FundingSourceDTO,
    ProjectFundingDTO,
)
from ..exceptions import PatronReportBelowFloor, ReportSourceInvalid
from ..infrastructure.document_notes import render_note
from ..infrastructure.reports import (
    render_board_report_html,
    render_document_notes_html,
    render_patron_report_html,
)
from ..models import BudgetLine, BudgetStatus, CostItem, FundingSource, ProjectBudget, ProjectFunding
from ..services.budget import BudgetService
from ..services.contracts import ContractService
from ..services.expenses import ExpenseService
from ..services.funding import FundingService
from ..services.plan import PlanService
from ..services.reports import (
    CONTRIBUTIONS_DOCUMENT,
    FUNDING_MERGED,
    PATRON_PAYEE_FLOOR,
    PERSONNEL_MERGED,
    REMAINDER,
    VARIANT_ACTUAL,
    VARIANT_PLAN,
    CategoryCost,
    charged_documents,
    floored_cost_structure,
    kosztorys,
    patron_report,
)
from .factories import make_crew, make_project, make_seat, make_user, price


def _source(name: str = "Mecenat Małopolski", kind: str = "PUBLIC_GRANT", **rules: Any) -> FundingSource:
    return FundingService.create_source(
        FundingSourceDTO.model_validate({"kind": kind, "name": name, **rules}), actor=None,
    )


def _fund(project: Project, source: FundingSource, planned: str = "0", received: str = "0") -> ProjectFunding:
    dto = ProjectFundingDTO.model_validate({
        "source": str(source.pk), "planned_amount": planned, "received_amount": received,
    })
    return FundingService.add_funding(project, dto, actor=None)


def _line(project: Project, category: str, quantity: str, unit_cost: str, unit: str = "SERVICE") -> BudgetLine:
    dto = BudgetLineDTO(category=category, name=f"Pozycja {category}", unit=unit,
                        quantity=Decimal(quantity), unit_cost=Decimal(unit_cost))
    return PlanService.create_line(project, dto, actor=None)


def _expense(project: Project, amount: str, category: str = "VENUE", **extra: Any) -> CostItem:
    dto = ExpenseDTO.model_validate({
        "category": category, "vendor_name": "Parafia", "document_type": "INVOICE", "cost_amount": amount, **extra,
    })
    return ExpenseService.create(project, dto, actor=None)


def _split(*pairs: tuple[ProjectFunding, str]) -> AllocationSetDTO:
    return AllocationSetDTO.model_validate({
        "allocations": [{"funding": str(funding.pk), "amount": amount} for funding, amount in pairs],
    })


def _singers(project: Project, *amounts: str) -> list[CostItem]:
    return [
        price(project, participation=make_seat(project, "Śpiewak", f"Numer{index}"), amount=amount)
        for index, amount in enumerate(amounts)
    ]


def _people(count: int, prefix: str) -> frozenset[str]:
    return frozenset(f"{prefix}{index}" for index in range(count))


class FloorRuleTests(TestCase):
    """`floored_cost_structure` on its own: which personnel rows may exist."""

    def test_one_person_in_both_personnel_categories_counts_once(self) -> None:
        rows = dict(floored_cost_structure([
            CategoryCost("PERSONNEL_ARTISTIC", Decimal("3000"), frozenset({"anna", "jan"})),
            CategoryCost("PERSONNEL_TECHNICAL", Decimal("800"), frozenset({"jan"})),
            CategoryCost("VENUE", Decimal("1500")),
        ]))

        # Two people, not three: personnel hides inside the venue.
        self.assertEqual(rows, {REMAINDER: Decimal("5300")})

    def test_each_personnel_category_above_the_floor_keeps_its_row(self) -> None:
        rows = dict(floored_cost_structure([
            CategoryCost("PERSONNEL_ARTISTIC", Decimal("3000"), _people(PATRON_PAYEE_FLOOR, "a")),
            CategoryCost("PERSONNEL_TECHNICAL", Decimal("2400"), _people(PATRON_PAYEE_FLOOR, "t")),
            CategoryCost("VENUE", Decimal("1500")),
        ]))

        self.assertEqual(rows, {
            "PERSONNEL_ARTISTIC": Decimal("3000"),
            "PERSONNEL_TECHNICAL": Decimal("2400"),
            "VENUE": Decimal("1500"),
        })

    def test_a_small_personnel_category_merges_with_the_other(self) -> None:
        rows = dict(floored_cost_structure([
            CategoryCost("PERSONNEL_ARTISTIC", Decimal("3000"), _people(5, "a")),
            CategoryCost("PERSONNEL_TECHNICAL", Decimal("800"), _people(1, "t")),
            CategoryCost("VENUE", Decimal("1500")),
        ]))

        self.assertEqual(rows, {PERSONNEL_MERGED: Decimal("3800"), "VENUE": Decimal("1500")})

    def test_personnel_below_the_floor_hides_inside_the_largest_other_cost(self) -> None:
        structure = floored_cost_structure([
            CategoryCost("PERSONNEL_ARTISTIC", Decimal("3000"), _people(1, "a")),
            CategoryCost("PERSONNEL_TECHNICAL", Decimal("800"), _people(1, "t")),
            CategoryCost("VENUE", Decimal("1500")),
            CategoryCost("PROMOTION", Decimal("620")),
        ])

        self.assertEqual(structure, [("PROMOTION", Decimal("620")), (REMAINDER, Decimal("5300"))])
        # Nothing printed equals the personnel cost, alone or as the total
        # minus the other rows.
        self.assertNotIn(Decimal("3800"), [amount for _, amount in structure])

    def test_personnel_below_the_floor_with_nothing_else_leaves_only_the_total(self) -> None:
        self.assertEqual(floored_cost_structure([CategoryCost("PERSONNEL_ARTISTIC", Decimal("3000"), _people(2, "a"))]), [])

    def test_without_personnel_the_rows_run_largest_first(self) -> None:
        structure = floored_cost_structure([
            CategoryCost("PROMOTION", Decimal("620")),
            CategoryCost("VENUE", Decimal("1500")),
        ])

        self.assertEqual([key for key, _ in structure], ["VENUE", "PROMOTION"])


class PatronReportTests(TestCase):
    def test_three_paid_singers_are_one_row_and_no_name_is_printed(self) -> None:
        project = make_project(title="Nieszpory")
        _singers(project, "400", "300", "250")
        _expense(project, "1500")

        report = patron_report(BudgetService.build(project))
        html = render_patron_report_html(BudgetService.build(project))

        self.assertEqual(
            {share.key: share.amount for share in report.structure},
            {"PERSONNEL_ARTISTIC": Decimal("950.00"), "VENUE": Decimal("1500.00")},
        )
        self.assertNotIn("Numer0", html)
        self.assertNotIn("400,00", html)

    def test_a_volunteer_does_not_count_towards_the_floor(self) -> None:
        project = make_project()
        _singers(project, "400", "300")
        price(project, participation=make_seat(project, "Wolontariusz", "Organista"), amount="0",
              in_kind_hours="10", in_kind_hourly_rate="50")
        _expense(project, "1500")

        report = patron_report(BudgetService.build(project))

        self.assertEqual({share.key for share in report.structure}, {REMAINDER})
        self.assertEqual(report.structure[0].amount, Decimal("2200.00"))

    def test_the_funding_structure_sums_to_the_cost_with_the_rest_as_own_funds(self) -> None:
        project = make_project()
        venue = _expense(project, "1500")
        _expense(project, "500", category="PROMOTION")
        grant = _fund(project, _source(), planned="1500")
        FundingService.set_cost_allocations(venue, _split((grant, "1200")), actor=None)

        report = patron_report(BudgetService.build(project))

        self.assertEqual(
            {share.key: share.amount for share in report.funding},
            {"PUBLIC_GRANT": Decimal("1200.00"), "OWN": Decimal("800.00")},
        )
        self.assertEqual(sum(share.amount for share in report.funding), report.total)

    def test_a_patrons_highlight_is_floored_like_the_whole(self) -> None:
        project = make_project()
        singers = _singers(project, "400", "300", "250")
        venue = _expense(project, "1500")
        sponsor = _source("Kancelaria", kind="SPONSOR")
        funding = _fund(project, sponsor, planned="1000")
        FundingService.set_cost_allocations(singers[0], _split((funding, "400")), actor=None)
        FundingService.set_cost_allocations(venue, _split((funding, "600")), actor=None)

        report = patron_report(BudgetService.build(project), source_id=sponsor.pk)

        assert report.highlight is not None
        self.assertEqual(report.highlight.covered, Decimal("1000.00"))
        self.assertEqual({share.key for share in report.highlight.structure}, {REMAINDER})

    def test_a_sponsor_of_one_soloist_finds_no_amount_of_theirs(self) -> None:
        project = make_project()
        _singers(project, "300", "300", "300")
        soloist = price(project, participation=make_seat(project, "Solista", "Jedyny"), amount="400")
        venue = _expense(project, "1500")
        grant = _fund(project, _source(), planned="1500")
        sponsor = _source("Kancelaria", kind="SPONSOR")
        FundingService.set_cost_allocations(venue, _split((grant, "1500")), actor=None)
        FundingService.set_cost_allocations(soloist, _split((_fund(project, sponsor, planned="400"), "400")),
                                            actor=None)

        report = patron_report(BudgetService.build(project), source_id=sponsor.pk)
        html = render_patron_report_html(BudgetService.build(project), source_id=sponsor.pk)

        assert report.highlight is not None
        self.assertIsNone(report.highlight.covered)
        self.assertEqual(report.highlight.structure, [])
        # The sponsors' row would be the soloist's fee: it merges into another source.
        self.assertEqual(
            {share.key: share.amount for share in report.funding},
            {"OWN": Decimal("900.00"), FUNDING_MERGED: Decimal("1900.00")},
        )
        self.assertIn("Pokryły część kosztów koncertu.", html)
        self.assertNotIn("400,00", html)

    def test_a_highlight_cannot_be_subtracted_from_the_merged_personnel(self) -> None:
        project = make_project()
        singers = _singers(project, "400", "300", "250")
        price(project, crew=make_crew(project, "Jan", "Dźwięk"), amount="800")
        sponsor = _source("Kancelaria", kind="SPONSOR")
        funding = _fund(project, sponsor, planned="950")
        for singer in singers:
            FundingService.set_cost_allocations(singer, _split((funding, str(singer.contract_amount))), actor=None)

        report = patron_report(BudgetService.build(project), source_id=sponsor.pk)

        self.assertEqual([(share.key, share.amount) for share in report.structure],
                         [(PERSONNEL_MERGED, Decimal("1750.00"))])
        assert report.highlight is not None
        # 1750 minus 950 would be the sound engineer's fee.
        self.assertIsNone(report.highlight.covered)
        self.assertEqual(report.highlight.structure, [])

    def test_a_highlight_cannot_be_subtracted_from_the_remainder(self) -> None:
        project = make_project()
        price(project, participation=make_seat(project, "Solista", "Jedyny"), amount="400")
        venue = _expense(project, "2000")
        _expense(project, "300", category="PROMOTION")
        grant = _source()
        FundingService.set_cost_allocations(venue, _split((_fund(project, grant, planned="2000"), "2000")),
                                            actor=None)

        report = patron_report(BudgetService.build(project), source_id=grant.pk)

        self.assertEqual([(share.key, share.amount) for share in report.structure],
                         [("PROMOTION", Decimal("300.00")), (REMAINDER, Decimal("2400.00"))])
        assert report.highlight is not None
        # A venue row of 2000 beside the whole's remainder of 2400 is the soloist's 400.
        self.assertEqual(report.highlight.structure, [])
        self.assertEqual(report.highlight.covered, Decimal("2000.00"))

    def test_volunteer_work_is_shown_only_when_enough_volunteers_make_it_up(self) -> None:
        project = make_project()
        work = _fund(project, _source("Wolontariat", kind="VOLUNTEER_WORK"))
        volunteers = [
            price(project, participation=make_seat(project, "Wolontariusz", f"Nr{index}"), amount="0",
                  in_kind_hours="10", in_kind_hourly_rate="50")
            for index in range(PATRON_PAYEE_FLOOR)
        ]
        for volunteer in volunteers[:-1]:
            FundingService.set_cost_allocations(volunteer, _split((work, "500")), actor=None)

        self.assertEqual(patron_report(BudgetService.build(project)).in_kind, [])

        FundingService.set_cost_allocations(volunteers[-1], _split((work, "500")), actor=None)
        in_kind = patron_report(BudgetService.build(project)).in_kind
        self.assertEqual([(share.key, share.amount) for share in in_kind], [("VOLUNTEER_WORK", Decimal("1500.00"))])

    def test_a_source_bringing_no_money_cannot_be_highlighted(self) -> None:
        project = make_project()
        gift = _source("Użyczenie kościoła", kind="IN_KIND")
        _fund(project, gift)

        with self.assertRaises(ReportSourceInvalid):
            patron_report(BudgetService.build(project), source_id=gift.pk)

    def test_a_concert_costing_only_two_peoples_fees_has_no_patron_report(self) -> None:
        project = make_project()
        _singers(project, "700", "500")

        with self.assertRaises(PatronReportBelowFloor):
            patron_report(BudgetService.build(project))

        _expense(project, "100")
        self.assertEqual(patron_report(BudgetService.build(project)).total, Decimal("1300.00"))

    def test_a_person_paid_on_two_rows_is_one_person_to_the_floor(self) -> None:
        project = make_project()
        _singers(project, "400")
        price(project, participation=make_seat(project, "Jan", "Kowalski"), amount="250")
        price(project, crew=make_crew(project, "Jan", "Kowalski"), amount="600")
        _expense(project, "1500")

        report = patron_report(BudgetService.build(project))

        # Three rows but two people: the personnel has no row of its own.
        self.assertEqual([(share.key, share.amount) for share in report.structure],
                         [(REMAINDER, Decimal("2750.00"))])

    def test_the_report_is_a_draft_until_the_budget_is_closed(self) -> None:
        project = make_project()
        _expense(project, "100")

        self.assertIn("wersja robocza", render_patron_report_html(BudgetService.build(project)))

        ProjectBudget.objects.filter(project=project).update(status=BudgetStatus.CLOSED)
        self.assertNotIn("wersja robocza", render_patron_report_html(BudgetService.build(project)))


class BoardReportTests(TestCase):
    def test_the_board_sees_names_fees_warnings_and_the_plan_deviation(self) -> None:
        project = make_project(title="Pasja")
        line = _line(project, "VENUE", "1", "1000")
        _expense(project, "1200", budget_line=str(line.pk))
        price(project, participation=make_seat(project, "Anna", "Nowak"), amount="450")
        make_seat(project, "Piotr", "Bez-Stawki")

        html = render_board_report_html(BudgetService.build(project))

        self.assertIn("Anna Nowak", html)
        self.assertIn("450,00", html)
        self.assertIn("Bez stawki", html)
        self.assertIn("Piotr Bez-Stawki", html)
        self.assertIn("+200,00", html)
        self.assertIn("ponad tolerancję", html)

    def test_the_foundations_own_reads_as_in_the_patron_report(self) -> None:
        project = make_project()
        venue = _expense(project, "1500")
        printing = _expense(project, "500", category="PROMOTION")
        grant = _fund(project, _source(), planned="1000")
        own = _fund(project, _source("Środki własne", kind="OWN_FUNDS"))
        FundingService.set_cost_allocations(venue, _split((grant, "1000")), actor=None)
        FundingService.set_cost_allocations(printing, _split((own, "300")), actor=None)

        html = render_board_report_html(BudgetService.build(project))
        own_share = next(
            share for share in patron_report(BudgetService.build(project)).funding if share.key == "OWN"
        )

        # Own funds charged (300) plus what no source carries (700).
        self.assertEqual(own_share.amount, Decimal("1000.00"))
        self.assertIn("Pokryte ze źródeł zewnętrznych", html)
        self.assertIn("Środki własne fundacji", html)
        self.assertIn(f"1{chr(0x00A0)}000,00", html)


class KosztorysTests(TestCase):
    def setUp(self) -> None:
        self.project = make_project()
        self.venue_line = _line(self.project, "VENUE", "1", "2000")
        self.admin_line = _line(self.project, "ADMINISTRATION", "10", "50", unit="HOUR")
        self.grant = _fund(self.project, _source(), planned="1500")
        self.sponsor = _fund(self.project, _source("Sponsor", kind="SPONSOR"), planned="200")
        self.gift = _fund(self.project, _source("Użyczenie", kind="IN_KIND"), received="400")

    def test_the_plan_splits_each_line_and_states_what_no_source_carries(self) -> None:
        FundingService.set_line_allocations(
            self.venue_line, _split((self.grant, "1200"), (self.sponsor, "200"), (self.gift, "400")), actor=None,
        )

        sections = kosztorys(BudgetService.build(self.project), variant=VARIANT_PLAN)

        venue = sections[0].rows[0]
        self.assertEqual(venue.value, Decimal("2000.00"))
        self.assertEqual(venue.split, {
            "grant": Decimal("1200.00"), "other_money": Decimal("200.00"), "personal": Decimal("0.00"),
            "material": Decimal("400.00"), "unassigned": Decimal("200.00"),
        })
        self.assertEqual(sections[1].rows[0].split["unassigned"], Decimal("500.00"))

    def test_the_actuals_add_costs_outside_the_plan_and_gifts_through_the_plans_split(self) -> None:
        FundingService.set_line_allocations(self.venue_line, _split((self.gift, "400")), actor=None)
        venue = _expense(self.project, "1600", budget_line=str(self.venue_line.pk))
        FundingService.set_cost_allocations(venue, _split((self.grant, "1000")), actor=None)
        _expense(self.project, "300", category="PROMOTION")

        sections = kosztorys(BudgetService.build(self.project), variant=VARIANT_ACTUAL)

        line_row, outside = sections[0].rows
        self.assertEqual(line_row.split["grant"], Decimal("1000.00"))
        self.assertEqual(line_row.split["material"], Decimal("400.00"))
        self.assertEqual(line_row.split["unassigned"], Decimal("600.00"))
        self.assertEqual(line_row.value, Decimal("2000.00"))
        self.assertIsNone(outside.line)
        self.assertEqual(outside.value, Decimal("300.00"))

    def test_the_named_source_is_the_grant_column(self) -> None:
        FundingService.set_line_allocations(
            self.venue_line, _split((self.grant, "1000"), (self.sponsor, "200")), actor=None,
        )
        sponsor_source = self.sponsor.source

        sections = kosztorys(BudgetService.build(self.project), variant=VARIANT_PLAN, source_id=sponsor_source.pk)

        split = sections[0].rows[0].split
        self.assertEqual((split["grant"], split["other_money"]), (Decimal("200.00"), Decimal("1000.00")))


class NoteTests(TestCase):
    def test_a_placeholder_the_panel_does_not_know_is_a_line_to_fill(self) -> None:
        note = render_note("Umowa nr {agreement_number} z dnia {agreement_date}, <b>{source_name}</b>", {
            "agreement_number": "KL/1", "agreement_date": "", "source_name": "A & B",
        })

        self.assertEqual(
            str(note), 'Umowa nr KL/1 z dnia <span class="blank"></span>, &lt;b&gt;A &amp; B&lt;/b&gt;',
        )

    def test_notes_cover_documents_charged_to_a_funder_but_not_own_funds(self) -> None:
        project = make_project()
        line = _line(project, "VENUE", "1", "1500")
        venue = _expense(project, "1500", document_number="FV/7/2026", budget_line=str(line.pk))
        printing = _expense(project, "620", category="PROMOTION", vendor_name="Drukarnia Tercja")
        grant = _fund(project, _source(agreement_number="KL-II.5.2026"), planned="1500")
        own = _fund(project, _source("Środki własne", kind="OWN_FUNDS"))
        FundingService.set_cost_allocations(venue, _split((grant, "1500")), actor=None)
        FundingService.set_cost_allocations(printing, _split((own, "620")), actor=None)

        html = render_document_notes_html(BudgetService.build(project))

        self.assertIn("FV/7/2026", html)
        self.assertIn("KL-II.5.2026", html)
        self.assertIn("I.1 Pozycja VENUE", html)
        self.assertNotIn("Drukarnia Tercja", html)

    def test_a_mandates_bill_is_financed_up_to_its_amount_and_its_contributions_apart(self) -> None:
        project = make_project()
        item = price(project, crew=make_crew(project, "Jan", "Dźwięk"), amount="1000", employer_contributions="200")
        ContractService.issue(item, actor=None)
        grant = _fund(project, _source(), planned="1200")
        FundingService.set_cost_allocations(item, _split((grant, "1200")), actor=None)

        documents = charged_documents(BudgetService.build(project))

        self.assertEqual(
            [(document.kind, document.amount, [amount for _, amount in document.charges]) for document in documents],
            [("ZLECENIE", Decimal("1000.00"), [Decimal("1000.00")]),
             (CONTRIBUTIONS_DOCUMENT, Decimal("200.00"), [Decimal("200.00")])],
        )
        html = render_document_notes_html(BudgetService.build(project))
        self.assertNotIn("1 200,00", html)
        self.assertIn("Składki ZUS płatnika do umowy nr UZ/", html)


def _pdf(html: str) -> bytes:
    return f"%PDF{html}".encode()


@patch("finance.infrastructure.reports._render_pdf", side_effect=_pdf)
class ReportApiTests(APITestCase):
    def setUp(self) -> None:
        self.client.force_authenticate(make_user())
        self.project = make_project(title="Lux Aeterna")
        price(self.project, crew=make_crew(self.project), amount="800")

    def _get(self, path: str) -> Any:
        return self.client.get(f"/api/finance/projects/{self.project.pk}/{path}")

    def test_the_reports_and_notes_download_as_pdfs(self, _render: Any) -> None:
        _expense(self.project, "1500")
        for path, filename in (
            ("report.pdf?audience=patron", "Sprawozdanie-dla-mecenasa-Lux_Aeterna.pdf"),
            ("report.pdf?audience=board", "Raport-dla-zarzadu-Lux_Aeterna.pdf"),
            ("document-notes.pdf", "Opisy-dokumentow-Lux_Aeterna.pdf"),
        ):
            response = self._get(path)
            self.assertEqual(response.status_code, 200, path)
            self.assertIn(filename, response["Content-Disposition"])

    def test_a_patron_report_that_would_print_one_persons_fee_is_refused(self, _render: Any) -> None:
        response = self._get("report.pdf?audience=patron")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error_code"], "patron_report_below_floor")
        self.assertEqual(self._get("report.pdf?audience=board").status_code, 200)

    def test_an_unknown_audience_or_a_foreign_source_is_refused(self, _render: Any) -> None:
        self.assertEqual(self._get("report.pdf?audience=press").status_code, 400)
        response = self._get(f"report.pdf?audience=patron&source={_source().pk}")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error_code"], "report_source_invalid")

    def test_the_kosztorys_downloads_in_both_variants(self, _render: Any) -> None:
        _line(self.project, "PERSONNEL_TECHNICAL", "1", "800")

        for variant, label in (("plan", "plan"), ("actual", "wykonanie")):
            response = self._get(f"export/kosztorys-{variant}.csv")
            self.assertEqual(response.status_code, 200)
            self.assertIn(f"Kosztorys-{label}-Lux_Aeterna.csv", response["Content-Disposition"])
            body = b"".join(response.streaming_content).decode("utf-8")
            rows = list(csv.reader(io.StringIO(body[1:]), delimiter=";"))
            self.assertEqual(rows[0][0], "Lp.")
            self.assertEqual(rows[-1][1], "Ogółem")
            self.assertEqual(rows[-1][5], "800,00")

    def test_the_patron_summary_is_written_in_any_state(self, _render: Any) -> None:
        ProjectBudget.objects.filter(project=self.project).update(status=BudgetStatus.CLOSED)

        response = self.client.patch(
            f"/api/finance/projects/{self.project.pk}/budget/", {"patron_summary": "  Wieczór Victorii.  "},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["budget"]["patron_summary"], "Wieczór Victorii.")

    def test_a_singer_cannot_download_a_report(self, _render: Any) -> None:
        self.client.force_authenticate(make_user(role=AppRole.ARTIST))

        self.assertEqual(self._get("report.pdf?audience=patron").status_code, 403)
        self.assertEqual(self._get("document-notes.pdf").status_code, 403)
        self.assertEqual(self._get("export/kosztorys-plan.csv").status_code, 403)
