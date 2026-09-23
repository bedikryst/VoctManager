"""
The foundation's documents: the amount in words, who signs for the
foundation, each template rendered from its contract row, the programme annex,
the PDF and bill endpoints, and the contracts ZIP.

WeasyPrint's native libraries are absent from the host, so nothing here renders
a PDF: the assertions run on the HTML handed to the renderer.
"""
import io
import os
import shutil
import tempfile
import zipfile
from dataclasses import replace
from datetime import timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock, patch

from django.core.files.storage import default_storage
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APITestCase

from archive.models import Composer, Piece
from core.constants import AppRole
from logistics.models import Location, LocationCategory
from roster.infrastructure.document_generator import DocumentRenderDependencyError
from roster.models import Collaborator, ProgramItem, Project, Rehearsal, VoiceType

from ..exceptions import BillNotApplicable, ContractAnnulled
from ..foundation import FOUNDATION, FoundationIdentityError, Representative, foundation_context, signatory_for
from ..infrastructure.amount_words import amount_to_words_pl, format_amount_pl, number_to_words_pl
from ..infrastructure.documents import render_bill_html, render_contract_html
from ..models import Contract, ContractSequence, CostItem
from ..services.contracts import ContractService
from ..tasks import NO_CONTRACTS, export_path, generate_contracts_zip_task
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
        self.assertIn("partii wokalnej (głos: ", html)
        self.assertIn("Program Koncertu", html)
        self.assertIn("Klauzula informacyjna", html)

    def test_umowa_zlecenia_renders_with_its_three_annexes(self) -> None:
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
        self.assertIn("Oświadczenie Zleceniobiorcy do celów ubezpieczeń i podatku", html)
        self.assertIn("Potwierdzenie liczby godzin wykonywania Zlecenia", html)
        self.assertIn("Załącznik nr 3 do umowy zlecenia", html)

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

        html = render_contract_html(self.dzielo())
        annex = html.split("Program Koncertu", 1)[1]

        positions = [annex.index(title) for title in ("Kyrie", "Gloria", "Credo", "Ave verum")]
        self.assertEqual(positions, sorted(positions))
        self.assertIn("Johann Sebastian Bach</span> — Kyrie", annex)
        self.assertIn("Ave verum <span class=\"programme-note\">(bis)</span>", annex)

    def test_an_empty_programme_leaves_lines_to_write_it_in(self) -> None:
        html = render_contract_html(self.dzielo())
        self.assertIn("programme-blank", html)

    def test_a_player_contracts_an_instrumental_part(self) -> None:
        seat = make_seat(self.project, "Jan", "Organista", voice_type=VoiceType.INSTRUMENTALIST)
        seat.artist.instrument = "Organy"
        seat.artist.save()
        html = render_contract_html(self.issue(price(self.project, participation=seat, amount="900")))

        self.assertIn("partii instrumentalnej (instrument: Organy)", html)
        self.assertNotIn("partii wokalnej", html)

    def test_the_conductor_is_paid_under_the_signature_of_another_board_member(self) -> None:
        seat = make_seat(self.project, "Florent", "de Bazelaire", voice_type=VoiceType.CONDUCTOR)
        html = render_contract_html(self.issue(price(self.project, participation=seat, amount="2000")))

        self.assertIn(f"reprezentowana przez: Anna Marcisz {EN_DASH} Wiceprezes Zarządu", html)
        self.assertNotIn("reprezentowana przez: Florentyn", html)
        self.assertIn("artystycznego wykonania (rola: ", html)

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

    def test_a_new_archive_replaces_the_last(self) -> None:
        self.contract("1500", "Alfa")
        first = self.run_task()
        second = self.run_task()

        self.assertFalse(default_storage.exists(export_path(str(self.project.pk), first.id)))
        self.assertTrue(default_storage.exists(export_path(str(self.project.pk), second.id)))

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

    def test_six_documents_and_not_a_row_or_a_number_left_behind(self) -> None:
        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        with (
            override_settings(MEDIA_ROOT=media),
            patch("finance.infrastructure.documents._render_pdf", side_effect=_html_as_pdf),
        ):
            call_command("finance_sample_documents", stdout=io.StringIO())

        folder = f"{media}/finance/samples"
        names = sorted(os.listdir(folder))
        self.assertEqual(len(names), 6)
        with open(f"{folder}/2-umowa-o-dzielo-dyrygent.pdf", encoding="utf-8") as handle:
            self.assertIn(f"reprezentowana przez: Anna Marcisz {EN_DASH} Wiceprezes Zarządu", handle.read())
        self.assertFalse(Project.objects.exists())
        self.assertFalse(Contract.all_objects.exists())
        self.assertFalse(ContractSequence.objects.exists())
