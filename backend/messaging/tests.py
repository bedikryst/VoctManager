"""
@file tests.py
@description API-level tests for the messaging domain: thread initiation by both
             parties, the hybrid ping-routing rule (directed assignee vs. management
             pool), queryset isolation, unread accounting, and manager-only triage.
             Notification emission is asserted by mocking NotificationService where
             it is *looked up* (messaging.services), keeping the suite decoupled from
             the email/push transport.
@architecture Enterprise SaaS 2026
@module messaging/tests
"""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from core.constants import AppRole
from core.models import UserProfile
from core.signals import account_soft_deleted
from notifications.models import NotificationType
from roster.models import Artist, Participation, Project, VoiceType

from .models import (
    ChannelMembership,
    ChannelMessage,
    Message,
    ProjectChannel,
    Thread,
    ThreadStatus,
)

User = get_user_model()

# Patched where it is *looked up* (the service module), not where it is defined.
EMIT = "messaging.services.NotificationService.create_notification"

THREADS = "/api/messaging/threads/"


class MessagingFlowTests(APITestCase):
    def setUp(self) -> None:
        self.manager = self._user("m1", "m1@test.pl", AppRole.MANAGER)
        self.manager2 = self._user("m2", "m2@test.pl", AppRole.MANAGER)

        self.artist_user = self._user("a1", "a1@test.pl", AppRole.ARTIST)
        self.artist = Artist.objects.create(
            user=self.artist_user, first_name="Ada", last_name="Lewandowska",
            email="a1@test.pl", voice_type=VoiceType.TENOR,
        )

        self.other_user = self._user("a2", "a2@test.pl", AppRole.ARTIST)
        self.other_artist = Artist.objects.create(
            user=self.other_user, first_name="Bo", last_name="Mazur",
            email="a2@test.pl", voice_type=VoiceType.BASS,
        )

    @staticmethod
    def _user(username: str, email: str, role: str):
        user = User.objects.create_user(username=username, email=email, password="pw123456")
        UserProfile.objects.create(user=user, role=role)
        return user

    # ------------------------------------------------------------------ #
    # Initiation + ping routing                                          #
    # ------------------------------------------------------------------ #

    def test_artist_opens_thread_directed_to_chosen_manager(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        with patch(EMIT) as emit, self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(
                THREADS,
                {"subject": "Spóźnię się", "body": "Będę 10 min później", "assignee_id": self.manager.id},
                format="json",
            )

        self.assertEqual(resp.status_code, 201)
        thread = Thread.objects.get()
        self.assertEqual(thread.assignee_id, self.manager.id)
        self.assertEqual(thread.status, ThreadStatus.OPEN)
        self.assertEqual(thread.artist_id, self.artist.id)

        self.assertEqual(emit.call_count, 1)
        dto = emit.call_args.args[0]
        self.assertEqual(dto.recipient_id, str(self.manager.id))
        self.assertEqual(dto.notification_type, NotificationType.MESSAGE_RECEIVED)

    def test_artist_opens_unassigned_thread_fans_out_to_all_managers(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        with patch(EMIT) as emit, self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(THREADS, {"subject": "Pytanie", "body": "Czy są nuty?"}, format="json")

        self.assertEqual(resp.status_code, 201)
        recipients = {c.args[0].recipient_id for c in emit.call_args_list}
        self.assertEqual(recipients, {str(self.manager.id), str(self.manager2.id)})

    def test_manager_reply_pings_only_the_artist(self) -> None:
        # Artist opens (no capture → its own on_commit emit does not fire).
        self.client.force_authenticate(user=self.artist_user)
        opened = self.client.post(
            THREADS, {"subject": "Cześć", "body": "wiadomość", "assignee_id": self.manager.id}, format="json"
        )
        thread_id = opened.json()["id"]

        self.client.force_authenticate(user=self.manager)
        with patch(EMIT) as emit, self.captureOnCommitCallbacks(execute=True):
            reply = self.client.post(f"{THREADS}{thread_id}/messages/", {"body": "Odpowiadam"}, format="json")

        self.assertEqual(reply.status_code, 201)
        self.assertEqual(emit.call_count, 1)
        self.assertEqual(emit.call_args.args[0].recipient_id, str(self.artist_user.id))

    # ------------------------------------------------------------------ #
    # Scoping, unread accounting, triage                                 #
    # ------------------------------------------------------------------ #

    def test_artist_cannot_see_other_artists_threads(self) -> None:
        self.client.force_authenticate(user=self.manager)
        self.client.post(THREADS, {"subject": "X", "body": "y", "artist_id": str(self.other_artist.id)}, format="json")

        self.client.force_authenticate(user=self.artist_user)
        resp = self.client.get(THREADS)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    def test_unread_count_drops_after_mark_read(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        self.client.post(THREADS, {"subject": "q", "body": "b", "assignee_id": self.manager.id}, format="json")
        thread_id = str(Thread.objects.get().id)

        self.client.force_authenticate(user=self.manager)
        self.assertEqual(self.client.get(f"{THREADS}unread-count/").json()["unread_count"], 1)

        self.assertEqual(self.client.post(f"{THREADS}{thread_id}/read/").status_code, 204)
        self.assertEqual(self.client.get(f"{THREADS}unread-count/").json()["unread_count"], 0)

    def test_triage_patch_is_manager_only(self) -> None:
        self.client.force_authenticate(user=self.manager)
        created = self.client.post(THREADS, {"subject": "X", "body": "y", "artist_id": str(self.artist.id)}, format="json")
        thread_id = created.json()["id"]

        self.client.force_authenticate(user=self.artist_user)
        denied = self.client.patch(f"{THREADS}{thread_id}/", {"status": ThreadStatus.RESOLVED}, format="json")
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(user=self.manager)
        ok = self.client.patch(f"{THREADS}{thread_id}/", {"status": ThreadStatus.RESOLVED}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(Thread.objects.get(id=thread_id).status, ThreadStatus.RESOLVED)

    def test_recipients_lists_managers_excluding_self(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        resp = self.client.get(f"{THREADS}recipients/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual({r["id"] for r in resp.json()}, {self.manager.id, self.manager2.id})

    # ------------------------------------------------------------------ #
    # Faza 3: dedup + GDPR erasure                                       #
    # ------------------------------------------------------------------ #

    def test_artist_undirected_general_threads_are_deduped(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        first = self.client.post(THREADS, {"subject": "Pytanie 1", "body": "a"}, format="json")
        self.assertEqual(first.status_code, 201)
        second = self.client.post(THREADS, {"subject": "Pytanie 2", "body": "b"}, format="json")
        self.assertEqual(second.status_code, 200)  # reused, not created
        self.assertEqual(Thread.objects.filter(artist=self.artist).count(), 1)
        self.assertEqual(first.json()["id"], second.json()["id"])

    def test_directed_general_thread_is_not_deduped(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        self.client.post(THREADS, {"subject": "Q1", "body": "a"}, format="json")
        directed = self.client.post(
            THREADS, {"subject": "Q2", "body": "b", "assignee_id": self.manager.id}, format="json"
        )
        self.assertEqual(directed.status_code, 201)
        self.assertEqual(Thread.objects.filter(artist=self.artist).count(), 2)

    def test_gdpr_erasure_blanks_messages_and_soft_deletes_threads(self) -> None:
        self.client.force_authenticate(user=self.artist_user)
        self.client.post(
            THREADS, {"subject": "Q", "body": "sekret", "assignee_id": self.manager.id}, format="json"
        )
        thread_id = Thread.objects.get().id

        account_soft_deleted.send(sender=self.__class__, user=self.artist_user)

        self.assertTrue(
            all(m.body == "[treść usunięta]" for m in Message.objects.filter(thread_id=thread_id))
        )
        self.assertFalse(Thread.objects.filter(id=thread_id).exists())  # soft-deleted
        self.assertTrue(Thread.all_objects.filter(id=thread_id).exists())


CHANNELS = "/api/messaging/channels/"
PUSH = "messaging.services.send_push_notification_task.delay"


class ProjectChannelTests(APITestCase):
    def setUp(self) -> None:
        self.manager = self._user("cm", "cm@test.pl", AppRole.MANAGER)
        self.artist_user = self._user("ca", "ca@test.pl", AppRole.ARTIST)
        self.artist = Artist.objects.create(
            user=self.artist_user, first_name="Ala", last_name="Kowal",
            email="ca@test.pl", voice_type=VoiceType.TENOR,
        )
        self.other_user = self._user("cb", "cb@test.pl", AppRole.ARTIST)
        self.other_artist = Artist.objects.create(
            user=self.other_user, first_name="Bo", last_name="Lis",
            email="cb@test.pl", voice_type=VoiceType.BASS,
        )
        self.project = Project.objects.create(title="Requiem")

    @staticmethod
    def _user(username: str, email: str, role: str):
        user = User.objects.create_user(username=username, email=email, password="pw123456")
        UserProfile.objects.create(user=user, role=role)
        return user

    def _confirm(self, artist, project=None):
        return Participation.objects.create(
            artist=artist, project=project or self.project, status=Participation.Status.CONFIRMED
        )

    # -- membership sync --------------------------------------------------- #

    def test_confirmed_participation_creates_membership(self) -> None:
        self._confirm(self.artist)
        channel = ProjectChannel.objects.get(project=self.project)
        self.assertTrue(ChannelMembership.objects.filter(channel=channel, user=self.artist_user).exists())

    def test_decline_removes_membership(self) -> None:
        participation = self._confirm(self.artist)
        channel = ProjectChannel.objects.get(project=self.project)
        self.assertTrue(ChannelMembership.objects.filter(channel=channel, user=self.artist_user).exists())
        participation.status = Participation.Status.DECLINED
        participation.save()
        self.assertFalse(ChannelMembership.objects.filter(channel=channel, user=self.artist_user).exists())

    # -- access / listing -------------------------------------------------- #

    def test_artist_lists_only_member_channels(self) -> None:
        self._confirm(self.artist)
        other_project = Project.objects.create(title="Vespers")
        self._confirm(self.other_artist, other_project)

        self.client.force_authenticate(user=self.artist_user)
        resp = self.client.get(CHANNELS)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual({c["project_id"] for c in resp.json()}, {str(self.project.id)})

    def test_non_member_cannot_post(self) -> None:
        self._confirm(self.artist)
        channel = ProjectChannel.objects.get(project=self.project)
        self.client.force_authenticate(user=self.other_user)  # not confirmed here
        resp = self.client.post(f"{CHANNELS}{channel.id}/messages/", {"body": "x"}, format="json")
        self.assertEqual(resp.status_code, 404)

    # -- delivery (push opt-in only) -------------------------------------- #

    def test_post_message_pushes_only_to_opted_in(self) -> None:
        self._confirm(self.artist)
        self._confirm(self.other_artist)
        channel = ProjectChannel.objects.get(project=self.project)
        ChannelMembership.objects.filter(channel=channel, user=self.other_user).update(push_enabled=True)

        self.client.force_authenticate(user=self.artist_user)
        with patch(PUSH) as push, self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(f"{CHANNELS}{channel.id}/messages/", {"body": "cześć"}, format="json")

        self.assertEqual(resp.status_code, 201)
        recipients = {c.kwargs["recipient_id"] for c in push.call_args_list}
        self.assertEqual(recipients, {str(self.other_user.id)})

    # -- pin / push toggle ------------------------------------------------- #

    def test_pin_is_manager_only(self) -> None:
        self._confirm(self.artist)
        channel = ProjectChannel.objects.get(project=self.project)
        self.client.force_authenticate(user=self.artist_user)
        message_id = self.client.post(
            f"{CHANNELS}{channel.id}/messages/", {"body": "ogłoszenie"}, format="json"
        ).json()["id"]

        denied = self.client.post(f"{CHANNELS}{channel.id}/messages/{message_id}/pin/", {"pinned": True}, format="json")
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(user=self.manager)
        ok = self.client.post(f"{CHANNELS}{channel.id}/messages/{message_id}/pin/", {"pinned": True}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(ChannelMessage.objects.get(id=message_id).is_pinned)

    def test_push_toggle(self) -> None:
        self._confirm(self.artist)
        channel = ProjectChannel.objects.get(project=self.project)
        self.client.force_authenticate(user=self.artist_user)
        resp = self.client.patch(f"{CHANNELS}{channel.id}/membership/", {"push_enabled": True}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(ChannelMembership.objects.get(channel=channel, user=self.artist_user).push_enabled)

    # -- GDPR -------------------------------------------------------------- #

    def test_gdpr_blanks_channel_messages_and_drops_membership(self) -> None:
        self._confirm(self.artist)
        channel = ProjectChannel.objects.get(project=self.project)
        self.client.force_authenticate(user=self.artist_user)
        self.client.post(f"{CHANNELS}{channel.id}/messages/", {"body": "sekret"}, format="json")

        account_soft_deleted.send(sender=self.__class__, user=self.artist_user)

        self.assertTrue(all(m.body == "[treść usunięta]" for m in ChannelMessage.objects.filter(channel=channel)))
        self.assertFalse(ChannelMembership.objects.filter(channel=channel, user=self.artist_user).exists())
