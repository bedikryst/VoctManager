"""
The foundation's documents: the amount in words, who signs for the
foundation, each template rendered from its contract row, the programme annex,
a performer's parts and hours record, the PDF and bill endpoints, and the
contracts ZIP.

WeasyPrint's native libraries are absent from the host, so nothing here renders
a PDF: the assertions run on the HTML handed to the renderer.
"""
import io
import os
import shutil
import tempfile
import zipfile
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock, patch

from django.core.files.storage import default_storage
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone, translation
from rest_framework.test import APITestCase

from archive.models import Composer, Piece, PieceVoiceRequirement, ScoreEdition
from core.constants import AppRole
from logistics.models import Location, LocationCategory
from roster.infrastructure.document_generator import DocumentRenderDependencyError
from roster.models import (
    Attendance,
    Collaborator,
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    ProjectSoloAssignment,
    Rehearsal,
    VoiceType,
)

from ..dtos import AllocationSetDTO, FundingSourceDTO, ProjectFundingDTO, SignContractDTO
from ..exceptions import BillNotApplicable, ContractAnnulled, ContractRefused
from ..foundation import FOUNDATION, FoundationIdentityError, Representative, foundation_context, signatory_for
from ..infrastructure.amount_words import amount_to_words_pl, format_amount_pl, number_to_words_pl
from ..infrastructure.documents import (
    Period,
    Solo,
    hours_record,
    performer_parts,
    render_bill_html,
    render_contract_html,
)
from ..models import Contract, ContractSequence, CostItem, FeeForm, FundingSource
from ..rules import finance_today
from ..services.contracts import ContractService
from ..services.funding import FundingService
from ..tasks import EXPORT_TTL, NO_CONTRACTS, export_path, generate_contracts_zip_task
from .factories import make_crew, make_project, make_seat, make_user, price

NBSP = chr(0x00A0)
# The representation line's dash, as the document prints it.
EN_DASH = chr(0x2013)
_BUNDLED_FACES = 6


class AmountWordsTests(SimpleTestCase):
    def words(self, amount: str) -> str:
        return amount_to_words_pl(Decimal(amount))

    def test_zero_is_a_legitimate_amount(self) -> None:
        self.assertEqual(self.words("0"), "zero złotych zero groszy")

    def test_one_takes_the_singular(self) -> None:
        self.assertEqual(self.words("1"), "jeden złoty zero groszy")
        self.assertEqual(self.words("0.01"), "zero złotych jeden grosz")

    def test_two_to_four_take_the_few_form_and_five_up_the_many(self) -> None:
        self.assertEqual(self.words("2"), "dwa złote zero groszy")
        self.assertEqual(self.words("4"), "cztery złote zero groszy")
        self.assertEqual(self.words("5"), "pięć złotych zero groszy")
        self.assertEqual(self.words("22"), "dwadzieścia dwa złote zero groszy")
        self.assertEqual(self.words("21"), "dwadzieścia jeden złotych zero groszy")
        self.assertEqual(self.words("0.22"), "zero złotych dwadzieścia dwa grosze")
        self.assertEqual(self.words("0.25"), "zero złotych dwadzieścia pięć groszy")

    def test_teens_take_the_many_form_even_ending_in_two_to_four(self) -> None:
        self.assertEqual(self.words("11"), "jedenaście złotych zero groszy")
        self.assertEqual(self.words("12"), "dwanaście złotych zero groszy")
        self.assertEqual(self.words("14"), "czternaście złotych zero groszy")
        self.assertEqual(self.words("112"), "sto dwanaście złotych zero groszy")
        self.assertEqual(self.words("0.13"), "zero złotych trzynaście groszy")

    def test_round_hundreds(self) -> None:
        self.assertEqual(self.words("100"), "sto złotych zero groszy")
        self.assertEqual(self.words("200"), "dwieście złotych zero groszy")
        self.assertEqual(self.words("300"), "trzysta złotych zero groszy")
        self.assertEqual(self.words("900"), "dziewięćset złotych zero groszy")

    def test_thousands_inflect_and_one_thousand_has_no_numeral(self) -> None:
        self.assertEqual(self.words("1000"), "tysiąc złotych zero groszy")
        self.assertEqual(self.words("1500.50"), "tysiąc pięćset złotych pięćdziesiąt groszy")
        self.assertEqual(self.words("1001"), "tysiąc jeden złotych zero groszy")
        self.assertEqual(self.words("1002"), "tysiąc dwa złote zero groszy")
        self.assertEqual(self.words("2000"), "dwa tysiące złotych zero groszy")
        self.assertEqual(self.words("5000"), "pięć tysięcy złotych zero groszy")
        self.assertEqual(self.words("12000"), "dwanaście tysięcy złotych zero groszy")
        self.assertEqual(self.words("22000"), "dwadzieścia dwa tysiące złotych zero groszy")
        self.assertEqual(self.words("101000"), "sto jeden tysięcy złotych zero groszy")

    def test_millions_reach_the_ledger_ceiling(self) -> None:
        self.assertEqual(number_to_words_pl(1_000_000), "milion")
        self.assertEqual(number_to_words_pl(2_500_000), "dwa miliony pięćset tysięcy")
        self.assertEqual(
            self.words("99999999.99"),
            "dziewięćdziesiąt dziewięć milionów dziewięćset dziewięćdziesiąt dziewięć tysięcy "
            "dziewięćset dziewięćdziesiąt dziewięć złotych dziewięćdziesiąt dziewięć groszy",
        )

    def test_a_negative_amount_is_refused(self) -> None:
        with self.assertRaises(ValueError):
            self.words("-1")

    def test_figures_use_a_decimal_comma_and_unbreakable_groups(self) -> None:
        self.assertEqual(format_amount_pl(Decimal("0")), "0,00")
        self.assertEqual(format_amount_pl(Decimal("300")), "300,00")
        self.assertEqual(format_amount_pl(Decimal("1500.5")), f"1{NBSP}500,50")
        self.assertEqual(format_amount_pl(Decimal("1234567.89")), f"1{NBSP}234{NBSP}567,89")


class SignatoryTests(SimpleTestCase):
    """A document prints the first board member who is not its own payee."""

    def test_the_president_signs_by_default(self) -> None:
        self.assertEqual(signatory_for("Anna Nowak").name, "Florentyn de Bazelaire de Boucheporn")

    def test_the_president_stands_aside_from_his_own_contract(self) -> None:
        for payee in (
            "Florentyn de Bazelaire de Boucheporn",
            "FLORENTYN DE BAZELAIRE DE BOUCHEPORN",
            "Florentyn Józef Maria Eliasz De Bazelaire De Boucheporn",
            "Florent de Bazelaire",
        ):
            with self.subTest(payee=payee):
                self.assertEqual(signatory_for(payee).name, "Anna Marcisz")

    def test_a_middle_name_and_diacritics_do_not_hide_the_payee(self) -> None:
        board = replace(FOUNDATION, representatives=FOUNDATION.representatives[1:])
        with patch("finance.foundation.FOUNDATION", board):
            self.assertEqual(signatory_for("Anna Elżbieta Marcisz").name, "Krystian Bugalski")
            self.assertEqual(signatory_for("anna marcisz").name, "Krystian Bugalski")

    def test_an_account_email_is_enough(self) -> None:
        first = replace(FOUNDATION.representatives[0], user_email="Prezes@Example.org")
        board = replace(FOUNDATION, representatives=(first, *FOUNDATION.representatives[1:]))
        with patch("finance.foundation.FOUNDATION", board):
            self.assertEqual(signatory_for("Stage Name", "prezes@example.org").name, "Anna Marcisz")

    def test_a_lone_first_name_is_nobody_in_particular(self) -> None:
        self.assertEqual(signatory_for("Florentyn").name, "Florentyn de Bazelaire de Boucheporn")

    def test_a_board_made_only_of_the_payee_refuses(self) -> None:
        board = replace(FOUNDATION, representatives=(Representative(name="Anna Marcisz", function="Prezes"),))
        with patch("finance.foundation.FOUNDATION", board), self.assertRaises(FoundationIdentityError):
            signatory_for("Anna Marcisz")

    def test_no_privacy_contact_no_document(self) -> None:
        blank = replace(FOUNDATION, privacy_contact=" ")
        with patch("finance.foundation.FOUNDATION", blank), self.assertRaises(FoundationIdentityError):
            foundation_context(payee_name="Anna Nowak")


class DocumentRenderTests(TestCase):
    """Each template through the real renderer, from a contract issued by the
    real service. Only the PDF engine is out of the picture."""

    def setUp(self) -> None:
        self.manager = make_user()
        self.project = make_project(days=30, title="Lux Aeterna")

    def issue(self, item: CostItem) -> Contract:
        return ContractService.issue(item, actor=self.manager)

    def dzielo(self, amount: str = "1500", **seat: Any) -> Contract:
        return self.issue(price(self.project, participation=make_seat(self.project, **seat), amount=amount))

    def assert_typography_is_intact(self, html: str) -> None:
        # A stack whose quotes were escaped is a stack the renderer drops,
        # silently, for the host's default serif.
        self.assertNotIn("&quot;", html)
        self.assertIn('font-family: "IBM Plex Sans"', html)
        self.assertIn('font-family: "Cormorant Garamond"', html)
        self.assertEqual(html.count("@font-face"), _BUNDLED_FACES)
        self.assertIn("file://", html)
        self.assertNotIn("googleapis", html)

    def assert_parties_are_real(self, html: str) -> None:
        self.assertIn(f"KRS {FOUNDATION.krs}", html)
        self.assertIn(f"NIP {FOUNDATION.nip}", html)
        self.assertIn(f"REGON {FOUNDATION.regon}", html)
        self.assertIn(FOUNDATION.address, html)
        self.assertIn(FOUNDATION.privacy_contact, html)
        self.assertNotIn("Przykładowa", html)

    def test_umowa_o_dzielo_renders_from_its_row(self) -> None:
        contract = self.dzielo("1500", first_name="Zażółć", last_name="Gęślą")
        html = render_contract_html(contract)

        self.assert_typography_is_intact(html)
        self.assert_parties_are_real(html)
        self.assertIn(f"UMOWA O DZIEŁO <span class=\"title-number\">nr {contract.number}</span>", html)
        self.assertIn("Zażółć Gęślą", html)
        self.assertIn(f"1{NBSP}500,00 zł brutto", html)
        self.assertIn("(słownie: tysiąc pięćset złotych zero groszy)", html)
        self.assertIn(f"reprezentowana przez: Florentyn de Bazelaire de Boucheporn {EN_DASH} Prezes Zarządu", html)
        self.assertIn("partii wokalnych (głos: ", html)
        self.assertIn('<div class="annex-title">Partie Wykonawcy</div>', html)
        self.assertIn('<div class="annex-title">Protokół odbioru Dzieła</div>', html)
        self.assertIn("Załącznik nr 3 do umowy o dzieło", html)
        self.assertIn("Klauzula informacyjna", html)
        self.assertNotIn("Program Koncertu", html)

    def test_a_crew_mandate_keeps_its_clause_and_leaves_the_declaration_to_the_office(self) -> None:
        crew = make_crew(self.project, "Jan", "Dźwiękowiec", specialty=Collaborator.Specialty.SOUND)
        crew.role_description = "Realizacja dźwięku"
        crew.save()
        contract = self.issue(price(self.project, crew=crew, amount="800"))
        html = render_contract_html(contract)

        self.assert_typography_is_intact(html)
        self.assert_parties_are_real(html)
        self.assertIn(f"UMOWA ZLECENIA <span class=\"title-number\">nr {contract.number}</span>", html)
        self.assertIn("czynności: <strong>Realizacja dźwięku</strong>", html)
        self.assertIn("(słownie: osiemset złotych zero groszy)", html)
        self.assertIn("Rezultaty i wizerunek", html)
        self.assertNotIn("art. 85 i 86", html)
        self.assertNotIn("Partie Zleceniobiorcy", html)
        self.assertIn("oświadczenie do celów ubezpieczeń na formularzu biura rachunkowego", html)
        self.assertNotIn("Oświadczenie Zleceniobiorcy do celów ubezpieczeń i podatku", html)
        self.assertIn("Załącznik nr 1 do umowy zlecenia", html)
        self.assertNotIn("Załącznik nr 2 do umowy zlecenia", html)
        self.assertIn("Ewidencja czasu wykonywania umowy zlecenia", html)
        self.assertIn('class="grid hours hours--month"', html)

    def test_volunteer_agreement_has_no_payment_lines(self) -> None:
        contract = self.issue(price(self.project, participation=make_seat(self.project), amount="0"))
        html = render_contract_html(contract)

        self.assert_typography_is_intact(html)
        self.assert_parties_are_real(html)
        self.assertIn("POROZUMIENIE O WYKONYWANIU ŚWIADCZEŃ WOLONTARIUSZA", html)
        self.assertIn("zwany/-a dalej „Wolontariuszem”", html)
        self.assertNotIn("PESEL", html.split("Klauzula informacyjna")[0])
        self.assertNotIn("numer rachunku bankowego", html)
        self.assertIn("Karta świadczeń wolontariusza", html)

    def test_the_paper_prints_the_frozen_amount_not_the_live_item(self) -> None:
        contract = self.dzielo("1500")
        # Behind the service's back: the row the paper is rendered from must win.
        CostItem.objects.filter(pk=contract.cost_item_id).update(contract_amount=Decimal("2750"))

        html = render_contract_html(contract)

        self.assertIn(f"1{NBSP}500,00 zł brutto", html)
        self.assertNotIn("2750", html)
        self.assertNotIn(f"2{NBSP}750", html)

    def test_the_bill_prints_the_gross_and_leaves_the_tax_to_the_office(self) -> None:
        contract = self.dzielo("300")
        html = render_bill_html(contract)

        self.assert_typography_is_intact(html)
        self.assertIn(f"do umowy nr {contract.number}", html)
        self.assertIn("Za wykonanie dzieła", html)
        self.assertIn("300,00 zł brutto", html)
        self.assertIn("(słownie: trzysta złotych zero groszy)", html)
        self.assertIn("Wypełnia Zamawiający / biuro rachunkowe", html)
        self.assertIn(f"NIP {FOUNDATION.nip}", html)

    def test_a_mandate_bill_speaks_of_a_mandate(self) -> None:
        contract = self.issue(price(self.project, crew=make_crew(self.project), amount="800"))
        html = render_bill_html(contract)
        self.assertIn("Za wykonanie zlecenia", html)
        self.assertIn("Wypełnia Zleceniodawca / biuro rachunkowe", html)

    def test_the_bill_names_the_source_paying_it(self) -> None:
        contract = self.dzielo("300")
        self.assertIn('Źródło finansowania (opis dokumentu): <span class="blank', render_bill_html(contract))

        source = FundingService.create_source(
            FundingSourceDTO.model_validate({"kind": "PUBLIC_GRANT", "name": "Mecenat Małopolski",
                                             "agreement_number": "KL/5/2026"}),
            actor=None,
        )
        funding = FundingService.add_funding(
            self.project, ProjectFundingDTO.model_validate({"source": str(source.pk), "planned_amount": "300"}),
            actor=None,
        )
        FundingService.set_cost_allocations(
            contract.cost_item,
            AllocationSetDTO.model_validate({"allocations": [{"funding": str(funding.pk), "amount": "300"}]}),
            actor=None,
        )

        html = render_bill_html(contract)
        self.assertIn("Mecenat Małopolski", html)
        self.assertIn("KL/5/2026", html)

    def test_volunteer_work_has_no_bill(self) -> None:
        contract = self.issue(price(self.project, participation=make_seat(self.project), amount="0"))
        with self.assertRaises(BillNotApplicable):
            render_bill_html(contract)

    def test_an_annulled_contract_is_not_printed_again(self) -> None:
        contract = self.dzielo()
        ContractService.annul(contract, reason="Wrong amount", actor=make_user(staff=True))
        with self.assertRaises(ContractAnnulled):
            render_contract_html(contract)
        with self.assertRaises(ContractAnnulled):
            render_bill_html(contract)

    def test_a_missing_privacy_contact_refuses_to_render(self) -> None:
        contract = self.dzielo()
        blank = replace(FOUNDATION, privacy_contact="")
        with patch("finance.foundation.FOUNDATION", blank), self.assertRaises(FoundationIdentityError):
            render_contract_html(contract)

    def test_the_programme_annex_lists_the_items_in_concert_order(self) -> None:
        bach = Composer.objects.create(first_name="Johann Sebastian", last_name="Bach")
        pieces = [Piece.objects.create(title=title, composer=bach) for title in ("Kyrie", "Gloria", "Credo")]
        encore = Piece.objects.create(title="Ave verum")
        # Created out of order: the annex follows `order`, not insertion.
        ProgramItem.objects.create(project=self.project, piece=pieces[2], order=3)
        ProgramItem.objects.create(project=self.project, piece=pieces[0], order=1)
        ProgramItem.objects.create(project=self.project, piece=encore, order=4, is_encore=True)
        ProgramItem.objects.create(project=self.project, piece=pieces[1], order=2)

        seat = make_seat(self.project, "Florent", "de Bazelaire", voice_type=VoiceType.CONDUCTOR)
        html = render_contract_html(self.issue(price(self.project, participation=seat, amount="2000")))
        annex = html.split("Program Koncertu", 1)[1]

        positions = [annex.index(title) for title in ("Kyrie", "Gloria", "Credo", "Ave verum")]
        self.assertEqual(positions, sorted(positions))
        self.assertIn("Johann Sebastian Bach</span> — Kyrie", annex)
        self.assertIn("Ave verum <span class=\"programme-note\">(bis)</span>", annex)

    def test_an_empty_programme_leaves_lines_to_write_it_in(self) -> None:
        self.assertIn('class="blank-row"', render_contract_html(self.dzielo()))
        seat = make_seat(self.project, "Florent", "de Bazelaire", voice_type=VoiceType.CONDUCTOR)
        conductor = render_contract_html(self.issue(price(self.project, participation=seat, amount="2000")))
        self.assertIn("programme-blank", conductor)

    def test_a_player_contracts_an_instrumental_part(self) -> None:
        seat = make_seat(self.project, "Jan", "Organista", voice_type=VoiceType.INSTRUMENTALIST)
        seat.artist.instrument = "Organy"
        seat.artist.save()
        html = render_contract_html(self.issue(price(self.project, participation=seat, amount="900")))

        self.assertIn("partii instrumentalnych (instrument: Organy)", html)
        self.assertNotIn("partii wokalnych", html)

    def test_the_conductor_is_paid_under_the_signature_of_another_board_member(self) -> None:
        seat = make_seat(self.project, "Florent", "de Bazelaire", voice_type=VoiceType.CONDUCTOR)
        html = render_contract_html(self.issue(price(self.project, participation=seat, amount="2000")))

        self.assertIn(f"reprezentowana przez: Anna Marcisz {EN_DASH} Wiceprezes Zarządu", html)
        self.assertNotIn("reprezentowana przez: Florentyn", html)
        self.assertIn("artystycznego wykonania (rola: ", html)
        self.assertIn("Program Koncertu", html)
        self.assertNotIn("Partie Wykonawcy", html)

    def test_the_place_is_printed_after_a_colon(self) -> None:
        venue = Location.objects.create(
            name="Bazylika Mariacka", category=LocationCategory.CHURCH,
            formatted_address="plac Mariacki 5, 31-042 Kraków, Polska",
        )
        Project.objects.filter(pk=self.project.pk).update(location=venue)

        html = render_contract_html(self.dzielo())

        self.assertIn("w miejscu: Bazylika Mariacka, plac Mariacki 5, 31-042 Kraków (dalej: „Koncert”)", html)

    def test_a_short_engagement_carries_the_insurance_duty(self) -> None:
        contract = self.issue(price(self.project, participation=make_seat(self.project), amount="0"))
        html = render_contract_html(contract)
        self.assertIn("ubezpieczenie od następstw nieszczęśliwych wypadków", html)

    def test_a_long_engagement_does_not(self) -> None:
        Rehearsal.objects.create(
            project=self.project, date_time=self.project.date_time - timedelta(days=45), timezone="Europe/Warsaw",
        )
        contract = self.issue(price(self.project, participation=make_seat(self.project), amount="0"))
        html = render_contract_html(contract)

        self.assertNotIn("ubezpieczenie od następstw nieszczęśliwych wypadków", html)
        self.assertIn("w okresie od ", html)

    def test_the_volunteer_valuation_is_printed_when_known(self) -> None:
        item = price(
            self.project, participation=make_seat(self.project), amount="0",
            in_kind_hours="12", in_kind_hourly_rate="35",
        )
        html = render_contract_html(self.issue(item))
        self.assertIn("wartość świadczeń Wolontariusza na 35,00 zł za godzinę", html)



class PerformerContractTests(TestCase):
    """A cast performer's contract names their parts piece by piece, and an
    umowa zlecenia carries the rehearsal days they attended."""

    def setUp(self) -> None:
        self.manager = make_user()
        # Sunday 11 October 2026, 13:30 in Warsaw.
        self.project = Project.objects.create(
            title="Pochwała Stworzenia", date_time=datetime(2026, 10, 11, 11, 30, tzinfo=UTC),
            status=Project.Status.ACTIVE,
        )
        composer = Composer.objects.create(first_name="Marian", last_name="Borkowski")
        titles = ("Gloria II", "Lumen", "Méditation", "Stars", "What a Wonderful World")
        self.pieces = {title: Piece.objects.create(title=title, composer=composer) for title in titles}
        # Created out of order: the annex follows `order`, not insertion.
        for order, title in reversed(list(enumerate(titles, start=1))):
            ProgramItem.objects.create(
                project=self.project, piece=self.pieces[title], order=order, is_encore=order == len(titles),
            )
        self.seat = make_seat(self.project, "Maria", "Kowalska")
        self.second_soprano = make_seat(self.project, "Ewa", "Nowak")
        self.alto = make_seat(self.project, "Ola", "Alt", voice_type=VoiceType.ALTO)
        self.organist = make_seat(self.project, "Jan", "Organista", voice_type=VoiceType.INSTRUMENTALIST)

    def cast(self, seat: Participation, title: str, line: str) -> None:
        ProjectPieceCasting.objects.create(participation=seat, piece=self.pieces[title], voice_line=line)

    def cast_the_choir(self) -> None:
        self.cast(self.seat, "Gloria II", "S1")
        self.cast(self.second_soprano, "Gloria II", "S2")
        self.cast(self.alto, "Gloria II", "A1")
        self.cast(self.seat, "Lumen", "S1")
        self.cast(self.alto, "Lumen", "A1")
        self.cast(self.organist, "Méditation", "ACC")
        self.cast(self.seat, "Stars", "S2")
        self.cast(self.second_soprano, "Stars", "S1")
        self.cast(self.seat, "What a Wonderful World", "S1")

    def issue(self, item: CostItem) -> Contract:
        return ContractService.issue(item, actor=self.manager)

    def rehearsal(self, day: int, month: int = 9, minutes: int | None = 150, **extra: Any) -> Rehearsal:
        return Rehearsal.objects.create(
            project=self.project, date_time=datetime(2026, month, day, 16, 30, tzinfo=UTC),
            timezone="Europe/Warsaw", duration_minutes=minutes, **extra,
        )

    def attend(self, rehearsal: Rehearsal, status: str, minutes_late: int | None = None) -> None:
        Attendance.objects.create(
            rehearsal=rehearsal, participation=self.seat, status=status, minutes_late=minutes_late,
        )

    def test_parts_follow_the_concert_order_and_skip_the_works_the_person_is_not_in(self) -> None:
        self.cast_the_choir()
        parts = performer_parts(self.project, self.seat)
        self.assertEqual(
            [(part.title, part.line, part.is_encore) for part in parts],
            [
                ("Gloria II", "Sopran 1", False),
                # One soprano line in this piece: the plain name, as the app shows it.
                ("Lumen", "Sopran", False),
                ("Stars", "Sopran 2", False),
                ("What a Wonderful World", "Sopran", True),
            ],
        )
        self.assertEqual(parts[0].composer, "Marian Borkowski")

    def test_a_named_solo_prints_with_its_score_reference(self) -> None:
        self.cast_the_choir()
        ProjectSoloAssignment.objects.create(
            project=self.project, piece=self.pieces["Stars"], position=1, participation=self.seat,
            label="Sopran solo", score_reference="t. 46-52,\n nad chórem",
        )
        # A solo in a work the person has no line in still puts that work on the list.
        ProjectSoloAssignment.objects.create(
            project=self.project, piece=self.pieces["Méditation"], position=1, participation=self.seat,
            label="Wokaliza",
        )
        ProjectSoloAssignment.objects.create(
            project=self.project, piece=self.pieces["Stars"], position=2, participation=self.second_soprano,
            label="Sopran solo II",
        )
        parts = {part.title: part for part in performer_parts(self.project, self.seat)}

        self.assertEqual(parts["Stars"].solos, (Solo(label="Sopran solo", score_reference="t. 46-52, nad chórem"),))
        self.assertEqual((parts["Méditation"].line, parts["Méditation"].solos), ("", (Solo("Wokaliza", ""),)))

        html = render_contract_html(self.issue(price(self.project, participation=self.seat, amount="1400")))
        self.assertIn('<div class="parts-solo">Sopran solo (t. 46-52, nad chórem)</div>', html)
        self.assertNotIn("Sopran solo II", html)

    def test_somebody_not_cast_yet_gets_the_whole_programme_to_fill_in(self) -> None:
        parts = performer_parts(self.project, self.seat)
        self.assertEqual(len(parts), 5)
        self.assertTrue(all(part.line == "" and part.solos == () for part in parts))

    def test_the_dzielo_names_the_parts_and_is_accepted_on_a_record(self) -> None:
        self.cast_the_choir()
        html = render_contract_html(self.issue(price(self.project, participation=self.seat, amount="1400")))
        annex = html.split('<div class="annex-title">Partie Wykonawcy</div>', 1)[1]

        self.assertIn("wskazanych w Załączniku nr 1 (dalej: „Partie Wykonawcy”) podczas koncertu", html)
        self.assertIn("nie zależy od liczby prób", html)
        self.assertLess(annex.index("Gloria II"), annex.index("Stars"))
        self.assertNotIn("Méditation", annex)
        self.assertIn('What a Wonderful World <span class="programme-note">(bis)</span>', annex)
        self.assertIn("Protokół odbioru Dzieła", annex)

    def test_a_performers_mandate_transfers_the_rights_and_lists_the_parts(self) -> None:
        self.cast_the_choir()
        self.rehearsal(18)
        html = render_contract_html(
            self.issue(price(self.project, participation=self.seat, amount="1500", form="ZLECENIE")),
        )

        self.assertIn("w tym na udziale w próbach zespołowych", html)
        self.assertIn("w okresie od 18.09.2026 r. do 11.10.2026 r.", html)
        self.assertIn("art. 86 ust. 1 pkt 2", html)
        self.assertNotIn("Rezultaty i wizerunek", html)
        self.assertIn('<div class="annex-title">Partie Zleceniobiorcy</div>', html)
        self.assertIn("Załącznik nr 2 do umowy zlecenia", html)
        self.assertIn("Ewidencja czasu wykonywania umowy zlecenia", html)
        self.assertNotIn('class="grid hours hours--month"', html)

    def test_a_player_outside_the_cast_keeps_the_programme(self) -> None:
        crew = make_crew(self.project, "Piotr", "Organista", specialty=Collaborator.Specialty.INSTRUMENT)
        html = render_contract_html(self.issue(price(self.project, crew=crew, amount="600", form="DZIELO")))
        self.assertIn('<div class="annex-title">Program Koncertu</div>', html)
        self.assertNotIn("Partie Wykonawcy", html)

    def test_the_hours_record_lists_attended_days_and_leaves_out_absences(self) -> None:
        self.attend(self.rehearsal(18), Attendance.Status.PRESENT)
        self.rehearsal(20, is_mandatory=False)
        self.attend(self.rehearsal(23), Attendance.Status.ABSENT)
        self.attend(self.rehearsal(24), Attendance.Status.EXCUSED)
        self.attend(self.rehearsal(26, minutes=165), Attendance.Status.LATE, minutes_late=15)
        # A sectional of the men does not call a soprano.
        self.rehearsal(27, minutes=90, called_sections="TB")
        # Ahead, or nobody took the register: a row for the pen.
        self.rehearsal(1, month=10)

        sheets = hours_record(self.project, self.seat, Period(date(2026, 9, 1), date(2026, 10, 11)))

        self.assertEqual([(sheet.month, sheet.year) for sheet in sheets], [("wrzesień", 2026), ("październik", 2026)])
        september, october = sheets
        self.assertEqual([(row.day.day, row.hours) for row in september.rows], [(18, "2:30"), (26, "2:30")])
        self.assertEqual(september.total, "5:00")
        # The concert day is always there with its hours left to the pen, so the sum is too.
        self.assertEqual([(row.day.day, row.hours) for row in october.rows], [(1, ""), (11, "")])
        self.assertEqual(october.total, "")

    def test_the_hours_record_keeps_to_the_contracts_period(self) -> None:
        self.attend(self.rehearsal(18), Attendance.Status.PRESENT)
        self.attend(self.rehearsal(30, minutes=165), Attendance.Status.PRESENT)

        sheets = hours_record(self.project, self.seat, Period(date(2026, 9, 25), date(2026, 10, 11)))

        self.assertEqual([(row.day.day, row.hours) for row in sheets[0].rows], [(30, "2:45")])

    def test_crew_get_the_concerts_whole_month(self) -> None:
        (sheet,) = hours_record(self.project, None, None)
        self.assertEqual((sheet.month, len(sheet.rows), sheet.full_month), ("październik", 31, True))
        self.assertTrue(all(row.hours == "" for row in sheet.rows))

    def test_declared_divisi_keeps_the_number_when_the_other_line_is_vacant(self) -> None:
        self.cast(self.seat, "Gloria II", "S1")
        for code in ("S1", "S2"):
            PieceVoiceRequirement.objects.create(piece=self.pieces["Gloria II"], voice_line=code, quantity=1)
        self.assertEqual(performer_parts(self.project, self.seat)[0].line, "Sopran 1")

    def test_repeated_work_uses_each_programme_items_edition(self) -> None:
        piece = self.pieces["Gloria II"]
        self.cast(self.seat, "Gloria II", "S1")
        unison = ScoreEdition.objects.create(
            piece=piece, original_filename="unison.pdf", pdf_file="score_editions/unison.pdf", sha256="a" * 64,
        )
        divided = ScoreEdition.objects.create(
            piece=piece, original_filename="divided.pdf", pdf_file="score_editions/divided.pdf", sha256="b" * 64,
        )
        for edition, codes in ((unison, ("S1",)), (divided, ("S1", "S2"))):
            for code in codes:
                PieceVoiceRequirement.objects.create(piece=piece, edition=edition, voice_line=code, quantity=1)
        ProgramItem.objects.filter(project=self.project, piece=piece).update(score_edition=unison)
        ProgramItem.objects.create(project=self.project, piece=piece, score_edition=divided, order=6, is_encore=True)
        self.assertEqual(
            [(part.line, part.is_encore) for part in performer_parts(self.project, self.seat)],
            [("Sopran", False), ("Sopran 1", True)],
        )

    def test_deleted_casting_does_not_widen_the_part_label(self) -> None:
        self.cast(self.seat, "Gloria II", "S1")
        self.cast(self.second_soprano, "Gloria II", "S2")
        Participation.objects.filter(pk=self.second_soprano.pk).update(is_deleted=True)
        self.assertEqual(performer_parts(self.project, self.seat)[0].line, "Sopran")

    def test_deleted_seat_does_not_retain_a_solo(self) -> None:
        ProjectSoloAssignment.objects.create(
            project=self.project, piece=self.pieces["Stars"], position=1, participation=self.seat, label="Solo",
        )
        Participation.objects.filter(pk=self.seat.pk).update(is_deleted=True)
        parts = performer_parts(self.project, self.seat)
        self.assertTrue(all(part.line == "" and part.solos == () for part in parts))

    def test_unknown_lateness_or_duration_leaves_hours_and_total_blank(self) -> None:
        self.attend(self.rehearsal(18), Attendance.Status.LATE)
        self.attend(self.rehearsal(19, minutes=None), Attendance.Status.PRESENT)
        sheet = hours_record(self.project, self.seat, None)[0]
        self.assertEqual([(row.day.day, row.hours) for row in sheet.rows], [(18, ""), (19, "")])
        self.assertEqual(sheet.total, "")

    def test_lateness_cannot_produce_negative_hours(self) -> None:
        self.attend(self.rehearsal(18, minutes=30), Attendance.Status.LATE, minutes_late=45)
        sheet = hours_record(self.project, self.seat, None)[0]
        self.assertEqual((sheet.rows[0].hours, sheet.total), ("0:00", "0:00"))

    def test_minutes_sum_exactly_across_days_and_rehearsals(self) -> None:
        for day in (18, 18, 19):
            self.attend(self.rehearsal(day, minutes=20), Attendance.Status.PRESENT)
        sheet = hours_record(self.project, self.seat, None)[0]
        self.assertEqual([(row.day.day, row.hours) for row in sheet.rows], [(18, "0:40"), (19, "0:20")])
        self.assertEqual(sheet.total, "1:00")

    def test_a_rehearsal_on_concert_day_does_not_claim_the_whole_days_hours(self) -> None:
        self.attend(self.rehearsal(11, month=10, minutes=90), Attendance.Status.PRESENT)
        (sheet,) = hours_record(self.project, self.seat, None)
        self.assertEqual([(row.day.day, row.hours) for row in sheet.rows], [(11, "")])
        self.assertEqual(sheet.total, "")

    def test_explicit_invites_override_sections_and_instrumentalist_flag(self) -> None:
        invited = self.rehearsal(18, called_sections="TB")
        invited.invited_participations.add(self.seat, self.organist)
        excluded = self.rehearsal(19)
        excluded.invited_participations.add(self.second_soprano)
        for seat in (self.seat, self.organist):
            with self.subTest(seat=seat.pk):
                sheet = hours_record(self.project, seat, None)[0]
                self.assertEqual([(row.day.day, row.hours) for row in sheet.rows], [(18, "")])

    def test_instrumentalist_only_gets_called_rehearsals_or_recorded_attendance(self) -> None:
        self.rehearsal(18)
        self.rehearsal(19, calls_instrumentalists=True)
        attended = self.rehearsal(20, is_mandatory=False)
        Attendance.objects.create(rehearsal=attended, participation=self.organist, status=Attendance.Status.PRESENT)
        sheet = hours_record(self.project, self.organist, None)[0]
        self.assertEqual([(row.day.day, row.hours) for row in sheet.rows], [(19, ""), (20, "2:30")])

    def test_period_keeps_a_first_rehearsal_in_its_own_local_date(self) -> None:
        rehearsal = Rehearsal.objects.create(
            project=self.project, date_time=datetime(2026, 9, 19, 3, 30, tzinfo=UTC),
            timezone="America/New_York", duration_minutes=90,
        )
        self.attend(rehearsal, Attendance.Status.PRESENT)
        html = render_contract_html(self.issue(price(self.project, participation=self.seat, amount="500", form="ZLECENIE")))
        self.assertIn("w okresie od 18.09.2026 r. do 11.10.2026 r.", html)
        self.assertIn('>18</td><td class="figure">1:30</td>', html)

    def test_the_period_opens_on_the_persons_own_first_rehearsal(self) -> None:
        # The choir starts in September; the organist is called to the dress rehearsal alone.
        self.rehearsal(18)
        self.rehearsal(8, month=10, calls_instrumentalists=True)
        html = render_contract_html(
            self.issue(price(self.project, participation=self.organist, amount="600", form="ZLECENIE")),
        )
        self.assertIn("w okresie od 08.10.2026 r. do 11.10.2026 r.", html)
        self.assertNotIn(">18</td>", html)

    def test_a_signed_contract_reprints_the_paper_not_the_changed_cast(self) -> None:
        self.cast_the_choir()
        contract = self.issue(price(self.project, participation=self.seat, amount="1400"))
        signed_on = finance_today()
        ContractService.sign(contract, SignContractDTO(signed_on=signed_on - timedelta(days=1)), actor=self.manager)
        signed = render_contract_html(contract)

        ProjectPieceCasting.objects.filter(participation=self.seat, piece=self.pieces["Stars"]).delete()
        self.cast(self.seat, "Méditation", "S1")
        # A later correction of the date or the copy's place keeps the frozen text.
        ContractService.sign(contract, SignContractDTO(signed_on=signed_on), actor=self.manager)
        reprint = render_contract_html(contract)

        self.assertEqual(reprint, signed)
        annex = reprint.split('<div class="annex-title">Partie Wykonawcy</div>', 1)[1]
        self.assertIn("Stars", annex)
        self.assertNotIn("Méditation", annex)
        # The snapshot keeps the text; the font rules are this host's and come back at print.
        self.assertEqual(reprint.count("@font-face"), _BUNDLED_FACES)

    def test_an_unsigned_contract_follows_the_cast(self) -> None:
        self.cast_the_choir()
        contract = self.issue(price(self.project, participation=self.seat, amount="1400"))
        self.cast(self.seat, "Méditation", "S1")
        annex = render_contract_html(contract).split('<div class="annex-title">Partie Wykonawcy</div>', 1)[1]
        self.assertIn("Méditation", annex)

    def test_hours_sheets_keep_the_year_when_the_period_crosses_new_year(self) -> None:
        self.project.date_time = datetime(2027, 1, 2, 12, tzinfo=UTC)
        self.project.save(update_fields=["date_time"])
        self.attend(self.rehearsal(31, month=12, minutes=60), Attendance.Status.PRESENT)
        sheets = hours_record(self.project, self.seat, Period(date(2026, 12, 31), date(2027, 1, 2)))
        self.assertEqual([(sheet.month, sheet.year) for sheet in sheets], [("grudzień", 2026), ("styczeń", 2027)])

    def test_conductor_mandate_has_programme_and_performance_rights(self) -> None:
        conductor = make_seat(self.project, "Adam", "Dyrygent", voice_type=VoiceType.CONDUCTOR)
        html = render_contract_html(self.issue(price(self.project, participation=conductor, amount="500", form="ZLECENIE")))
        self.assertIn("dyrygowaniu artystycznym wykonaniem", html)
        self.assertIn('<div class="annex-title">Program Koncertu</div>', html)
        self.assertIn("Załącznik nr 2 do umowy zlecenia", html)
        self.assertIn("art. 86 ust. 1 pkt 2", html)
        self.assertNotIn("Partie Zleceniobiorcy", html)
        self.assertNotIn("Rezultaty i wizerunek", html)

    def test_non_performing_crew_cannot_print_an_artistic_deed_but_can_print_its_bill(self) -> None:
        crew = make_crew(self.project, "Piotr", "Fotograf", specialty=Collaborator.Specialty.VISUALS)
        contract = self.issue(price(self.project, crew=crew, amount="600", form="ZLECENIE"))
        # A legacy row issued before template eligibility was enforced.
        Contract.objects.filter(pk=contract.pk).update(form=FeeForm.DZIELO)
        with self.assertRaises(ContractRefused):
            render_contract_html(contract)
        self.assertIn(contract.number, render_bill_html(contract))

    def test_outside_cast_instrumentalist_gets_artistic_mandate_and_blank_hours(self) -> None:
        crew = make_crew(self.project, "Jan", "Organista", specialty=Collaborator.Specialty.INSTRUMENT)
        html = render_contract_html(self.issue(price(self.project, crew=crew, amount="600", form="ZLECENIE")))
        self.assertIn("artystycznym wykonaniu partii instrumentalnych", html)
        self.assertIn("art. 86 ust. 1 pkt 2", html)
        self.assertIn('<div class="annex-title">Program Koncertu</div>', html)
        self.assertIn("Załącznik nr 2 do umowy zlecenia", html)
        self.assertIn("godz:min", html)
        # The app knows none of this player's days, so the period's start is the pen's.
        self.assertIn('w okresie od <span class="blank blank--s"></span> r. do 11.10.2026 r.', html)
        self.assertTrue(all(row.hours == "" for row in hours_record(self.project, None, None)[0].rows))
        self.assertNotIn("Partie Zleceniobiorcy", html)
        self.assertNotIn("Rezultaty i wizerunek", html)

    def test_missing_leader_hours_follow_delegation_not_singer_invitations(self) -> None:
        conductor = make_seat(self.project, "Adam", "Dyrygent", voice_type=VoiceType.CONDUCTOR)
        self.project.conductor = conductor.artist
        self.project.save(update_fields=["conductor"])
        sectional = self.rehearsal(18, called_sections="TB", is_mandatory=False)
        sectional.invited_participations.add(self.alto)
        self.rehearsal(19, led_by=self.alto.artist)
        absent = self.rehearsal(20)
        Attendance.objects.create(rehearsal=absent, participation=conductor, status=Attendance.Status.ABSENT)
        attended = self.rehearsal(21, called_sections="SA", is_mandatory=False, led_by=self.alto.artist)
        Attendance.objects.create(rehearsal=attended, participation=conductor, status=Attendance.Status.PRESENT)
        sheet = hours_record(self.project, conductor, None)[0]
        self.assertEqual([(row.day.day, row.hours) for row in sheet.rows], [(18, ""), (21, "2:30")])
        self.assertEqual(sheet.total, "")

    def test_part_labels_stay_polish_under_a_foreign_ui_language(self) -> None:
        self.cast(self.seat, "Gloria II", "VP")
        with translation.override("fr"):
            parts = performer_parts(self.project, self.seat)
        self.assertEqual(parts[0].line, "Perkusja wokalna / Beatbox")


def _streamed(response: Any) -> bytes:
    """The body of a FileResponse, which streams rather than holding `content`."""
    return b"".join(response.streaming_content)


def _html_as_pdf(html: str, base_url: str | None = None) -> bytes:
    """Stands in for WeasyPrint: the 'PDF' is the HTML, so the ZIP can be read."""
    return html.encode("utf-8")


class DocumentEndpointTests(APITestCase):
    def setUp(self) -> None:
        self.manager = make_user()
        self.project = make_project(title="Lux Aeterna")
        self.client.force_authenticate(self.manager)
        seat = make_seat(self.project, "Ada", "Lovelace")
        self.contract = ContractService.issue(price(self.project, participation=seat, amount="1500"), actor=None)

    def get(self, path: str) -> Any:
        return self.client.get(f"/api/finance/{path}")

    @patch("finance.infrastructure.documents._render_pdf", return_value=b"%PDF-contract")
    def test_the_contract_pdf_downloads(self, _render: MagicMock) -> None:
        response = self.get(f"contracts/{self.contract.pk}/pdf/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertIn("Umowa-UoD-1-", response["Content-Disposition"])
        self.assertEqual(_streamed(response), b"%PDF-contract")

    @patch("finance.infrastructure.documents._render_pdf", return_value=b"%PDF-bill")
    def test_the_bill_downloads(self, _render: MagicMock) -> None:
        response = self.get(f"contracts/{self.contract.pk}/bill.pdf")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Rachunek-UoD-1-", response["Content-Disposition"])

    def test_a_volunteer_bill_is_refused(self) -> None:
        volunteer = ContractService.issue(
            price(self.project, participation=make_seat(self.project, "Bo", "Wolny"), amount="0"), actor=None,
        )
        response = self.get(f"contracts/{volunteer.pk}/bill.pdf")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "bill_not_applicable")

    def test_an_annulled_contract_is_refused(self) -> None:
        ContractService.annul(self.contract, reason="Wrong payee", actor=None)
        response = self.get(f"contracts/{self.contract.pk}/pdf/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "contract_annulled")

    @patch("finance.infrastructure.documents._render_pdf", side_effect=DocumentRenderDependencyError("no libs"))
    def test_a_missing_renderer_is_a_503(self, _render: MagicMock) -> None:
        response = self.get(f"contracts/{self.contract.pk}/pdf/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error_code"], "pdf_renderer_unavailable")

    def test_a_member_gets_nothing(self) -> None:
        self.client.force_authenticate(make_user(role=AppRole.ARTIST))
        self.assertEqual(self.get(f"contracts/{self.contract.pk}/pdf/").status_code, 403)
        self.assertEqual(self.get(f"contracts/{self.contract.pk}/bill.pdf").status_code, 403)


class ContractsZipTests(APITestCase):
    """The ZIP packs the live contracts, each rendered from its row."""

    def setUp(self) -> None:
        self.media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)
        media = override_settings(MEDIA_ROOT=self.media)
        media.enable()
        self.addCleanup(media.disable)
        render = patch("finance.infrastructure.documents._render_pdf", side_effect=_html_as_pdf)
        render.start()
        self.addCleanup(render.stop)

        self.manager = make_user()
        self.project = make_project(title="Lux Aeterna")
        self.client.force_authenticate(self.manager)

    def contract(self, amount: str, last_name: str) -> Contract:
        seat = make_seat(self.project, "Anna", last_name)
        return ContractService.issue(price(self.project, participation=seat, amount=amount), actor=None)

    def run_task(self) -> Any:
        return generate_contracts_zip_task.apply(args=[str(self.project.pk)])

    def archive(self, task_id: str) -> zipfile.ZipFile:
        with default_storage.open(export_path(str(self.project.pk), task_id), "rb") as handle:
            return zipfile.ZipFile(io.BytesIO(handle.read()))

    def test_it_packs_live_contracts_rendered_from_their_rows(self) -> None:
        kept = self.contract("1500", "Alfa")
        annulled = self.contract("700", "Beta")
        ContractService.annul(annulled, reason="Wrong payee", actor=None)
        signed = self.contract("0", "Gamma")
        # Priced but never issued: no paper to pack.
        price(self.project, participation=make_seat(self.project, "Anna", "Delta"), amount="400")

        result = self.run_task()

        self.assertEqual(result.result, {"project_id": str(self.project.pk), "count": 2})
        archive = self.archive(result.id)
        self.assertEqual(len(archive.namelist()), 2)
        contents = "".join(archive.read(name).decode("utf-8") for name in archive.namelist())
        self.assertIn(kept.number, contents)
        self.assertIn(signed.number, contents)
        self.assertNotIn(annulled.number, contents)
        self.assertIn(f"1{NBSP}500,00 zł brutto", contents)
        self.assertNotIn(f"4{NBSP}321", contents)

    def test_a_project_without_contracts_reports_so(self) -> None:
        result = self.run_task()
        self.assertEqual(result.result, {"project_id": str(self.project.pk), "error_code": NO_CONTRACTS})

    def test_an_inapplicable_template_refuses_the_zip_without_publishing_a_partial_file(self) -> None:
        self.contract("500", "Alfa")
        crew = make_crew(self.project, "Piotr", "Fotograf", specialty=Collaborator.Specialty.VISUALS)
        contract = ContractService.issue(price(self.project, crew=crew, amount="600", form="ZLECENIE"), actor=None)
        Contract.objects.filter(pk=contract.pk).update(form=FeeForm.DZIELO)
        result = self.run_task()
        self.assertEqual(result.result, {
            "project_id": str(self.project.pk), "error_code": "contract_refused", "contract_number": contract.number,
        })
        with patch("finance.views._zip_result", return_value=("SUCCESS", result.result)):
            response = self.client.get(f"/api/finance/contracts/zip/{result.id}/")
        self.assertEqual(response.data["contract_number"], contract.number)
        self.assertFalse(default_storage.exists(export_path(str(self.project.pk), result.id)))

    def test_a_new_archive_clears_stale_ones_and_leaves_one_being_downloaded(self) -> None:
        self.contract("1500", "Alfa")
        stale = self.run_task()
        stale_path = default_storage.path(export_path(str(self.project.pk), stale.id))
        an_hour_ago = (timezone.now() - EXPORT_TTL - timedelta(minutes=1)).timestamp()
        os.utime(stale_path, (an_hour_ago, an_hour_ago))
        fresh = self.run_task()

        latest = self.run_task()

        self.assertFalse(default_storage.exists(export_path(str(self.project.pk), stale.id)))
        # Another manager's archive, packed a moment ago, is still theirs to download.
        self.assertTrue(default_storage.exists(export_path(str(self.project.pk), fresh.id)))
        self.assertTrue(default_storage.exists(export_path(str(self.project.pk), latest.id)))

    @patch("finance.views.generate_contracts_zip_task")
    def test_the_request_enqueues_the_task(self, task: MagicMock) -> None:
        task.delay.return_value = MagicMock(id="task-1")
        response = self.client.post(f"/api/finance/projects/{self.project.pk}/contracts/zip/")

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data, {"task_id": "task-1"})
        task.delay.assert_called_once_with(str(self.project.pk))

    def test_status_then_file_through_the_manager_only_views(self) -> None:
        self.contract("1500", "Alfa")
        result = self.run_task()

        with patch("finance.views.AsyncResult", return_value=MagicMock(state="SUCCESS", result=result.result)):
            status_response = self.client.get(f"/api/finance/contracts/zip/{result.id}/")
            file_url = status_response.data["file_url"]
            file_response = self.client.get(file_url)
            self.client.force_authenticate(make_user(role=AppRole.ARTIST))
            refused = self.client.get(file_url)

        self.assertEqual(status_response.data["state"], "SUCCESS")
        self.assertEqual(status_response.data["count"], 1)
        self.assertEqual(file_url, f"/api/finance/contracts/zip/{result.id}/file/")
        self.assertEqual(file_response.status_code, 200)
        self.assertEqual(file_response["Content-Type"], "application/zip")
        self.assertIn("Umowy-Lux_Aeterna.zip", file_response["Content-Disposition"])
        self.assertEqual(len(zipfile.ZipFile(io.BytesIO(_streamed(file_response))).namelist()), 1)
        self.assertEqual(refused.status_code, 403)

    def test_nothing_to_pack_is_a_failure_with_its_code(self) -> None:
        result = self.run_task()
        with patch("finance.views.AsyncResult", return_value=MagicMock(state="SUCCESS", result=result.result)):
            status_response = self.client.get(f"/api/finance/contracts/zip/{result.id}/")
            file_response = self.client.get(f"/api/finance/contracts/zip/{result.id}/file/")

        self.assertEqual(status_response.data, {"state": "FAILURE", "error_code": NO_CONTRACTS})
        self.assertEqual(file_response.status_code, 404)

    def test_a_running_task_reports_its_state(self) -> None:
        with patch("finance.views.AsyncResult", return_value=MagicMock(state="PENDING", result=None)):
            response = self.client.get("/api/finance/contracts/zip/5c1f0b7e-8a55-4c55-9a53-2f4f0f7f9d10/")
        self.assertEqual(response.data, {"state": "PENDING"})


class SampleDocumentsCommandTests(TestCase):
    """The printed-check command writes one of each document and keeps nothing."""

    def test_every_document_and_not_a_row_or_a_number_left_behind(self) -> None:
        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        with (
            override_settings(MEDIA_ROOT=media),
            patch("finance.infrastructure.documents._render_pdf", side_effect=_html_as_pdf),
            patch("finance.infrastructure.reports._render_pdf", side_effect=_html_as_pdf),
            patch("django.utils.timezone.now", return_value=datetime(2030, 11, 2, 12, tzinfo=UTC)),
        ):
            call_command("finance_sample_documents", stdout=io.StringIO())

        folder = f"{media}/finance/samples"
        names = sorted(os.listdir(folder))
        self.assertEqual(len(names), 12)
        with open(f"{folder}/1-umowa-o-dzielo.pdf", encoding="utf-8") as handle:
            html = handle.read()
            self.assertIn("Sopran solo (t. 1-8)", html)
            self.assertIn("wystawiono 02.11.2030", html)
            self.assertIn("23.11.2030", html)
        with open(f"{folder}/2-umowa-o-dzielo-dyrygent.pdf", encoding="utf-8") as handle:
            self.assertIn(f"reprezentowana przez: Anna Marcisz {EN_DASH} Wiceprezes Zarządu", handle.read())
        with open(f"{folder}/3-umowa-zlecenia-wykonawca.pdf", encoding="utf-8") as handle:
            self.assertIn("Ewidencja czasu wykonywania umowy zlecenia", handle.read())
        with open(f"{folder}/9-sprawozdanie-dla-sponsora.pdf", encoding="utf-8") as handle:
            self.assertIn("Środki: Kancelaria Przykładowa", handle.read())
        self.assertFalse(Project.objects.exists())
        self.assertFalse(Contract.all_objects.exists())
        self.assertFalse(ContractSequence.objects.exists())
        self.assertFalse(FundingSource.objects.exists())
