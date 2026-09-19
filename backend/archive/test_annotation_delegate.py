"""
@file test_annotation_delegate.py
@description What a stand-in may and may not read off the conductor's score.

    A delegation exists so somebody can run one evening the conductor cannot.
    It is a lent key, and the whole point of the design is which door it does
    NOT open: the 'conductor' layer carries what he thinks about the singers, so
    handing it to one of them would hand them the remarks about their own
    section. The stand-in reads 'leader' and nothing else of his.

    The other half is time. A grant is a favour for an upcoming evening, so it
    has to stop working on its own — when it expires, and when the concert is
    over — or the choir slowly accumulates people who can still read everything.

@architecture Enterprise SaaS 2026
@module archive/test_annotation_delegate
"""

from __future__ import annotations

import tempfile
from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import override_settings
from django.utils import timezone
from pypdf import PdfWriter
from rest_framework.test import APITestCase

from archive.models import (
    CONDUCTOR_ANNOTATION_LAYER,
    LEADER_ANNOTATION_LAYER,
    PERSONAL_ANNOTATION_LAYER,
    SHARED_ANNOTATION_LAYER,
    Annotation,
    AnnotationType,
    Composer,
    Piece,
    ScoreEdition,
)
from core.constants import AppRole
from core.models import UserProfile
from roster.models import (
    Artist,
    Participation,
    ProgramItem,
    Project,
    RehearsalDelegate,
    VoiceType,
)

_MEDIA = tempfile.mkdtemp(prefix="vm_delegate_marks_test_")

_ENDPOINT = "/api/archive/annotations/"
_PENCIL = "#1F2933"


def _pdf_bytes(pages: int = 1) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=595, height=842)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


@override_settings(MEDIA_ROOT=_MEDIA)
class DelegateMarkVisibilityTests(APITestCase):
    """Who sees which layer, on whose music, and for how long."""

    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("mgr", "mgr@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)

        self.deputy_user = User.objects.create_user(
            "deputy", "deputy@test.pl", "pw123456",
            first_name="Kasia", last_name="Nowak",
        )
        UserProfile.objects.create(user=self.deputy_user, role=AppRole.ARTIST)
        self.singer_user = User.objects.create_user(
            "singer", "singer@test.pl", "pw123456",
            first_name="Jan", last_name="Kowalski",
        )
        UserProfile.objects.create(user=self.singer_user, role=AppRole.ARTIST)

        self.project = Project.objects.create(
            title="Adwent", status=Project.Status.ACTIVE,
        )
        composer = Composer.objects.create(first_name="Anton", last_name="Bruckner")
        self.piece = Piece.objects.create(title="Locus iste", composer=composer)
        ProgramItem.objects.create(project=self.project, piece=self.piece, order=1)

        self.deputy = self._artist(self.deputy_user, "Kasia", "Nowak", "deputy@test.pl")
        self._artist(self.singer_user, "Jan", "Kowalski", "singer@test.pl")

        self.edition = ScoreEdition.objects.create(
            piece=self.piece, original_filename="score.pdf",
            page_count=2, is_default=True, sha256="a" * 64,
        )
        self.edition.pdf_file.save("score.pdf", ContentFile(_pdf_bytes(2)), save=True)

        self.leader_mark = self._mark(LEADER_ANNOTATION_LAYER)
        self.conductor_mark = self._mark(CONDUCTOR_ANNOTATION_LAYER)
        self.shared_mark = self._mark(SHARED_ANNOTATION_LAYER)

    def _artist(self, user, first: str, last: str, email: str) -> Artist:
        artist = Artist.objects.create(
            user=user, first_name=first, last_name=last,
            email=email, voice_type=VoiceType.TENOR,
        )
        Participation.objects.create(
            artist=artist, project=self.project,
            status=Participation.Status.CONFIRMED,
        )
        return artist

    def _mark(self, layer: str) -> Annotation:
        return Annotation.objects.create(
            edition=self.edition, page_number=1,
            annotation_type=AnnotationType.FREEHAND,
            payload={"paths": [[[0.2, 0.3], [0.6, 0.35]]], "width": 0.004},
            layer_name=layer, color=_PENCIL, created_by=self.manager,
        )

    def _grant(self, **overrides) -> RehearsalDelegate:
        return RehearsalDelegate.objects.create(
            project=self.project, artist=self.deputy,
            granted_by=self.manager, **overrides,
        )

    def _layers_visible_to(self, user) -> set[str]:
        self.client.force_authenticate(user)
        response = self.client.get(f"{_ENDPOINT}?edition={self.edition.pk}")
        self.assertEqual(response.status_code, 200)
        return {row["layer_name"] for row in response.json()}

    # --- what the grant opens -------------------------------------------------

    def test_a_plain_singer_never_sees_the_leader_layer(self) -> None:
        self.assertEqual(
            self._layers_visible_to(self.singer_user), {SHARED_ANNOTATION_LAYER},
        )

    def test_a_delegate_reads_the_leader_layer_but_not_the_private_one(self) -> None:
        self._grant()
        visible = self._layers_visible_to(self.deputy_user)
        self.assertIn(LEADER_ANNOTATION_LAYER, visible)
        self.assertIn(SHARED_ANNOTATION_LAYER, visible)
        # The whole reason the fourth layer exists.
        self.assertNotIn(CONDUCTOR_ANNOTATION_LAYER, visible)

    def test_the_marks_scope_can_be_withheld_while_the_grant_stands(self) -> None:
        self._grant(can_see_leader_marks=False)
        self.assertNotIn(
            LEADER_ANNOTATION_LAYER, self._layers_visible_to(self.deputy_user),
        )

    def test_a_grant_on_one_project_does_not_open_another_s_music(self) -> None:
        other = Project.objects.create(title="Wielkanoc", status=Project.Status.ACTIVE)
        other_piece = Piece.objects.create(
            title="Christus factus est", composer=self.piece.composer,
        )
        ProgramItem.objects.create(project=other, piece=other_piece, order=1)
        other_edition = ScoreEdition.objects.create(
            piece=other_piece, original_filename="other.pdf",
            page_count=1, is_default=True, sha256="b" * 64,
        )
        Annotation.objects.create(
            edition=other_edition, page_number=1,
            annotation_type=AnnotationType.FREEHAND,
            payload={"paths": [[[0.1, 0.1], [0.2, 0.2]]], "width": 0.004},
            layer_name=LEADER_ANNOTATION_LAYER, color=_PENCIL,
            created_by=self.manager,
        )
        self._grant()

        self.client.force_authenticate(self.deputy_user)
        response = self.client.get(f"{_ENDPOINT}?edition={other_edition.pk}")
        self.assertEqual(response.json(), [])

    # --- when it stops opening it --------------------------------------------

    def test_an_expired_grant_opens_nothing(self) -> None:
        self._grant(expires_at=timezone.now() - timedelta(hours=1))
        self.assertNotIn(
            LEADER_ANNOTATION_LAYER, self._layers_visible_to(self.deputy_user),
        )

    def test_a_grant_with_a_future_expiry_still_opens(self) -> None:
        self._grant(expires_at=timezone.now() + timedelta(days=3))
        self.assertIn(
            LEADER_ANNOTATION_LAYER, self._layers_visible_to(self.deputy_user),
        )

    def test_a_closed_project_ends_the_grant_on_its_own(self) -> None:
        self._grant()
        self.project.status = Project.Status.COMPLETED
        self.project.save(update_fields=["status"])
        # The singer's own door shuts at the same moment, so nothing of this
        # project's music is left reachable.
        self.assertEqual(self._layers_visible_to(self.deputy_user), set())

    def test_a_revoked_grant_opens_nothing(self) -> None:
        grant = self._grant()
        grant.delete()
        self.assertNotIn(
            LEADER_ANNOTATION_LAYER, self._layers_visible_to(self.deputy_user),
        )

    # --- read, and only read --------------------------------------------------

    def test_a_delegate_may_not_write_on_the_leader_layer(self) -> None:
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        response = self.client.post(
            _ENDPOINT,
            {
                "edition": str(self.edition.pk),
                "page_number": 1,
                "annotation_type": AnnotationType.FREEHAND,
                "payload": {"paths": [[[0.1, 0.1], [0.2, 0.2]]], "width": 0.004},
                "layer_name": LEADER_ANNOTATION_LAYER,
                "color": _PENCIL,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_a_delegate_may_not_edit_a_leader_mark_they_can_now_see(self) -> None:
        # The widened read scope makes the row reachable by id; the write guard
        # is what still refuses it — a 403, not the 404 it used to be.
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        response = self.client.patch(
            f"{_ENDPOINT}{self.leader_mark.pk}/",
            {"color": "#1F2933"}, format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_a_delegate_keeps_their_own_pencil(self) -> None:
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        response = self.client.post(
            _ENDPOINT,
            {
                "edition": str(self.edition.pk),
                "page_number": 1,
                "annotation_type": AnnotationType.FREEHAND,
                "payload": {"paths": [[[0.1, 0.1], [0.2, 0.2]]], "width": 0.004},
                "layer_name": PERSONAL_ANNOTATION_LAYER,
                "color": _PENCIL,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    # --- the choir's layer, on request --------------------------------------

    def _post_shared_mark(self):
        return self.client.post(
            _ENDPOINT,
            {
                "edition": str(self.edition.pk),
                "page_number": 1,
                "annotation_type": AnnotationType.FREEHAND,
                "payload": {"paths": [[[0.1, 0.1], [0.2, 0.2]]], "width": 0.004},
                "layer_name": SHARED_ANNOTATION_LAYER,
                "color": _PENCIL,
            },
            format="json",
        )

    def test_a_grant_without_choir_marks_keeps_the_shared_layer_closed(self) -> None:
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        self.assertEqual(self._post_shared_mark().status_code, 403)

    def test_choir_marks_open_the_shared_layer_for_their_own_hand(self) -> None:
        self._grant(can_mark_for_choir=True)
        self.client.force_authenticate(self.deputy_user)
        response = self._post_shared_mark()
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["layer_name"], SHARED_ANNOTATION_LAYER)

    def test_choir_marks_do_not_reach_the_conductor_s_shared_mark(self) -> None:
        # The layer is open, the row is not theirs: the own-row rule holds on
        # 'shared' exactly as it does on 'personal'.
        self._grant(can_mark_for_choir=True)
        self.client.force_authenticate(self.deputy_user)
        response = self.client.patch(
            f"{_ENDPOINT}{self.shared_mark.pk}/",
            {"color": "#1F2933"}, format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_choir_marks_do_not_open_the_leader_layer(self) -> None:
        self._grant(can_mark_for_choir=True)
        self.client.force_authenticate(self.deputy_user)
        response = self.client.post(
            _ENDPOINT,
            {
                "edition": str(self.edition.pk),
                "page_number": 1,
                "annotation_type": AnnotationType.FREEHAND,
                "payload": {"paths": [[[0.1, 0.1], [0.2, 0.2]]], "width": 0.004},
                "layer_name": LEADER_ANNOTATION_LAYER,
                "color": _PENCIL,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_clearing_the_page_still_only_reaches_their_own_marks(self) -> None:
        self._grant()
        self.client.force_authenticate(self.deputy_user)
        response = self.client.post(
            f"{_ENDPOINT}clear/", {"edition": str(self.edition.pk)}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["deleted"], 0)
        self.assertTrue(Annotation.objects.filter(pk=self.leader_mark.pk).exists())
        self.assertTrue(Annotation.objects.filter(pk=self.conductor_mark.pk).exists())

    def test_clearing_with_choir_marks_takes_their_own_shared_marks_only(self) -> None:
        # The trash reaches exactly what the pencil could: their shared mark
        # goes, the conductor's shared mark on the same page stays.
        self._grant(can_mark_for_choir=True)
        self.client.force_authenticate(self.deputy_user)
        own_shared_id = self._post_shared_mark().json()["id"]
        response = self.client.post(
            f"{_ENDPOINT}clear/", {"edition": str(self.edition.pk)}, format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["deleted"], 1)
        self.assertFalse(Annotation.objects.filter(pk=own_shared_id).exists())
        self.assertTrue(Annotation.objects.filter(pk=self.shared_mark.pk).exists())

    def test_clearing_without_choir_marks_leaves_shared_marks_alone(self) -> None:
        # A shared mark they wrote while the scope was on is no longer theirs to
        # bulk-erase once it is withdrawn — the row rules follow the grant.
        grant = self._grant(can_mark_for_choir=True)
        self.client.force_authenticate(self.deputy_user)
        own_shared_id = self._post_shared_mark().json()["id"]
        grant.can_mark_for_choir = False
        grant.save(update_fields=["can_mark_for_choir"])
        response = self.client.post(
            f"{_ENDPOINT}clear/", {"edition": str(self.edition.pk)}, format="json",
        )
        self.assertEqual(response.json()["deleted"], 0)
        self.assertTrue(Annotation.objects.filter(pk=own_shared_id).exists())

    # --- what the stand is told ---------------------------------------------

    def _songbook_choir_flag(self) -> bool:
        rows = self.client.get("/api/participations/materials-dashboard/").json()
        row = next(r for r in rows if r["project"]["id"] == str(self.project.pk))
        return row["program"][0]["piece"]["may_mark_for_choir"]

    def test_the_songbook_says_where_the_choir_pill_may_aim(self) -> None:
        # The flag follows the scope, not the grant: the stand arms its choir
        # pill from this and nothing else, so it must move exactly when the
        # server's write rule does.
        self.client.force_authenticate(self.deputy_user)
        self.assertFalse(self._songbook_choir_flag())
        grant = self._grant()
        self.assertFalse(self._songbook_choir_flag())
        grant.can_mark_for_choir = True
        grant.save(update_fields=["can_mark_for_choir"])
        self.assertTrue(self._songbook_choir_flag())


@override_settings(MEDIA_ROOT=_MEDIA)
class DelegateOutsideTheCastTests(APITestCase):
    """A stand-in asked to take a programme they do not sing in.

    This is the case `can_open_materials` exists for, and the one where every
    cast-derived rule quietly stops applying. What the choir can see, the person
    in front of them must see too — otherwise they rehearse off a clean page
    while forty singers read the conductor's markings.
    """

    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("mgr3", "mgr3@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.deputy_user = User.objects.create_user(
            "deputy2", "deputy2@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.deputy_user, role=AppRole.ARTIST)
        # No Participation anywhere: the whole point of this fixture.
        self.deputy = Artist.objects.create(
            user=self.deputy_user, first_name="Kasia", last_name="Nowak",
            email="deputy2@test.pl", voice_type=VoiceType.ALTO,
        )
        self.project = Project.objects.create(
            title="Roraty", status=Project.Status.ACTIVE,
        )
        composer = Composer.objects.create(first_name="Josquin", last_name="Desprez")
        piece = Piece.objects.create(title="Ave Maria", composer=composer)
        ProgramItem.objects.create(project=self.project, piece=piece, order=1)
        self.edition = ScoreEdition.objects.create(
            piece=piece, original_filename="score.pdf",
            page_count=1, is_default=True, sha256="d" * 64,
        )
        for layer in (
            SHARED_ANNOTATION_LAYER,
            LEADER_ANNOTATION_LAYER,
            CONDUCTOR_ANNOTATION_LAYER,
        ):
            Annotation.objects.create(
                edition=self.edition, page_number=1,
                annotation_type=AnnotationType.FREEHAND,
                payload={"paths": [[[0.2, 0.3], [0.6, 0.35]]], "width": 0.004},
                layer_name=layer, color=_PENCIL, created_by=self.manager,
            )
        RehearsalDelegate.objects.create(
            project=self.project, artist=self.deputy, granted_by=self.manager,
        )

    def test_a_stand_in_reads_what_the_choir_reads(self) -> None:
        self.client.force_authenticate(self.deputy_user)
        layers = {
            row["layer_name"]
            for row in self.client.get(f"{_ENDPOINT}?edition={self.edition.pk}").json()
        }
        self.assertEqual(
            layers, {SHARED_ANNOTATION_LAYER, LEADER_ANNOTATION_LAYER},
        )

    def test_their_own_pencil_comes_back_on_the_next_read(self) -> None:
        # The write guard asks "cast OR leading"; the read scope used to ask only
        # "cast" — so a stand-in could draw a mark and never see it again.
        self.client.force_authenticate(self.deputy_user)
        created = self.client.post(
            _ENDPOINT,
            {
                "edition": str(self.edition.pk),
                "page_number": 1,
                "annotation_type": AnnotationType.FREEHAND,
                "payload": {"paths": [[[0.1, 0.1], [0.2, 0.2]]], "width": 0.004},
                "layer_name": PERSONAL_ANNOTATION_LAYER,
                "color": _PENCIL,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        rows = self.client.get(f"{_ENDPOINT}?edition={self.edition.pk}").json()
        self.assertIn(created.json()["id"], {row["id"] for row in rows})


@override_settings(MEDIA_ROOT=_MEDIA)
class ConductorWithoutManagershipTests(APITestCase):
    """The podium carries the same rights without anyone granting them.

    A guest conductor holds `Project.conductor` and no manager role. They are the
    one the leader layer is written for, so it reaches them the same way — and
    the conductor's private layer still does not.
    """

    def setUp(self) -> None:
        User = get_user_model()
        self.manager = User.objects.create_user("mgr2", "mgr2@test.pl", "pw123456")
        UserProfile.objects.create(user=self.manager, role=AppRole.MANAGER)
        self.maestro_user = User.objects.create_user(
            "maestro", "maestro@test.pl", "pw123456",
        )
        UserProfile.objects.create(user=self.maestro_user, role=AppRole.ARTIST)
        maestro = Artist.objects.create(
            user=self.maestro_user, first_name="Florent", last_name="D.",
            email="maestro@test.pl", voice_type=VoiceType.CONDUCTOR,
        )
        # Deliberately NOT cast: a conductor holds no seat in the programme.
        self.project = Project.objects.create(
            title="Nieszpory", status=Project.Status.ACTIVE, conductor=maestro,
        )
        composer = Composer.objects.create(first_name="Claudio", last_name="Monteverdi")
        piece = Piece.objects.create(title="Dixit Dominus", composer=composer)
        ProgramItem.objects.create(project=self.project, piece=piece, order=1)
        self.edition = ScoreEdition.objects.create(
            piece=piece, original_filename="score.pdf",
            page_count=1, is_default=True, sha256="c" * 64,
        )
        for layer in (
            LEADER_ANNOTATION_LAYER,
            CONDUCTOR_ANNOTATION_LAYER,
            SHARED_ANNOTATION_LAYER,
        ):
            Annotation.objects.create(
                edition=self.edition, page_number=1,
                annotation_type=AnnotationType.FREEHAND,
                payload={"paths": [[[0.2, 0.3], [0.6, 0.35]]], "width": 0.004},
                layer_name=layer, color=_PENCIL, created_by=self.manager,
            )

    def test_the_podium_reads_the_leader_layer_without_a_grant(self) -> None:
        self.client.force_authenticate(self.maestro_user)
        response = self.client.get(f"{_ENDPOINT}?edition={self.edition.pk}")
        layers = {row["layer_name"] for row in response.json()}
        self.assertEqual(
            layers, {LEADER_ANNOTATION_LAYER, SHARED_ANNOTATION_LAYER},
        )

    def test_the_choir_s_own_layer_is_not_hidden_from_whoever_runs_it(self) -> None:
        # The layer scope used to be the SEAT, and a conductor holds none — so
        # the one person standing in front of the choir saw none of the marks
        # the choir was reading off. The binder bakes 'shared' in at build time,
        # which made the paper and the screen disagree as well.
        self.client.force_authenticate(self.maestro_user)
        response = self.client.get(f"{_ENDPOINT}?edition={self.edition.pk}")
        self.assertIn(
            SHARED_ANNOTATION_LAYER,
            {row["layer_name"] for row in response.json()},
        )

    def test_a_cancelled_project_takes_the_podium_s_access_with_it(self) -> None:
        self.project.status = Project.Status.CANCELLED
        self.project.save(update_fields=["status"])
        self.client.force_authenticate(self.maestro_user)
        response = self.client.get(f"{_ENDPOINT}?edition={self.edition.pk}")
        self.assertEqual(response.json(), [])
