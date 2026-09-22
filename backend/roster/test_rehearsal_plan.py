"""The rehearsal plan: one ordered table of rows, each a piece, a label or a
break, an optional clock, voice exclusions, a reserve flag and the debrief's
verdict (`RehearsalPlanItem`).

Two suites. The contract suite replays `domain/rehearsal_plan_cases.json`,
the fixture the client's exclusion chips mirror, so "bez B2 · 3 osoby" on the
panel and who the server calls are one rule. The API suite drives the plan
through its doors: the declarative PUT (verdicts survive, positions never
collide, a piece outside the programme is refused, the reserve closes the
plan), the per-reader read (`calls_me`, `my_plan_window`) on the single
rehearsal and on the schedule dashboard, the publish gate on all five of its
readers, `done` defaulting to the plan once the evening is over, and "Wyślij
plan", which is the one moment the cast hears about the plan.
"""

from __future__ import annotations

import json
from datetime import datetime, time, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.contrib.auth.base_user import AbstractBaseUser
from django.db import IntegrityError, transaction
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from archive.models import Composer, Piece, PieceVoiceRequirement
from core.constants import AppRole
from core.models import UserProfile
from roster.domain.day_timeline import localize
from roster.domain.rehearsal_plan import (
    CANONICAL_LINES,
    PlanRow,
    PlanSeat,
    item_calls_seat,
    plan_window_for_seat,
    row_lines,
)
from roster.models import (
    Artist,
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    Rehearsal,
    RehearsalDelegate,
    RehearsalPlanItem,
    VoiceType,
)

WARSAW = ZoneInfo("Europe/Warsaw")


def _clock(value: str | None) -> time | None:
    return time.fromisoformat(value) if value else None


class RehearsalPlanContractTests(SimpleTestCase):
    """The rule, pinned by the shared fixture."""

    @staticmethod
    def _load() -> dict:
        fixture = Path(__file__).resolve().parent / "domain" / "rehearsal_plan_cases.json"
        return json.loads(fixture.read_text(encoding="utf-8"))

    def test_rule_matches_the_shared_fixture(self) -> None:
        fixture = self._load()
        pieces = {key: row_lines(lines) for key, lines in fixture["pieces"].items()}
        seats = {
            handle: PlanSeat(
                section_letters=spec.get("letters", ""),
                is_instrumentalist=bool(spec.get("instrumentalist", False)),
                cast_lines=dict(spec.get("castings", {})),
            )
            for handle, spec in fixture["seats"].items()
        }
        self.assertGreater(len(fixture["cases"]), 0)
        for case in fixture["cases"]:
            rehearsal = case["rehearsal"]
            rows = [
                PlanRow(
                    piece=row.get("piece"),
                    starts_at=_clock(row.get("time")),
                    lines=pieces[row["piece"]] if row.get("piece") else row_lines(()),
                    excluded_lines=frozenset(row.get("excluded", ())),
                    excludes_instrumentalists=bool(row.get("excludesInstrumentalists", False)),
                    is_break=bool(row.get("isBreak", False)),
                )
                for row in case["rows"]
            ]
            for handle, expected in case["expected"].items():
                with self.subTest(case=case["name"], seat=handle):
                    seat = seats[handle]
                    calls = [
                        item_calls_seat(
                            row, seat,
                            calls_instrumentalists=rehearsal["callsInstrumentalists"],
                        )
                        for row in rows
                    ]
                    self.assertEqual(calls, expected["calls"])
                    window = plan_window_for_seat(
                        rows, seat,
                        start=_clock(rehearsal["start"]) or time(0, 0),
                        end=_clock(rehearsal["end"]),
                        calls_instrumentalists=rehearsal["callsInstrumentalists"],
                    )
                    if expected["window"] is None:
                        self.assertIsNone(window)
                    else:
                        self.assertIsNotNone(window)
                        assert window is not None
                        self.assertEqual(window.calls_me, expected["window"]["callsMe"])
                        self.assertEqual(window.start, _clock(expected["window"]["start"]))
                        self.assertEqual(window.end, _clock(expected["window"]["end"]))

    def test_an_undeclared_piece_offers_the_canonical_lines(self) -> None:
        self.assertEqual(row_lines(()), frozenset(CANONICAL_LINES))
        self.assertEqual(row_lines(["S1", "", "A1"]), frozenset({"S1", "A1"}))


# Voice type, seat line, and the line held on each piece of the board.
_CAST: tuple[tuple[str, str, dict[str, str]], ...] = (
    ("sopran", VoiceType.SOPRANO, {"orff": "S1", "bach": "S1", "lumen": "S1"}),
    ("alt", VoiceType.ALTO, {"orff": "A1", "bach": "A1", "lumen": "A1"}),
    ("tenor", VoiceType.TENOR, {"orff": "T1", "bach": "T1", "lumen": "T1"}),
    ("bas-b2", VoiceType.BASS, {"orff": "B2", "bach": "B1", "lumen": "B1"}),
    ("bas-uncast", VoiceType.BASS, {}),
    ("organista", VoiceType.INSTRUMENTALIST, {}),
)

_PIECES: dict[str, tuple[str, ...]] = {
    "orff": ("S1", "A1", "T1", "B1", "B2"),
    "bach": ("S1", "A1", "T1", "B1"),
    "lumen": ("S1", "S2", "A1", "T1", "B1"),
}


class RehearsalPlanApiTests(APITestCase):
    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("mgr-plan", "mgr-plan@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Laudes creaturarum",
            date_time=timezone.now() + timedelta(days=40),
            status=Project.Status.ACTIVE,
        )
        composer = Composer.objects.create(first_name="Carl", last_name="Orff")
        self.pieces: dict[str, Piece] = {}
        for order, (key, lines) in enumerate(_PIECES.items(), start=1):
            piece = Piece.objects.create(title=key.title(), composer=composer)
            for line in lines:
                PieceVoiceRequirement.objects.create(piece=piece, voice_line=line)
            ProgramItem.objects.create(project=self.project, piece=piece, order=order)
            self.pieces[key] = piece
        self.outsider_piece = Piece.objects.create(title="Elsewhere", composer=composer)

        self.users: dict[str, AbstractBaseUser] = {}
        self.seats: dict[str, Participation] = {}
        for handle, voice_type, castings in _CAST:
            user, seat = self._member(handle, voice_type)
            self.users[handle] = user
            self.seats[handle] = seat
            for key, line in castings.items():
                ProjectPieceCasting.objects.create(
                    participation=seat, piece=self.pieces[key], voice_line=line,
                )

        # The assistant: no seat, the roll call by grant.
        self.leader_user, self.leader = self._person("asystent", VoiceType.ALTO)
        RehearsalDelegate.objects.create(
            project=self.project, artist=self.leader, granted_by=self.manager,
        )
        # A member of another project: a stranger to this evening.
        self.stranger_user, stranger = self._person("obcy", VoiceType.TENOR)
        other = Project.objects.create(
            title="Other", date_time=timezone.now() + timedelta(days=50),
            status=Project.Status.ACTIVE,
        )
        Participation.objects.create(
            artist=stranger, project=other, status=Participation.Status.CONFIRMED,
        )

        start = datetime.now(WARSAW) + timedelta(days=7)
        self.rehearsal = Rehearsal.objects.create(
            project=self.project,
            date_time=start.replace(hour=18, minute=0, second=0, microsecond=0),
            timezone="Europe/Warsaw",
            duration_minutes=180,
            calls_instrumentalists=True,
        )
        self.url = f"/api/rehearsals/{self.rehearsal.id}/"
        self.plan_url = f"{self.url}plan/"

    def _person(self, handle: str, voice_type: str) -> tuple[AbstractBaseUser, Artist]:
        User = get_user_model()
        user = User.objects.create_user(
            handle, f"{handle}@test.pl", "pw123456", first_name=handle, last_name="X",
        )
        UserProfile.objects.create(user=user, role=AppRole.ARTIST)
        artist = Artist.objects.create(
            user=user, first_name=handle, last_name="X", email=f"{handle}@test.pl",
            voice_type=voice_type,
            instrument="Organy" if voice_type == VoiceType.INSTRUMENTALIST else "",
        )
        return user, artist

    def _member(self, handle: str, voice_type: str) -> tuple[AbstractBaseUser, Participation]:
        user, artist = self._person(handle, voice_type)
        seat = Participation.objects.create(
            artist=artist, project=self.project, status=Participation.Status.CONFIRMED,
        )
        return user, seat

    # The ladies-only closer of the fixture's first case, as the editor sends it.
    def _evening(self) -> list[dict]:
        return [
            {"piece": str(self.pieces["orff"].id), "starts_at": "18:00",
             "excluded_voice_lines": ["A1", "B2"], "note": "od t. 40"},
            {"piece": str(self.pieces["bach"].id), "starts_at": "19:00"},
            {"piece": str(self.pieces["lumen"].id), "starts_at": "20:30",
             "excluded_voice_lines": ["T1", "B1"], "excludes_instrumentalists": True},
        ]

    def _put(self, rows: list[dict]):
        self.client.force_authenticate(user=self.manager)
        return self.client.put(self.plan_url, {"rows": rows}, format="json")

    def _start_the_evening(self) -> None:
        Rehearsal.objects.filter(pk=self.rehearsal.pk).update(
            date_time=timezone.now() - timedelta(hours=1),
        )
        self.rehearsal.refresh_from_db()

    def _end_the_evening(self) -> None:
        """Three hours long, over two hours ago."""
        Rehearsal.objects.filter(pk=self.rehearsal.pk).update(
            date_time=timezone.now() - timedelta(hours=5),
        )
        self.rehearsal.refresh_from_db()

    def _publish(self) -> None:
        """The conductor's send, without the queue: the plan is public from
        here on (decision 14). Every read through a member's seat below
        publishes first — a draft is withheld from them."""
        Rehearsal.objects.filter(pk=self.rehearsal.pk).update(plan_announced_at=timezone.now())
        self.rehearsal.refresh_from_db()

    def _pieces(self, *keys: str) -> list[str]:
        return [str(self.pieces[key].id) for key in keys]

    # --- writing -----------------------------------------------------------

    def test_put_writes_the_plan_in_order_and_silently(self) -> None:
        with patch("roster.services.queue_broadcast") as queue:
            response = self._put(self._evening())
        self.assertEqual(response.status_code, 200, response.data)
        rows = response.data["rows"]
        self.assertEqual([row["position"] for row in rows], [1, 2, 3])
        self.assertEqual([row["title"] for row in rows], ["Orff", "Bach", "Lumen"])
        self.assertEqual([row["starts_at"] for row in rows], ["18:00", "19:00", "20:30"])
        self.assertEqual(rows[0]["note"], "od t. 40")
        self.assertEqual(rows[0]["excluded_voice_lines"], ["A1", "B2"])
        self.assertTrue(rows[2]["excludes_instrumentalists"])
        self.assertIsNone(response.data["plan_announced_at"])
        queue.assert_not_called()

    def test_put_keeps_done_stamps_reorders_and_drops(self) -> None:
        first = self._put(self._evening()).data["rows"]
        self._start_the_evening()
        self.client.force_authenticate(user=self.manager)
        ticked = self.client.patch(
            f"{self.plan_url}{first[1]['id']}/done/", {"done": True}, format="json",
        )
        self.assertEqual(ticked.status_code, 200, ticked.data)
        self.assertIsNotNone(ticked.data["done_at"])

        # Bach first, Orff dropped, a free row added, Lumen kept — by id.
        resaved = self._put([
            {"id": first[1]["id"], "piece": str(self.pieces["bach"].id), "starts_at": "18:00"},
            {"label": "Przerwa", "starts_at": "19:00"},
            {"id": first[2]["id"], "piece": str(self.pieces["lumen"].id)},
        ]).data["rows"]
        self.assertEqual([row["title"] for row in resaved], ["Bach", "Przerwa", "Lumen"])
        self.assertEqual([row["position"] for row in resaved], [1, 2, 3])
        self.assertEqual(resaved[0]["id"], first[1]["id"])
        self.assertIsNotNone(resaved[0]["done_at"])
        self.assertEqual(resaved[2]["id"], first[2]["id"])
        self.assertIsNone(resaved[2]["starts_at"])
        self.assertFalse(RehearsalPlanItem.objects.filter(pk=first[0]["id"]).exists())

    def test_reversing_the_order_never_trips_the_position_constraint(self) -> None:
        rows = self._put(self._evening()).data["rows"]
        reversed_rows = [
            {"id": row["id"], "piece": row["piece"], "starts_at": row["starts_at"]}
            for row in reversed(rows)
        ]
        response = self._put(reversed_rows)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            [row["id"] for row in response.data["rows"]],
            [row["id"] for row in reversed(rows)],
        )
        with transaction.atomic(), self.assertRaises(IntegrityError):
            RehearsalPlanItem.objects.create(
                rehearsal=self.rehearsal, position=1, label="Dup",
            )

    def test_an_unchanged_row_keeps_its_updated_at(self) -> None:
        rows = self._put(self._evening()).data["rows"]
        stamps = {row["id"]: row["updated_at"] for row in rows}
        resaved = self._put([
            {
                "id": row["id"], "piece": row["piece"], "starts_at": row["starts_at"],
                "note": row["note"], "excluded_voice_lines": row["excluded_voice_lines"],
                "excludes_instrumentalists": row["excludes_instrumentalists"],
            }
            for row in rows
        ]).data["rows"]
        self.assertEqual({row["id"]: row["updated_at"] for row in resaved}, stamps)

    def test_a_piece_outside_the_programme_is_refused(self) -> None:
        response = self._put([{"piece": str(self.outsider_piece.id)}])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(RehearsalPlanItem.objects.count(), 0)

    def test_a_row_needs_a_piece_or_a_label(self) -> None:
        self.assertEqual(self._put([{"note": "?"}]).status_code, 400)
        self.assertEqual(self._put([{"piece": None, "label": "  "}]).status_code, 400)
        self.assertEqual(
            self._put([{"piece": str(self.pieces["orff"].id), "excluded_voice_lines": ["X9"]}]).status_code,
            400,
        )

    def test_a_row_of_another_rehearsal_is_refused(self) -> None:
        other = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=9),
        )
        foreign = RehearsalPlanItem.objects.create(rehearsal=other, position=1, label="Obcy")
        response = self._put([{"id": str(foreign.id), "label": "Obcy"}])
        self.assertEqual(response.status_code, 400)

    def test_only_a_manager_writes_the_plan(self) -> None:
        self.client.force_authenticate(user=self.users["alt"])
        response = self.client.put(self.plan_url, {"rows": []}, format="json")
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(user=self.leader_user)
        response = self.client.put(self.plan_url, {"rows": []}, format="json")
        self.assertEqual(response.status_code, 403)

    # --- reading -----------------------------------------------------------

    def test_get_plan_is_for_the_people_the_evening_concerns(self) -> None:
        self._put(self._evening())
        for user, expected in (
            (self.users["alt"], 200),
            (self.leader_user, 200),
            (self.manager, 200),
            (self.stranger_user, 404),
        ):
            self.client.force_authenticate(user=user)
            self.assertEqual(self.client.get(self.plan_url).status_code, expected)

    def _read(self, handle: str) -> dict:
        self.client.force_authenticate(user=self.users[handle])
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200, handle)
        return response.data

    def test_exclusions_resolve_through_casting_then_the_section(self) -> None:
        self._put(self._evening())
        self._publish()
        cases = {
            "sopran": ([True, True, True], None),
            "alt": ([False, True, True], {"calls_me": True, "start": "19:00", "end": "21:00"}),
            "tenor": ([True, True, False], {"calls_me": True, "start": "18:00", "end": "20:30"}),
            "bas-b2": ([False, True, False], {"calls_me": True, "start": "19:00", "end": "20:30"}),
            # Uncast: "bez B2" does not bite while B1 is still offered.
            "bas-uncast": ([True, True, False], {"calls_me": True, "start": "18:00", "end": "20:30"}),
            "organista": ([True, True, False], {"calls_me": True, "start": "18:00", "end": "20:30"}),
        }
        for handle, (calls, window) in cases.items():
            with self.subTest(seat=handle):
                data = self._read(handle)
                self.assertEqual([row["calls_me"] for row in data["plan"]], calls)
                self.assertEqual(data["my_plan_window"], window)

    def test_no_row_for_the_seat_says_so_and_the_call_stands(self) -> None:
        self._put([
            {"piece": str(self.pieces["orff"].id), "starts_at": "18:00",
             "excluded_voice_lines": ["T1"]},
            {"piece": str(self.pieces["bach"].id), "starts_at": "19:00",
             "excluded_voice_lines": ["T1"]},
        ])
        self._publish()
        data = self._read("tenor")
        self.assertEqual([row["calls_me"] for row in data["plan"]], [False, False])
        self.assertEqual(
            data["my_plan_window"], {"calls_me": False, "start": None, "end": None},
        )
        self.assertIn(self.seats["tenor"], set(self.rehearsal.called_participations()))

    def test_a_named_player_reads_the_rows_as_called(self) -> None:
        self.rehearsal.calls_instrumentalists = False
        self.rehearsal.save()
        self.rehearsal.invited_participations.set([self.seats["organista"], self.seats["alt"]])
        self._put(self._evening())
        self._publish()
        data = self._read("organista")
        self.assertEqual([row["calls_me"] for row in data["plan"]], [True, True, False])

    def test_a_row_without_a_clock_flows_under_the_last_clocked_one(self) -> None:
        self._put([
            {"label": "Rozśpiewanie"},
            {"piece": str(self.pieces["orff"].id), "starts_at": "19:00",
             "excluded_voice_lines": ["T1"]},
            {"piece": str(self.pieces["bach"].id), "excluded_voice_lines": ["T1"]},
        ])
        self._publish()
        data = self._read("tenor")
        self.assertEqual([row["calls_me"] for row in data["plan"]], [True, False, False])
        self.assertEqual(
            data["my_plan_window"], {"calls_me": True, "start": "18:00", "end": "19:00"},
        )

    def test_the_schedule_dashboard_carries_the_window(self) -> None:
        self._put(self._evening())
        self._publish()
        self.client.force_authenticate(user=self.users["alt"])
        response = self.client.get("/api/participations/schedule-dashboard/")
        self.assertEqual(response.status_code, 200)
        evenings = [item for item in response.data if item["type"] == "REHEARSAL"]
        self.assertEqual(len(evenings), 1)
        rehearsal = evenings[0]["rehearsal"]
        self.assertEqual(
            rehearsal["my_plan_window"], {"calls_me": True, "start": "19:00", "end": "21:00"},
        )
        self.assertEqual([row["calls_me"] for row in rehearsal["plan"]], [False, True, True])

    def test_the_lead_sheet_shows_the_plan_without_reader_fields(self) -> None:
        # Not published: the lead sheet is the conductor's side of the gate.
        self._put(self._evening())
        self.client.force_authenticate(user=self.leader_user)
        response = self.client.get(f"{self.url}lead-sheet/")
        self.assertEqual(response.status_code, 200)
        plan = response.data["rehearsal"]["plan"]
        self.assertEqual([row["title"] for row in plan], ["Orff", "Bach", "Lumen"])
        self.assertEqual([row["calls_me"] for row in plan], [None, None, None])
        self.assertIsNone(response.data["rehearsal"]["my_plan_window"])

    def test_a_past_rehearsal_is_still_readable_with_its_ticks(self) -> None:
        # Never sent, yet readable: once the evening starts the plan is its record.
        rows = self._put(self._evening()).data["rows"]
        self._start_the_evening()
        self.client.force_authenticate(user=self.leader_user)
        self.client.patch(f"{self.plan_url}{rows[0]['id']}/done/", {"done": True}, format="json")
        data = self._read("alt")
        self.assertEqual([row["done"] for row in data["plan"]], [True, None, None])

    # --- done --------------------------------------------------------------

    def test_done_is_gated_like_the_debrief(self) -> None:
        rows = self._put(self._evening()).data["rows"]
        done_url = f"{self.plan_url}{rows[0]['id']}/done/"

        self.client.force_authenticate(user=self.users["alt"])
        self.assertEqual(
            self.client.patch(done_url, {"done": True}, format="json").status_code, 404,
        )
        self.client.force_authenticate(user=self.leader_user)
        self.assertEqual(
            self.client.patch(done_url, {"done": True}, format="json").status_code, 400,
        )
        self.assertIsNone(RehearsalPlanItem.objects.get(pk=rows[0]["id"]).done_at)

        self._start_the_evening()
        before = RehearsalPlanItem.objects.get(pk=rows[0]["id"]).updated_at
        ticked = self.client.patch(done_url, {"done": True}, format="json")
        self.assertEqual(ticked.status_code, 200, ticked.data)
        item = RehearsalPlanItem.objects.get(pk=rows[0]["id"])
        self.assertIsNotNone(item.done_at)
        # Ticking is not an edit of the plan the cast was sent.
        self.assertEqual(item.updated_at, before)

        # "Not done" is a verdict of its own, not the absence of one.
        unticked = self.client.patch(done_url, {"done": False}, format="json")
        self.assertEqual(unticked.status_code, 200)
        self.assertIsNone(unticked.data["done_at"])
        self.assertIsNotNone(unticked.data["skipped_at"])
        self.assertFalse(unticked.data["done"])

        self.client.force_authenticate(user=self.manager)
        self.assertEqual(
            self.client.patch(done_url, {"done": True}, format="json").status_code, 200,
        )
        self.assertEqual(
            self.client.patch(
                f"{self.plan_url}{'0' * 8}-0000-0000-0000-000000000000/done/",
                {"done": True}, format="json",
            ).status_code,
            404,
        )

    # --- announce ----------------------------------------------------------

    def test_announce_queues_once_and_stamps(self) -> None:
        self._put(self._evening())
        self.client.force_authenticate(user=self.manager)
        with patch("roster.services.queue_broadcast") as queue:
            response = self.client.post(f"{self.plan_url}announce/", format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNotNone(response.data["plan_announced_at"])
        self.rehearsal.refresh_from_db()
        self.assertIsNotNone(self.rehearsal.plan_announced_at)
        queue.assert_called_once()
        kwargs = queue.call_args.kwargs
        self.assertEqual(kwargs["subject_id"], str(self.rehearsal.id))
        self.assertEqual(kwargs["metadata"]["changes"], [{"field": "plan", "old": None, "new": None}])
        self.assertFalse(kwargs["metadata"]["plan_revised"])

    def test_announce_refuses_an_empty_plan_and_a_non_manager(self) -> None:
        self.client.force_authenticate(user=self.manager)
        with patch("roster.services.queue_broadcast") as queue:
            self.assertEqual(
                self.client.post(f"{self.plan_url}announce/", format="json").status_code, 400,
            )
        queue.assert_not_called()
        self._put(self._evening())
        self.client.force_authenticate(user=self.leader_user)
        self.assertEqual(
            self.client.post(f"{self.plan_url}announce/", format="json").status_code, 403,
        )

    def test_announce_refuses_an_evening_already_under_way(self) -> None:
        self._put(self._evening())
        self._start_the_evening()
        self.client.force_authenticate(user=self.manager)
        with patch("roster.services.queue_broadcast") as queue:
            self.assertEqual(
                self.client.post(f"{self.plan_url}announce/", format="json").status_code, 400,
            )
        queue.assert_not_called()
        self.rehearsal.refresh_from_db()
        self.assertIsNone(self.rehearsal.plan_announced_at)

    def test_announce_reads_as_a_plan_not_a_move(self) -> None:
        from django.utils import translation

        from notifications.message_content import MessageContentBuilder
        from notifications.models import NotificationLevel, NotificationType

        with translation.override("pl"):
            content = MessageContentBuilder.build(
                notification_type=NotificationType.REHEARSAL_UPDATED,
                level=NotificationLevel.WARNING,
                metadata={
                    "rehearsal_id": str(self.rehearsal.id),
                    "project_name": "Laudes",
                    "changes": [{"field": "plan", "old": None, "new": None}],
                },
                is_manager=False,
            )
        self.assertIn("Plan próby", content.title)
        self.assertNotIn("przeniesion", content.title.lower())

    def test_announce_lands_the_member_on_the_evening_not_the_schedule(self) -> None:
        """The window is per reader, so the notice has to land where it is
        stated. A schedule full of cards makes the reader look for the evening
        they were just told about; a manager keeps the workspace, where the
        plan is laid out rather than read."""
        from notifications.message_content import MessageContentBuilder
        from notifications.models import NotificationLevel, NotificationType

        metadata = {
            "rehearsal_id": str(self.rehearsal.id),
            "project_name": "Laudes",
            "changes": [{"field": "plan", "old": None, "new": None}],
        }

        member = MessageContentBuilder.build(
            notification_type=NotificationType.REHEARSAL_UPDATED,
            level=NotificationLevel.WARNING,
            metadata=metadata,
            is_manager=False,
        )
        self.assertEqual(
            member.url_path, f"/panel/schedule/rehearsal/{self.rehearsal.id}",
        )

        manager = MessageContentBuilder.build(
            notification_type=NotificationType.REHEARSAL_UPDATED,
            level=NotificationLevel.WARNING,
            metadata=metadata,
            is_manager=True,
        )
        self.assertEqual(manager.url_path, "/panel/rehearsals")

    def test_a_move_still_lands_on_the_schedule(self) -> None:
        """Only the plan diff is redirected to the evening's own page: an
        evening that actually moved is about a date, and the date is read
        against every other one. The schedule is handed the evening's id so it
        can open on that card, which saves the reader the hunt without taking
        the season off the screen."""
        from notifications.message_content import MessageContentBuilder
        from notifications.models import NotificationLevel, NotificationType

        content = MessageContentBuilder.build(
            notification_type=NotificationType.REHEARSAL_UPDATED,
            level=NotificationLevel.WARNING,
            metadata={
                "rehearsal_id": str(self.rehearsal.id),
                "project_name": "Laudes",
                "changes": [{"field": "date_time", "old": None, "new": None}],
            },
            is_manager=False,
        )
        self.assertEqual(
            content.url_path, f"/panel/schedule?rehearsal={self.rehearsal.id}",
        )

    # --- reminder, calendar, statistics ------------------------------------

    def _remind(self) -> list[dict[str, Any]]:
        """Run the hourly sweep over this evening and hand back the dispatches:
        one per distinct window, each with the metadata its group receives."""
        from roster.tasks import _dispatch_rehearsal_reminders

        tomorrow = (datetime.now(WARSAW) + timedelta(days=1)).replace(
            hour=18, minute=0, second=0, microsecond=0,
        )
        Rehearsal.objects.filter(pk=self.rehearsal.pk).update(date_time=tomorrow)
        with (
            override_settings(REHEARSAL_REMINDER_LEAD_HOURS=48),
            patch("roster.tasks.send_bulk_notifications_task.delay") as delay,
        ):
            _dispatch_rehearsal_reminders(timezone.now())
        return [dict(call.kwargs) for call in delay.call_args_list]

    def _user_id(self, handle: str) -> str:
        return str(self.users[handle].pk)

    def test_the_reminder_is_the_one_message_that_states_a_window(self) -> None:
        """A broadcast cannot personalise (decision 6), so the window travels
        in the reminder — which means the sweep fans out per distinct window
        rather than once for the whole call."""
        self._put(self._evening())
        self._publish()
        dispatches = self._remind()

        by_recipient = {
            recipient: call["metadata"]
            for call in dispatches
            for recipient in call["recipient_ids"]
        }
        # The tenor sits out the ladies-only closer; the alto misses the opener;
        # the uncast bass and the organist both leave when Lumen starts.
        self.assertEqual(
            by_recipient[self._user_id("tenor")]["my_window"],
            {"calls_me": True, "start": "18:00", "end": "20:30"},
        )
        self.assertEqual(
            by_recipient[self._user_id("alt")]["my_window"],
            {"calls_me": True, "start": "19:00", "end": "21:00"},
        )
        self.assertEqual(
            by_recipient[self._user_id("bas-b2")]["my_window"],
            {"calls_me": True, "start": "19:00", "end": "20:30"},
        )
        # Called throughout: the plan has nothing to add to the evening's hours.
        self.assertIsNone(by_recipient[self._user_id("sopran")]["my_window"])
        # One dispatch per distinct window, and the three seats that leave at
        # 20:30 share one of them.
        self.assertEqual(len(dispatches), 4)
        self.assertCountEqual(
            next(
                call["recipient_ids"] for call in dispatches
                if call["metadata"]["my_window"] == {
                    "calls_me": True, "start": "18:00", "end": "20:30",
                }
            ),
            [self._user_id(handle) for handle in ("tenor", "bas-uncast", "organista")],
        )

    def test_a_group_that_fails_to_dispatch_does_not_take_the_others_with_it(self) -> None:
        """`reminder_sent_at` is claimed once for the evening, so a group the
        broker refuses cannot be retried by a later beat — but the groups
        after it must still go out, and the sweep must reach the next
        rehearsal. Before the fan-out this was one call per evening."""
        from roster.tasks import _dispatch_rehearsal_reminders

        self._put(self._evening())
        self._publish()
        tomorrow = (datetime.now(WARSAW) + timedelta(days=1)).replace(
            hour=18, minute=0, second=0, microsecond=0,
        )
        Rehearsal.objects.filter(pk=self.rehearsal.pk).update(date_time=tomorrow)
        later = Rehearsal.objects.create(
            project=self.project, date_time=tomorrow + timedelta(hours=4),
            timezone="Europe/Warsaw", duration_minutes=120,
        )

        attempts: list[int] = []

        def flaky(*_args: Any, **_kwargs: Any) -> None:
            attempts.append(len(attempts))
            if len(attempts) == 2:
                raise ConnectionError("broker away")

        with (
            override_settings(REHEARSAL_REMINDER_LEAD_HOURS=48),
            patch("roster.tasks.send_bulk_notifications_task.delay", side_effect=flaky) as delay,
            self.assertLogs("roster.tasks", level="ERROR") as logs,
        ):
            sent = _dispatch_rehearsal_reminders(timezone.now())

        # Four windows for the planned evening plus one call for the unplanned
        # one: the second group was lost and logged, the other four went out.
        self.assertEqual(delay.call_count, 5)
        self.assertEqual(sent, 2)
        self.assertEqual(len(logs.records), 1)
        self.assertIn(str(self.rehearsal.id), logs.output[0])
        later.refresh_from_db()
        self.assertIsNotNone(later.reminder_sent_at)

    def test_the_reminder_carries_the_plan_and_lands_on_the_evening(self) -> None:
        from django.utils import translation

        from notifications.message_content import MessageContentBuilder
        from notifications.models import NotificationLevel, NotificationType

        self._put(self._evening())
        self._publish()
        metadata = self._remind()[0]["metadata"]
        self.assertEqual(
            [row["title"] for row in metadata["plan"]], ["Orff", "Bach", "Lumen"],
        )
        self.assertEqual(metadata["plan"][0]["time"], "18:00")
        self.assertEqual(metadata["plan"][0]["note"], "od t. 40")

        with translation.override("pl"):
            content = MessageContentBuilder.build(
                notification_type=NotificationType.REHEARSAL_REMINDER,
                level=NotificationLevel.INFO,
                metadata={
                    **metadata,
                    "my_window": {"calls_me": True, "start": "19:00", "end": "21:00"},
                },
                is_manager=False,
            )
        self.assertIn("19:00", content.body)
        self.assertEqual(
            content.url_path, f"/panel/schedule/rehearsal/{self.rehearsal.id}",
        )
        labels = {row.label: row.value for row in content.details}
        self.assertIn("Orff", labels["Plan"])
        self.assertEqual(labels["Twoja część"], "19:00–21:00")  # noqa: RUF001

    def test_a_voice_the_plan_skips_is_told_the_call_stands(self) -> None:
        """Decision 8: silence here would read as "you are not needed", which
        is the one thing `calls_me: false` does not mean."""
        from django.utils import translation

        from notifications.message_content import MessageContentBuilder
        from notifications.models import NotificationLevel, NotificationType

        with translation.override("pl"):
            content = MessageContentBuilder.build(
                notification_type=NotificationType.REHEARSAL_REMINDER,
                level=NotificationLevel.INFO,
                metadata={
                    "rehearsal_id": str(self.rehearsal.id),
                    "project_name": "Laudes",
                    "my_window": {"calls_me": False, "start": None, "end": None},
                },
                is_manager=False,
            )
        labels = {row.label: row.value for row in content.details}
        self.assertIn("wezwanie zostaje w mocy", labels["Twoja część"])

    def test_the_calendar_keeps_the_plan_out(self) -> None:
        """A subscribed calendar refreshes a feed every few hours and keeps
        what it last read, so a plan in the description would be stale exactly
        when somebody opens the event to read it."""
        from core.ical_service import ICalGeneratorService

        self._put(self._evening())
        feed = ICalGeneratorService._build_ics([], [self.rehearsal])
        self.assertIn(f"UID:rehearsal_{self.rehearsal.id}@voctensemble.com", feed)
        for title in ("Orff", "Bach", "Lumen"):
            self.assertNotIn(title, feed)

    def test_the_programme_counts_nothing_until_a_verdict_exists(self) -> None:
        """A tick during the evening is a verdict before the end is: the
        figures appear with it, and the zero is the point from then on."""
        rows = self._put(self._evening()).data["rows"]
        self.client.force_authenticate(user=self.manager)
        programme = f"/api/program-items/?project={self.project.id}"

        before = self.client.get(programme).data
        self.assertEqual({item["rehearsed_count"] for item in before}, {None})

        self._start_the_evening()
        self.client.patch(f"{self.plan_url}{rows[1]['id']}/done/", {"done": True}, format="json")

        after = {str(item["piece"]): item for item in self.client.get(programme).data}
        worked = after[str(self.pieces["bach"].id)]
        self.assertEqual(worked["rehearsed_count"], 1)
        evening = localize(self.rehearsal.date_time, self.rehearsal.timezone)
        assert evening is not None
        self.assertEqual(worked["last_rehearsed_on"], evening.date().isoformat())
        # Under way and untouched: not counted until the evening is over.
        untouched = after[str(self.pieces["orff"].id)]
        self.assertEqual(untouched["rehearsed_count"], 0)
        self.assertIsNone(untouched["last_rehearsed_on"])

    def test_the_programme_counts_evenings_as_the_plan_said(self) -> None:
        """Decision 17. Nobody debriefed this evening, and it still counts:
        its main rows read done. A piece worked in the sectional slot and
        again in the tutti is one rehearsal of it, a reserve piece nobody
        confirmed is not rehearsed, and an evening not held yet adds nothing."""
        orff, bach, lumen = self._pieces("orff", "bach", "lumen")
        self._put([
            {"piece": bach, "starts_at": "18:00"},
            {"label": "Przerwa", "starts_at": "19:00", "is_break": True},
            {"piece": bach, "starts_at": "19:15"},
            {"piece": orff, "is_reserve": True},
        ])
        later = Rehearsal.objects.create(
            project=self.project, date_time=timezone.now() + timedelta(days=3),
            timezone="Europe/Warsaw", duration_minutes=120,
        )
        RehearsalPlanItem.objects.create(rehearsal=later, position=1, piece=self.pieces["lumen"])

        self.client.force_authenticate(user=self.manager)
        programme = f"/api/program-items/?project={self.project.id}"
        self.assertEqual(
            {item["rehearsed_count"] for item in self.client.get(programme).data}, {None},
        )

        self._end_the_evening()
        after = {str(item["piece"]): item for item in self.client.get(programme).data}
        self.assertEqual(after[bach]["rehearsed_count"], 1)
        evening = localize(self.rehearsal.date_time, self.rehearsal.timezone)
        assert evening is not None
        self.assertEqual(after[bach]["last_rehearsed_on"], evening.date().isoformat())
        self.assertEqual(after[orff]["rehearsed_count"], 0)
        self.assertEqual(after[lumen]["rehearsed_count"], 0)
        self.assertIsNone(after[lumen]["last_rehearsed_on"])

    def test_retrieve_names_the_programme_for_a_page_read_on_its_own(self) -> None:
        """The rehearsal page has no list around it to borrow a title from, so
        the read carries one. Per-reader fields come with it — that is the
        whole reason the page asks for this read rather than the list."""
        self._put(self._evening())
        self._publish()
        self.client.force_authenticate(user=self.users["tenor"])
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["project_title"], self.project.title)
        self.assertTrue(response.data["plan"])
        self.assertIsNotNone(response.data["plan"][0]["calls_me"])
        # The tenor is out of the ladies-only closer, so his evening ends when
        # it starts — the window the page is built to state.
        self.assertEqual(
            response.data["my_plan_window"],
            {"calls_me": True, "start": "18:00", "end": "20:30"},
        )

    def test_retrieve_says_which_rows_open_for_the_reader(self) -> None:
        """A row's piece links to the songbook only where the songbook would
        answer: an item cast on the organist alone is withheld from a singer's
        seat, open to the player, and unknown (null) to a manager, who holds
        no seat and is refused nothing. A free row opens nothing."""
        toccata = Piece.objects.create(
            title="Toccata", composer=self.pieces["orff"].composer,
        )
        ProgramItem.objects.create(project=self.project, piece=toccata, order=9)
        ProjectPieceCasting.objects.create(
            participation=self.seats["organista"], piece=toccata, voice_line="",
        )
        self._put([
            {"piece": str(toccata.id), "starts_at": "18:00"},
            *self._evening()[:1],
            {"label": "Przerwa"},
        ])
        self._publish()

        self.client.force_authenticate(user=self.users["tenor"])
        rows = self.client.get(self.url).data["plan"]
        self.assertEqual([row["piece_open"] for row in rows], [False, True, False])

        self.client.force_authenticate(user=self.users["organista"])
        rows = self.client.get(self.url).data["plan"]
        self.assertEqual([row["piece_open"] for row in rows], [True, True, False])

        self.client.force_authenticate(user=self.manager)
        rows = self.client.get(self.url).data["plan"]
        self.assertEqual([row["piece_open"] for row in rows], [None, None, None])

    def test_retrieve_reads_a_member_through_the_preview_parameter(self) -> None:
        """The card in a manager's preview of a member states that member's
        window; the page opened from it must state the same one, so the read
        honours the same ``?artist=`` the dashboard does. Without it the
        manager, seatless, gets no window at all."""
        self._put(self._evening())
        self._publish()
        self.client.force_authenticate(user=self.manager)
        own = self.client.get(self.url)
        self.assertEqual(own.status_code, 200)
        self.assertIsNone(own.data["my_plan_window"])

        tenor_artist = self.seats["tenor"].artist
        previewed = self.client.get(self.url, {"artist": str(tenor_artist.id)})
        self.assertEqual(previewed.status_code, 200)
        self.assertEqual(
            previewed.data["my_plan_window"],
            {"calls_me": True, "start": "18:00", "end": "20:30"},
        )

        self.client.force_authenticate(user=self.users["alt"])
        refused = self.client.get(self.url, {"artist": str(tenor_artist.id)})
        self.assertEqual(refused.status_code, 403)

    # --- the publish gate (decision 14) --------------------------------------

    def test_a_draft_stays_on_the_conductors_side(self) -> None:
        """A half-laid plan saved on Sunday must not put a window on a
        tenor's card. Every read a member makes says nothing until the send —
        so does a manager's preview of that member; the manager's own read and
        the lead sheet show the draft being worked on."""
        self._put(self._evening())
        tenor_artist = str(self.seats["tenor"].artist.id)

        tenor = self._read("tenor")
        self.assertEqual(tenor["plan"], [])
        self.assertIsNone(tenor["my_plan_window"])
        self.client.force_authenticate(user=self.users["tenor"])
        dashboard = self.client.get("/api/participations/schedule-dashboard/").data
        card = next(item for item in dashboard if item["type"] == "REHEARSAL")["rehearsal"]
        self.assertEqual(card["plan"], [])
        self.assertIsNone(card["my_plan_window"])
        listed = self.client.get(f"/api/rehearsals/?project={self.project.id}").data
        self.assertEqual([row["plan"] for row in listed], [[]])
        self.assertEqual(self.client.get(self.plan_url).data["rows"], [])

        self.client.force_authenticate(user=self.manager)
        self.assertEqual(len(self.client.get(self.url).data["plan"]), 3)
        self.assertEqual(len(self.client.get(self.plan_url).data["rows"]), 3)
        previewed = self.client.get(self.url, {"artist": tenor_artist}).data
        self.assertEqual(previewed["plan"], [])
        self.assertIsNone(previewed["my_plan_window"])
        previewed_card = next(
            item for item in self.client.get(
                "/api/participations/schedule-dashboard/", {"artist": tenor_artist},
            ).data
            if item["type"] == "REHEARSAL"
        )["rehearsal"]
        self.assertEqual(previewed_card["plan"], [])

        self.client.force_authenticate(user=self.leader_user)
        self.assertEqual(len(self.client.get(self.plan_url).data["rows"]), 3)

        self._publish()
        tenor = self._read("tenor")
        self.assertEqual(len(tenor["plan"]), 3)
        self.assertEqual(
            tenor["my_plan_window"], {"calls_me": True, "start": "18:00", "end": "20:30"},
        )

    def test_a_started_evening_shows_its_plan_unsent(self) -> None:
        """After the start the plan is the evening's record, sent or not."""
        self._put(self._evening())
        self._start_the_evening()
        self.assertEqual(len(self._read("alt")["plan"]), 3)
        self.client.force_authenticate(user=self.users["alt"])
        self.assertEqual(len(self.client.get(self.plan_url).data["rows"]), 3)

    def test_the_reminder_keeps_a_draft_to_itself(self) -> None:
        """The gate's easiest reader to miss: the reminder states a window
        per reader and prints the plan in the e-mail. A draft travels in
        neither, and the evening goes out as one group."""
        self._put(self._evening())
        dispatches = self._remind()
        self.assertEqual(len(dispatches), 1)
        self.assertEqual(dispatches[0]["metadata"]["plan"], [])
        self.assertIsNone(dispatches[0]["metadata"]["my_window"])

    # --- reserve and break (decisions 15, 16) --------------------------------

    def test_the_reserve_closes_the_plan(self) -> None:
        from django.utils import translation

        from notifications.message_content import MessageContentBuilder
        from notifications.models import NotificationLevel, NotificationType

        orff, bach, lumen = self._pieces("orff", "bach", "lumen")
        refused = self._put([{"piece": orff, "is_reserve": True}, {"piece": bach}])
        self.assertEqual(refused.status_code, 400)
        self.assertEqual(RehearsalPlanItem.objects.count(), 0)

        saved = self._put([
            {"piece": orff, "starts_at": "18:00"},
            {"piece": bach, "is_reserve": True},
            {"piece": lumen, "is_reserve": True, "note": "tylko fuga"},
        ])
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual([row["is_reserve"] for row in saved.data["rows"]], [False, True, True])

        self._publish()
        lines = self._remind()[0]["metadata"]["plan"]
        self.assertEqual([line["reserve"] for line in lines], [False, True, True])
        with translation.override("pl"):
            content = MessageContentBuilder.build(
                notification_type=NotificationType.REHEARSAL_REMINDER,
                level=NotificationLevel.INFO,
                metadata={
                    "rehearsal_id": str(self.rehearsal.id),
                    "project_name": "Laudes",
                    "plan": lines,
                },
                is_manager=False,
            )
        plan = {row.label: row.value for row in content.details}["Plan"]
        self.assertEqual(
            plan.split("\n"),
            ["18:00 · Orff", "Jeśli starczy czasu:", "Bach", "Lumen · tylko fuga"],
        )

    def test_a_break_calls_nobody_and_is_never_ticked(self) -> None:
        """"20:00 przerwa, 20:15 Lumen same panie": the men go home at the
        break, not after it."""
        orff, lumen = self._pieces("orff", "lumen")
        for row in (
            {"label": "Przerwa", "is_break": True, "piece": orff},
            {"label": "Przerwa", "is_break": True, "excluded_voice_lines": ["T1"]},
            {"label": "Przerwa", "is_break": True, "excludes_instrumentalists": True},
            {"is_break": True},
        ):
            with self.subTest(row=row):
                self.assertEqual(self._put([row]).status_code, 400)

        rows = self._put([
            {"piece": orff, "starts_at": "18:00"},
            {"label": "Przerwa", "starts_at": "20:00", "is_break": True},
            {"piece": lumen, "starts_at": "20:15", "excluded_voice_lines": ["T1", "B1"]},
        ]).data["rows"]
        self.assertTrue(rows[1]["is_break"])
        self._publish()
        tenor = self._read("tenor")
        self.assertEqual([row["calls_me"] for row in tenor["plan"]], [True, False, False])
        self.assertEqual(
            tenor["my_plan_window"], {"calls_me": True, "start": "18:00", "end": "20:00"},
        )
        organist = self._read("organista")
        self.assertEqual([row["calls_me"] for row in organist["plan"]], [True, False, True])

        self._start_the_evening()
        self.client.force_authenticate(user=self.manager)
        ticked = self.client.patch(
            f"{self.plan_url}{rows[1]['id']}/done/", {"done": True}, format="json",
        )
        self.assertEqual(ticked.status_code, 400)

    # --- done defaults to the plan (decision 17) -----------------------------

    def test_done_follows_the_plan_unless_the_debrief_says_otherwise(self) -> None:
        orff, bach, lumen = self._pieces("orff", "bach", "lumen")
        rows = self._put([
            {"piece": orff, "starts_at": "18:00"},    # ticked done
            {"piece": bach},                          # ticked not done
            {"piece": lumen},                         # untouched main
            {"label": "Przerwa", "is_break": True},   # a break
            {"piece": bach, "is_reserve": True},      # untouched reserve
            {"piece": orff, "is_reserve": True},      # reserve, ticked done
        ]).data["rows"]
        self.assertEqual([row["done"] for row in rows], [None] * 6)

        self._start_the_evening()
        self.client.force_authenticate(user=self.manager)
        for index, done in ((0, True), (1, False), (5, True)):
            response = self.client.patch(
                f"{self.plan_url}{rows[index]['id']}/done/", {"done": done}, format="json",
            )
            self.assertEqual(response.status_code, 200, response.data)

        # Under way: the verdicts are known, the untouched rows not yet.
        during = self._read("alt")["plan"]
        self.assertEqual(
            [row["done"] for row in during], [True, False, None, None, None, True],
        )

        # Over with no debrief for the rest: the plan is the default.
        self._end_the_evening()
        after = self._read("alt")["plan"]
        self.assertEqual(
            [row["done"] for row in after], [True, False, True, None, False, True],
        )
        self.assertIsNone(after[2]["done_at"])
        self.assertIsNone(after[2]["skipped_at"])

        # An explicit "not done" wins over the default on a main row.
        self.client.force_authenticate(user=self.manager)
        self.client.patch(f"{self.plan_url}{rows[2]['id']}/done/", {"done": False}, format="json")
        self.assertFalse(self._read("alt")["plan"][2]["done"])

    # --- "zmieniony po wysłaniu" and the resend (decision 14) ----------------

    def test_every_change_the_cast_could_notice_moves_plan_changed_at(self) -> None:
        first = self._put(self._evening())
        stamp = first.data["plan_changed_at"]
        self.assertIsNotNone(stamp)
        same = [
            {
                "id": row["id"], "piece": row["piece"], "starts_at": row["starts_at"],
                "note": row["note"], "excluded_voice_lines": row["excluded_voice_lines"],
                "excludes_instrumentalists": row["excludes_instrumentalists"],
            }
            for row in first.data["rows"]
        ]
        self.assertEqual(self._put(same).data["plan_changed_at"], stamp)

        # Dropping the last row changes no surviving row, and is a change.
        dropped = self._put(same[:2]).data["plan_changed_at"]
        self.assertGreater(dropped, stamp)

        # A tick is the debrief, not an edit of the plan.
        self._start_the_evening()
        self.client.force_authenticate(user=self.manager)
        self.client.patch(f"{self.plan_url}{same[0]['id']}/done/", {"done": True}, format="json")
        self.rehearsal.refresh_from_db()
        self.assertEqual(self.rehearsal.plan_changed_at, dropped)

    def test_a_second_send_says_the_plan_changed(self) -> None:
        from django.utils import translation

        from notifications.message_content import MessageContentBuilder
        from notifications.models import NotificationLevel, NotificationType

        announce = f"{self.plan_url}announce/"
        self._put(self._evening())
        self.client.force_authenticate(user=self.manager)
        with patch("roster.services.queue_broadcast") as queue:
            self.assertEqual(self.client.post(announce, format="json").status_code, 200)
            # Nothing changed since the send: a resend would repeat it.
            self.assertEqual(self.client.post(announce, format="json").status_code, 400)
            self._put(self._evening()[:2])
            self.assertEqual(self.client.post(announce, format="json").status_code, 200)
        first, second = (call.kwargs["metadata"] for call in queue.call_args_list)
        self.assertFalse(first["plan_revised"])
        self.assertTrue(second["plan_revised"])

        with translation.override("pl"):
            content = MessageContentBuilder.build(
                notification_type=NotificationType.REHEARSAL_UPDATED,
                level=NotificationLevel.WARNING,
                metadata=second,
                is_manager=False,
            )
        self.assertIn("Zmiana planu próby", content.title)
        self.assertEqual(content.url_path, f"/panel/schedule/rehearsal/{self.rehearsal.id}")

    def test_a_resend_the_cast_has_not_heard_before_is_still_the_plan(self) -> None:
        """The queue holds a send until the conductor publishes it. While the
        first one still waits, the cast has heard nothing, so the one message
        they will get must not say the plan changed."""
        from notifications.models import PendingAnnouncement

        announce = f"{self.plan_url}announce/"
        self._put(self._evening())
        self.client.force_authenticate(user=self.manager)
        self.assertEqual(self.client.post(announce, format="json").status_code, 200)
        self._put(self._evening()[:2])
        self.assertEqual(self.client.post(announce, format="json").status_code, 200)
        pending = PendingAnnouncement.objects.filter(
            subject_id=str(self.rehearsal.id), change_field="plan",
        )
        self.assertEqual(pending.count(), 2)
        self.assertFalse(any(row.metadata.get("plan_revised") for row in pending))
