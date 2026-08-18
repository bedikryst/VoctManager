"""
@file archive/tests.py
@description Tests for the composer-enrichment path ("Odśwież z MusicBrainz"):
             the shared HTTP layer's negative-result caching, the MusicBrainz /
             Wikidata clients, the enrichment service (fill vs. force, manual-edit
             protection, name fallback, provenance), and the refresh_mb endpoint.

             These guard the regression this work fixed: enrichment silently
             doing nothing (cache-poisoned empties, blank-only no-ops, and a
             portrait gap when Wikidata lacks the P434 backlink).
@architecture Enterprise SaaS 2026
@module archive/tests
"""
import tempfile
from unittest.mock import MagicMock, patch
from uuid import UUID

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils.translation import override as override_language
from rest_framework.test import APITestCase

from archive.dtos import ComposerLookupResult, ExtractedWorkIdentity
from archive.infrastructure import _http
from archive.infrastructure._http import GetResult
from archive.infrastructure.musicbrainz_client import MusicBrainzClient
from archive.infrastructure.wikidata_client import (
    PORTRAIT_THUMB_WIDTH,
    WikidataClient,
    _claim_image,
)
from archive.models import (
    Composer,
    IngestionStatus,
    Movement,
    Piece,
    PieceVoiceRequirement,
    ProgramNote,
    ProvenanceRecord,
    ProvenanceSource,
    ScoreEdition,
    Track,
)
from archive.services import enrichment
from archive.services.resolvers import resolve_or_create_piece
from archive.services.voice_scope import scoped_to_edition, voice_labels
from archive.tasks import _identity_from_analysis
from core.constants import AppRole
from core.models import UserProfile
from core.voice_labels import collapse_voice_labels, voice_line_label

User = get_user_model()

BACH_MBID = UUID("24f1766e-9635-4d58-a4d4-9413f9f98a4c")

# A direct /artist/{mbid} payload, plus the search-result variant.
_MB_ARTIST = {
    "id": str(BACH_MBID),
    "name": "Johann Sebastian Bach",
    "sort-name": "Bach, Johann Sebastian",
    "country": "DE",
    "life-span": {"begin": "1685-03-31", "end": "1750-07-28"},
    "aliases": [{"name": "J.S. Bach"}, {"name": "JS Bach"}],
}
_MB_ARTIST_HIT = {**_MB_ARTIST, "score": 100, "type": "Person"}


class _FakeResp:
    """Minimal stand-in for a requests.Response."""

    def __init__(self, status: int, payload: object, headers: dict | None = None):
        self.status_code = status
        self._payload = payload
        self.headers = headers or {}
        self.text = ""

    def json(self) -> object:
        return self._payload


# ===========================================================================
# Shared HTTP layer — negative results must NOT inherit the 30-day TTL
# ===========================================================================

class CachedGetJsonTests(SimpleTestCase):
    @patch("archive.infrastructure._http.requests.get")
    def test_empty_result_uses_short_negative_ttl(self, mock_get):
        mock_get.return_value = _FakeResp(200, {"artists": []})
        fake_cache = MagicMock()
        fake_cache.get.return_value = None  # force a miss → real fetch path

        with patch("archive.infrastructure._http.cache", fake_cache):
            _http.cached_get_json(
                source="t", url="https://example.test/y",
                is_empty=lambda d: not d.get("artists"),
            )

        timeout = fake_cache.set.call_args.kwargs["timeout"]
        self.assertEqual(timeout, _http.DEFAULT_NEGATIVE_CACHE_TTL_SECONDS)

    @patch("archive.infrastructure._http.requests.get")
    def test_real_result_uses_long_ttl(self, mock_get):
        mock_get.return_value = _FakeResp(200, {"artists": [{"id": "x"}]})
        fake_cache = MagicMock()
        fake_cache.get.return_value = None

        with patch("archive.infrastructure._http.cache", fake_cache):
            _http.cached_get_json(
                source="t", url="https://example.test/y",
                is_empty=lambda d: not d.get("artists"),
            )

        timeout = fake_cache.set.call_args.kwargs["timeout"]
        self.assertEqual(timeout, _http.DEFAULT_CACHE_TTL_SECONDS)

    def test_bust_cache_deletes_key(self):
        fake_cache = MagicMock()
        with patch("archive.infrastructure._http.cache", fake_cache):
            _http.bust_cache("t", "https://example.test/y", {"a": 1})
        fake_cache.delete.assert_called_once()


# ===========================================================================
# MusicBrainz client
# ===========================================================================

class MusicBrainzClientTests(SimpleTestCase):
    @patch.object(MusicBrainzClient, "_respect_rate_limit", lambda *a, **k: None)
    @patch("archive.infrastructure.musicbrainz_client.cached_get_json")
    def test_get_artist_parses_identity_and_aliases(self, mock_get):
        mock_get.return_value = GetResult(data=_MB_ARTIST, from_cache=False)
        res = MusicBrainzClient.get_artist(BACH_MBID)
        assert res is not None  # narrow Optional for the type checker
        self.assertEqual(res.mbid, BACH_MBID)
        self.assertEqual(res.canonical_last_name, "Bach")
        self.assertEqual(res.canonical_first_name, "Johann Sebastian")
        self.assertEqual(res.birth_year, 1685)
        self.assertEqual(res.death_year, 1750)
        self.assertIn("J.S. Bach", res.aliases)

    @patch.object(MusicBrainzClient, "_respect_rate_limit", lambda *a, **k: None)
    @patch("archive.infrastructure.musicbrainz_client.cached_get_json")
    def test_search_composer_returns_top_person(self, mock_get):
        mock_get.return_value = GetResult(data={"artists": [_MB_ARTIST_HIT]}, from_cache=False)
        res = MusicBrainzClient.search_composer(name="Bach")
        assert res is not None  # narrow Optional for the type checker
        self.assertEqual(res.mbid, BACH_MBID)

    @patch.object(MusicBrainzClient, "_respect_rate_limit", lambda *a, **k: None)
    @patch("archive.infrastructure.musicbrainz_client.cached_get_json")
    def test_empty_search_returns_none(self, mock_get):
        mock_get.return_value = GetResult(data={"artists": []}, from_cache=False)
        self.assertIsNone(MusicBrainzClient.search_composer(name="Nobody"))

    @patch.object(MusicBrainzClient, "_respect_rate_limit", lambda *a, **k: None)
    @patch("archive.infrastructure.musicbrainz_client.bust_cache")
    @patch("archive.infrastructure.musicbrainz_client.cached_get_json")
    def test_force_evicts_cache_before_fetch(self, mock_get, mock_bust):
        mock_get.return_value = GetResult(data={"artists": []}, from_cache=False)
        MusicBrainzClient.search_composer(name="Bach", force=True)
        mock_bust.assert_called_once()


# ===========================================================================
# Wikidata client
# ===========================================================================

class WikidataClientTests(SimpleTestCase):
    def test_claim_image_builds_encoded_thumbnail_url(self):
        claim = [{"mainsnak": {"datavalue": {"value": "Johann Sebastian Bach.jpg"}}}]
        url = _claim_image(claim)
        self.assertIn("Special:FilePath/Johann_Sebastian_Bach.jpg", url)
        self.assertTrue(url.endswith(f"?width={PORTRAIT_THUMB_WIDTH}"))

    def test_claim_image_url_encodes_special_chars(self):
        claim = [{"mainsnak": {"datavalue": {"value": "Saint-Saëns (1900), portrait.jpg"}}}]
        url = _claim_image(claim)
        self.assertNotIn(" ", url)
        self.assertNotIn("(", url)  # parenthesis percent-encoded

    def test_find_qid_by_mbid_sends_no_origin_param(self):
        captured: dict = {}

        def fake_get(url, params, *, is_empty=None, force=False):
            captured["params"] = params
            return {"query": {"search": [{"title": "Q1339"}]}}

        with patch.object(WikidataClient, "_get", side_effect=fake_get):
            qid = WikidataClient._find_qid_by_mbid(BACH_MBID)

        self.assertEqual(qid, "Q1339")
        self.assertNotIn("origin", captured["params"])

    def test_enrich_by_mbid_returns_none_when_no_p434_link(self):
        with patch.object(WikidataClient, "_get", return_value={"query": {"search": []}}):
            self.assertIsNone(WikidataClient.enrich_composer_by_mbid(BACH_MBID))


# ===========================================================================
# Enrichment service — the heart of the fix
# ===========================================================================

@patch("archive.services.enrichment.WikidataClient")
@patch("archive.services.enrichment.MusicBrainzClient")
class RefreshComposerServiceTests(TestCase):
    def _mbz(self) -> ComposerLookupResult:
        return ComposerLookupResult(
            mbid=BACH_MBID,
            canonical_first_name="Johann Sebastian",
            canonical_last_name="Bach",
            birth_year=1685, death_year=1750,
            nationality="DE", aliases=("J.S. Bach",), source="musicbrainz",
        )

    def _wiki(self, **kw) -> ComposerLookupResult:
        defaults = dict(
            wikidata_qid="Q1339",
            bio="German composer of the Baroque period.",
            portrait_url="https://commons.wikimedia.org/wiki/Special:FilePath/Bach.jpg?width=480",
            portrait_license="wikimedia-commons",
            nationality="Germany", period="BAR",
            birth_year=1685, death_year=1750, source="wikidata",
        )
        defaults.update(kw)
        return ComposerLookupResult(**defaults)

    def test_fill_blanks_populates_and_records_provenance(self, mb, wiki):
        composer = Composer.objects.create(first_name="Johann Sebastian", last_name="Bach")
        mb.get_artist.return_value = None
        mb.search_composer.return_value = self._mbz()
        wiki.enrich_composer_by_mbid.return_value = self._wiki()

        report = enrichment.refresh_composer(composer)
        composer.refresh_from_db()

        self.assertEqual(report.status, enrichment.STATUS_UPDATED)
        self.assertEqual(composer.mbid, BACH_MBID)
        self.assertTrue(composer.portrait_url)
        self.assertIn("bio", report.fields_filled)
        self.assertIn("portrait_url", report.fields_filled)
        self.assertTrue(
            ProvenanceRecord.objects.filter(
                object_id=composer.pk, field_name="bio",
                source=ProvenanceSource.WIKIDATA,
            ).exists()
        )

    def test_already_complete_reports_matched_no_changes(self, mb, wiki):
        w = self._wiki()
        composer = Composer.objects.create(
            first_name="Johann Sebastian", last_name="Bach", mbid=BACH_MBID,
            wikidata_qid=w.wikidata_qid, bio=w.bio, portrait_url=w.portrait_url,
            portrait_license=w.portrait_license, nationality=w.nationality,
            period=w.period, birth_year="1685", death_year="1750",
            aliases=["J.S. Bach"],
        )
        mb.get_artist.return_value = self._mbz()
        wiki.enrich_composer_by_mbid.return_value = w

        report = enrichment.refresh_composer(composer)

        self.assertEqual(report.status, enrichment.STATUS_MATCHED_NO_CHANGES)
        self.assertEqual(report.fields_filled, [])
        self.assertEqual(report.fields_overwritten, [])

    def test_force_overwrites_canonical_field(self, mb, wiki):
        composer = Composer.objects.create(
            first_name="Johann Sebastian", last_name="Bach", bio="stale bio",
        )
        mb.get_artist.return_value = None
        mb.search_composer.return_value = None
        wiki.enrich_composer_by_mbid.return_value = None
        wiki.enrich_composer_by_name.return_value = ComposerLookupResult(
            wikidata_qid="Q1339", bio="fresh canonical bio", source="wikidata",
        )

        report = enrichment.refresh_composer(composer, force=True)
        composer.refresh_from_db()

        self.assertIn("bio", report.fields_overwritten)
        self.assertEqual(composer.bio, "fresh canonical bio")

    def test_force_respects_manual_edit(self, mb, wiki):
        composer = Composer.objects.create(
            first_name="Johann Sebastian", last_name="Bach", bio="conductor's own words",
        )
        ct = ContentType.objects.get_for_model(Composer)
        ProvenanceRecord.objects.create(
            content_type=ct, object_id=composer.pk, field_name="bio",
            source=ProvenanceSource.MANUAL, source_reference="conductor@test.pl",
        )
        mb.get_artist.return_value = None
        mb.search_composer.return_value = None
        wiki.enrich_composer_by_mbid.return_value = None
        wiki.enrich_composer_by_name.return_value = ComposerLookupResult(
            wikidata_qid="Q1339", bio="canonical bio", source="wikidata",
        )

        report = enrichment.refresh_composer(composer, force=True)
        composer.refresh_from_db()

        self.assertIn("bio", report.fields_skipped_existing)
        self.assertNotIn("bio", report.fields_overwritten)
        self.assertEqual(composer.bio, "conductor's own words")

    def test_falls_back_to_name_when_p434_link_missing(self, mb, wiki):
        composer = Composer.objects.create(
            first_name="Modern", last_name="Composer", mbid=BACH_MBID,
        )
        mb.get_artist.return_value = self._mbz()
        wiki.enrich_composer_by_mbid.return_value = None  # no P434 backlink
        wiki.enrich_composer_by_name.return_value = ComposerLookupResult(
            wikidata_qid="Q9",
            portrait_url="https://commons.wikimedia.org/wiki/Special:FilePath/p.jpg?width=480",
            source="wikidata",
        )

        report = enrichment.refresh_composer(composer)
        composer.refresh_from_db()

        wiki.enrich_composer_by_name.assert_called_once()
        self.assertTrue(composer.portrait_url)
        self.assertEqual(report.status, enrichment.STATUS_UPDATED)

    def test_no_match_when_both_sources_silent(self, mb, wiki):
        composer = Composer.objects.create(first_name="Obscure", last_name="Person")
        mb.get_artist.return_value = None
        mb.search_composer.return_value = None
        wiki.enrich_composer_by_mbid.return_value = None
        wiki.enrich_composer_by_name.return_value = None

        report = enrichment.refresh_composer(composer)

        self.assertEqual(report.status, enrichment.STATUS_NO_MATCH)
        self.assertFalse(report.mbz_responded)
        self.assertFalse(report.wiki_responded)


# ===========================================================================
# refresh_mb endpoint
# ===========================================================================

class RefreshMbEndpointTests(APITestCase):
    def setUp(self) -> None:
        self.manager = self._user("mgr", "mgr@test.pl", AppRole.MANAGER)
        self.artist = self._user("art", "art@test.pl", AppRole.ARTIST)
        self.composer = Composer.objects.create(
            first_name="Johann Sebastian", last_name="Bach",
        )
        self.url = f"/api/composers/{self.composer.id}/refresh_mb/"

    @staticmethod
    def _user(username: str, email: str, role: str):
        user = User.objects.create_user(username=username, email=email, password="pw123456")
        UserProfile.objects.create(user=user, role=role)
        return user

    def test_requires_manager(self) -> None:
        self.client.force_authenticate(self.artist)
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, 403)

    @patch("archive.views.enrichment.refresh_composer")
    def test_returns_diagnostic_payload(self, mock_refresh) -> None:
        mock_refresh.return_value = enrichment.RefreshReport(
            status=enrichment.STATUS_UPDATED,
            fields_filled=["bio"], fields_overwritten=[],
            fields_skipped_existing=["portrait_url"],
            mbid=str(BACH_MBID), wikidata_qid="Q1339",
            mbz_responded=True, wiki_responded=True,
        )
        self.client.force_authenticate(self.manager)
        resp = self.client.post(self.url)

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["status"], "updated")
        self.assertEqual(body["fields_filled"], ["bio"])
        self.assertEqual(body["fields_skipped_existing"], ["portrait_url"])
        self.assertEqual(body["sources"], {"musicbrainz": True, "wikidata": True})
        self.assertFalse(mock_refresh.call_args.kwargs["force"])

    @patch("archive.views.enrichment.refresh_composer")
    def test_force_flag_is_parsed(self, mock_refresh) -> None:
        mock_refresh.return_value = enrichment.RefreshReport(
            status=enrichment.STATUS_MATCHED_NO_CHANGES, mbz_responded=True,
        )
        self.client.force_authenticate(self.manager)
        resp = self.client.post(self.url + "?force=true")

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(mock_refresh.call_args.kwargs["force"])


# ===========================================================================
# Piece update — manual-provenance stamping
# ===========================================================================

class UpdatePieceProvenanceTests(APITestCase):
    """PATCH /api/pieces/{id}/ stamps MANUAL provenance for exactly the scalar
    fields whose value actually changed, so the review-cockpit chip flips
    "AI · do sprawdzenia" → "Zweryfikowane". Untouched fields keep their AI
    chip; a no-op edit (same value) stamps nothing.
    """

    @staticmethod
    def _user(username: str, email: str, role: str):
        user = User.objects.create_user(username=username, email=email, password="pw123456")
        UserProfile.objects.create(user=user, role=role)
        return user

    def setUp(self) -> None:
        self.manager = self._user("mgr", "mgr@test.pl", AppRole.MANAGER)
        self.artist = self._user("art", "art@test.pl", AppRole.ARTIST)
        self.piece = Piece.objects.create(
            title="Ave Verum", arranger="opr. AI", musical_key="D",
        )
        # Seed AI provenance on two fields so we can prove one flips and the
        # other is left alone.
        ct = ContentType.objects.get_for_model(Piece)
        for field in ("title", "musical_key"):
            ProvenanceRecord.objects.create(
                content_type=ct, object_id=self.piece.pk, field_name=field,
                source=ProvenanceSource.AI_OPUS, model_version="claude-opus-4-8",
            )
        self.url = f"/api/pieces/{self.piece.id}/"

    def _manual(self, field: str):
        return ProvenanceRecord.objects.filter(
            object_id=self.piece.pk, field_name=field, source=ProvenanceSource.MANUAL,
        )

    def test_requires_manager(self) -> None:
        self.client.force_authenticate(self.artist)
        resp = self.client.patch(self.url, {"title": "Nope"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_editing_a_field_stamps_manual_provenance_with_actor(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.patch(self.url, {"title": "Ave Verum Corpus"}, format="json")

        self.assertEqual(resp.status_code, 200)
        self.piece.refresh_from_db()
        self.assertEqual(self.piece.title, "Ave Verum Corpus")
        manual = self._manual("title")
        self.assertTrue(manual.exists())
        self.assertEqual(manual.latest("retrieved_at").source_reference, "mgr@test.pl")

    def test_untouched_field_keeps_ai_provenance(self) -> None:
        self.client.force_authenticate(self.manager)
        self.client.patch(self.url, {"title": "Ave Verum Corpus"}, format="json")
        # musical_key was not in the PATCH → no manual record, AI chip stays.
        self.assertFalse(self._manual("musical_key").exists())

    def test_no_op_edit_does_not_stamp(self) -> None:
        # Same value as stored → nothing actually changed → no manual record.
        self.client.force_authenticate(self.manager)
        resp = self.client.patch(self.url, {"title": "Ave Verum"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(self._manual("title").exists())

    def test_provenance_index_reflects_the_flip(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.patch(self.url, {"title": "Ave Verum Corpus"}, format="json")

        index = resp.json()["provenance"]
        self.assertEqual(index[f"{self.piece.id}:title"]["source"], ProvenanceSource.MANUAL)
        self.assertEqual(
            index[f"{self.piece.id}:musical_key"]["source"], ProvenanceSource.AI_OPUS,
        )


class VerifyFieldEndpointTests(APITestCase):
    """POST /api/pieces/{id}/verify_field/ marks an AI field human-verified —
    it stamps MANUAL provenance WITHOUT changing the value, so a conductor can
    clear a field they trust without re-typing it. It only accepts the piece's
    own chip-bearing fields (and those of its own movements/translations); an
    unknown field or a foreign object is rejected.
    """

    @staticmethod
    def _user(username: str, email: str, role: str):
        user = User.objects.create_user(username=username, email=email, password="pw123456")
        UserProfile.objects.create(user=user, role=role)
        return user

    def setUp(self) -> None:
        self.manager = self._user("mgr2", "mgr2@test.pl", AppRole.MANAGER)
        self.artist = self._user("art2", "art2@test.pl", AppRole.ARTIST)
        self.piece = Piece.objects.create(title="Ave Verum", musical_key="D")
        self.movement = Movement.objects.create(
            piece=self.piece, title="I. Kyrie", order_index=0,
        )
        piece_ct = ContentType.objects.get_for_model(Piece)
        mvmt_ct = ContentType.objects.get_for_model(Movement)
        ProvenanceRecord.objects.create(
            content_type=piece_ct, object_id=self.piece.pk, field_name="title",
            source=ProvenanceSource.AI_OPUS, model_version="claude-opus-4-8",
        )
        ProvenanceRecord.objects.create(
            content_type=mvmt_ct, object_id=self.movement.pk, field_name="title",
            source=ProvenanceSource.AI_OPUS, model_version="claude-opus-4-8",
        )
        self.url = f"/api/pieces/{self.piece.id}/verify_field/"

    def _manual(self, object_id, field: str):
        return ProvenanceRecord.objects.filter(
            object_id=object_id, field_name=field, source=ProvenanceSource.MANUAL,
        )

    def test_requires_manager(self) -> None:
        self.client.force_authenticate(self.artist)
        resp = self.client.post(self.url, {"field": "title"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_verifying_a_piece_field_stamps_manual_without_changing_value(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.post(self.url, {"field": "title"}, format="json")

        self.assertEqual(resp.status_code, 200)
        self.piece.refresh_from_db()
        self.assertEqual(self.piece.title, "Ave Verum")  # value untouched
        manual = self._manual(self.piece.pk, "title")
        self.assertTrue(manual.exists())
        self.assertEqual(manual.latest("retrieved_at").source_reference, "mgr2@test.pl")
        # The returned payload's provenance index shows the flip.
        index = resp.json()["provenance"]
        self.assertEqual(
            index[f"{self.piece.id}:title"]["source"], ProvenanceSource.MANUAL,
        )

    def test_verifying_a_child_field_targets_the_child(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.post(
            self.url, {"field": "title", "object_id": str(self.movement.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(self._manual(self.movement.pk, "title").exists())
        # The piece's own title stays AI — only the movement was verified.
        self.assertFalse(self._manual(self.piece.pk, "title").exists())

    def test_unknown_field_is_rejected(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.post(self.url, {"field": "not_a_field"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(self._manual(self.piece.pk, "not_a_field").exists())

    def test_missing_field_is_rejected(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.post(self.url, {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_foreign_object_is_rejected(self) -> None:
        # An object_id that is not one of this piece's own children → 400, and
        # nothing is stamped (guards against verifying arbitrary rows).
        other_piece = Piece.objects.create(title="Other")
        other_movement = Movement.objects.create(
            piece=other_piece, title="Foreign", order_index=0,
        )
        self.client.force_authenticate(self.manager)
        resp = self.client.post(
            self.url, {"field": "title", "object_id": str(other_movement.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(self._manual(other_movement.pk, "title").exists())


class ProgramNoteEndpointTests(APITestCase):
    """PATCH/DELETE /api/archive/program-notes/{id}/ let the conductor fix a
    factual slip or a repeated phrase in the AI note by hand — a cheaper, more
    surgical alternative to a full regenerate. Manager-only; delete soft-deletes.
    """

    @staticmethod
    def _user(username: str, email: str, role: str):
        user = User.objects.create_user(username=username, email=email, password="pw123456")
        UserProfile.objects.create(user=user, role=role)
        return user

    def setUp(self) -> None:
        self.manager = self._user("mgr3", "mgr3@test.pl", AppRole.MANAGER)
        self.artist = self._user("art3", "art3@test.pl", AppRole.ARTIST)
        self.piece = Piece.objects.create(title="Ave Verum")
        self.note = ProgramNote.objects.create(
            piece=self.piece, language="pl", content="Pierwotna treść notki.",
        )
        self.url = f"/api/archive/program-notes/{self.note.id}/"

    def test_requires_manager(self) -> None:
        self.client.force_authenticate(self.artist)
        resp = self.client.patch(self.url, {"content": "Hack"}, format="json")
        self.assertEqual(resp.status_code, 403)
        self.note.refresh_from_db()
        self.assertEqual(self.note.content, "Pierwotna treść notki.")

    def test_manager_can_edit_content(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.patch(
            self.url, {"content": "Poprawiona treść bez powtórzeń."}, format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.note.refresh_from_db()
        self.assertEqual(self.note.content, "Poprawiona treść bez powtórzeń.")

    def test_project_and_word_count_target_are_read_only(self) -> None:
        # Scope + length target belong to the generator; a hand-edit can't move
        # the note to a project or rewrite its target — those keys are ignored.
        self.client.force_authenticate(self.manager)
        resp = self.client.patch(
            self.url, {"word_count_target": 999}, format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.note.refresh_from_db()
        self.assertEqual(self.note.word_count_target, 250)

    def test_manager_can_delete(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.delete(self.url)
        self.assertEqual(resp.status_code, 204)
        self.note.refresh_from_db()
        self.assertTrue(self.note.is_deleted)  # EnterpriseBaseModel soft-delete

    def test_list_filters_by_piece(self) -> None:
        other = Piece.objects.create(title="Other")
        ProgramNote.objects.create(piece=other, language="pl", content="Inna.")
        self.client.force_authenticate(self.manager)
        resp = self.client.get(f"/api/archive/program-notes/?piece={self.piece.id}")
        self.assertEqual(resp.status_code, 200)
        ids = {row["id"] for row in resp.json()}
        self.assertEqual(ids, {str(self.note.id)})


class OrphanIngestionsEndpointTests(APITestCase):
    """GET /api/archive/editions/orphans/ — the dead-letter queue.

    A pipeline that dies before the resolver attaches a Piece leaves a row that
    is terminal (so `active/` has dropped it) and piece-less (so no piece card
    shows it). Without this endpoint the upload, its error and its AI spend were
    unreachable after a page reload, with no way left to retry or delete. These
    guard exactly that boundary: piece-less failures in, everything else out.
    """

    @staticmethod
    def _user(username: str, email: str, role: str):
        user = User.objects.create_user(username=username, email=email, password="pw123456")
        UserProfile.objects.create(user=user, role=role)
        return user

    @staticmethod
    def _edition(name: str, status: str, piece: Piece | None = None) -> ScoreEdition:
        return ScoreEdition.objects.create(
            piece=piece,
            original_filename=name,
            pdf_file=f"scores/{name}",
            ingestion_status=status,
            ingestion_error="Nie udało się odczytać PDF." if status == IngestionStatus.FAILED else "",
            sha256="",
            page_count=0,
        )

    def setUp(self) -> None:
        self.manager = self._user("mgr4", "mgr4@test.pl", AppRole.MANAGER)
        self.artist = self._user("art4", "art4@test.pl", AppRole.ARTIST)
        self.piece = Piece.objects.create(title="Ave Verum")
        self.orphan = self._edition("orphan.pdf", IngestionStatus.FAILED)
        self.url = "/api/archive/editions/orphans/"

    def test_requires_manager(self) -> None:
        self.client.force_authenticate(self.artist)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_returns_piece_less_failures(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        rows = resp.json()
        self.assertEqual([row["id"] for row in rows], [str(self.orphan.id)])
        # The reason and the money spent are the whole point of the row.
        self.assertIn("ingestion_error", rows[0])
        self.assertIn("ingestion_cost_cents_lifetime", rows[0])

    def test_excludes_failures_that_reached_a_piece(self) -> None:
        # Those already appear on their piece's card, with the same error and
        # the same actions — listing them here would duplicate the door.
        self._edition("attached.pdf", IngestionStatus.FAILED, piece=self.piece)
        self.client.force_authenticate(self.manager)
        ids = {row["id"] for row in self.client.get(self.url).json()}
        self.assertEqual(ids, {str(self.orphan.id)})

    def test_excludes_in_flight_and_settled_runs(self) -> None:
        self._edition("running.pdf", IngestionStatus.EXTRACTING)
        self._edition("awaiting.pdf", IngestionStatus.AWAITING)
        self.client.force_authenticate(self.manager)
        ids = {row["id"] for row in self.client.get(self.url).json()}
        self.assertEqual(ids, {str(self.orphan.id)})

    def test_deleting_an_orphan_clears_it(self) -> None:
        self.client.force_authenticate(self.manager)
        resp = self.client.delete(f"/api/archive/editions/{self.orphan.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(self.client.get(self.url).json(), [])


# ===========================================================================
# composition_year — from the analysis JSON to a review chip
# ===========================================================================

class CompositionYearIngestionTests(TestCase):
    """The one identity fact a reprint's title page usually does NOT carry.

    What the score prints is the publisher's year, so the prompt tells the model
    to answer null unless the page dates the composition itself. These guard the
    consequences of that: a stray year degrades to null instead of failing the
    whole analysis; a year that IS written arrives stamped AI (inside the review
    backlog, never trusted); and an absent year writes no provenance row at all,
    so it costs the conductor's meter nothing.
    """

    def setUp(self) -> None:
        self.composer = Composer.objects.create(
            first_name="Wolfgang Amadeus", last_name="Mozart",
        )

    @staticmethod
    def _identity(**overrides) -> ExtractedWorkIdentity:
        return ExtractedWorkIdentity.model_validate({
            "title": "Ave Verum Corpus",
            "composer_full_name": "Wolfgang Amadeus Mozart",
            "confidence": 0.9,
            **overrides,
        })

    def _year_provenance(self, piece: Piece):
        return ProvenanceRecord.objects.filter(
            object_id=piece.pk, field_name="composition_year",
        )

    def test_implausible_year_degrades_to_null(self) -> None:
        # One bad field must not cost the whole run: the analysis is parsed from
        # model-authored JSON, and everything else in it is still usable.
        for raw in (12, 20250, "nie podano", None):
            with self.subTest(raw=raw):
                identity = self._identity(composition_year=raw)
                self.assertIsNone(identity.composition_year)

    def test_numeric_string_is_accepted(self) -> None:
        self.assertEqual(self._identity(composition_year="1791").composition_year, 1791)

    def test_analysis_projection_carries_the_year(self) -> None:
        # The projection onto the resolver's DTO is where a newly added identity
        # field silently disappears if it is not listed.
        identity = _identity_from_analysis({
            "title": "Ave Verum Corpus",
            "composer_full_name": "Wolfgang Amadeus Mozart",
            "composition_year": 1791,
            "confidence": 0.9,
        })
        self.assertEqual(identity.composition_year, 1791)

    def test_created_piece_carries_the_year_stamped_ai(self) -> None:
        outcome = resolve_or_create_piece(
            composer_id=self.composer.id,
            extracted=self._identity(composition_year=1791),
        )
        piece = Piece.objects.get(pk=outcome.entity_id)
        self.assertEqual(piece.composition_year, 1791)
        record = self._year_provenance(piece).latest("retrieved_at")
        self.assertEqual(record.source, ProvenanceSource.AI_SONNET)

    def test_absent_year_writes_no_provenance_row(self) -> None:
        # Null is the expected answer on most scores. It must stay free: a row
        # here would enlarge the review meter with a field nothing populated.
        outcome = resolve_or_create_piece(
            composer_id=self.composer.id, extracted=self._identity(),
        )
        piece = Piece.objects.get(pk=outcome.entity_id)
        self.assertIsNone(piece.composition_year)
        self.assertFalse(self._year_provenance(piece).exists())

    def test_merge_fills_a_blank_year(self) -> None:
        piece = Piece.objects.create(
            title="Ave Verum Corpus", composer=self.composer,
        )
        resolve_or_create_piece(
            composer_id=self.composer.id,
            extracted=self._identity(composition_year=1791),
        )
        piece.refresh_from_db()
        self.assertEqual(piece.composition_year, 1791)
        self.assertTrue(self._year_provenance(piece).exists())

    def test_merge_never_overwrites_an_existing_year(self) -> None:
        # A conductor's correction outranks the next upload's guess.
        piece = Piece.objects.create(
            title="Ave Verum Corpus", composer=self.composer, composition_year=1791,
        )
        resolve_or_create_piece(
            composer_id=self.composer.id,
            extracted=self._identity(composition_year=1618),
        )
        piece.refresh_from_db()
        self.assertEqual(piece.composition_year, 1791)


# ===========================================================================
# Contextual voice-line naming + edition-scoped divisi / tracks
# ===========================================================================

class VoiceLabelRuleTests(SimpleTestCase):
    """The naming rule itself, with no database in the way.

    Pinned to English so the assertions test the RULE rather than the contents
    of the Polish catalogue — the rendered-sheet tests in `roster` cover the
    translated output. Pinned per test rather than by decorating the class:
    `translation.override` is a ContextDecorator, and applied to a class it
    replaces it with a function the test loader then never collects.
    """

    def setUp(self) -> None:
        self.enterContext(override_language("en"))

    def test_undivided_family_drops_its_index(self) -> None:
        labels = collapse_voice_labels({"S1", "A1", "T1", "B1"})
        self.assertEqual(
            [labels[code] for code in ("S1", "A1", "T1", "B1")],
            ["Soprano", "Alto", "Tenor", "Bass"],
        )

    def test_a_divided_family_keeps_every_index(self) -> None:
        labels = collapse_voice_labels({"S1", "S2", "T1"})
        self.assertEqual(labels["S1"], "Soprano 1")
        self.assertEqual(labels["S2"], "Soprano 2")
        # Its undivided neighbour is unaffected — the rule is per family.
        self.assertEqual(labels["T1"], "Tenor")

    def test_a_lone_second_line_is_still_the_only_one(self) -> None:
        # Odd but legal: a part book labelled "Tenor 2" with no Tenor 1 beside
        # it is, in that arrangement, simply the tenor line.
        self.assertEqual(collapse_voice_labels({"T2"})["T2"], "Tenor")

    def test_untyped_canon_parts_collapse_the_same_way(self) -> None:
        self.assertEqual(collapse_voice_labels({"V1", "V2"})["V1"], "Voice 1")
        self.assertEqual(collapse_voice_labels({"V1"})["V1"], "Voice")

    def test_standalone_roles_are_never_collapsed(self) -> None:
        labels = collapse_voice_labels({"TUTTI", "SOLO"})
        self.assertEqual(labels["TUTTI"], "Tutti (All)")
        self.assertEqual(labels["SOLO"], "Solo")

    def test_an_unknown_scope_keeps_the_index(self) -> None:
        # No scope is not evidence of no divisi: a legacy payload must not be
        # renamed on a guess.
        self.assertEqual(voice_line_label("S2", ()), "Soprano 2")
        self.assertEqual(voice_line_label("S2", ("S2",)), "Soprano")


class EditionScopedDivisiTests(TestCase):
    """An edition that declares its own divisi overrides the piece-wide layer
    outright; one that declares nothing inherits it."""

    def setUp(self) -> None:
        self.piece = Piece.objects.create(title="Dona nobis pacem")
        self.unison = ScoreEdition.objects.create(
            piece=self.piece, original_filename="unison.pdf",
            sha256="a" * 64, is_default=True,
        )
        self.three_part = ScoreEdition.objects.create(
            piece=self.piece, original_filename="three.pdf", sha256="b" * 64,
        )

    def _require(self, line: str, edition: ScoreEdition | None) -> PieceVoiceRequirement:
        return PieceVoiceRequirement.objects.create(
            piece=self.piece, edition=edition, voice_line=line, quantity=4,
        )

    def test_an_edition_overrides_rather_than_adds_to_the_piece_layer(self) -> None:
        self._require("S1", None)
        self._require("A1", None)
        self._require("V1", self.three_part)
        self._require("V2", self.three_part)
        self._require("V3", self.three_part)

        rows = list(self.piece.voice_requirements.all())
        self.assertEqual(
            sorted(r.voice_line for r in scoped_to_edition(rows, self.three_part.pk)),
            ["V1", "V2", "V3"],
        )

    def test_an_edition_without_its_own_divisi_inherits_the_piece_layer(self) -> None:
        self._require("S1", None)
        self._require("V1", self.three_part)

        rows = list(self.piece.voice_requirements.all())
        self.assertEqual(
            [r.voice_line for r in scoped_to_edition(rows, self.unison.pk)], ["S1"],
        )

    def test_each_edition_names_its_own_lines(self) -> None:
        self._require("T1", self.unison)
        self._require("T1", self.three_part)
        self._require("T2", self.three_part)
        self._require("B1", self.three_part)

        rows = list(self.piece.voice_requirements.all())
        self.assertEqual(voice_labels(rows, self.unison.pk)["T1"], "Tenor")
        self.assertEqual(voice_labels(rows, self.three_part.pk)["T1"], "Tenor 1")

    def test_the_same_line_may_exist_on_both_layers(self) -> None:
        # The unique constraints guard each layer separately — a piece-wide
        # "T1" and an edition's "T1" are an override, not a duplicate.
        self._require("T1", None)
        self._require("T1", self.three_part)
        self.assertEqual(self.piece.voice_requirements.count(), 2)

    def test_tracks_follow_the_bound_arrangement(self) -> None:
        piece_wide = Track.objects.create(
            piece=self.piece, voice_part="TUTTI", audio_file="audio_tracks/all.mp3",
        )
        three_part_track = Track.objects.create(
            piece=self.piece, edition=self.three_part, voice_part="T1",
            audio_file="audio_tracks/tenor.mp3",
        )
        rows = list(self.piece.tracks.all())
        self.assertEqual(scoped_to_edition(rows, self.three_part.pk), [three_part_track])
        self.assertEqual(scoped_to_edition(rows, self.unison.pk), [piece_wide])


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class TrackUploadEndpointTests(APITestCase):
    """POST /api/tracks/ — the response is rendered from the saved row.

    The display fields resolve a voice line against its piece's divisi, so they
    need a Track, not the validated payload: rendering an unsaved serializer
    hands them a plain dict and the upload dies with a 500 after the file has
    already landed.
    """

    def setUp(self) -> None:
        self.manager = User.objects.create_user(
            username="trk-mgr", email="trk@test.pl", password="pw123456",
        )
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.piece = Piece.objects.create(title="Ave verum")
        PieceVoiceRequirement.objects.create(
            piece=self.piece, voice_line="T1", quantity=4,
        )
        self.client.force_authenticate(self.manager)

    def _upload(self, **extra: object):
        return self.client.post(
            "/api/tracks/",
            {
                "piece": str(self.piece.id),
                "voice_part": "T1",
                "audio_file": SimpleUploadedFile(
                    "tenor-take-3.mp3", b"ID3\x03\x00\x00\x00", content_type="audio/mpeg",
                ),
                **extra,
            },
            format="multipart",
        )

    def test_upload_returns_the_created_track(self) -> None:
        with override_language("en"):
            response = self._upload()
        self.assertEqual(response.status_code, 201, getattr(response, "data", None))
        self.assertEqual(response.data["voice_part"], "T1")
        # One tenor line on the piece, so the part is named plainly.
        self.assertEqual(response.data["voice_part_display"], "Tenor")
        self.assertEqual(response.data["original_filename"], "tenor-take-3.mp3")
        self.assertEqual(Track.objects.filter(piece=self.piece).count(), 1)

    def test_the_note_travels_with_the_upload(self) -> None:
        response = self._upload(description="od taktu 34, tempo 90")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["description"], "od taktu 34, tempo 90")
