# outreach/tests.py
# ==========================================
# Outreach — concert notice list, endpoint + state-machine tests
# Standard: Enterprise SaaS 2026
# ==========================================
from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .consent import NOTICE_CLAUSE_VERSION
from .models import (
    CONFIRM_TOKEN_TTL,
    EVIDENCE_RETENTION,
    ConcertNoticeSubscription,
    NoticeConsentEvent,
    NoticeConsentEventKind,
    NoticeStatus,
)
from .services import NoticeListService, SubscribeOutcome
from .tasks import purge_notice_records


@override_settings(PUBLIC_SITE_URL='https://voctensemble.com')
class NoticeListTestCase(APITestCase):
    """Shared fixtures: the three URLs and a cache reset, since the throttles are real."""

    subscribe_url = reverse('outreach:notice-subscribe')
    confirm_url = reverse('outreach:notice-confirm')
    unsubscribe_url = reverse('outreach:notice-unsubscribe')

    def setUp(self):
        cache.clear()
        mail.outbox = []

    def _subscribe(self, email='reader@example.com', **extra):
        payload = {'email': email, 'consent': True, **extra}
        return self.client.post(self.subscribe_url, payload, format='json')

    @staticmethod
    def _row(email='reader@example.com') -> ConcertNoticeSubscription:
        return ConcertNoticeSubscription.all_objects.get(email=email)

    def _live_confirm_token(self, email='reader@example.com') -> str:
        """The confirmation secret of a row that must have one — asserted, so the type
        checker sees a `str` and a broken fixture fails here rather than three lines on."""
        token = self._row(email).confirm_token
        self.assertIsNotNone(token)
        assert token is not None
        return token


class SubscribeTests(NoticeListTestCase):
    """The sign-up half: what a public form is allowed to create, and what it may leak."""

    def test_signup_creates_a_pending_row_and_sends_one_mail(self):
        response = self._subscribe()

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        row = self._row()
        self.assertEqual(row.status, NoticeStatus.PENDING)
        self.assertIsNone(row.confirmed_at)
        self.assertEqual(row.clause_version, NOTICE_CLAUSE_VERSION)
        self.assertEqual(row.surface, 'web:koncerty')
        self.assertEqual(len(mail.outbox), 1)

    def test_confirmation_mail_carries_the_confirm_link_and_not_the_other_secret(self):
        self._subscribe()
        row = self._row()
        body = mail.outbox[0].body

        self.assertIn(f'https://voctensemble.com/nuntius?confirm={row.confirm_token}', body)
        # The reader is asked to do exactly one thing here, and a second link beside it —
        # one that ENDS what the first begins — is how a reader confirms nothing by mistake.
        # The one-click header carries that token deliberately; the prose must not.
        self.assertNotIn(row.unsubscribe_token, body)

    def test_locale_drives_the_link_prefix(self):
        self._subscribe(email='lecteur@example.com', locale='fr')
        self.assertIn('https://voctensemble.com/fr/nuntius?confirm=', mail.outbox[0].body)

    def test_the_mail_comes_from_the_ensemble_not_the_panel(self):
        """
        The recipient is not a member and has never heard of VoctManager. The sender's
        display name is the first thing they read, before the careful footer.
        """
        self._subscribe()

        self.assertEqual(mail.outbox[0].from_email, settings.PUBLIC_FROM_EMAIL)
        self.assertIn('VoctEnsemble', mail.outbox[0].from_email)
        self.assertNotIn('VoctManager', mail.outbox[0].from_email)

    def test_a_reply_reaches_the_address_the_footer_prints(self):
        """
        The sender is a noreply address, and the footer of this very mail invites the
        reader to write to us about their consent. The two facts are asserted together
        because they are one promise: the address in the prose is where a reply lands.
        """
        self._subscribe()
        msg = mail.outbox[0]

        self.assertEqual(msg.reply_to, [settings.PUBLIC_REPLY_TO_EMAIL])
        for address in msg.reply_to:
            self.assertIn(address, msg.body)

    def test_the_mail_offers_one_click_withdrawal_to_the_reader_s_client(self):
        """
        RFC 8058. The URI must be one a mail client can POST to, which the static page is
        not — so the header names the API. A header aimed at `/nuntius` would have Gmail
        report a withdrawal that nginx answered with 405.
        """
        self._subscribe()
        token = self._row().unsubscribe_token
        headers = mail.outbox[0].extra_headers

        self.assertEqual(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
        self.assertEqual(
            headers['List-Unsubscribe'],
            f'<https://voctensemble.com/api/outreach/notices/unsubscribe/{token}/>',
        )
        self.assertNotIn('/nuntius', headers['List-Unsubscribe'])

    def test_consent_must_be_true(self):
        response = self.client.post(
            self.subscribe_url,
            {'email': 'reader@example.com', 'consent': False},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ConcertNoticeSubscription.all_objects.exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_surface_outside_the_allowlist_is_refused(self):
        response = self._subscribe(surface='web:phishing')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_every_placement_the_site_mounts_is_recorded_as_itself(self):
        """The column names the SCREEN, so each placement must survive into the row intact —
        a value quietly collapsed to the default would make the record say a reader read the
        clause somewhere they never were."""
        for surface in ('web:koncerty', 'web:newsletter', 'web:404'):
            with self.subTest(surface=surface):
                email = f'{surface.replace(":", "-")}@example.com'
                response = self._subscribe(email=email, surface=surface)
                self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
                self.assertEqual(self._row(email).surface, surface)

    def test_address_is_matched_case_insensitively(self):
        self._subscribe(email='Reader@Example.com')
        self._subscribe(email='reader@example.com')
        self.assertEqual(ConcertNoticeSubscription.all_objects.count(), 1)

    def test_repeat_signup_inside_the_cooldown_sends_nothing_further(self):
        self._subscribe()
        response = self._subscribe()

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(len(mail.outbox), 1)

    def test_signup_for_a_confirmed_address_answers_the_same_and_sends_nothing(self):
        self._subscribe()
        NoticeListService.confirm(self._live_confirm_token())
        confirmed_at = self._row().confirmed_at
        mail.outbox = []

        response = self._subscribe()

        # Identical answer to a first-time sign-up: the endpoint must not tell a stranger
        # whether an address is on the list.
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(len(mail.outbox), 0)
        row = self._row()
        self.assertEqual(row.status, NoticeStatus.CONFIRMED)
        self.assertEqual(row.confirmed_at, confirmed_at)

    def test_signup_after_the_cooldown_reissues_a_fresh_secret(self):
        self._subscribe()
        first_token = self._row().confirm_token
        ConcertNoticeSubscription.all_objects.update(
            confirm_sent_at=timezone.now() - timedelta(hours=1),
        )

        self._subscribe()

        self.assertNotEqual(self._row().confirm_token, first_token)
        self.assertEqual(len(mail.outbox), 2)

    def test_a_transport_failure_never_reaches_the_reader(self):
        with patch(
            'outreach.services.EmailDispatcherService.dispatch',
            side_effect=RuntimeError('ESP down'),
        ):
            response = self._subscribe()

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        # The row survives, so the reader's retry after the cooldown is the recovery path.
        self.assertEqual(self._row().status, NoticeStatus.PENDING)

    def test_a_failure_to_SAVE_the_sign_up_is_not_answered_with_202(self):
        """
        202 means "we have your address", and it may only be sent when that is true. The
        forgiveness a dead mailer earns covers the send and nothing else — stretched over
        the write as well, it would answer a lost sign-up with "check your mailbox".
        """
        with patch(
            'outreach.services.NoticeListService.subscribe',
            side_effect=RuntimeError('database down'),
        ), self.assertRaises(RuntimeError):
            self._subscribe()


class ConfirmTests(NoticeListTestCase):
    """The double opt-in: the click that turns a row into a consent."""

    def setUp(self):
        super().setUp()
        self._subscribe()
        self.token = self._live_confirm_token()

    def _confirm(self, token=None):
        return self.client.post(
            self.confirm_url, {'token': token or self.token}, format='json',
        )

    def test_confirming_records_the_consent(self):
        response = self._confirm()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'status': 'confirmed'})
        row = self._row()
        self.assertEqual(row.status, NoticeStatus.CONFIRMED)
        self.assertIsNotNone(row.confirmed_at)

    def test_confirming_twice_is_idempotent(self):
        self._confirm()
        first = self._row().confirmed_at

        response = self._confirm()

        self.assertEqual(response.data, {'status': 'already_confirmed'})
        self.assertEqual(self._row().confirmed_at, first)

    def test_an_expired_link_does_not_confirm(self):
        ConcertNoticeSubscription.all_objects.update(
            confirm_sent_at=timezone.now() - CONFIRM_TOKEN_TTL - timedelta(minutes=1),
        )

        response = self._confirm()

        self.assertEqual(response.data, {'status': 'expired'})
        self.assertEqual(self._row().status, NoticeStatus.PENDING)

    def test_an_unknown_token_is_answered_not_raised(self):
        response = self._confirm(token='not-a-token')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'status': 'invalid'})

    def test_an_old_link_cannot_resurrect_a_withdrawn_consent(self):
        self._confirm()
        NoticeListService.unsubscribe(self._row().unsubscribe_token)

        response = self._confirm()

        self.assertEqual(response.data, {'status': 'invalid'})
        self.assertEqual(self._row().status, NoticeStatus.UNSUBSCRIBED)


class UnsubscribeTests(NoticeListTestCase):
    """Withdrawal: it must end the sending and keep the evidence."""

    def setUp(self):
        super().setUp()
        self._subscribe()
        NoticeListService.confirm(self._live_confirm_token())

    def _unsubscribe(self, token=None):
        return self.client.post(
            self.unsubscribe_url,
            {'token': token or self._row().unsubscribe_token},
            format='json',
        )

    def test_unsubscribing_keeps_the_row_and_its_evidence(self):
        response = self._unsubscribe()

        self.assertEqual(response.data, {'status': 'unsubscribed'})
        row = self._row()
        self.assertEqual(row.status, NoticeStatus.UNSUBSCRIBED)
        self.assertIsNotNone(row.unsubscribed_at)
        # Withdrawing consent ends the processing, not the duty to show the consent was
        # lawfully obtained — so the confirmation timestamp stays.
        self.assertIsNotNone(row.confirmed_at)

    def test_unsubscribing_twice_is_idempotent(self):
        self._unsubscribe()
        response = self._unsubscribe()
        self.assertEqual(response.data, {'status': 'already_unsubscribed'})

    def test_an_unknown_token_is_answered_not_raised(self):
        response = self._unsubscribe(token='not-a-token')
        self.assertEqual(response.data, {'status': 'invalid'})

    def test_the_consent_log_survives_a_later_sign_up(self):
        """
        The one case the subscription row alone cannot answer: an address that consented,
        withdrew, and signed up again. The row is reset — `confirmed_at` and the clause
        version describe the NEW cycle — so without the log the proof of the consent under
        which mail had already been sent would be gone.
        """
        self._unsubscribe()
        NoticeListService.subscribe(
            email='reader@example.com', locale='pl', surface='web:koncerty',
        )

        row = self._row()
        self.assertEqual(row.status, NoticeStatus.PENDING)
        self.assertIsNone(row.confirmed_at)
        self.assertEqual(
            list(row.consent_events.order_by('at').values_list('kind', flat=True)),
            [NoticeConsentEventKind.GRANTED, NoticeConsentEventKind.WITHDRAWN],
        )

    def test_signing_up_again_after_withdrawal_starts_a_new_double_opt_in(self):
        self._unsubscribe()
        mail.outbox = []

        outcome = NoticeListService.subscribe(
            email='reader@example.com', locale='pl', surface='web:koncerty',
        )

        self.assertEqual(outcome, SubscribeOutcome.CONFIRMATION_SENT)
        row = self._row()
        self.assertEqual(row.status, NoticeStatus.PENDING)
        self.assertIsNone(row.confirmed_at)
        self.assertIsNone(row.unsubscribed_at)
        self.assertEqual(len(mail.outbox), 1)


class OneClickUnsubscribeTests(NoticeListTestCase):
    """
    The URI the `List-Unsubscribe` header carries. Nobody reads this endpoint's answer —
    a mail client does — so what it must get right is the method split: POST withdraws,
    GET does not.
    """

    def setUp(self):
        super().setUp()
        self._subscribe()
        NoticeListService.confirm(self._live_confirm_token())
        self.token = self._row().unsubscribe_token

    @staticmethod
    def _url(token: str) -> str:
        return reverse('outreach:notice-unsubscribe-one-click', args=[token])

    def _one_click(self, token: str = ''):
        """The request as a mail client sends it: the RFC's fixed body, form-encoded."""
        return self.client.post(
            self._url(token or self.token),
            'List-Unsubscribe=One-Click',
            content_type='application/x-www-form-urlencoded',
        )

    def test_one_click_withdraws_the_consent(self):
        response = self._one_click()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'status': 'unsubscribed'})
        row = self._row()
        self.assertEqual(row.status, NoticeStatus.UNSUBSCRIBED)
        self.assertEqual(
            row.consent_events.filter(kind=NoticeConsentEventKind.WITHDRAWN).count(), 1,
        )

    def test_the_body_is_never_read_so_an_empty_one_still_works(self):
        """The RFC fixes what the client sends; a provider that sends something else, or
        nothing, must not turn a withdrawal into a parse error."""
        response = self.client.post(self._url(self.token))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._row().status, NoticeStatus.UNSUBSCRIBED)

    def test_a_get_lands_on_the_page_without_withdrawing_anything(self):
        """
        RFC 8058 forbids the URI acting on GET, which is the rule the whole app already
        lives by: the scanners that fetch every link in a mail must not end consents.
        """
        response = self.client.get(self._url(self.token))

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertEqual(
            response['Location'],
            f'https://voctensemble.com/nuntius?unsubscribe={self.token}',
        )
        self.assertEqual(self._row().status, NoticeStatus.CONFIRMED)

    def test_the_redirect_speaks_the_subscriber_s_own_language(self):
        ConcertNoticeSubscription.all_objects.filter(pk=self._row().pk).update(locale='fr')

        response = self.client.get(self._url(self.token))

        self.assertEqual(
            response['Location'],
            f'https://voctensemble.com/fr/nuntius?unsubscribe={self.token}',
        )

    def test_an_unknown_token_is_answered_not_raised(self):
        response = self._one_click(token='not-a-token')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'status': 'invalid'})

    def test_an_unknown_token_still_has_somewhere_to_land_on_a_get(self):
        response = self.client.get(self._url('not-a-token'))

        self.assertEqual(
            response['Location'],
            'https://voctensemble.com/nuntius?unsubscribe=not-a-token',
        )


class ConsentEvidenceTests(NoticeListTestCase):
    """The log, and the sweep that decides how long any of it is kept."""

    def test_confirming_and_withdrawing_each_write_one_event(self):
        self._subscribe()
        NoticeListService.confirm(self._live_confirm_token())
        NoticeListService.unsubscribe(self._row().unsubscribe_token)

        events = list(self._row().consent_events.order_by('at'))
        self.assertEqual(
            [e.kind for e in events],
            [NoticeConsentEventKind.GRANTED, NoticeConsentEventKind.WITHDRAWN],
        )
        # Each event carries the clause it describes, so reading one needs no join back.
        self.assertTrue(all(e.clause_version == NOTICE_CLAUSE_VERSION for e in events))

    def test_purge_drops_a_sign_up_nobody_ever_confirmed(self):
        self._subscribe()
        ConcertNoticeSubscription.all_objects.update(
            confirm_sent_at=timezone.now() - CONFIRM_TOKEN_TTL - timedelta(days=1),
        )

        result = purge_notice_records()

        self.assertEqual(result['unconfirmed'], 1)
        self.assertFalse(ConcertNoticeSubscription.all_objects.exists())

    def test_purge_is_a_hard_delete_not_a_soft_one(self):
        """
        The address must actually leave the table. `SoftDeleteQuerySet.delete()` would have
        flagged the row and kept it, which is the outcome the sweep exists to prevent.
        """
        self._subscribe()
        ConcertNoticeSubscription.all_objects.update(
            confirm_sent_at=timezone.now() - CONFIRM_TOKEN_TTL - timedelta(days=1),
        )

        purge_notice_records()

        self.assertEqual(ConcertNoticeSubscription.all_objects.count(), 0)

    def test_purge_defers_an_abandoned_sign_up_with_a_history_but_takes_it_in_the_end(self):
        """
        The row the two sweeps could each leave to the other: an address that consented,
        withdrew, signed up again and never confirmed. Sweep 1 must not take it — its
        events are evidence, and seven days is not the period that governs evidence — but
        sweep 2 must, once that period runs out. Skipped by both, it would be an address
        held forever with no consent behind it.
        """
        self._subscribe()
        NoticeListService.confirm(self._live_confirm_token())
        NoticeListService.unsubscribe(self._row().unsubscribe_token)
        NoticeListService.subscribe(
            email='reader@example.com', locale='pl', surface='web:koncerty',
        )
        ConcertNoticeSubscription.all_objects.update(
            confirm_sent_at=timezone.now() - CONFIRM_TOKEN_TTL - timedelta(days=1),
        )

        result = purge_notice_records()

        self.assertEqual(result['unconfirmed'], 0)
        self.assertTrue(ConcertNoticeSubscription.all_objects.exists())

        # `at` is auto_now_add, so the age has to be written after the fact.
        NoticeConsentEvent.objects.update(
            at=timezone.now() - EVIDENCE_RETENTION - timedelta(days=1),
        )

        self.assertEqual(purge_notice_records()['evidence'], 1)
        self.assertFalse(ConcertNoticeSubscription.all_objects.exists())

    def test_purge_leaves_a_sign_up_that_is_still_inside_its_seven_days(self):
        """
        The mistake sweep 2 invites once it stops naming a status: a fresh PENDING row has
        no events at all, and "no event newer than three years ago" is true of it in the
        reading a plain `exclude()` would give.
        """
        self._subscribe()

        result = purge_notice_records()

        self.assertEqual(result, {'unconfirmed': 0, 'evidence': 0})
        self.assertTrue(ConcertNoticeSubscription.all_objects.exists())

    def test_purge_never_touches_a_live_consent_however_old(self):
        """A consent that has not been withdrawn is kept while it lasts; nothing here expires it."""
        self._subscribe()
        NoticeListService.confirm(self._live_confirm_token())
        NoticeConsentEvent.objects.update(
            at=timezone.now() - EVIDENCE_RETENTION - timedelta(days=400),
        )
        ConcertNoticeSubscription.all_objects.update(
            confirm_sent_at=timezone.now() - CONFIRM_TOKEN_TTL - timedelta(days=400),
        )

        result = purge_notice_records()

        self.assertEqual(result, {'unconfirmed': 0, 'evidence': 0})
        self.assertEqual(self._row().status, NoticeStatus.CONFIRMED)

    def test_purge_keeps_a_recently_withdrawn_consent_and_drops_a_stale_one(self):
        self._subscribe()
        NoticeListService.confirm(self._live_confirm_token())
        NoticeListService.unsubscribe(self._row().unsubscribe_token)

        self.assertEqual(purge_notice_records()['evidence'], 0)

        # `at` is auto_now_add, so the age has to be written after the fact.
        NoticeConsentEvent.objects.update(
            at=timezone.now() - EVIDENCE_RETENTION - timedelta(days=1),
        )

        self.assertEqual(purge_notice_records()['evidence'], 1)
        self.assertFalse(ConcertNoticeSubscription.all_objects.exists())
