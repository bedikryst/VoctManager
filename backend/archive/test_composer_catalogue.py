"""
@file archive/test_composer_catalogue.py
@description Tests for the composer catalogue's write paths: merging two entries
             (pieces, blank fields, MBID, aliases and provenance move to the
             entry that stays), MusicBrainz ids that are unique among active rows
             only, and hand edits that stamp MANUAL provenance and so survive a
             forced refresh.
@module archive/test_composer_catalogue
"""
from unittest.mock import patch
from uuid import UUID

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APITestCase

from archive.dtos import ComposerLookupResult
from archive.models import Composer, Piece, ProvenanceRecord, ProvenanceSource
from archive.services import enrichment
from core.constants import AppRole
from core.models import UserProfile

User = get_user_model()

BACH_MBID = UUID("24f1766e-9635-4d58-a4d4-9413f9f98a4c")
WORK_MBID = UUID("0b9a4c8e-5d1f-4e7a-9c35-2f6d8a1b7e40")


def _manager():
    user = User.objects.create_user(username="mgr", email="mgr@test.pl", password="pw123456")
    UserProfile.objects.create(user=user, role=AppRole.MANAGER)
    return user


def _provenance(composer: Composer, field_name: str):
    return ProvenanceRecord.objects.filter(
        content_type=ContentType.objects.get_for_model(Composer),
        object_id=composer.pk,
        field_name=field_name,
    )


class MergeComposersTests(APITestCase):
    def setUp(self) -> None:
        self.client.force_authenticate(_manager())
        self.target = Composer.objects.create(
            first_name="Johann Sebastian", last_name="Bach",
            birth_year="1685", nationality="niemiecka",
            aliases=["Bach, J.S."],
        )
        self.source = Composer.objects.create(
            first_name="J.S.", last_name="Bach",
            birth_year="1686", death_year="1750", period="BAR",
            nationality="Germany", bio="German composer.",
            portrait_url="https://commons.wikimedia.org/wiki/Special:FilePath/Bach.jpg",
            portrait_license="wikimedia-commons",
            mbid=BACH_MBID, wikidata_qid="Q1339",
            aliases=["Bach, J.S.", "J. S. Bach", "JOHANN SEBASTIAN BACH", "Иоганн Себастьян Бах"],
        )
        ct = ContentType.objects.get_for_model(Composer)
        for field_name, source in (
            ("mbid", ProvenanceSource.MUSICBRAINZ),
            ("death_year", ProvenanceSource.MUSICBRAINZ),
            ("portrait_url", ProvenanceSource.WIKIDATA),
            ("birth_year", ProvenanceSource.MUSICBRAINZ),
        ):
            ProvenanceRecord.objects.create(
                content_type=ct, object_id=self.source.pk,
                field_name=field_name, source=source,
            )
        self.piece = Piece.objects.create(title="Magnificat", composer=self.source)

    def _merge(self):
        return self.client.post(
            f"/api/composers/{self.source.id}/merge_into/{self.target.id}/",
        )

    def test_merge_fills_blanks_and_never_overwrites(self) -> None:
        resp = self._merge()
        self.assertEqual(resp.status_code, 200)
        self.target.refresh_from_db()

        # Filled from the source.
        self.assertEqual(self.target.death_year, "1750")
        self.assertEqual(self.target.period, "BAR")
        self.assertEqual(self.target.bio, "German composer.")
        self.assertEqual(self.target.portrait_license, "wikimedia-commons")
        self.assertEqual(self.target.wikidata_qid, "Q1339")
        # Kept: the target's own values and names.
        self.assertEqual(self.target.birth_year, "1685")
        self.assertEqual(self.target.nationality, "niemiecka")
        self.assertEqual(self.target.first_name, "Johann Sebastian")
        self.assertEqual(resp.json()["pieces_count"], 1)

    def test_merge_moves_mbid_pieces_and_soft_deletes_source(self) -> None:
        self._merge()
        self.target.refresh_from_db()
        self.piece.refresh_from_db()

        self.assertEqual(self.target.mbid, BACH_MBID)
        self.assertEqual(self.piece.composer_id, self.target.pk)
        self.assertTrue(Composer.all_objects.get(pk=self.source.pk).is_deleted)

    def test_merge_adds_source_spellings_as_aliases(self) -> None:
        self._merge()
        self.target.refresh_from_db()

        # Folded duplicates and the target's own name stay out.
        self.assertEqual(
            self.target.aliases,
            ["Bach, J.S.", "J.S. Bach", "J. S. Bach", "Иоганн Себастьян Бах"],
        )

    def test_merge_moves_provenance_of_copied_fields_only(self) -> None:
        self._merge()

        self.assertTrue(_provenance(self.target, "mbid").exists())
        self.assertTrue(_provenance(self.target, "death_year").exists())
        self.assertTrue(_provenance(self.target, "portrait_url").exists())
        # birth_year was not copied, so its record stays with the source.
        self.assertFalse(_provenance(self.target, "birth_year").exists())
        self.assertTrue(_provenance(self.source, "birth_year").exists())

    def test_merge_into_itself_is_refused(self) -> None:
        resp = self.client.post(
            f"/api/composers/{self.source.id}/merge_into/{self.source.id}/",
        )
        self.assertEqual(resp.status_code, 400)

    def test_merge_into_deleted_target_is_not_found(self) -> None:
        self.target.delete()
        resp = self._merge()
        self.assertEqual(resp.status_code, 404)
        self.assertFalse(Composer.all_objects.get(pk=self.source.pk).is_deleted)


class MbidAmongActiveRowsTests(TestCase):
    def test_new_composer_takes_a_deleted_composers_mbid(self) -> None:
        Composer.objects.create(last_name="Bach", mbid=BACH_MBID).delete()

        fresh = Composer.objects.create(last_name="Bach", mbid=BACH_MBID)

        self.assertEqual(Composer.objects.get(mbid=BACH_MBID).pk, fresh.pk)

    def test_two_active_composers_cannot_share_an_mbid(self) -> None:
        Composer.objects.create(last_name="Bach", mbid=BACH_MBID)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Composer.objects.create(last_name="Bach", first_name="J.S.", mbid=BACH_MBID)

    def test_new_piece_takes_a_deleted_pieces_work_id(self) -> None:
        Piece.objects.create(title="Magnificat", mbid_work=WORK_MBID).delete()

        fresh = Piece.objects.create(title="Magnificat", mbid_work=WORK_MBID)

        self.assertEqual(Piece.objects.get(mbid_work=WORK_MBID).pk, fresh.pk)


@patch("archive.services.enrichment.WikidataClient")
@patch("archive.services.enrichment.MusicBrainzClient")
class HandEditProvenanceTests(APITestCase):
    def setUp(self) -> None:
        self.client.force_authenticate(_manager())
        self.composer = Composer.objects.create(
            first_name="Johann Sebastian", last_name="Bach",
            birth_year="1685", bio="German composer.",
        )
        self.url = f"/api/composers/{self.composer.id}/"

    def _manual(self) -> set[str]:
        return set(
            ProvenanceRecord.objects.filter(
                object_id=self.composer.pk, source=ProvenanceSource.MANUAL,
            ).values_list("field_name", flat=True)
        )

    def test_patch_records_manual_for_changed_fields_only(self, mb, wiki) -> None:
        resp = self.client.patch(
            self.url, {"birth_year": "1685", "death_year": "1750"}, format="json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._manual(), {"death_year"})
        self.assertEqual(
            _provenance(self.composer, "death_year").get().source_reference, "mgr@test.pl",
        )

    def test_forced_refresh_leaves_a_hand_edit_alone(self, mb, wiki) -> None:
        self.client.patch(self.url, {"bio": "Kantor lipski."}, format="json")
        mb.get_artist.return_value = None
        mb.search_composer.return_value = None
        wiki.enrich_composer_by_mbid.return_value = None
        wiki.enrich_composer_by_name.return_value = ComposerLookupResult(
            wikidata_qid="Q1339", bio="German composer of the Baroque period.",
            source="wikidata",
        )
        self.composer.refresh_from_db()

        report = enrichment.refresh_composer(self.composer, force=True)
        self.composer.refresh_from_db()

        self.assertEqual(self.composer.bio, "Kantor lipski.")
        self.assertIn("bio", report.fields_skipped_existing)
        self.assertEqual(self.composer.wikidata_qid, "Q1339")
