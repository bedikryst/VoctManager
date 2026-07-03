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
from unittest.mock import MagicMock, patch
from uuid import UUID

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APITestCase

from archive.dtos import ComposerLookupResult
from archive.infrastructure import _http
from archive.infrastructure._http import GetResult
from archive.infrastructure.musicbrainz_client import MusicBrainzClient
from archive.infrastructure.wikidata_client import (
    PORTRAIT_THUMB_WIDTH,
    WikidataClient,
    _claim_image,
)
from archive.models import Composer, Piece, ProvenanceRecord, ProvenanceSource
from archive.services import enrichment
from core.constants import AppRole
from core.models import UserProfile

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
