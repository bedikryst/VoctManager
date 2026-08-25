"""
The order the cast is read in — `/api/participations/order/` and [cast_order].

A choir stands in an order its conductor decides, and until now every surface
invented one for itself. These cases pin the three things that make the single
order hold: the arrangement outranks the older tie-breakers (or a drag past the
marked leader would do nothing on screen), a section nobody has arranged still
reads alphabetically, and a singer's place follows them into the next project so
the conductor does not re-arrange forty people every time.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from core.constants import AppRole, VoiceLine
from core.models import UserProfile

from .cast_order import participation_sort_key
from .models import Artist, Participation, Project, VoiceType

ORDER_URL = "/api/participations/order/"
PARTICIPATIONS_URL = "/api/participations/"


class CastOrderTests(APITestCase):
    def _artist(self, first: str, last: str, voice: str = VoiceType.SOPRANO) -> Artist:
        return Artist.objects.create(
            first_name=first, last_name=last,
            email=f"{first.lower()}.{last.lower()}@test.pl", voice_type=voice,
        )

    def setUp(self) -> None:
        User = get_user_model()
        self.manager_user = User.objects.create_user(
            username="ord-mgr", email="ord-mgr@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=self.manager_user, role=AppRole.MANAGER)

        self.project = Project.objects.create(
            title="Nieszpory", date_time=timezone.now() + timedelta(days=30),
            status=Project.Status.DRAFT,
        )

        # Alphabetically Antos, Borys, Cecylia — so any test that reaches a
        # different order has reached it for a reason.
        self.antos = self._artist("Ala", "Antos")
        self.borys = self._artist("Bea", "Borys")
        self.cecylia = self._artist("Cela", "Cecylia")

        self.seats = {
            artist.last_name: Participation.objects.create(
                artist=artist, project=self.project,
                status=Participation.Status.CONFIRMED,
            )
            for artist in (self.antos, self.borys, self.cecylia)
        }

    def _sorted_names(self) -> list[str]:
        return [
            participation.artist.last_name
            for participation in sorted(
                Participation.objects.filter(project=self.project).select_related(
                    "artist"
                ),
                key=participation_sort_key,
            )
        ]

    def _put_order(self, *last_names: str):
        self.client.force_authenticate(user=self.manager_user)
        return self.client.put(
            ORDER_URL,
            {
                "project": str(self.project.id),
                "order": [
                    {"participation": str(self.seats[name].id), "section_rank": rank}
                    for rank, name in enumerate(last_names)
                ],
            },
            format="json",
        )

    # ── The order itself ─────────────────────────────────────────────────

    def test_an_unarranged_section_still_reads_alphabetically(self) -> None:
        self.assertEqual(self._sorted_names(), ["Antos", "Borys", "Cecylia"])

    def test_the_arrangement_decides_the_order(self) -> None:
        response = self._put_order("Cecylia", "Antos", "Borys")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._sorted_names(), ["Cecylia", "Antos", "Borys"])

    def test_the_arrangement_outranks_the_section_leader(self) -> None:
        """A singer dragged above the marked leader has to stay above them.

        The star still heads a section nobody has arranged — that is the case
        below — but once there is an arrangement, it is the arrangement that is
        being looked at.
        """
        leader = self.seats["Cecylia"]
        leader.is_section_leader = True
        leader.save(update_fields=["is_section_leader"])
        self.assertEqual(self._sorted_names()[0], "Cecylia")

        self._put_order("Borys", "Cecylia", "Antos")

        self.assertEqual(self._sorted_names(), ["Borys", "Cecylia", "Antos"])

    def test_the_arrangement_outranks_the_line_up_seat(self) -> None:
        top = self.seats["Cecylia"]
        top.default_voice_line = VoiceLine.SOPRANO_1
        top.save(update_fields=["default_voice_line"])
        self.assertEqual(self._sorted_names()[0], "Cecylia")

        self._put_order("Antos", "Borys", "Cecylia")

        self.assertEqual(self._sorted_names(), ["Antos", "Borys", "Cecylia"])

    def test_an_unarranged_singer_sorts_after_every_arranged_one(self) -> None:
        """Adding somebody to an arranged section appends them, never leads it."""
        self._put_order("Cecylia", "Borys")

        self.assertEqual(self._sorted_names(), ["Cecylia", "Borys", "Antos"])

    def test_sections_are_ordered_independently(self) -> None:
        """Rank 0 in the altos does not outrank rank 1 in the sopranos.

        The two numbers are not comparable — voice type decides first — which is
        what lets every section be renumbered from the top without any regard for
        the others.
        """
        alto = self._artist("Zofia", "Zeman", VoiceType.ALTO)
        alto_seat = Participation.objects.create(
            artist=alto, project=self.project,
            status=Participation.Status.CONFIRMED, section_rank=0,
        )
        self.assertIsNotNone(alto_seat.pk)

        self._put_order("Cecylia", "Antos", "Borys")

        self.assertEqual(
            self._sorted_names(), ["Cecylia", "Antos", "Borys", "Zeman"]
        )

    # ── Writing it ───────────────────────────────────────────────────────

    def test_the_endpoint_refuses_someone_from_another_project(self) -> None:
        other_project = Project.objects.create(
            title="Kolędy", date_time=timezone.now() + timedelta(days=60),
        )
        stranger = Participation.objects.create(
            artist=self._artist("Ewa", "Obca", VoiceType.ALTO),
            project=other_project,
            status=Participation.Status.CONFIRMED,
        )

        self.client.force_authenticate(user=self.manager_user)
        response = self.client.put(
            ORDER_URL,
            {
                "project": str(self.project.id),
                "order": [{"participation": str(stranger.id), "section_rank": 0}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        stranger.refresh_from_db()
        self.assertIsNone(stranger.section_rank)

    def test_the_endpoint_refuses_a_repeated_participation(self) -> None:
        self.client.force_authenticate(user=self.manager_user)
        seat_id = str(self.seats["Antos"].id)
        response = self.client.put(
            ORDER_URL,
            {
                "project": str(self.project.id),
                "order": [
                    {"participation": seat_id, "section_rank": 0},
                    {"participation": seat_id, "section_rank": 1},
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_a_singer_cannot_arrange_the_cast(self) -> None:
        User = get_user_model()
        singer_user = User.objects.create_user(
            username="ord-singer", email="ord-singer@test.pl", password="pw123456"
        )
        UserProfile.objects.create(user=singer_user, role=AppRole.ARTIST)
        self.antos.user = singer_user
        self.antos.save(update_fields=["user"])

        self.client.force_authenticate(user=singer_user)
        response = self.client.put(
            ORDER_URL,
            {
                "project": str(self.project.id),
                "order": [
                    {"participation": str(self.seats["Antos"].id), "section_rank": 0}
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.seats["Antos"].refresh_from_db()
        self.assertIsNone(self.seats["Antos"].section_rank)

    # ── Carrying it to the next project ──────────────────────────────────

    def test_a_new_seat_inherits_the_place_its_singer_last_held(self) -> None:
        self._put_order("Cecylia", "Antos", "Borys")

        next_project = Project.objects.create(
            title="Pasja", date_time=timezone.now() + timedelta(days=120),
            status=Project.Status.DRAFT,
        )
        self.client.force_authenticate(user=self.manager_user)
        with self.captureOnCommitCallbacks(execute=True):
            for artist in (self.antos, self.borys, self.cecylia):
                response = self.client.post(
                    PARTICIPATIONS_URL,
                    {
                        "artist": str(artist.id),
                        "project": str(next_project.id),
                        "status": Participation.Status.INVITED,
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, 201)

        carried = [
            participation.artist.last_name
            for participation in sorted(
                Participation.objects.filter(project=next_project).select_related(
                    "artist"
                ),
                key=participation_sort_key,
            )
        ]
        self.assertEqual(carried, ["Cecylia", "Antos", "Borys"])

    def test_a_singer_nobody_ever_arranged_starts_unranked(self) -> None:
        next_project = Project.objects.create(
            title="Pasja", date_time=timezone.now() + timedelta(days=120),
            status=Project.Status.DRAFT,
        )
        self.client.force_authenticate(user=self.manager_user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                PARTICIPATIONS_URL,
                {
                    "artist": str(self.antos.id),
                    "project": str(next_project.id),
                    "status": Participation.Status.INVITED,
                },
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertIsNone(
            Participation.objects.get(
                artist=self.antos, project=next_project
            ).section_rank
        )
