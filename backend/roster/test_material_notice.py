"""
Material notices fold per piece — [listeners.handle_piece_material_updated] opens
a window, [tasks.dispatch_material_notice_task] closes it.

Every uploaded track fires the material event, so without the window a batch of
rehearsal MP3s is a dozen pushes per singer. These cases pin it: however many
events land in one window, one notice goes out, it names the kind only when the
events agree, and it reaches only the people the piece is programmed for.
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from archive.models import Piece
from archive.signals import piece_material_updated_event

from .models import Artist, Participation, ProgramItem, Project, VoiceType
from .tasks import dispatch_material_notice_task

SCHEDULE = "roster.listeners.dispatch_material_notice_task.apply_async"
BULK = "roster.tasks.send_bulk_notifications_task.delay"


class MaterialNoticeWindowTests(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.piece = Piece.objects.create(title="Lacrimosa")
        project = Project.objects.create(
            title="Requiem", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.DRAFT,
        )
        ProgramItem.objects.create(project=project, piece=self.piece, order=1)
        self.user = get_user_model().objects.create_user(
            username="mat-alt", email="mat-alt@test.pl", password="pw123456"
        )
        artist = Artist.objects.create(
            user=self.user, first_name="Ala", last_name="Alt",
            email="mat-alt@test.pl", voice_type=VoiceType.ALTO,
        )
        Participation.objects.create(
            artist=artist, project=project, status=Participation.Status.CONFIRMED,
        )

    def _event(self, kind: str, piece: Piece | None = None) -> None:
        piece_material_updated_event.send(
            sender=self.__class__, piece=piece or self.piece, kind=kind,
        )

    def _close_window(self, piece: Piece | None = None):
        with patch(BULK) as bulk:
            dispatch_material_notice_task(str((piece or self.piece).id))
        return bulk

    def test_a_batch_inside_the_window_is_one_notice(self) -> None:
        with patch(SCHEDULE) as schedule:
            for _ in range(3):
                self._event("recording")

        schedule.assert_called_once()
        self.assertEqual(schedule.call_args.kwargs["args"], [str(self.piece.id)])
        self.assertEqual(schedule.call_args.kwargs["countdown"], 10 * 60)

        bulk = self._close_window()
        bulk.assert_called_once()
        self.assertEqual(bulk.call_args.kwargs["recipient_ids"], [str(self.user.id)])
        self.assertEqual(bulk.call_args.kwargs["metadata"]["material_kind"], "recording")

    def test_mixed_kinds_name_no_kind(self) -> None:
        with patch(SCHEDULE):
            self._event("recording")
            self._event("score")

        bulk = self._close_window()
        self.assertIsNone(bulk.call_args.kwargs["metadata"]["material_kind"])

    def test_a_piece_outside_any_project_sends_nothing(self) -> None:
        loose = Piece.objects.create(title="Ave verum")
        with patch(SCHEDULE):
            self._event("recording", piece=loose)

        self._close_window(piece=loose).assert_not_called()

    def test_a_closed_window_lets_the_next_event_open_another(self) -> None:
        with patch(SCHEDULE) as schedule:
            self._event("recording")
            self._close_window()
            self._event("score")

        self.assertEqual(schedule.call_count, 2)
        self.assertEqual(self._close_window().call_args.kwargs["metadata"]["material_kind"], "score")

    def test_a_failed_schedule_leaves_no_window_open(self) -> None:
        # A gate with no task behind it would swallow every upload to the piece
        # until it expired.
        with patch(SCHEDULE, side_effect=RuntimeError("broker down")):
            self._event("recording")
        with patch(SCHEDULE) as schedule:
            self._event("recording")

        schedule.assert_called_once()

    def test_a_task_that_runs_at_once_still_finds_the_kind(self) -> None:
        # Eager Celery runs the task inside `apply_async`, as an idle worker
        # nearly does — the kind has to be recorded before the gate schedules it.
        with patch(BULK) as bulk:
            self._event("score")

        bulk.assert_called_once()
        self.assertEqual(bulk.call_args.kwargs["metadata"]["material_kind"], "score")
