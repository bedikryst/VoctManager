"""
@file archive/test_audience_ai_choices.py
@description Tests for the choices a manager makes about the archive's AI
             output at the moment of asking for it: the Latin pronunciation an
             upload's guide is written in, the language and tone of a
             programme note, and an on-demand prose translation into one more
             audience language.
@architecture Enterprise SaaS 2026
@module archive/test_audience_ai_choices
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import UUID

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APITestCase

from archive.dtos import CallCost, GeneratedTranslation
from archive.infrastructure.ai_client import AIClientError, AIClientOverloadedError, AIModel
from archive.infrastructure.prompts import TRANSLATE_SUNG_TEXT
from archive.models import (
    IngestionStatus,
    LatinPronunciation,
    Piece,
    ProvenanceRecord,
    ProvenanceSource,
    ScoreEdition,
    Translation,
)
from archive.serializers import ScoreEditionUploadSerializer
from archive.services.audience_jobs import audience_job, mark_audience_job_running
from archive.services.ingestion import IngestionPreconditionError, start_ingestion
from archive.services.ipa import ipa_job
from archive.services.language import translation_adds_meaning
from archive.tasks import (
    build_ingestion_chain,
    generate_program_note,
    generate_translation,
    persist_analysis,
    translate_piece_text,
)
from core.constants import AppRole
from core.models import UserProfile

User = get_user_model()

_SUNG = "Gloria in excelsis Deo\net in terra pax"
_GERMAN_IPA = "ˈɡloːria ɪn ɛksˈtsɛlzɪs ˈdeːo\nɛt ɪn ˈtɛra paks"  # noqa: RUF001
_POLISH = "Chwała na wysokości Bogu\na na ziemi pokój"


def _manager(username: str = "aud-mgr"):
    user = User.objects.create_user(
        username=username, email=f"{username}@test.pl", password="pw123456",
    )
    UserProfile.objects.create(user=user, role=AppRole.MANAGER)
    return user


def _translation_client(text: str = _POLISH, cents: int = 2) -> MagicMock:
    client = MagicMock()
    client.parse.return_value = (
        GeneratedTranslation(text=text),
        CallCost(model=AIModel.SONNET, total_usd=Decimal("0.02"), total_cents=cents),
    )
    return client


class TranslationAddsMeaningTests(SimpleTestCase):
    def test_a_text_entirely_in_the_target_needs_no_translation(self) -> None:
        self.assertFalse(translation_adds_meaning("pl", "pl"))
        self.assertFalse(translation_adds_meaning("Polish", "pl"))

    def test_a_text_partly_in_another_language_does(self) -> None:
        for raw in ("la", "pl+la", "Latin"):
            with self.subTest(raw=raw):
                self.assertTrue(translation_adds_meaning(raw, "pl"))

    def test_an_unknown_language_keeps_it_applicable(self) -> None:
        self.assertTrue(translation_adds_meaning("", "pl"))
        self.assertTrue(translation_adds_meaning("klingon", "en"))


# ---------------------------------------------------------------------------
# Upload: the Latin pronunciation of the guide
# ---------------------------------------------------------------------------

class UploadLatinSystemTests(TestCase):
    def setUp(self) -> None:
        cache.clear()

    def _persist(self, piece: Piece, language: str, latin_system: str = "") -> None:
        edition = ScoreEdition.objects.create(
            piece=piece, original_filename="x.pdf", sha256=str(piece.pk).replace("-", "")[:32] * 2,
        )
        payload = {
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
        }
        if latin_system:
            payload["latin_system"] = latin_system
        persist_analysis(payload)
        piece.refresh_from_db()

    @patch("archive.tasks.recompute_ipa")
    def test_another_system_is_queued_over_the_german_guide(self, task: MagicMock) -> None:
        piece = Piece.objects.create(title="Gloria")
        self._persist(piece, "la", LatinPronunciation.ITALIANATE)

        # The German guide stays until the recompute lands.
        self.assertEqual(piece.lyrics_ipa, _GERMAN_IPA)
        self.assertEqual(piece.lyrics_ipa_system, LatinPronunciation.GERMANIC)
        task.delay.assert_called_once_with(str(piece.pk), LatinPronunciation.ITALIANATE)
        job = ipa_job(piece.pk)
        assert job is not None
        self.assertEqual(job["state"], "running")

    @patch("archive.tasks.recompute_ipa")
    def test_german_asks_for_nothing_more(self, task: MagicMock) -> None:
        piece = Piece.objects.create(title="Gloria")
        self._persist(piece, "la", LatinPronunciation.GERMANIC)
        task.delay.assert_not_called()

    @patch("archive.tasks.recompute_ipa")
    def test_a_piece_not_in_latin_is_left_alone(self, task: MagicMock) -> None:
        piece = Piece.objects.create(title="Lied")
        self._persist(piece, "de", LatinPronunciation.CLASSICAL)
        task.delay.assert_not_called()

    @patch("archive.tasks.recompute_ipa")
    def test_a_guide_the_piece_already_had_is_left_alone(self, task: MagicMock) -> None:
        piece = Piece.objects.create(
            title="Gloria", language="la", lyrics_ipa="corrected by hand",
        )
        self._persist(piece, "la", LatinPronunciation.ITALIANATE)
        self.assertEqual(piece.lyrics_ipa, "corrected by hand")
        task.delay.assert_not_called()

    def test_the_chain_carries_the_choice_to_its_first_task(self) -> None:
        signature = build_ingestion_chain(
            UUID("00000000-0000-0000-0000-000000000001"), latin_system="classical",
        )
        first_payload = signature.tasks[0].args[0]
        self.assertEqual(first_payload["latin_system"], "classical")

    def test_the_upload_accepts_only_a_known_system(self) -> None:
        pdf = SimpleUploadedFile("x.pdf", b"%PDF-1.4", content_type="application/pdf")
        self.assertTrue(
            ScoreEditionUploadSerializer(data={"pdf_file": pdf, "latin_system": "italianate"}).is_valid(),
        )
        pdf.seek(0)
        self.assertFalse(
            ScoreEditionUploadSerializer(data={"pdf_file": pdf, "latin_system": "anglican"}).is_valid(),
        )

    @override_settings(ANTHROPIC_API_KEY="test-key")
    def test_an_unknown_system_is_refused_before_the_edition_moves(self) -> None:
        edition = ScoreEdition.objects.create(original_filename="x.pdf", sha256="d" * 64)
        with self.assertRaises(IngestionPreconditionError):
            start_ingestion(edition, latin_system="anglican")
        edition.refresh_from_db()
        self.assertIsNone(edition.ingestion_run_started_at)
        self.assertEqual(edition.ingestion_status, IngestionStatus.PENDING)


# ---------------------------------------------------------------------------
# Programme note: language and tone
# ---------------------------------------------------------------------------

@override_settings(ANTHROPIC_API_KEY="test-key")
class ProgramNoteChoicesTests(APITestCase):
    def setUp(self) -> None:
        cache.clear()
        self.client.force_authenticate(_manager())
        self.piece = Piece.objects.create(title="Gloria", language="la", lyrics_original=_SUNG)
        ScoreEdition.objects.create(piece=self.piece, original_filename="g.pdf", sha256="e" * 64)
        self.url = f"/api/pieces/{self.piece.id}/generate_program_note/"

    @patch("archive.services.ingestion.generate_program_note")
    def test_language_and_tone_reach_the_task(self, task: MagicMock) -> None:
        task.delay.return_value.id = "task-1"
        resp = self.client.post(
            f"{self.url}?language=fr&tone=devotional&force=true",
        )
        self.assertEqual(resp.status_code, 202)
        payload = task.delay.call_args.args[0]
        self.assertEqual(payload["program_note_language"], "fr")
        self.assertEqual(payload["program_note_tone"], "devotional")
        self.assertTrue(payload["force_program_note"])
        # The answer is the piece, already showing the job the cockpit polls.
        self.assertEqual(
            resp.json()["program_note_job"], {"state": "running", "language": "fr", "reason": ""},
        )

    @patch("archive.services.ingestion.generate_program_note")
    def test_an_unknown_tone_or_language_is_refused(self, task: MagicMock) -> None:
        self.assertEqual(self.client.post(f"{self.url}?tone=ironic").status_code, 400)
        self.assertEqual(self.client.post(f"{self.url}?language=xx").status_code, 400)
        task.delay.assert_not_called()

    @patch("archive.services.ingestion.generate_program_note")
    def test_a_second_note_waits_for_the_first(self, task: MagicMock) -> None:
        mark_audience_job_running("program_note", self.piece.pk, "pl")
        self.assertEqual(self.client.post(f"{self.url}?language=en").status_code, 400)
        task.delay.assert_not_called()


class ProgramNoteTaskTests(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.piece = Piece.objects.create(title="Gloria", language="la", lyrics_original=_SUNG)
        self.edition = ScoreEdition.objects.create(
            piece=self.piece, original_filename="g.pdf", sha256="a" * 64,
            ingestion_status=IngestionStatus.READY,
        )
        self.payload = {
            "edition_id": str(self.edition.id),
            "piece_id": str(self.piece.id),
            "program_note_language": "en",
        }
        mark_audience_job_running("program_note", self.piece.pk, "en")

    @patch("archive.tasks._write_program_note")
    def test_a_failed_note_leaves_the_score_ready_and_says_so(self, write: MagicMock) -> None:
        write.side_effect = AIClientError("schema mismatch")
        generate_program_note(self.payload)
        self.edition.refresh_from_db()
        self.assertEqual(self.edition.ingestion_status, IngestionStatus.READY)
        self.assertEqual(self.edition.ingestion_error, "")
        self.assertEqual(
            audience_job("program_note", self.piece.pk),
            {"state": "failed", "language": "en", "reason": "failed"},
        )

    @patch("archive.tasks._write_program_note")
    def test_a_written_note_clears_the_job(self, write: MagicMock) -> None:
        generate_program_note(self.payload)
        write.assert_called_once_with(self.payload, "en")
        self.assertIsNone(audience_job("program_note", self.piece.pk))


# ---------------------------------------------------------------------------
# Translation on demand
# ---------------------------------------------------------------------------

class TranslatePieceTextTests(TestCase):
    def setUp(self) -> None:
        cache.clear()
        self.piece = Piece.objects.create(title="Gloria", language="la", lyrics_original=_SUNG)

    def test_writes_a_literal_translation_with_ai_provenance(self) -> None:
        client = _translation_client()
        translate_piece_text(self.piece, "pl", client=client)

        translation = Translation.objects.get(piece=self.piece, target_language="pl")
        self.assertEqual(translation.text, _POLISH)
        self.assertFalse(translation.is_singable)
        self.assertIsNone(translation.movement_id)
        record = ProvenanceRecord.objects.get(object_id=translation.pk, field_name="text")
        self.assertEqual(record.source, ProvenanceSource.AI_SONNET)
        self.assertEqual(record.prompt_version, TRANSLATE_SUNG_TEXT.version)

    def test_the_call_names_the_target_and_carries_the_text(self) -> None:
        client = _translation_client()
        translate_piece_text(self.piece, "fr", client=client)
        user_content = client.parse.call_args.kwargs["user_content"]
        self.assertIn("Target language: fr", user_content)
        self.assertIn(_SUNG, user_content)

    def test_bills_the_default_edition(self) -> None:
        edition = ScoreEdition.objects.create(
            piece=self.piece, original_filename="g.pdf", sha256="f" * 64,
        )
        translate_piece_text(self.piece, "pl", client=_translation_client(cents=5))
        edition.refresh_from_db()
        self.assertEqual(edition.ingestion_cost_cents_lifetime, 5)

    def test_an_existing_translation_is_never_replaced(self) -> None:
        Translation.objects.create(piece=self.piece, target_language="pl", text="printed")
        client = _translation_client()
        translate_piece_text(self.piece, "pl", client=client)
        client.parse.assert_not_called()
        self.assertEqual(
            Translation.objects.get(piece=self.piece, target_language="pl").text, "printed",
        )

    def test_a_translation_that_lands_during_the_call_wins(self) -> None:
        client = _translation_client()

        def race(**_kwargs):
            Translation.objects.create(piece=self.piece, target_language="pl", text="first")
            return (
                GeneratedTranslation(text=_POLISH),
                CallCost(model=AIModel.SONNET, total_usd=Decimal("0.02"), total_cents=2),
            )

        client.parse.side_effect = race
        translate_piece_text(self.piece, "pl", client=client)
        self.assertEqual(
            list(Translation.objects.filter(piece=self.piece).values_list("text", flat=True)),
            ["first"],
        )

    @patch("archive.tasks.translate_piece_text")
    def test_an_overload_with_no_retry_left_is_reported(self, translate: MagicMock) -> None:
        # Called directly, `self.retry` hands back the overload as a worker does
        # once the retries are spent; the task must report it, not raise.
        translate.side_effect = AIClientOverloadedError("529 overloaded")
        generate_translation(str(self.piece.pk), "pl")
        self.assertEqual(
            audience_job("translation", self.piece.pk),
            {"state": "failed", "language": "pl", "reason": "overloaded"},
        )

    @patch("archive.tasks.translate_piece_text")
    def test_a_failed_call_is_reported(self, translate: MagicMock) -> None:
        translate.side_effect = AIClientError("Claude returned an empty translation.")
        generate_translation(str(self.piece.pk), "pl")
        job = audience_job("translation", self.piece.pk)
        assert job is not None
        self.assertEqual(job["reason"], "failed")

    @patch("archive.tasks.translate_piece_text")
    def test_a_finished_translation_clears_the_job(self, translate: MagicMock) -> None:
        mark_audience_job_running("translation", self.piece.pk, "pl")
        generate_translation(str(self.piece.pk), "pl")
        self.assertIsNone(audience_job("translation", self.piece.pk))


@override_settings(ANTHROPIC_API_KEY="test-key")
class GenerateTranslationEndpointTests(APITestCase):
    def setUp(self) -> None:
        cache.clear()
        self.client.force_authenticate(_manager())
        self.piece = Piece.objects.create(title="Gloria", language="la", lyrics_original=_SUNG)
        self.url = f"/api/pieces/{self.piece.id}/generate_translation/"

    @patch("archive.services.ingestion.generate_translation")
    def test_dispatches(self, task: MagicMock) -> None:
        task.delay.return_value.id = "task-1"
        resp = self.client.post(self.url, {"language": "en"}, format="json")
        self.assertEqual(resp.status_code, 202)
        task.delay.assert_called_once_with(str(self.piece.pk), "en")
        self.assertEqual(
            resp.json()["translation_job"], {"state": "running", "language": "en", "reason": ""},
        )

        # A second request while the first runs would bill twice.
        resp = self.client.post(self.url, {"language": "fr"}, format="json")
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["error_code"], "running")
        task.delay.assert_called_once()

    @patch("archive.services.ingestion.generate_translation")
    def test_refusals_carry_a_code(self, task: MagicMock) -> None:
        Translation.objects.create(piece=self.piece, target_language="pl", text="printed")
        polish = Piece.objects.create(title="Bogurodzica", language="pl", lyrics_original="x")
        silent = Piece.objects.create(title="Vocalise", language="la")
        cases = (
            (self.url, "de", 400, "invalid_language"),
            (self.url, "pl", 409, "exists"),
            (f"/api/pieces/{polish.id}/generate_translation/", "pl", 400, "same_language"),
            (f"/api/pieces/{silent.id}/generate_translation/", "en", 400, "no_text"),
        )
        for url, language, status_code, code in cases:
            with self.subTest(code=code):
                resp = self.client.post(url, {"language": language}, format="json")
                self.assertEqual(resp.status_code, status_code)
                self.assertEqual(resp.json()["error_code"], code)
        task.delay.assert_not_called()
