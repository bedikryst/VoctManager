"""
The ledger through its API: rows computed from the roster, the §5.1 invariants
enforced by the service, the standard rate's skip rules, batch atomicity,
paying and reverting, one-off payees, and who may do which of these.
"""
from datetime import timedelta
from decimal import Decimal
from typing import Any

from rest_framework.test import APITestCase

from core.constants import AppRole
from roster.models import Collaborator, Participation

from ..dtos import PayFeesDTO
from ..models import BudgetStatus, CostItem, FeeForm, FinanceAction, FinanceEvent, ProjectBudget
from ..rules import finance_today
from ..services.budget import BudgetService
from ..services.contracts import ContractService
from ..services.ledger import LedgerService
from .factories import make_crew, make_project, make_seat, make_user, price


def _pay(items: list[CostItem]) -> PayFeesDTO:
    return PayFeesDTO(ids=tuple(item.pk for item in items), paid_on=finance_today())


class LedgerTestCase(APITestCase):
    def setUp(self) -> None:
        self.manager = make_user()
        self.board = make_user(staff=True)
        self.project = make_project()
        self.anna = make_seat(self.project, "Anna", "Nowak")
        self.basia = make_seat(self.project, "Barbara", "Zając")
        self.sound = make_crew(self.project, "Jan", "Kowalski")
        self.client.force_authenticate(self.manager)

    def url(self, suffix: str) -> str:
        return f"/api/finance/projects/{self.project.pk}/{suffix}"

    def patch_fees(self, payload: dict[str, Any]) -> Any:
        return self.client.patch(self.url("fees/"), payload, format="json")

    def row(self, response: Any, key: object) -> dict[str, Any]:
        return next(row for row in response.data["ledger"] if row["key"] == str(key))


class ReadTests(LedgerTestCase):
    def test_unpriced_rows_come_from_the_roster_and_create_nothing(self) -> None:
        response = self.client.get(self.url("budget/"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual({row["origin"] for row in response.data["ledger"]}, {"cast", "crew"})
        self.assertEqual(len(response.data["ledger"]), 3)
        self.assertFalse(CostItem.objects.exists())
        anna = self.row(response, self.anna.pk)
        self.assertFalse(anna["is_priced"])
        self.assertEqual(anna["default_form"], FeeForm.DZIELO)
        self.assertEqual(self.row(response, self.sound.pk)["default_form"], FeeForm.ZLECENIE)
        self.assertEqual(response.data["summary"]["unpriced"], 3)
        self.assertEqual(response.data["budget"]["status"], BudgetStatus.PLANNING)

    def test_a_declined_singer_with_no_fee_is_not_a_row(self) -> None:
        make_seat(self.project, "Celina", "Odmowa", status=Participation.Status.DECLINED)

        response = self.client.get(self.url("budget/"))

        self.assertEqual(len(response.data["ledger"]), 3)

    def test_a_singer_cannot_read_the_ledger(self) -> None:
        self.client.force_authenticate(make_user(role=AppRole.ARTIST))

        self.assertEqual(self.client.get(self.url("budget/")).status_code, 403)


class PricingTests(LedgerTestCase):
    def test_typing_zero_records_a_volunteer(self) -> None:
        response = self.patch_fees({"items": [{"ref": {"participation": str(self.anna.pk)}, "contract_amount": "0"}]})

        self.assertEqual(response.status_code, 200)
        row = self.row(response, self.anna.pk)
        self.assertEqual(row["form"], FeeForm.VOLUNTEER)
        self.assertEqual(row["contract_amount"], "0.00")
        self.assertEqual(row["cost_amount"], "0.00")
        self.assertTrue(row["counted"])

    def test_choosing_volunteer_sets_zero(self) -> None:
        response = self.patch_fees({"items": [{
            "ref": {"participation": str(self.anna.pk)}, "contract_amount": "400", "form": "VOLUNTEER",
        }]})

        self.assertEqual(self.row(response, self.anna.pk)["contract_amount"], "0.00")

    def test_a_mandate_costs_its_amount_plus_the_offices_contributions(self) -> None:
        item = price(self.project, crew=self.sound, amount="600", actor=self.manager)
        self.assertEqual(item.form, FeeForm.ZLECENIE)
        self.assertEqual(item.cost_amount, Decimal("600.00"))

        item = price(self.project, crew=self.sound, amount="600", employer_contributions="117.18")

        self.assertEqual(item.cost_amount, Decimal("717.18"))

    def test_contributions_go_when_the_form_leaves_zlecenie(self) -> None:
        price(self.project, crew=self.sound, amount="600", employer_contributions="117.18")

        item = price(self.project, crew=self.sound, amount="600", form="DZIELO")

        self.assertIsNone(item.employer_contributions)
        self.assertEqual(item.cost_amount, Decimal("600.00"))

    def test_a_repriced_mandate_waits_for_its_contributions_again(self) -> None:
        price(self.project, crew=self.sound, amount="1000", employer_contributions="200")

        item = price(self.project, crew=self.sound, amount="2000")

        self.assertIsNone(item.employer_contributions)
        self.assertEqual(item.cost_amount, Decimal("2000.00"))
        self.assertIn("EMPLOYER_COST_MISSING", {w.code for w in BudgetService.build(self.project).warnings})

        item = price(self.project, crew=self.sound, amount="3000", employer_contributions="600")
        self.assertEqual(item.cost_amount, Decimal("3600.00"))

    def test_a_cost_wider_than_the_ledger_holds_is_refused(self) -> None:
        response = self.patch_fees({"items": [{
            "ref": {"crew_assignment": str(self.sound.pk)},
            "contract_amount": "99999999.99", "employer_contributions": "1",
        }]})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "amount_too_large")
        self.assertFalse(CostItem.objects.exists())

    def test_changes_are_logged_with_before_and_after(self) -> None:
        price(self.project, participation=self.anna, amount="300", actor=self.manager)
        price(self.project, participation=self.anna, amount="350", form="ZLECENIE", actor=self.manager)

        actions = sorted(FinanceEvent.objects.values_list("action", flat=True))
        self.assertEqual(actions, sorted([FinanceAction.PRICED, FinanceAction.FORM_CHANGED, FinanceAction.PRICED]))
        first, repricing = sorted(
            FinanceEvent.objects.filter(action=FinanceAction.PRICED),
            key=lambda event: event.before["contract_amount"] is not None,
        )
        self.assertEqual((first.before, first.after), ({"contract_amount": None}, {"contract_amount": "300.00"}))
        self.assertEqual(repricing.before, {"contract_amount": "300.00"})
        self.assertEqual(repricing.after, {"contract_amount": "350.00"})
        self.assertEqual(repricing.actor, self.manager)
        form_change = FinanceEvent.objects.get(action=FinanceAction.FORM_CHANGED)
        self.assertEqual((form_change.before, form_change.after), ({"form": "DZIELO"}, {"form": "ZLECENIE"}))

    def test_a_declined_seat_cannot_be_priced(self) -> None:
        declined = make_seat(self.project, "Celina", "Odmowa", status=Participation.Status.DECLINED)

        response = self.patch_fees({"items": [{"ref": {"participation": str(declined.pk)}, "contract_amount": "1"}]})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "seat_not_billable")

    def test_a_seat_of_another_project_is_refused(self) -> None:
        stranger = make_seat(make_project(), "Obca", "Osoba")

        response = self.patch_fees({"items": [{"ref": {"participation": str(stranger.pk)}, "contract_amount": "1"}]})

        self.assertEqual(response.data["error_code"], "unknown_fee_reference")

    def test_a_malformed_row_is_a_validation_error(self) -> None:
        response = self.patch_fees({"items": [{"ref": {}, "contract_amount": "-5"}]})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "validation_error")


class LockTests(LedgerTestCase):
    def test_a_paid_item_refuses_a_new_amount_and_form(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")
        LedgerService.pay(self.project, _pay([item]), actor=self.manager)

        for change in ({"contract_amount": "350"}, {"contract_amount": "300", "form": "ZLECENIE"}):
            with self.subTest(change=change):
                response = self.patch_fees({"items": [{"ref": {"participation": str(self.anna.pk)}, **change}]})
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.data["error_code"], "item_paid")
        item.refresh_from_db()
        self.assertEqual((item.contract_amount, item.form), (Decimal("300.00"), FeeForm.DZIELO))

    def test_resending_a_paid_row_unchanged_is_not_an_error(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")
        LedgerService.pay(self.project, _pay([item]), actor=self.manager)

        response = self.patch_fees({"items": [{"ref": {"participation": str(self.anna.pk)}, "contract_amount": "300"}]})

        self.assertEqual(response.status_code, 200)

    def test_the_office_may_add_contributions_after_payment(self) -> None:
        item = price(self.project, crew=self.sound, amount="600")
        LedgerService.pay(self.project, _pay([item]), actor=self.manager)

        item = price(self.project, crew=self.sound, amount="600", employer_contributions="117.18")

        self.assertEqual(item.cost_amount, Decimal("717.18"))

    def test_an_issued_contract_freezes_the_amount(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")
        ContractService.issue(item, actor=self.manager)

        response = self.patch_fees({"items": [{"ref": {"participation": str(self.anna.pk)}, "contract_amount": "320"}]})

        self.assertEqual(response.data["error_code"], "item_contracted")

    def test_a_volunteer_agreement_freezes_the_rate_it_prints_but_not_the_hours(self) -> None:
        item = price(self.project, participation=self.anna, amount="0", in_kind_hourly_rate="40", in_kind_hours="10")
        ContractService.issue(item, actor=self.manager)
        detail = f"/api/finance/cost-items/{item.pk}/"

        refused = self.client.patch(detail, {"in_kind_hourly_rate": "55"}, format="json")
        self.assertEqual(refused.data["error_code"], "item_contracted")

        allowed = self.client.patch(detail, {"in_kind_hours": "12", "note": "Próby i koncert"}, format="json")
        self.assertEqual(allowed.status_code, 200)
        item.refresh_from_db()
        self.assertEqual((item.in_kind_hours, item.in_kind_hourly_rate, item.note),
                         (Decimal("12.00"), Decimal("40.00"), "Próby i koncert"))

    def test_details_and_contributions_are_one_edit(self) -> None:
        item = price(self.project, crew=self.sound, amount="600")
        detail = f"/api/finance/cost-items/{item.pk}/"

        refused = self.client.patch(
            detail, {"employer_contributions": "117.18", "budget_line": str(item.pk)}, format="json",
        )
        self.assertEqual(refused.status_code, 400)
        item.refresh_from_db()
        self.assertIsNone(item.employer_contributions)

        # Priced against the stored amount, whatever the client last saw.
        price(self.project, crew=self.sound, amount="700")
        response = self.client.patch(detail, {"employer_contributions": "117.18", "note": "DRA 10/2026"}, format="json")
        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertEqual((item.contract_amount, item.cost_amount, item.note),
                         (Decimal("700.00"), Decimal("817.18"), "DRA 10/2026"))

    def test_a_closed_budget_refuses_every_write(self) -> None:
        budget = ProjectBudget.objects.create(project=self.project, status=BudgetStatus.CLOSED)
        self.assertEqual(budget.status, BudgetStatus.CLOSED)

        response = self.patch_fees({"items": [{"ref": {"participation": str(self.anna.pk)}, "contract_amount": "1"}]})

        self.assertEqual(response.data["error_code"], "budget_locked")


class AtomicityTests(LedgerTestCase):
    def test_one_bad_row_rolls_back_the_whole_batch(self) -> None:
        paid = price(self.project, participation=self.basia, amount="200")
        LedgerService.pay(self.project, _pay([paid]), actor=self.manager)
        events_before = FinanceEvent.objects.count()

        response = self.patch_fees({
            "standard_rate": {"crew": "500"},
            "items": [
                {"ref": {"participation": str(self.anna.pk)}, "contract_amount": "300"},
                {"ref": {"participation": str(self.basia.pk)}, "contract_amount": "999"},
            ],
        })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["params"]["index"], 1)
        self.assertEqual(response.data["params"]["ref"], str(self.basia.pk))
        self.assertFalse(CostItem.objects.filter(participation=self.anna).exists())
        self.assertFalse(CostItem.objects.filter(crew_assignment=self.sound).exists())
        self.assertEqual(FinanceEvent.objects.count(), events_before)


class StandardRateTests(LedgerTestCase):
    def test_the_rate_skips_paid_contracted_volunteer_invoice_and_declined_rows(self) -> None:
        paid = make_seat(self.project, "Paula", "Opłacona")
        paid_item = price(self.project, participation=paid, amount="100")
        LedgerService.pay(self.project, _pay([paid_item]), actor=self.manager)
        contracted = make_seat(self.project, "Cecylia", "Umowna")
        ContractService.issue(price(self.project, participation=contracted, amount="150"), actor=self.manager)
        volunteer = make_seat(self.project, "Wanda", "Wolontariuszka")
        price(self.project, participation=volunteer, amount="0")
        declined = make_seat(self.project, "Dorota", "Odmowa", status=Participation.Status.DECLINED)
        priced_before = price(self.project, participation=self.basia, amount="50")
        company = make_crew(self.project, "Firma", "Dźwięk", company_name="Nagłośnienie Sp. z o.o.")
        invoiced = make_crew(self.project, "Iga", "Faktura")
        price(self.project, crew=invoiced, amount="900", form="INVOICE")

        response = self.patch_fees({"standard_rate": {"cast": "250", "crew": "700"}})

        self.assertEqual(response.status_code, 200)
        amounts = {
            row["key"]: row["contract_amount"] for row in response.data["ledger"]
        }
        self.assertEqual(amounts[str(self.anna.pk)], "250.00")
        self.assertEqual(amounts[str(priced_before.participation_id)], "250.00")
        self.assertEqual(amounts[str(paid.pk)], "100.00")
        self.assertEqual(amounts[str(contracted.pk)], "150.00")
        self.assertEqual(amounts[str(volunteer.pk)], "0.00")
        self.assertEqual(amounts[str(self.sound.pk)], "700.00")
        self.assertIsNone(amounts[str(company.pk)])
        self.assertEqual(amounts[str(invoiced.pk)], "900.00")
        self.assertNotIn(str(declined.pk), amounts)

    def test_rows_in_the_same_batch_override_the_rate(self) -> None:
        response = self.patch_fees({
            "standard_rate": {"cast": "250"},
            "items": [{"ref": {"participation": str(self.anna.pk)}, "contract_amount": "400"}],
        })

        self.assertEqual(self.row(response, self.anna.pk)["contract_amount"], "400.00")
        self.assertEqual(self.row(response, self.basia.pk)["contract_amount"], "250.00")


class PaymentTests(LedgerTestCase):
    def test_payment_refuses_the_whole_batch_and_names_every_refusal(self) -> None:
        priced = price(self.project, participation=self.anna, amount="300")
        volunteer = price(self.project, participation=self.basia, amount="0")
        unpriced = price(self.project, crew=self.sound, amount=None, form="DZIELO")

        response = self.client.post(self.url("fees/pay/"), {
            "ids": [str(priced.pk), str(volunteer.pk), str(unpriced.pk)],
            "paid_on": finance_today().isoformat(),
        }, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error_code"], "payment_refused")
        reasons = {entry["id"]: entry["reason"] for entry in response.data["params"]["refused"]}
        self.assertEqual(reasons, {str(volunteer.pk): "volunteer", str(unpriced.pk): "unpriced"})
        priced.refresh_from_db()
        self.assertIsNone(priced.paid_on)

    def test_paying_twice_is_refused(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")
        payload = {"ids": [str(item.pk)], "paid_on": finance_today().isoformat()}
        self.client.post(self.url("fees/pay/"), payload, format="json")

        response = self.client.post(self.url("fees/pay/"), payload, format="json")

        self.assertEqual(response.data["params"]["refused"], [{"id": str(item.pk), "reason": "already_paid"}])

    def test_payment_is_recorded_with_the_offices_date_and_who_marked_it(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")
        paid_on = finance_today() - timedelta(days=2)

        response = self.client.post(self.url("fees/pay/"), {
            "ids": [str(item.pk)], "paid_on": paid_on.isoformat(),
        }, format="json")

        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.paid_on, paid_on)
        self.assertEqual(item.paid_marked_by, self.manager)
        self.assertTrue(FinanceEvent.objects.filter(subject_id=item.pk, action=FinanceAction.PAID).exists())
        self.assertEqual(self.row(response, self.anna.pk)["paid_on"], paid_on.isoformat())

    def test_a_payment_date_in_the_future_is_refused(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")

        response = self.client.post(self.url("fees/pay/"), {
            "ids": [str(item.pk)], "paid_on": (finance_today() + timedelta(days=1)).isoformat(),
        }, format="json")

        self.assertEqual(response.status_code, 400)

    def test_reverting_a_payment_is_the_boards_and_is_logged_with_its_reason(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")
        LedgerService.pay(self.project, _pay([item]), actor=self.manager)
        unpay = f"/api/finance/cost-items/{item.pk}/unpay/"

        self.assertEqual(self.client.post(unpay, {"reason": "Pomyłka"}, format="json").status_code, 403)

        self.client.force_authenticate(self.board)
        self.assertEqual(self.client.post(unpay, {"reason": "  "}, format="json").status_code, 400)
        response = self.client.post(unpay, {"reason": "Przelew wrócił"}, format="json")

        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertIsNone(item.paid_on)
        event = FinanceEvent.objects.get(subject_id=item.pk, action=FinanceAction.UNPAID)
        self.assertEqual(event.reason, "Przelew wrócił")
        self.assertEqual(event.actor, self.board)
        self.assertEqual(event.before["paid_on"], finance_today().isoformat())


class OneOffTests(LedgerTestCase):
    def create(self, **overrides: object) -> Any:
        payload = {
            "payee_name": "Piotr Solista", "payee_role": "Baryton", "category": "PERSONNEL_ARTISTIC",
            "form": "DZIELO", "contract_amount": "1200", **overrides,
        }
        return self.client.post(self.url("fees/one-off/"), payload, format="json")

    def test_a_one_off_payee_is_a_row_of_its_own(self) -> None:
        response = self.create()

        self.assertEqual(response.status_code, 201)
        [row] = [row for row in response.data["ledger"] if row["origin"] == "one_off"]
        self.assertEqual(row["payee_name"], "Piotr Solista")
        self.assertEqual(row["key"], row["cost_item_id"])
        self.assertEqual(row["cost_amount"], "1200.00")
        self.assertTrue(FinanceEvent.objects.filter(action=FinanceAction.CREATED).exists())

    def test_zero_makes_a_one_off_a_volunteer_too(self) -> None:
        response = self.create(contract_amount="0")

        [row] = [row for row in response.data["ledger"] if row["origin"] == "one_off"]
        self.assertEqual(row["form"], FeeForm.VOLUNTEER)

    def test_a_one_off_payee_can_be_renamed_until_paid(self) -> None:
        self.create()
        item = CostItem.objects.get(payee_name="Piotr Solista")
        detail = f"/api/finance/cost-items/{item.pk}/"

        response = self.client.patch(detail, {"payee_name": "Piotr Solista-Nowak"}, format="json")
        self.assertEqual(response.status_code, 200)

        LedgerService.pay(self.project, _pay([item]), actor=self.manager)
        response = self.client.patch(detail, {"payee_name": "Ktoś Inny"}, format="json")
        self.assertEqual(response.data["error_code"], "item_paid")

    def test_a_roster_rows_payee_comes_from_the_roster(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")

        response = self.client.patch(f"/api/finance/cost-items/{item.pk}/", {"payee_name": "X"}, format="json")

        self.assertEqual(response.data["error_code"], "invalid_item_change")

    def test_bookkeeping_details_are_editable_and_the_nip_is_checked(self) -> None:
        item = price(self.project, crew=self.sound, amount="900", form="INVOICE")
        detail = f"/api/finance/cost-items/{item.pk}/"

        bad = self.client.patch(detail, {"vendor_nip": "676-271-89-93"}, format="json")
        good = self.client.patch(detail, {
            "vendor_nip": "676-271-89-92", "document_number": "FV/12/2026", "note": "przelew 14 dni",
        }, format="json")

        self.assertEqual(bad.status_code, 400)
        self.assertEqual(good.status_code, 200)
        item.refresh_from_db()
        self.assertEqual((item.vendor_nip, item.document_number), ("6762718992", "FV/12/2026"))


class SummaryTests(LedgerTestCase):
    def test_totals_are_exact_decimals(self) -> None:
        third = make_seat(self.project, "Celina", "Trzecia")
        for seat in (self.anna, self.basia, third):
            price(self.project, participation=seat, amount="333.33")
        price(self.project, crew=self.sound, amount="100.10", employer_contributions="20.05")
        LedgerService.pay(self.project, _pay([CostItem.objects.get(participation=self.anna)]), actor=self.manager)
        volunteer = make_seat(self.project, "Wanda", "Wolontariuszka")
        price(self.project, participation=volunteer, amount="0", in_kind_hours="10", in_kind_hourly_rate="45.5")

        summary = self.client.get(self.url("budget/")).data["summary"]

        self.assertEqual(summary["committed"], "1120.14")
        self.assertEqual(summary["paid"], "333.33")
        self.assertEqual(summary["outstanding"], "786.81")
        self.assertEqual(summary["in_kind"], "455.00")
        self.assertEqual(summary["volunteers"], 1)
        by_category = {entry["category"]: entry["committed"] for entry in summary["by_category"]}
        self.assertEqual(by_category, {"PERSONNEL_ARTISTIC": "999.99", "PERSONNEL_TECHNICAL": "120.15"})

    def test_an_orphaned_fee_leaves_the_totals_and_a_paid_one_stays(self) -> None:
        price(self.project, participation=self.anna, amount="300")
        paid = price(self.project, participation=self.basia, amount="200")
        LedgerService.pay(self.project, _pay([paid]), actor=self.manager)
        Participation.objects.filter(pk__in=[self.anna.pk, self.basia.pk]).update(
            status=Participation.Status.DECLINED,
        )

        response = self.client.get(self.url("budget/"))

        anna, basia = self.row(response, self.anna.pk), self.row(response, self.basia.pk)
        self.assertTrue(anna["orphaned"])
        self.assertFalse(anna["counted"])
        self.assertFalse(basia["orphaned"])
        self.assertTrue(basia["counted"])
        self.assertEqual(response.data["summary"]["committed"], "200.00")
        self.assertEqual(response.data["summary"]["orphaned"], 1)

    def test_a_removed_seat_keeps_its_paid_fee_on_the_books(self) -> None:
        paid = price(self.project, participation=self.anna, amount="300")
        LedgerService.pay(self.project, _pay([paid]), actor=self.manager)
        self.anna.delete()

        response = self.client.get(self.url("budget/"))

        row = self.row(response, self.anna.pk)
        self.assertFalse(row["billable"])
        self.assertTrue(row["counted"])
        self.assertEqual(response.data["summary"]["paid"], "300.00")

    def test_the_payee_name_follows_the_roster_until_a_contract_freezes_it(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")
        ContractService.issue(item, actor=self.manager)
        self.anna.artist.last_name = "Nowak-Kowalska"
        self.anna.artist.save()

        self.assertEqual(self.row(self.client.get(self.url("budget/")), self.anna.pk)["payee_name"], "Anna Nowak")
        self.assertEqual(
            self.row(self.client.get(self.url("budget/")), self.basia.pk)["payee_name"], "Barbara Zając",
        )


class OverviewTests(LedgerTestCase):
    def test_the_portfolio_rolls_up_every_project_and_lists_what_is_owed(self) -> None:
        price(self.project, participation=self.anna, amount="300")
        paid = price(self.project, participation=self.basia, amount="200")
        LedgerService.pay(self.project, _pay([paid]), actor=self.manager)
        make_project(status="CANC", title="Odwołany")

        response = self.client.get("/api/finance/overview/")

        self.assertEqual(response.status_code, 200)
        titles = {entry["project"]["title"] for entry in response.data["projects"]}
        self.assertEqual(titles, {"Koncert", "Odwołany"})
        [mine] = [entry for entry in response.data["projects"] if entry["project"]["title"] == "Koncert"]
        self.assertEqual(mine["summary"]["outstanding"], "300.00")
        self.assertGreaterEqual(mine["warning_counts"]["work"], 1)
        self.assertEqual(response.data["payables"]["count"], 1)
        self.assertEqual(response.data["payables"]["results"][0]["payee_name"], "Anna Nowak")

    def test_the_portfolio_is_manager_only(self) -> None:
        self.client.force_authenticate(make_user(role=AppRole.ARTIST))

        self.assertEqual(self.client.get("/api/finance/overview/").status_code, 403)


class CategoryOfCrewTests(LedgerTestCase):
    def test_a_player_booked_as_crew_is_artistic_personnel(self) -> None:
        organist = make_crew(self.project, "Olga", "Organistka", specialty=Collaborator.Specialty.INSTRUMENT)

        item = price(self.project, crew=organist, amount="800")

        self.assertEqual((item.category, item.form), ("PERSONNEL_ARTISTIC", FeeForm.DZIELO))


class ReleaseOrphanTests(LedgerTestCase):
    def release(self, item: CostItem) -> Any:
        return self.client.post(f"/api/finance/cost-items/{item.pk}/release/")

    def test_a_declined_singers_unpaid_fee_is_released_and_the_budget_can_close(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")
        Participation.objects.filter(pk=self.anna.pk).update(status=Participation.Status.DECLINED)

        response = self.release(item)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["orphaned"], 0)
        # A declined seat without a fee is not a ledger row at all.
        self.assertNotIn(str(self.anna.pk), [row["key"] for row in response.data["ledger"]])
        self.assertTrue(CostItem.all_objects.get(pk=item.pk).is_deleted)
        event = FinanceEvent.objects.get(subject_id=item.pk, action=FinanceAction.REMOVED)
        self.assertEqual(event.before["contract_amount"], "300.00")

    def test_a_removed_seats_fee_is_released_too(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")
        self.anna.delete()

        self.assertEqual(self.release(item).status_code, 200)
        self.assertTrue(CostItem.all_objects.get(pk=item.pk).is_deleted)

    def test_a_fee_that_still_counts_a_paid_one_and_a_contracted_one_stay(self) -> None:
        counting = price(self.project, participation=self.anna, amount="300")
        paid = price(self.project, participation=self.basia, amount="200")
        LedgerService.pay(self.project, _pay([paid]), actor=self.manager)
        contracted_seat = make_seat(self.project, "Celina", "Umowa")
        contracted = price(self.project, participation=contracted_seat, amount="250")
        ContractService.issue(contracted, actor=self.manager)
        Participation.objects.filter(pk__in=[self.basia.pk, contracted_seat.pk]).update(
            status=Participation.Status.DECLINED,
        )

        codes = [self.release(item).data["error_code"] for item in (counting, paid, contracted)]

        self.assertEqual(codes, ["fee_not_orphaned", "item_paid_not_removable", "item_contracted"])
        self.assertEqual(CostItem.objects.filter(pk__in=[counting.pk, paid.pk, contracted.pk]).count(), 3)

    def test_a_singer_cannot_release_a_fee(self) -> None:
        item = price(self.project, participation=self.anna, amount="300")
        Participation.objects.filter(pk=self.anna.pk).update(status=Participation.Status.DECLINED)
        self.client.force_authenticate(make_user(role=AppRole.ARTIST))

        self.assertEqual(self.release(item).status_code, 403)
        self.assertFalse(CostItem.all_objects.get(pk=item.pk).is_deleted)
