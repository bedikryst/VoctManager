"""
The workspace's payables across projects: the filtered, paged list of what is
owed or paid, paying costs of several projects in one all-or-nothing act, and
the overview's headline figures.
"""
from datetime import date, timedelta
from typing import Any
from uuid import uuid4

from rest_framework.test import APITestCase

from core.constants import AppRole
from roster.models import Participation

from ..models import BudgetStatus, CostItem, CostKind, FinanceAction, FinanceEvent, ProjectBudget
from ..rules import finance_today
from .factories import make_project, make_seat, make_user, price

PAYABLES = "/api/finance/payables/"
PAY = "/api/finance/payables/pay/"


class PayablesTestCase(APITestCase):
    def setUp(self) -> None:
        self.manager = make_user()
        self.client.force_authenticate(self.manager)
        self.today = finance_today()
        self.spring = make_project(title="Wiosna", days=10)
        self.autumn = make_project(title="Jesień", days=40)
        self.anna = price(self.spring, participation=make_seat(self.spring, "Anna", "Nowak"), amount="300")
        self.basia = price(self.spring, participation=make_seat(self.spring, "Barbara", "Zając"), amount="1250")
        self.celina = price(self.autumn, participation=make_seat(self.autumn, "Celina", "Adamska"), amount="800")
        self.organ = self.expense(self.autumn, vendor_name="Organmistrz Sp. z o.o.", cost_amount="2000")

    def expense(self, project: Any, **overrides: Any) -> CostItem:
        payload = {"category": "VENUE", "document_type": "INVOICE", **overrides}
        response = self.client.post(f"/api/finance/projects/{project.pk}/expenses/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return CostItem.objects.get(kind=CostKind.EXPENSE, vendor_name=overrides["vendor_name"])

    def due(self, item: CostItem, days: int | None) -> None:
        CostItem.objects.filter(pk=item.pk).update(
            due_on=None if days is None else self.today + timedelta(days=days),
        )

    def fetch(self, **params: Any) -> dict[str, Any]:
        response = self.client.get(PAYABLES, params)
        self.assertEqual(response.status_code, 200, response.content)
        body: dict[str, Any] = response.json()
        return body

    def pay(self, items: list[CostItem], paid_on: date | None = None) -> Any:
        return self.client.post(PAY, {
            "ids": [str(item.pk) for item in items], "paid_on": (paid_on or self.today).isoformat(),
        }, format="json")

    def ids(self, body: dict[str, Any]) -> list[str]:
        return [row["cost_item_id"] for row in body["results"]]


class PayablesListTests(PayablesTestCase):
    def test_what_is_owed_comes_by_due_date_with_the_whole_sets_sum(self) -> None:
        self.due(self.anna, 5)
        self.due(self.basia, 1)
        self.due(self.celina, None)
        self.due(self.organ, 3)

        body = self.fetch(limit=2)

        self.assertEqual(body["count"], 4)
        self.assertEqual((body["limit"], body["offset"]), (2, 0))
        self.assertEqual(body["total_amount"], "4350.00")
        self.assertEqual(self.ids(body), [str(self.basia.pk), str(self.organ.pk)])
        self.assertIsNone(body["results"][0]["paid_on"])
        self.assertEqual(self.ids(self.fetch(limit=2, offset=2)), [str(self.anna.pk), str(self.celina.pk)])

    def test_the_list_filters_by_project_and_kind(self) -> None:
        by_project = self.fetch(project=str(self.spring.pk))
        expenses = self.fetch(kind="EXPENSE")

        self.assertEqual(set(self.ids(by_project)), {str(self.anna.pk), str(self.basia.pk)})
        self.assertEqual(by_project["total_amount"], "1550.00")
        self.assertEqual(self.ids(expenses), [str(self.organ.pk)])

    def test_the_whitelisted_orderings_sort_both_ways(self) -> None:
        CostItem.objects.update(due_on=None)

        self.assertEqual(
            self.ids(self.fetch(ordering="-amount")),
            [str(self.organ.pk), str(self.basia.pk), str(self.celina.pk), str(self.anna.pk)],
        )
        self.assertEqual(
            self.ids(self.fetch(ordering="payee")),
            [str(self.anna.pk), str(self.basia.pk), str(self.celina.pk), str(self.organ.pk)],
        )
        # The later concert first; within it, the payee breaks the tie.
        self.assertEqual(
            self.ids(self.fetch(ordering="-project")),
            [str(self.celina.pk), str(self.organ.pk), str(self.anna.pk), str(self.basia.pk)],
        )

    def test_the_paid_list_has_its_date_range_and_keeps_a_paid_orphan(self) -> None:
        self.assertEqual(self.pay([self.anna], self.today - timedelta(days=10)).status_code, 200)
        self.assertEqual(self.pay([self.organ], self.today - timedelta(days=2)).status_code, 200)
        assert self.anna.participation_id is not None
        Participation.objects.filter(pk=self.anna.participation_id).update(status=Participation.Status.DECLINED)

        paid = self.fetch(status="paid")
        recent = self.fetch(status="paid", paid_from=(self.today - timedelta(days=5)).isoformat())

        self.assertEqual(self.ids(paid), [str(self.organ.pk), str(self.anna.pk)])
        self.assertEqual(paid["total_amount"], "2300.00")
        self.assertEqual(paid["results"][1]["paid_on"], (self.today - timedelta(days=10)).isoformat())
        self.assertEqual(self.ids(recent), [str(self.organ.pk)])
        self.assertEqual(self.fetch()["count"], 2)

    def test_meaningless_or_unknown_parameters_are_refused(self) -> None:
        for params in (
            {"status": "late"},
            {"ordering": "created_at"},
            {"ordering": "paid_on"},
            {"paid_from": self.today.isoformat()},
            {"status": "paid", "paid_from": self.today.isoformat(), "paid_to": "2020-01-01"},
            {"limit": 201},
            {"kind": "fee"},
            {"sort": "amount"},
        ):
            with self.subTest(params=params):
                self.assertEqual(self.client.get(PAYABLES, params).status_code, 400)

    def test_the_list_is_manager_only(self) -> None:
        self.client.force_authenticate(make_user(role=AppRole.ARTIST))

        self.assertEqual(self.client.get(PAYABLES).status_code, 403)
        self.assertEqual(self.pay([self.anna]).status_code, 403)


class PayAcrossTests(PayablesTestCase):
    def test_costs_of_two_projects_and_both_kinds_are_paid_in_one_act(self) -> None:
        paid_on = self.today - timedelta(days=1)

        response = self.pay([self.celina, self.anna, self.organ], paid_on)

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["count"], 3)
        self.assertEqual(
            set(response.json()["project_ids"]), {str(self.spring.pk), str(self.autumn.pk)},
        )
        for item in (self.celina, self.anna, self.organ):
            item.refresh_from_db()
            self.assertEqual(item.paid_on, paid_on)
            self.assertEqual(item.paid_marked_by, self.manager)
        self.assertEqual(FinanceEvent.objects.filter(action=FinanceAction.PAID).count(), 3)
        self.basia.refresh_from_db()
        self.assertIsNone(self.basia.paid_on)

    def test_a_refusal_in_one_project_undoes_the_other_and_names_every_refused_id(self) -> None:
        unpriced = price(self.autumn, participation=make_seat(self.autumn, "Dorota", "Bez"), amount=None, form="ZLECENIE")
        volunteer = price(self.spring, participation=make_seat(self.spring, "Ewa", "Wolna"), amount="0")
        self.pay([self.celina])
        missing = CostItem(pk=uuid4())

        response = self.pay([self.anna, unpriced, self.organ, volunteer, self.celina, missing])

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error_code"], "payment_refused")
        self.assertEqual(response.json()["params"]["refused"], [
            {"id": str(unpriced.pk), "reason": "unpriced"},
            {"id": str(volunteer.pk), "reason": "volunteer"},
            {"id": str(self.celina.pk), "reason": "already_paid"},
            {"id": str(missing.pk), "reason": "unknown"},
        ])
        for item in (self.anna, self.organ):
            item.refresh_from_db()
            self.assertIsNone(item.paid_on)
        self.assertEqual(FinanceEvent.objects.filter(action=FinanceAction.PAID).count(), 1)

    def test_a_closed_budget_refuses_the_whole_act(self) -> None:
        ProjectBudget.all_objects.filter(project=self.autumn).update(status=BudgetStatus.CLOSED)

        response = self.pay([self.anna, self.organ])

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error_code"], "budget_locked")
        self.assertEqual(response.json()["params"]["project_ids"], [str(self.autumn.pk)])
        self.anna.refresh_from_db()
        self.assertIsNone(self.anna.paid_on)

    def test_the_date_and_the_ids_are_checked_first(self) -> None:
        future = self.pay([self.anna], self.today + timedelta(days=1))
        repeated = self.client.post(PAY, {
            "ids": [str(self.anna.pk), str(self.anna.pk)], "paid_on": self.today.isoformat(),
        }, format="json")
        empty = self.client.post(PAY, {"ids": [], "paid_on": self.today.isoformat()}, format="json")

        for response in (future, repeated, empty):
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["error_code"], "validation_error")


class PayablesSummaryTests(PayablesTestCase):
    def test_the_overview_sums_what_is_owed_overdue_and_due_soon(self) -> None:
        self.due(self.anna, -3)
        self.due(self.basia, 0)
        self.due(self.celina, 14)
        self.due(self.organ, 15)
        self.pay([self.anna])
        overdue = price(self.autumn, participation=make_seat(self.autumn, "Filip", "Późny"), amount="99.99")
        self.due(overdue, -1)

        summary = self.client.get("/api/finance/overview/").json()["payables_summary"]

        self.assertEqual(summary, {
            "count": 4,
            "total": "4149.99",
            "overdue_count": 1,
            "overdue_total": "99.99",
            "due_soon_count": 2,
            "due_soon_total": "2050.00",
        })

    def test_nothing_owed_reads_as_zeros(self) -> None:
        CostItem.objects.update(paid_on=self.today)

        summary = self.client.get("/api/finance/overview/").json()["payables_summary"]

        self.assertEqual(summary["count"], 0)
        self.assertEqual(summary["total"], "0.00")
        self.assertEqual(summary["overdue_total"], "0.00")
