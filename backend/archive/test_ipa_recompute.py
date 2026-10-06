"""
@file archive/test_ipa_recompute.py
@description Tests for re-deriving a Latin piece's IPA guide in a chosen
             pronunciation system: which pieces qualify, what a recompute
             writes and bills, the card's endpoint (including the refusal to
             replace a hand-edited guide without a yes), the Celery task's job
             state, the system recorded by ingestion, and the bulk command.
@architecture Enterprise SaaS 2026
@module archive/test_ipa_recompute
"""
from decimal import Decimal
from io import StringIO
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APITestCase

from archive.dtos import CallCost, IpaTranscriptionResult
from archive.infrastructure.ai_client import (
    AIClientError,
    AIClientOverloadedError,
    AIModel,
    CostCeilingExceeded,
)
from archive.infrastructure.prompts import TRANSCRIBE_IPA
from archive.models import (
    LatinPronunciation,
    Piece,
    ProvenanceRecord,
    ProvenanceSource,
    ScoreEdition,
)
from archive.services.ipa import (
    IpaRecomputeRefused,
    ipa_is_hand_edited,
    ipa_job,
    mark_ipa_job_running,
)
from archive.services.language import is_latin
from archive.tasks import persist_analysis, recompute_ipa, recompute_piece_ipa
from core.constants import AppRole
from core.models import UserProfile

User = get_user_model()

_SUNG = "Gloria in excelsis Deo\net in terra pax"
_GERMAN_IPA = "ˈɡloːria ɪn ɛksˈtsɛlzɪs ˈdeːo\nɛt ɪn ˈtɛra paks"  # noqa: RUF001


def _fake_client(ipa: str = _GERMAN_IPA, cents: int = 3) -> MagicMock:
    client = MagicMock()
    client.parse.return_value = (
        IpaTranscriptionResult(ipa_transcription=ipa),
        CallCost(model=AIModel.SONNET, total_usd=Decimal("0.03"), total_cents=cents),
    )
    return client


def _stamp(piece: Piece, source: str) -> None:
    ProvenanceRecord.objects.create(
        content_type=ContentType.objects.get_for_model(Piece),
        object_id=piece.pk,
        field_name="lyrics_ipa",
        source=source,
    )


class IsLatinTests(SimpleTestCase):
    def test_every_spelling_of_latin_qualifies(self) -> None:
        for value in ("la", "Latin", "łacina", "LATIN", "pl+la", "Polish + Latin"):
            with self.subTest(value=value):
                self.assertTrue(is_latin(value))

    def test_other_languages_do_not(self) -> None:
        for value in ("", None, "pl", "German", "fr+de"):
            with self.subTest(value=value):
                self.assertFalse(is_latin(value))


class RecomputePieceIpaTests(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.piece = Piece.objects.create(
            title="Gloria", language="la", lyrics_original=_SUNG,
            lyrics_ipa="ˈɡlɔria ɪn ekˈʃɛlsis", lyrics_ipa_system="",  # noqa: RUF001
        )

    def test_writes_the_guide_its_system_and_ai_provenance(self) -> None:
        client = _fake_client()
        outcome = recompute_piece_ipa(self.piece, LatinPronunciation.GERMANIC, client=client)

        self.piece.refresh_from_db()
        self.assertEqual(self.piece.lyrics_ipa, _GERMAN_IPA)
        self.assertEqual(self.piece.lyrics_ipa_system, LatinPronunciation.GERMANIC)
        record = ProvenanceRecord.objects.filter(
            object_id=self.piece.pk, field_name="lyrics_ipa",
        ).latest("retrieved_at")
        self.assertEqual(record.source, ProvenanceSource.AI_SONNET)
        self.assertEqual(record.prompt_version, TRANSCRIBE_IPA.version)
        self.assertTrue(outcome.aligned)

    def test_the_call_names_the_chosen_system(self) -> None:
        client = _fake_client()
        recompute_piece_ipa(self.piece, LatinPronunciation.CLASSICAL, client=client)
        user_content = client.parse.call_args.kwargs["user_content"]
        self.assertIn("Latin pronunciation system: CLASSICAL", user_content)
        self.assertIn(_SUNG, user_content)

    def test_bills_the_default_edition(self) -> None:
        edition = ScoreEdition.objects.create(
            piece=self.piece, original_filename="gloria.pdf", sha256="c" * 64,
        )
        recompute_piece_ipa(self.piece, LatinPronunciation.GERMANIC, client=_fake_client(cents=4))
        edition.refresh_from_db()
        self.assertEqual(edition.ingestion_cost_cents_lifetime, 4)

    def test_refuses_a_piece_not_sung_in_latin(self) -> None:
        self.piece.language = "pl"
        self.piece.save(update_fields=["language"])
        client = _fake_client()
        with self.assertRaises(IpaRecomputeRefused) as ctx:
            recompute_piece_ipa(self.piece, LatinPronunciation.GERMANIC, client=client)
        self.assertEqual(ctx.exception.code, "not_latin")
        client.parse.assert_not_called()

    def test_an_empty_answer_keeps_the_current_guide(self) -> None:
        before = self.piece.lyrics_ipa
        with self.assertRaises(AIClientError):
            recompute_piece_ipa(self.piece, LatinPronunciation.GERMANIC, client=_fake_client(ipa="\n"))
        self.piece.refresh_from_db()
        self.assertEqual(self.piece.lyrics_ipa, before)


@override_settings(ANTHROPIC_API_KEY="test-key")
class RecomputeIpaEndpointTests(APITestCase):
    @staticmethod
    def _user(username: str, role: str):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.pl", password="pw123456",
        )
        UserProfile.objects.create(user=user, role=role)
        return user

    def setUp(self) -> None:
        cache.clear()
        self.manager = self._user("ipa-mgr", AppRole.MANAGER)
        self.artist = self._user("ipa-art", AppRole.ARTIST)
        self.piece = Piece.objects.create(
            title="Gloria", language="la", lyrics_original=_SUNG, lyrics_ipa="old",
        )
        self.url = f"/api/pieces/{self.piece.id}/recompute_ipa/"

    def test_requires_manager(self) -> None:
        self.client.force_authenticate(self.artist)
        resp = self.client.post(self.url, {"system": "germanic"}, format="json")
        self.assertEqual(resp.status_code, 403)

    @patch("archive.services.ingestion.recompute_ipa")
    def test_dispatches_and_reports_the_running_job(self, task: MagicMock) -> None:
        task.delay.return_value.id = "task-1"
        self.client.force_authenticate(self.manager)
        resp = self.client.post(self.url, {"system": "italianate"}, format="json")

        self.assertEqual(resp.status_code, 202)
        task.delay.assert_called_once_with(str(self.piece.pk), "italianate")
        self.assertEqual(resp.json()["lyrics_ipa_job"]["state"], "running")
        self.assertEqual(resp.json()["lyrics_ipa_job"]["system"], "italianate")

    @patch("archive.services.ingestion.recompute_ipa")
    def test_a_hand_edited_guide_needs_an_explicit_yes(self, task: MagicMock) -> None:
        _stamp(self.piece, ProvenanceSource.MANUAL)
        self.client.force_authenticate(self.manager)

        refused = self.client.post(self.url, {"system": "germanic"}, format="json")
        self.assertEqual(refused.status_code, 409)
        self.assertEqual(refused.json()["error_code"], "hand_edited")
        task.delay.assert_not_called()

        accepted = self.client.post(
            self.url, {"system": "germanic", "replace_manual": True}, format="json",
        )
        self.assertEqual(accepted.status_code, 202)
        task.delay.assert_called_once()

    @patch("archive.services.ingestion.recompute_ipa")
    def test_a_second_click_while_running_is_refused(self, task: MagicMock) -> None:
        mark_ipa_job_running(self.piece.pk, "germanic")
        self.client.force_authenticate(self.manager)
        resp = self.client.post(self.url, {"system": "germanic"}, format="json")
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["error_code"], "running")
        task.delay.assert_not_called()

    def test_refuses_a_piece_not_sung_in_latin(self) -> None:
        self.piece.language = "de"
        self.piece.save(update_fields=["language"])
        self.client.force_authenticate(self.manager)
        resp = self.client.post(self.url, {"system": "germanic"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["error_code"], "not_latin")

    def test_refuses_an_unknown_system(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.post(self.url, {"system": "anglican"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["error_code"], "invalid_system")

    def test_the_card_learns_whether_it_may_offer_the_button(self) -> None:
        polish = Piece.objects.create(title="Bogurodzica", language="pl", lyrics_original="x")
        self.client.force_authenticate(self.manager)
        self.assertTrue(
            self.client.get(f"/api/pieces/{self.piece.id}/").json()["lyrics_ipa_recomputable"],
        )
        self.assertFalse(
            self.client.get(f"/api/pieces/{polish.id}/").json()["lyrics_ipa_recomputable"],
        )

    def test_clearing_the_guide_by_hand_clears_its_system(self) -> None:
        self.piece.lyrics_ipa_system = LatinPronunciation.GERMANIC
        self.piece.save(update_fields=["lyrics_ipa_system"])
        self.client.force_authenticate(self.manager)
        self.client.patch(f"/api/pieces/{self.piece.id}/", {"lyrics_ipa": ""}, format="json")
        self.piece.refresh_from_db()
        self.assertEqual(self.piece.lyrics_ipa_system, "")


class RecomputeIpaTaskTests(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.piece = Piece.objects.create(title="Gloria", language="la", lyrics_original=_SUNG)

    @patch("archive.tasks.recompute_piece_ipa")
    def test_success_clears_the_job(self, recompute: MagicMock) -> None:
        mark_ipa_job_running(self.piece.pk, "germanic")
        recompute_ipa(str(self.piece.pk), "germanic")
        self.assertIsNone(ipa_job(self.piece.pk))

    @patch("archive.tasks.recompute_piece_ipa")
    def test_a_spent_budget_marks_the_job_failed(self, recompute: MagicMock) -> None:
        recompute.side_effect = CostCeilingExceeded(entity_id="daily", spent_cents=1, ceiling_cents=1)
        mark_ipa_job_running(self.piece.pk, "germanic")
        recompute_ipa(str(self.piece.pk), "germanic")
        job = ipa_job(self.piece.pk)
        assert job is not None
        self.assertEqual(job["state"], "failed")
        self.assertEqual(job["reason"], "budget")

    @patch("archive.tasks.recompute_piece_ipa")
    def test_an_overload_with_no_retry_left_marks_the_job_failed(self, recompute: MagicMock) -> None:
        # Called directly, `self.retry` hands back the overload exactly as a worker
        # does once the retries are spent: the job must not stay "running".
        recompute.side_effect = AIClientOverloadedError("529 overloaded")
        mark_ipa_job_running(self.piece.pk, "germanic")
        recompute_ipa(str(self.piece.pk), "germanic")
        job = ipa_job(self.piece.pk)
        assert job is not None
        self.assertEqual(job["state"], "failed")
        self.assertEqual(job["reason"], "overloaded")


class IngestionRecordsTheSystemTests(TestCase):
    def _persist(self, piece: Piece, language: str) -> None:
        edition = ScoreEdition.objects.create(
            piece=piece, original_filename="x.pdf", sha256=str(piece.pk).replace("-", "")[:32] * 2,
        )
        persist_analysis({
            "edition_id": str(edition.id),
            "piece_id": str(piece.id),
            "analysis": {
                "title": piece.title,
                "composer_full_name": "Anon",
                "confidence": 0.9,
                "sung_text": _SUNG,
                "ipa_transcription": _GERMAN_IPA,
                "sung_text_language": language,
            },
        })
        piece.refresh_from_db()

    def test_a_latin_guide_is_recorded_as_german(self) -> None:
        piece = Piece.objects.create(title="Gloria")
        self._persist(piece, "la")
        self.assertEqual(piece.lyrics_ipa_system, LatinPronunciation.GERMANIC)

    def test_a_guide_in_another_language_carries_no_system(self) -> None:
        piece = Piece.objects.create(title="Lied")
        self._persist(piece, "de")
        self.assertEqual(piece.lyrics_ipa_system, "")


class RecomputeIpaCommandTests(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.todo = Piece.objects.create(
            title="A Gloria", language="la", lyrics_original=_SUNG, lyrics_ipa="old",
        )
        self.done = Piece.objects.create(
            title="B Credo", language="la", lyrics_original=_SUNG, lyrics_ipa="new",
            lyrics_ipa_system=LatinPronunciation.GERMANIC,
        )
        self.hand = Piece.objects.create(
            title="C Sanctus", language="la", lyrics_original=_SUNG, lyrics_ipa="fixed",
        )
        _stamp(self.hand, ProvenanceSource.MANUAL)
        Piece.objects.create(title="D Bogurodzica", language="pl", lyrics_original="x")

    @patch("archive.management.commands.recompute_ipa.recompute_piece_ipa")
    def test_dry_run_calls_nothing(self, recompute: MagicMock) -> None:
        out = StringIO()
        call_command("recompute_ipa", "--dry-run", stdout=out)
        recompute.assert_not_called()
        self.assertIn("1 to recompute", out.getvalue())

    @override_settings(ANTHROPIC_API_KEY="test-key")
    @patch("archive.management.commands.recompute_ipa.recompute_piece_ipa")
    def test_skips_done_and_hand_edited_guides(self, recompute: MagicMock) -> None:
        recompute.return_value = MagicMock(cost_cents=2, aligned=True)
        call_command("recompute_ipa", "--system", "germanic", stdout=StringIO())
        recomputed = [call.args[0].pk for call in recompute.call_args_list]
        self.assertEqual(recomputed, [self.todo.pk])
        self.assertTrue(ipa_is_hand_edited(self.hand))
