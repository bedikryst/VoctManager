"""
The pure money rules: the default form table, categories, the foundation's cost,
the 0 ⇔ volunteer reconciliation, and the constants the warnings read.
"""
from decimal import Decimal

from django.test import SimpleTestCase

from roster.models import Collaborator, CrewAssignment, Participation

from ..models import CostCategory, FeeForm
from ..rules import (
    Pricing,
    category_for,
    contract_number,
    cost_for,
    default_form_for,
    in_kind_value,
    is_valid_nip,
    minimum_hourly_rate,
    reconcile_pricing,
)


def _crew(specialty: str, company_name: str = "") -> CrewAssignment:
    return CrewAssignment(collaborator=Collaborator(specialty=specialty, company_name=company_name))


class DefaultFormTests(SimpleTestCase):
    def test_every_cast_seat_is_a_dzielo(self) -> None:
        self.assertEqual(default_form_for(Participation()), FeeForm.DZIELO)

    def test_a_company_invoices_whatever_its_specialty(self) -> None:
        self.assertEqual(default_form_for(_crew(Collaborator.Specialty.INSTRUMENT, "Organy Sp. z o.o.")),
                         FeeForm.INVOICE)
        self.assertEqual(default_form_for(_crew(Collaborator.Specialty.SOUND, "Nagłośnienie")), FeeForm.INVOICE)

    def test_players_and_visual_artists_deliver_a_work(self) -> None:
        self.assertEqual(default_form_for(_crew(Collaborator.Specialty.INSTRUMENT)), FeeForm.DZIELO)
        self.assertEqual(default_form_for(_crew(Collaborator.Specialty.VISUALS)), FeeForm.DZIELO)

    def test_technicians_perform_a_service(self) -> None:
        for specialty in (
            Collaborator.Specialty.SOUND, Collaborator.Specialty.LIGHT,
            Collaborator.Specialty.LOGISTICS, Collaborator.Specialty.OTHER,
        ):
            with self.subTest(specialty=specialty):
                self.assertEqual(default_form_for(_crew(specialty)), FeeForm.ZLECENIE)

    def test_categories_follow_the_side_of_the_stage(self) -> None:
        self.assertEqual(category_for(Participation()), CostCategory.PERSONNEL_ARTISTIC)
        self.assertEqual(category_for(_crew(Collaborator.Specialty.INSTRUMENT)), CostCategory.PERSONNEL_ARTISTIC)
        self.assertEqual(category_for(_crew(Collaborator.Specialty.SOUND)), CostCategory.PERSONNEL_TECHNICAL)


class CostTests(SimpleTestCase):
    def test_the_cost_is_what_leaves_the_foundation(self) -> None:
        self.assertEqual(cost_for(FeeForm.DZIELO, Decimal("500"), None), Decimal("500.00"))
        self.assertEqual(cost_for(FeeForm.INVOICE, Decimal("1230"), None), Decimal("1230.00"))
        self.assertEqual(cost_for(FeeForm.ZLECENIE, Decimal("500"), Decimal("98.05")), Decimal("598.05"))

    def test_a_mandate_counts_at_its_amount_until_the_office_reports_contributions(self) -> None:
        self.assertEqual(cost_for(FeeForm.ZLECENIE, Decimal("500"), None), Decimal("500.00"))

    def test_volunteer_work_costs_nothing_and_unpriced_has_no_cost(self) -> None:
        self.assertEqual(cost_for(FeeForm.VOLUNTEER, Decimal("0"), None), Decimal("0.00"))
        self.assertIsNone(cost_for(FeeForm.DZIELO, None, None))

    def test_in_kind_value_is_hours_times_rate_to_the_grosz(self) -> None:
        self.assertEqual(in_kind_value(Decimal("7.5"), Decimal("33.33")), Decimal("249.98"))
        self.assertIsNone(in_kind_value(Decimal("7.5"), None))


class ReconcilePricingTests(SimpleTestCase):
    def reconcile(self, current: Pricing, form: str | None, amount: str | None) -> Pricing:
        return reconcile_pricing(
            current, requested_form=form,
            requested_amount=None if amount is None else Decimal(amount),
            fallback_form=FeeForm.DZIELO,
        )

    def test_typing_zero_makes_a_volunteer(self) -> None:
        self.assertEqual(self.reconcile(Pricing(FeeForm.DZIELO, Decimal("500")), None, "0"),
                         Pricing(FeeForm.VOLUNTEER, Decimal("0")))

    def test_zero_wins_over_a_form_sent_alongside_it(self) -> None:
        self.assertEqual(self.reconcile(Pricing(FeeForm.DZIELO, None), FeeForm.ZLECENIE, "0").form,
                         FeeForm.VOLUNTEER)

    def test_choosing_volunteer_sets_zero(self) -> None:
        self.assertEqual(self.reconcile(Pricing(FeeForm.DZIELO, Decimal("500")), FeeForm.VOLUNTEER, "500"),
                         Pricing(FeeForm.VOLUNTEER, Decimal("0")))

    def test_leaving_volunteer_drops_the_zero_to_unpriced(self) -> None:
        self.assertEqual(self.reconcile(Pricing(FeeForm.VOLUNTEER, Decimal("0")), FeeForm.ZLECENIE, "0"),
                         Pricing(FeeForm.ZLECENIE, None))

    def test_typing_an_amount_on_a_volunteer_leaves_volunteer_work(self) -> None:
        self.assertEqual(self.reconcile(Pricing(FeeForm.VOLUNTEER, Decimal("0")), None, "300"),
                         Pricing(FeeForm.DZIELO, Decimal("300")))

    def test_clearing_a_volunteer_leaves_it_unpriced(self) -> None:
        self.assertEqual(self.reconcile(Pricing(FeeForm.VOLUNTEER, Decimal("0")), None, None),
                         Pricing(FeeForm.DZIELO, None))

    def test_an_untouched_row_stays_as_it_is(self) -> None:
        current = Pricing(FeeForm.ZLECENIE, Decimal("450"))
        self.assertEqual(self.reconcile(current, None, "450"), current)


class ConstantsTests(SimpleTestCase):
    def test_minimum_hourly_rate_reads_the_latest_known_year(self) -> None:
        self.assertEqual(minimum_hourly_rate(2026), Decimal("31.40"))
        self.assertEqual(minimum_hourly_rate(2031), Decimal("31.40"))
        self.assertIsNone(minimum_hourly_rate(2019))

    def test_contract_numbers(self) -> None:
        self.assertEqual(contract_number(FeeForm.DZIELO, 7, 2026), "UoD/7/2026")
        self.assertEqual(contract_number(FeeForm.ZLECENIE, 1, 2026), "UZ/1/2026")
        self.assertEqual(contract_number(FeeForm.VOLUNTEER, 12, 2027), "W/12/2027")

    def test_nip_checksum(self) -> None:
        self.assertTrue(is_valid_nip("6762718992"))
        self.assertFalse(is_valid_nip("6762718993"))
        self.assertFalse(is_valid_nip("123"))
