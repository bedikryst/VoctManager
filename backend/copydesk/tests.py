"""
@file tests.py
@description Copy desk tests. Weighted towards the two things that fail silently
             rather than loudly: a stale translation that looks perfectly fine on
             screen, and a sanitizer that accepts what it was supposed to rebuild.
@architecture Enterprise SaaS 2026
@module copydesk/tests
"""
from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import UserProfile
from notifications.delivery import (
    GROUP_OF_TYPE,
    STAFF_ONLY_TYPES,
    assert_preference_policy_is_coherent,
    default_channel_preferences,
    is_digestible,
)
from notifications.message_content import MessageContentBuilder
from notifications.models import NotificationLevel, NotificationType

from .dtos import ProposalReviewDTO, ProposalWriteDTO, SegmentUpsertDTO
from .hashing import normalize_for_hash, source_hash
from .models import CopyProposal, CopySegment, ProposalStatus, SegmentKind, SiteLocale
from .permissions import user_can_edit_site_copy, user_is_copy_reviewer
from .sanitizers import sanitize_html, sanitize_text
from .services import CopyDeskService, ProposalClosedError, UnknownProposalsError
from .tasks import QUIET_PERIOD, dispatch_copy_proposal_digests

User = get_user_model()


def make_user(email: str, *, editor: bool = False, staff: bool = False):
    user = User.objects.create_user(
        username=email.split("@")[0], email=email, password="Xk9!vortex2026",
    )
    profile, _created = UserProfile.objects.get_or_create(user=user)
    profile.can_edit_site_copy = editor
    profile.save(update_fields=["can_edit_site_copy", "updated_at"])
    if staff:
        user.is_staff = True
        user.save(update_fields=["is_staff"])
    return user


def make_segment(key: str, locale: str, value: str, **kwargs) -> CopySegment:
    return CopySegment.objects.create(
        key=key,
        locale=locale,
        value=value,
        kind=kwargs.pop("kind", SegmentKind.TEXT),
        scope=kwargs.pop("scope", ".".join(key.split(".")[:2])),
        scope_label=kwargs.pop("scope_label", "Kontemplacja Wcielenia"),
        label=kwargs.pop("label", "Esencja"),
        order=kwargs.pop("order", 0),
        source_hash=kwargs.pop("source_hash", ""),
    )


class SourceHashTests(TestCase):
    """The hash is mirrored in TypeScript by the extractor, so every rule it
    applies has to be one somebody can reproduce deliberately."""

    def test_crlf_and_lf_hash_identically(self):
        # The corpus is CRLF on a Windows checkout; a byte-level hash would
        # report every unchanged string as moved.
        self.assertEqual(source_hash("a\r\nb"), source_hash("a\nb"))

    def test_nfc_and_nfd_hash_identically(self):
        self.assertEqual(source_hash("zażółć"), source_hash("zażółć"))

    def test_hard_spaces_fold_to_ordinary_spaces(self):
        # typo.ts inserts these at build time; letting one mark a translation
        # stale would be an alarm the editor cannot see the cause of. Written
        # Built from codepoints: these characters are invisible in a diff.
        nbsp, narrow = chr(0x00A0), chr(0x202F)
        self.assertEqual(source_hash(f"Iz{nbsp}11"), source_hash("Iz 11"))
        self.assertEqual(source_hash(f"oui{narrow}?"), source_hash("oui ?"))

    def test_surrounding_whitespace_is_not_sense(self):
        self.assertEqual(source_hash("  Wyrosła różdżka  "), source_hash("Wyrosła różdżka"))

    def test_interior_whitespace_is_preserved(self):
        self.assertNotEqual(source_hash("a b"), source_hash("a  b"))

    def test_empty_is_not_a_hash(self):
        # "No source recorded" must stay distinguishable from "hash of nothing",
        # because the desk renders the two differently.
        self.assertEqual(source_hash(""), "")
        self.assertEqual(source_hash("   \r\n  "), "")

    def test_normalization_is_exposed_for_the_extractor(self):
        self.assertEqual(normalize_for_hash(" a\r\nb "), "a\nb")


class HashParityFixtureTests(TestCase):
    """The fixture both languages read.

    `web/copydesk/normalize.mjs` has to reproduce this module character for
    character, and a drift between them is invisible: the corpus would simply
    start reading as stale, or a moved Polish would read as fresh. Neither side
    can be trusted to police the other, so both read ONE file of adversarial
    cases — generated from the functions below — and both fail when it moves.

    This test's own job is narrower than the JavaScript one: it proves the
    fixture still describes THIS module. Editing `hashing.py` without
    regenerating the fixture fails here; regenerating it without telling the
    mirror fails there.
    """

    @classmethod
    def fixture_path(cls) -> Path:
        return Path(settings.BASE_DIR).parent / "web" / "copydesk" / "fixtures" / "hash-parity.json"

    def test_fixture_is_present(self):
        # Not skipped when missing. A parity test that quietly opts out is worth
        # less than no parity test, because it reads as green.
        self.assertTrue(
            self.fixture_path().exists(),
            f"The shared hash fixture is missing: {self.fixture_path()}",
        )

    def test_every_case_still_describes_this_module(self):
        payload = json.loads(self.fixture_path().read_text(encoding="ascii"))
        cases = payload["cases"]
        self.assertGreaterEqual(len(cases), 20, "the fixture should not shrink")

        for case in cases:
            with self.subTest(case=case["id"]):
                self.assertEqual(normalize_for_hash(case["input"]), case["normalized"], case["why"])
                self.assertEqual(source_hash(case["input"]), case["sha256"], case["why"])

    def test_the_fixture_carries_the_cases_a_naive_mirror_gets_wrong(self):
        # U+FEFF is not whitespace to Python and U+0085 is; JavaScript's `trim()`
        # takes the opposite view of both. These two cases are the only thing
        # standing between the mirror and a plausible-looking wrong answer, so
        # losing them from the fixture has to be a deliberate act.
        ids = {case["id"] for case in json.loads(self.fixture_path().read_text(encoding="ascii"))["cases"]}
        self.assertIn("bom", ids)
        self.assertIn("nel", ids)


class SanitizerTests(TestCase):
    """§7's contenteditable trap: the browser injects markup the editor never typed."""

    def test_inline_vocabulary_survives(self):
        self.assertEqual(
            sanitize_html("<em>Wyrosła</em> <strong>różdżka</strong>"),
            "<em>Wyrosła</em> <strong>różdżka</strong>",
        )

    def test_styled_span_is_flattened_to_its_text(self):
        self.assertEqual(
            sanitize_html('<span style="color:red">Wyrosła</span>'), "Wyrosła"
        )

    def test_contenteditable_divs_become_line_breaks_not_fused_words(self):
        self.assertEqual(sanitize_html("<div>pierwszy</div><div>drugi</div>"), "pierwszy\ndrugi")

    def test_attributes_are_dropped_except_href(self):
        self.assertEqual(
            sanitize_html('<a href="/koncerty" class="x" target="_blank">Koncerty</a>'),
            '<a href="/koncerty">Koncerty</a>',
        )

    def test_javascript_href_is_removed_leaving_the_words(self):
        self.assertEqual(
            sanitize_html('<a href="javascript:alert(1)">Koncerty</a>'), "<a>Koncerty</a>"
        )

    def test_unbalanced_markup_is_closed(self):
        # A browser hands over `<em>foo` as readily as `<em>foo</em>`; leaking the
        # open tag would bleed emphasis into the next segment on the page.
        self.assertEqual(sanitize_html("<em>foo"), "<em>foo</em>")

    def test_script_content_does_not_survive_as_markup(self):
        self.assertEqual(
            sanitize_html("<script>alert(1)</script>"), "alert(1)"
        )

    def test_angle_brackets_in_prose_are_escaped(self):
        self.assertEqual(sanitize_html("a < b"), "a &lt; b")

    def test_text_segments_have_no_html_path_at_all(self):
        self.assertEqual(sanitize_text("<em>Wyrosła</em> różdżka"), "Wyrosła różdżka")

    def test_text_segment_keeps_the_words_of_a_formatted_paste(self):
        # Removal, not rejection: a 400 would lose the words without telling the
        # editor which invisible span was at fault.
        self.assertEqual(
            sanitize_text('<div><span style="x">Bazylika</span> NSPJ</div>'),
            "Bazylika NSPJ",
        )


class StalenessTests(TestCase):
    """§2 made mechanical. A translation whose Polish moved looks fine on screen."""

    def setUp(self):
        self.editor = make_user("florent@example.com", editor=True)
        self.polish = make_segment("concert.wcielenie.essence", SiteLocale.POLISH, "Stara treść")

    def test_translation_written_against_current_polish_is_fresh(self):
        english = make_segment(
            "concert.wcielenie.essence", SiteLocale.ENGLISH, "Old text",
            source_hash=source_hash("Stara treść"),
        )
        segments = CopyDeskService.segments_for_scope(
            scope=english.scope, user=self.editor, locales=[SiteLocale.ENGLISH],
        )
        self.assertFalse(segments[0].is_stale)
        self.assertTrue(segments[0].source_known)

    def test_translation_goes_stale_when_the_published_polish_moves(self):
        make_segment(
            "concert.wcielenie.essence", SiteLocale.ENGLISH, "Old text",
            source_hash=source_hash("Stara treść"),
        )
        self.polish.value = "Nowa treść"
        self.polish.save(update_fields=["value", "updated_at"])

        segments = CopyDeskService.segments_for_scope(
            scope=self.polish.scope, user=self.editor, locales=[SiteLocale.ENGLISH],
        )
        self.assertTrue(segments[0].is_stale)

    def test_a_merely_PROPOSED_polish_edit_already_invalidates_its_translations(self):
        # The window this closes: waiting for the commit would leave a stale
        # translation reading as fresh for as long as review takes.
        make_segment(
            "concert.wcielenie.essence", SiteLocale.ENGLISH, "Old text",
            source_hash=source_hash("Stara treść"),
        )
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.polish.id, value="Nowa treść"),
            author=self.editor,
        )
        segments = CopyDeskService.segments_for_scope(
            scope=self.polish.scope, user=self.editor, locales=[SiteLocale.ENGLISH],
        )
        self.assertTrue(segments[0].is_stale)

    def test_polish_is_never_stale(self):
        segments = CopyDeskService.segments_for_scope(
            scope=self.polish.scope, user=self.editor, locales=[SiteLocale.POLISH],
        )
        self.assertFalse(segments[0].is_stale)
        self.assertTrue(segments[0].source_known)

    def test_unknown_provenance_is_reported_as_unknown_not_as_fresh(self):
        make_segment("concert.wcielenie.essence", SiteLocale.FRENCH, "Ancien texte")
        segments = CopyDeskService.segments_for_scope(
            scope=self.polish.scope, user=self.editor, locales=[SiteLocale.FRENCH],
        )
        self.assertFalse(segments[0].is_stale)
        self.assertFalse(segments[0].source_known)

    def test_a_proposal_carries_the_polish_it_was_written_against(self):
        english = make_segment("concert.wcielenie.essence", SiteLocale.ENGLISH, "")
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=english.id, value="New text"),
            author=self.editor,
        )
        self.polish.value = "Nowa treść"
        self.polish.save(update_fields=["value", "updated_at"])

        segments = CopyDeskService.segments_for_scope(
            scope=english.scope, user=self.editor, locales=[SiteLocale.ENGLISH],
        )
        self.assertTrue(segments[0].proposals[0].is_stale)


class ProposalLifecycleTests(TestCase):
    def setUp(self):
        self.editor = make_user("florent@example.com", editor=True)
        self.other = make_user("ania@example.com", editor=True)
        self.reviewer = make_user("dev@example.com", staff=True)
        self.segment = make_segment("page.kontakt.hero.lede", SiteLocale.POLISH, "Zapraszamy")

    def test_a_second_save_revises_in_place_rather_than_stacking(self):
        # The desk's editor autosaves; a row per keystroke would bury the reviewer.
        for value in ("Pierwsza", "Druga", "Trzecia"):
            CopyDeskService.save_proposal(
                dto=ProposalWriteDTO(segment_id=self.segment.id, value=value),
                author=self.editor,
            )
        proposals = CopyProposal.objects.filter(segment=self.segment, author=self.editor)
        self.assertEqual(proposals.count(), 1)
        self.assertEqual(proposals.get().value, "Trzecia")

    def test_two_editors_may_hold_competing_proposals_on_one_segment(self):
        # Deliberate: the reviewer sees both and chooses, rather than one
        # person's words silently replacing another's.
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Florent"),
            author=self.editor,
        )
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Ania"),
            author=self.other,
        )
        self.assertEqual(CopyProposal.objects.filter(segment=self.segment).count(), 2)

    def test_revising_a_value_makes_it_news_again(self):
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Pierwsza"),
            author=self.editor,
        )
        CopyProposal.objects.filter(id=proposal.id).update(notified_at=timezone.now())

        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Druga"),
            author=self.editor,
        )
        proposal.refresh_from_db()
        self.assertIsNone(proposal.notified_at)

    def test_an_unchanged_resave_does_not_re_announce(self):
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Pierwsza"),
            author=self.editor,
        )
        stamped = timezone.now()
        CopyProposal.objects.filter(id=proposal.id).update(notified_at=stamped)

        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Pierwsza", comment="ok"),
            author=self.editor,
        )
        proposal.refresh_from_db()
        self.assertIsNotNone(proposal.notified_at)

    def test_the_written_value_is_the_sanitized_one(self):
        html_segment = make_segment(
            "page.kontakt.hero.body", SiteLocale.POLISH, "", kind=SegmentKind.HTML,
        )
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(
                segment_id=html_segment.id,
                value='<div><span style="color:red">Zapraszamy</span></div>',
            ),
            author=self.editor,
        )
        self.assertEqual(proposal.value, "Zapraszamy")

    def test_accepting_leaves_the_repository_untouched_until_apply(self):
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Nowe"),
            author=self.editor,
        )
        CopyDeskService.review_proposal(
            proposal_id=proposal.id,
            dto=ProposalReviewDTO(status=ProposalStatus.ACCEPTED),
            reviewer=self.reviewer,
        )
        self.segment.refresh_from_db()
        proposal.refresh_from_db()
        self.assertEqual(self.segment.value, "Zapraszamy")
        self.assertIsNone(proposal.applied_at)

    def test_a_settled_proposal_cannot_be_reviewed_twice(self):
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Nowe"),
            author=self.editor,
        )
        CopyDeskService.review_proposal(
            proposal_id=proposal.id,
            dto=ProposalReviewDTO(status=ProposalStatus.ACCEPTED),
            reviewer=self.reviewer,
        )
        with self.assertRaises(ProposalClosedError):
            CopyDeskService.review_proposal(
                proposal_id=proposal.id,
                dto=ProposalReviewDTO(status=ProposalStatus.REJECTED),
                reviewer=self.reviewer,
            )

    def test_a_settled_segment_accepts_a_fresh_proposal(self):
        # The terminal row is history, so the next edit must not be blocked by it.
        first = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Nowe"),
            author=self.editor,
        )
        CopyDeskService.review_proposal(
            proposal_id=first.id,
            dto=ProposalReviewDTO(status=ProposalStatus.ACCEPTED),
            reviewer=self.reviewer,
        )
        second = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Jeszcze nowsze"),
            author=self.editor,
        )
        self.assertNotEqual(first.id, second.id)
        self.assertEqual(CopyProposal.objects.filter(segment=self.segment).count(), 2)

    def test_a_reviewer_edit_is_recorded_on_the_row_that_gets_committed(self):
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Nowe"),
            author=self.editor,
        )
        CopyDeskService.review_proposal(
            proposal_id=proposal.id,
            dto=ProposalReviewDTO(status=ProposalStatus.ACCEPTED, value="Nowe i poprawione"),
            reviewer=self.reviewer,
        )
        proposal.refresh_from_db()
        self.assertEqual(proposal.value, "Nowe i poprawione")
        self.assertEqual(proposal.reviewed_by, self.reviewer)


def upsert_row(key: str, value: str = "Treść", locale: str = SiteLocale.POLISH) -> SegmentUpsertDTO:
    return SegmentUpsertDTO(
        key=key,
        locale=locale,
        value=value,
        scope_label="Kontemplacja Wcielenia",
        label="Esencja",
    )


class MirrorTests(TestCase):
    """`CopySegment` is git's projection; the extractor must be able to re-run."""

    def test_reconciliation_is_idempotent_and_preserves_first_seen(self):
        row = SegmentUpsertDTO(
            key="concert.wcielenie.essence",
            locale=SiteLocale.POLISH,
            value="Treść",
            scope_label="Kontemplacja Wcielenia",
            label="Esencja",
        )
        first = CopyDeskService.upsert_segments([row])
        created_at = CopySegment.objects.get().created_at
        second = CopyDeskService.upsert_segments([row])

        self.assertEqual(first.created, 1)
        self.assertEqual(second.created, 0)
        self.assertEqual(second.retired, 0)
        # If a re-run recreated rows, every segment would read as new on every
        # extraction and the "new since your last visit" state would be noise.
        self.assertEqual(CopySegment.objects.get().created_at, created_at)

    def test_scope_is_always_derived_from_the_key(self):
        CopyDeskService.upsert_segments([
            SegmentUpsertDTO(
                key="concert.wcielenie.program.3.note",
                locale=SiteLocale.POLISH,
                value="Nota",
            ),
        ])
        self.assertEqual(CopySegment.objects.get().scope, "concert.wcielenie")


class RetirementTests(TestCase):
    """A key the extractor stopped emitting has left the site — but only the
    pages the payload actually described can say anything about that."""

    def setUp(self):
        CopyDeskService.upsert_segments([
            upsert_row("concert.wcielenie.essence"),
            upsert_row("concert.wcielenie.about"),
            upsert_row("concert.pasja.essence"),
            upsert_row("concert.pasja.about"),
        ])

    def test_prune_is_narrowed_to_the_scopes_the_payload_carried(self):
        # A run over one concert must not retire the other five. Without the
        # narrowing, extracting a single page empties the whole desk.
        result = CopyDeskService.upsert_segments([upsert_row("concert.wcielenie.essence")])

        self.assertEqual(result.retired_keys, ("concert.wcielenie.about",))
        self.assertEqual(result.scopes, ("concert.wcielenie",))
        self.assertEqual(
            set(CopySegment.objects.values_list("key", flat=True)),
            {"concert.wcielenie.essence", "concert.pasja.essence", "concert.pasja.about"},
        )

    def test_a_retired_row_is_a_tombstone_not_an_erasure(self):
        CopyDeskService.upsert_segments([upsert_row("concert.wcielenie.essence")])
        retired = CopySegment.all_objects.get(key="concert.wcielenie.about")
        self.assertTrue(retired.is_deleted)

    def test_a_returning_key_is_a_new_row_not_a_revival(self):
        # Positional keys (§6d): `program.3.note` coming back is not evidence
        # that it is the same note, so its history stays with the tombstone
        # instead of being handed to whatever now sits at position 3.
        CopyDeskService.upsert_segments([upsert_row("concert.wcielenie.essence")])
        result = CopyDeskService.upsert_segments([
            upsert_row("concert.wcielenie.essence"),
            upsert_row("concert.wcielenie.about"),
        ])
        self.assertEqual(result.created, 1)
        self.assertEqual(CopySegment.all_objects.filter(key="concert.wcielenie.about").count(), 2)

    def test_prune_can_be_switched_off_for_a_deliberately_partial_payload(self):
        result = CopyDeskService.upsert_segments(
            [upsert_row("concert.wcielenie.essence")], prune=False,
        )
        self.assertEqual(result.retired, 0)
        self.assertEqual(CopySegment.objects.count(), 4)

    def test_the_run_reports_the_open_proposals_it_stranded(self):
        editor = make_user("florent@example.com", editor=True)
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(
                segment_id=CopySegment.objects.get(key="concert.wcielenie.about").id,
                value="Nowe",
            ),
            author=editor,
        )
        result = CopyDeskService.upsert_segments([upsert_row("concert.wcielenie.essence")])
        self.assertEqual(result.orphaned_proposals, 1)

    def test_retiring_many_keys_at_once_says_so_instead_of_pruning_quietly(self):
        # The signature of a shifted list: one entry inserted into a positionally
        # keyed list re-keys every entry below it, and the extractor then emits
        # none of the old keys. Reported, not refused — the extractor is the
        # authority on what the site holds, and the prune is a soft delete.
        CopyDeskService.upsert_segments([
            upsert_row(f"concert.wcielenie.program.{index}.note") for index in range(8)
        ], prune=False)

        with self.assertLogs("copydesk.services", level="WARNING") as captured:
            result = CopyDeskService.upsert_segments([upsert_row("concert.wcielenie.essence")])

        self.assertTrue(result.bulk_retirement)
        self.assertEqual(len(result.retired_keys), 9)
        self.assertIn("shifted", captured.output[0])
        self.assertIn("concert.wcielenie.program.0.note", captured.output[0])

    def test_an_ordinary_deletion_is_not_dressed_up_as_an_alarm(self):
        result = CopyDeskService.upsert_segments([upsert_row("concert.wcielenie.essence")])
        self.assertEqual(result.retired, 1)
        self.assertFalse(result.bulk_retirement)


class ApplyStampTests(TestCase):
    """§6c's second defect: nothing ever wrote `CopySegment.source_hash`, so the
    stale state — the entire reason the hash exists — never fired once."""

    def setUp(self):
        self.editor = make_user("florent@example.com", editor=True)
        self.reviewer = make_user("dev@example.com", staff=True)
        self.polish = make_segment("concert.wcielenie.essence", SiteLocale.POLISH, "Stara treść")
        self.english = make_segment("concert.wcielenie.essence", SiteLocale.ENGLISH, "")

    def _accept(self, segment, value):
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=segment.id, value=value), author=self.editor,
        )
        return CopyDeskService.review_proposal(
            proposal_id=proposal.id,
            dto=ProposalReviewDTO(status=ProposalStatus.ACCEPTED),
            reviewer=self.reviewer,
        )

    def _english_row(self):
        return CopyDeskService.segments_for_scope(
            scope="concert.wcielenie", user=self.editor, locales=[SiteLocale.ENGLISH],
        )[0]

    def test_apply_stamps_the_segment_with_the_polish_the_translation_renders(self):
        self.assertFalse(self._english_row().source_known)

        proposal = self._accept(self.english, "Old text")
        CopyDeskService.mark_applied(proposal_ids=[proposal.id], reviewer=self.reviewer)

        self.english.refresh_from_db()
        self.assertEqual(self.english.source_hash, source_hash("Stara treść"))
        row = self._english_row()
        self.assertTrue(row.source_known)
        self.assertFalse(row.is_stale)

    def test_the_stale_state_fires_once_the_provenance_exists(self):
        proposal = self._accept(self.english, "Old text")
        CopyDeskService.mark_applied(proposal_ids=[proposal.id], reviewer=self.reviewer)

        self.polish.value = "Nowa treść"
        self.polish.save(update_fields=["value", "updated_at"])

        self.assertTrue(self._english_row().is_stale)

    def test_a_polish_edit_applied_with_its_translation_leaves_the_translation_fresh(self):
        # The two halves of one patch. The translation was written against the
        # Polish as it MEANS (the accepted proposal), so the mirror's Polish has
        # to move in the same call — otherwise a translation that is correct by
        # construction reads as stale until the next extraction.
        polish_proposal = self._accept(self.polish, "Nowa treść")
        english_proposal = self._accept(self.english, "New text")
        CopyDeskService.mark_applied(
            proposal_ids=[polish_proposal.id, english_proposal.id], reviewer=self.reviewer,
        )

        self.polish.refresh_from_db()
        self.assertEqual(self.polish.value, "Nowa treść")
        row = self._english_row()
        self.assertEqual(row.value, "New text")
        self.assertTrue(row.source_known)
        self.assertFalse(row.is_stale)

    def test_the_next_extractor_run_does_not_erase_the_provenance(self):
        # `upsert_segments` must keep `source_hash` out of its `defaults`. If it
        # ever writes that column, the stamp survives exactly until the next
        # `copy:sync` and the desk is back where the defect found it.
        proposal = self._accept(self.english, "Old text")
        CopyDeskService.mark_applied(proposal_ids=[proposal.id], reviewer=self.reviewer)

        CopyDeskService.upsert_segments([
            upsert_row("concert.wcielenie.essence", "Stara treść"),
            upsert_row("concert.wcielenie.essence", "Old text", locale=SiteLocale.ENGLISH),
        ])

        self.english.refresh_from_db()
        self.assertEqual(self.english.source_hash, source_hash("Stara treść"))

    def test_a_polish_row_is_given_no_provenance(self):
        # A source renders nothing, so it goes stale against nothing.
        proposal = self._accept(self.polish, "Nowa treść")
        CopyDeskService.mark_applied(proposal_ids=[proposal.id], reviewer=self.reviewer)

        self.polish.refresh_from_db()
        self.assertEqual(self.polish.source_hash, "")

    def test_applying_twice_is_a_skip_not_an_error(self):
        # A script that wrote the files and lost the response has to be able to
        # say so again.
        proposal = self._accept(self.english, "Old text")
        first = CopyDeskService.mark_applied(proposal_ids=[proposal.id], reviewer=self.reviewer)
        stamped = CopyProposal.objects.get(id=proposal.id).applied_at

        second = CopyDeskService.mark_applied(proposal_ids=[proposal.id], reviewer=self.reviewer)

        self.assertEqual(first.applied, 1)
        self.assertEqual(second.applied, 0)
        self.assertEqual(second.skipped[0].reason, "already_applied")
        self.assertEqual(CopyProposal.objects.get(id=proposal.id).applied_at, stamped)

    def test_a_proposal_rejected_mid_flight_is_reported_rather_than_stamped(self):
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.english.id, value="Old text"),
            author=self.editor,
        )
        CopyDeskService.review_proposal(
            proposal_id=proposal.id,
            dto=ProposalReviewDTO(status=ProposalStatus.REJECTED),
            reviewer=self.reviewer,
        )
        result = CopyDeskService.mark_applied(
            proposal_ids=[proposal.id], reviewer=self.reviewer,
        )
        self.english.refresh_from_db()
        self.assertEqual(result.applied, 0)
        self.assertEqual(result.skipped[0].reason, "not_accepted")
        self.assertEqual(self.english.source_hash, "")

    def test_an_unknown_id_stamps_nothing_at_all(self):
        proposal = self._accept(self.english, "Old text")
        with self.assertRaises(UnknownProposalsError):
            CopyDeskService.mark_applied(
                proposal_ids=[proposal.id, uuid4()], reviewer=self.reviewer,
            )
        self.assertIsNone(CopyProposal.objects.get(id=proposal.id).applied_at)


class NewSinceLastVisitTests(TestCase):
    def setUp(self):
        self.editor = make_user("florent@example.com", editor=True)

    def test_everything_is_new_until_the_first_visit_is_stamped(self):
        make_segment("page.kontakt.hero.lede", SiteLocale.POLISH, "Zapraszamy")
        segments = CopyDeskService.segments_for_scope(
            scope="page.kontakt", user=self.editor,
        )
        # No visit recorded yet: nothing is claimed as new, because there is no
        # "last time" to measure against and a first sitting is not a diff.
        self.assertFalse(segments[0].is_new)

    def test_a_segment_added_after_the_visit_reads_as_new(self):
        make_segment("page.kontakt.hero.lede", SiteLocale.POLISH, "Zapraszamy")
        CopyDeskService.mark_seen(user=self.editor)
        self.editor.profile.refresh_from_db()

        later = make_segment("page.kontakt.hero.body", SiteLocale.POLISH, "Nowa sekcja")
        CopySegment.objects.filter(id=later.id).update(
            created_at=timezone.now() + timedelta(seconds=5)
        )

        segments = {
            segment.key: segment
            for segment in CopyDeskService.segments_for_scope(
                scope="page.kontakt", user=self.editor,
            )
        }
        self.assertFalse(segments["page.kontakt.hero.lede"].is_new)
        self.assertTrue(segments["page.kontakt.hero.body"].is_new)


class ContentsListTests(TestCase):
    def test_counts_answer_what_have_i_already_done(self):
        editor = make_user("florent@example.com", editor=True)
        reviewer = make_user("dev@example.com", staff=True)
        polish = make_segment("concert.wcielenie.essence", SiteLocale.POLISH, "Treść")
        make_segment(
            "concert.wcielenie.essence", SiteLocale.ENGLISH, "Text",
            source_hash=source_hash("Coś zupełnie innego"),
        )
        make_segment("concert.wcielenie.about", SiteLocale.POLISH, "O koncercie", order=1)

        touched = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=polish.id, value="Nowa treść"),
            author=editor,
        )
        CopyDeskService.review_proposal(
            proposal_id=touched.id,
            dto=ProposalReviewDTO(status=ProposalStatus.ACCEPTED),
            reviewer=reviewer,
        )

        summary = CopyDeskService.scope_summaries(user=editor)[0]
        self.assertEqual(summary.scope, "concert.wcielenie")
        self.assertEqual(summary.label, "Kontemplacja Wcielenia")
        self.assertEqual(summary.segments, 3)
        self.assertEqual(summary.accepted, 1)
        self.assertEqual(summary.stale, 1)


class ReviewQueueTests(TestCase):
    """The reviewer's read: what is waiting anywhere, and what has been decided
    and not yet written."""

    def setUp(self):
        self.florent = make_user("florent@example.com", editor=True)
        self.ania = make_user("ania@example.com", editor=True)
        self.reviewer = make_user("dev@example.com", staff=True)
        self.polish = make_segment("concert.wcielenie.essence", SiteLocale.POLISH, "Treść")
        self.english = make_segment(
            "concert.wcielenie.essence", SiteLocale.ENGLISH, "Text", order=1,
        )
        self.untouched = make_segment(
            "concert.wcielenie.about", SiteLocale.POLISH, "O koncercie", order=2,
        )

    def test_only_segments_somebody_is_waiting_on_are_in_the_queue(self):
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.polish.id, value="Nowa treść"),
            author=self.florent,
        )
        settled = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.english.id, value="New text"),
            author=self.florent,
        )
        CopyDeskService.review_proposal(
            proposal_id=settled.id,
            dto=ProposalReviewDTO(status=ProposalStatus.REJECTED),
            reviewer=self.reviewer,
        )

        queue = CopyDeskService.review_queue(user=self.reviewer)
        self.assertEqual([entry.id for entry in queue], [self.polish.id])

    def test_two_editors_on_one_field_arrive_as_one_entry_carrying_both(self):
        """§6b keeps competing proposals on purpose; the queue is where they are
        read side by side, so BOTH values have to travel."""
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.polish.id, value="Wersja Florenta"),
            author=self.florent,
        )
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.polish.id, value="Wersja Ani"),
            author=self.ania,
        )

        queue = CopyDeskService.review_queue(user=self.reviewer)
        self.assertEqual(len(queue), 1)
        self.assertEqual(
            {proposal.value for proposal in queue[0].proposals},
            {"Wersja Florenta", "Wersja Ani"},
        )
        # The value the site is serving is what each of them is measured against.
        self.assertEqual(queue[0].value, "Treść")

    def test_a_note_without_a_rewrite_reaches_the_queue(self):
        """A comment on an unchanged value is a real proposal (§6h), and the
        queue is where it is told apart from a rewrite — by the value, which is
        the one the repository already holds."""
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(
                segment_id=self.polish.id, value="Treść", comment="To zdanie mi zgrzyta.",
            ),
            author=self.florent,
        )

        queue = CopyDeskService.review_queue(user=self.reviewer)
        self.assertEqual(queue[0].proposals[0].value, queue[0].value)
        self.assertEqual(queue[0].proposals[0].comment, "To zdanie mi zgrzyta.")

    def test_the_patch_counts_fields_rather_than_decisions(self):
        """Two accepted proposals competing for one field collapse to one write,
        so the band promises one changed line and not two."""
        for author, value in ((self.florent, "Pierwsza"), (self.ania, "Druga")):
            proposal = CopyDeskService.save_proposal(
                dto=ProposalWriteDTO(segment_id=self.polish.id, value=value),
                author=author,
            )
            CopyDeskService.review_proposal(
                proposal_id=proposal.id,
                dto=ProposalReviewDTO(status=ProposalStatus.ACCEPTED),
                reviewer=self.reviewer,
            )

        summary = CopyDeskService.patch_summary()
        self.assertEqual(summary.rows, 1)
        self.assertEqual(len(summary.scopes), 1)
        self.assertEqual(summary.scopes[0].label, "Kontemplacja Wcielenia")
        self.assertIsNotNone(summary.since)

    def test_an_applied_decision_leaves_the_patch(self):
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.polish.id, value="Nowa treść"),
            author=self.florent,
        )
        CopyDeskService.review_proposal(
            proposal_id=proposal.id,
            dto=ProposalReviewDTO(status=ProposalStatus.ACCEPTED),
            reviewer=self.reviewer,
        )
        self.assertEqual(CopyDeskService.patch_summary().rows, 1)

        CopyDeskService.mark_applied(proposal_ids=[proposal.id], reviewer=self.reviewer)
        self.assertEqual(CopyDeskService.patch_summary().rows, 0)

    def test_the_queue_is_reviewer_only(self):
        api = APIClient()
        api.force_authenticate(user=self.florent)
        self.assertEqual(api.get(reverse("copydesk-queue")).status_code, 403)

        api.force_authenticate(user=self.reviewer)
        response = api.get(reverse("copydesk-queue"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["segments"], [])
        self.assertEqual(response.data["patch"]["rows"], 0)


class PermissionTests(TestCase):
    def test_the_capability_is_independent_of_role(self):
        editor = make_user("florent@example.com", editor=True)
        singer = make_user("singer@example.com")
        self.assertTrue(user_can_edit_site_copy(editor))
        self.assertFalse(user_can_edit_site_copy(singer))
        # Editing is not reviewing: accepting ends in a commit.
        self.assertFalse(user_is_copy_reviewer(editor))

    def test_staff_edits_and_reviews(self):
        developer = make_user("dev@example.com", staff=True)
        self.assertTrue(user_can_edit_site_copy(developer))
        self.assertTrue(user_is_copy_reviewer(developer))

    def test_anonymous_is_refused_both(self):
        self.assertFalse(user_can_edit_site_copy(None))
        self.assertFalse(user_is_copy_reviewer(None))


class ApiTests(TestCase):
    def setUp(self):
        self.editor = make_user("florent@example.com", editor=True)
        self.singer = make_user("singer@example.com")
        self.reviewer = make_user("dev@example.com", staff=True)
        self.segment = make_segment("page.kontakt.hero.lede", SiteLocale.POLISH, "Zapraszamy")
        self.api = APIClient()

    def test_a_singer_cannot_reach_the_desk(self):
        self.api.force_authenticate(user=self.singer)
        response = self.api.get(reverse("copydesk-contents"))
        self.assertEqual(response.status_code, 403)

    def test_an_editor_reads_a_page_in_reading_order(self):
        make_segment("page.kontakt.hero.body", SiteLocale.POLISH, "Druga", order=1)
        self.api.force_authenticate(user=self.editor)
        response = self.api.get(
            reverse("copydesk-segments"), {"scope": "page.kontakt"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [s["key"] for s in response.data["segments"]],
            ["page.kontakt.hero.lede", "page.kontakt.hero.body"],
        )

    def test_an_editor_cannot_accept_their_own_proposal(self):
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Nowe"),
            author=self.editor,
        )
        self.api.force_authenticate(user=self.editor)
        response = self.api.post(
            reverse("copydesk-proposal-review", args=[proposal.id]),
            {"status": ProposalStatus.ACCEPTED},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_an_editor_cannot_name_the_outcome_they_would_like(self):
        self.api.force_authenticate(user=self.editor)
        response = self.api.post(
            reverse("copydesk-proposals"),
            {
                "segment_id": str(self.segment.id),
                "value": "Nowe",
                "status": ProposalStatus.ACCEPTED,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_the_patch_endpoint_lists_accepted_and_unapplied_work(self):
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Nowe"),
            author=self.editor,
        )
        CopyDeskService.review_proposal(
            proposal_id=proposal.id,
            dto=ProposalReviewDTO(status=ProposalStatus.ACCEPTED),
            reviewer=self.reviewer,
        )
        self.api.force_authenticate(user=self.reviewer)
        response = self.api.get(reverse("copydesk-patch"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["proposals"],
            [{
                "id": str(proposal.id),
                "key": "page.kontakt.hero.lede",
                "locale": SiteLocale.POLISH,
                "kind": SegmentKind.TEXT,
                "value": "Nowe",
                # The pre-image: what the apply script must find in the file before
                # it is allowed to write over it.
                "base_value": self.segment.value,
                "source_hash": "",
            }],
        )

    def test_the_ingest_door_is_closed_to_an_editor(self):
        # The rule the desk's API never writes the mirror holds for the routes an
        # EDITOR can reach; this one is staff, with a payload derived from git.
        self.api.force_authenticate(user=self.editor)
        response = self.api.post(
            reverse("copydesk-ingest"),
            {"segments": [{"key": "page.kontakt.hero.lede", "locale": "pl", "value": "x"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_the_ingest_reconciles_and_reports_what_it_withdrew(self):
        make_segment("page.kontakt.hero.body", SiteLocale.POLISH, "Druga", order=1)
        self.api.force_authenticate(user=self.reviewer)
        response = self.api.post(
            reverse("copydesk-ingest"),
            {
                "revision": "cc5a5f0",
                "segments": [{
                    "key": "page.kontakt.hero.lede",
                    "locale": "pl",
                    "value": "Zapraszamy serdecznie",
                    "label": "Lede",
                }],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated"], 1)
        self.assertEqual(response.data["retired_keys"], ["page.kontakt.hero.body"])
        self.segment.refresh_from_db()
        self.assertEqual(self.segment.value, "Zapraszamy serdecznie")

    def test_a_row_with_a_field_the_mirror_cannot_hold_is_named_by_position(self):
        # `extra="forbid"`: a misspelled field name has to be a 400 that says
        # which row, not a column quietly dropped on the way in.
        self.api.force_authenticate(user=self.reviewer)
        response = self.api.post(
            reverse("copydesk-ingest"),
            {"segments": [
                {"key": "page.kontakt.hero.lede", "locale": "pl", "value": "x"},
                {"key": "page.kontakt.hero.body", "locale": "pl", "paths": ["hero", "body"]},
            ]},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Row 1", response.data["detail"])

    def test_only_a_reviewer_may_stamp_an_applied_patch(self):
        self.api.force_authenticate(user=self.editor)
        response = self.api.post(
            reverse("copydesk-applied"), {"proposal_ids": [str(uuid4())]}, format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_an_applied_proposal_leaves_the_patch(self):
        proposal = CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Nowe"),
            author=self.editor,
        )
        CopyDeskService.review_proposal(
            proposal_id=proposal.id,
            dto=ProposalReviewDTO(status=ProposalStatus.ACCEPTED),
            reviewer=self.reviewer,
        )
        self.api.force_authenticate(user=self.reviewer)
        applied = self.api.post(
            reverse("copydesk-applied"), {"proposal_ids": [str(proposal.id)]}, format="json",
        )
        self.assertEqual(applied.status_code, 200)
        self.assertEqual(applied.data["applied"], 1)

        patch_response = self.api.get(reverse("copydesk-patch"))
        self.assertEqual(patch_response.data["proposals"], [])

    def test_an_unknown_proposal_id_is_a_400_that_names_it(self):
        stray = uuid4()
        self.api.force_authenticate(user=self.reviewer)
        response = self.api.post(
            reverse("copydesk-applied"), {"proposal_ids": [str(stray)]}, format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["unknown"], [str(stray)])

    def test_mark_seen_stamps_the_visit(self):
        self.api.force_authenticate(user=self.editor)
        response = self.api.post(reverse("copydesk-mark-seen"))
        self.assertEqual(response.status_code, 200)
        self.editor.profile.refresh_from_db()
        self.assertIsNotNone(self.editor.profile.copy_desk_seen_at)


class DigestTests(TestCase):
    """One message per editor per sitting, and the sitting ends at a pause."""

    def setUp(self):
        self.editor = make_user("florent@example.com", editor=True)
        self.reviewer = make_user("dev@example.com", staff=True)
        self.polish = make_segment("concert.wcielenie.essence", SiteLocale.POLISH, "Treść")
        self.about = make_segment(
            "concert.wcielenie.about", SiteLocale.POLISH, "O koncercie", order=1,
        )

    def _propose(self, segment, value="Nowa treść"):
        return CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=segment.id, value=value), author=self.editor,
        )

    def _age_everything(self):
        CopyProposal.objects.all().update(
            updated_at=timezone.now() - QUIET_PERIOD - timedelta(minutes=1)
        )

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_an_editor_still_working_is_not_reported(self, delay):
        self._propose(self.polish)
        self.assertEqual(dispatch_copy_proposal_digests(), {"digests": 0})
        delay.assert_not_called()

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_a_finished_sitting_produces_exactly_one_message(self, delay):
        self._propose(self.polish)
        self._propose(self.about, "Nowe o koncercie")
        self._age_everything()

        self.assertEqual(dispatch_copy_proposal_digests(), {"digests": 1})
        self.assertEqual(delay.call_count, 1)
        metadata = delay.call_args.kwargs["metadata"]
        self.assertEqual(metadata["proposal_count"], 2)
        self.assertEqual(metadata["scopes"][0]["label"], "Kontemplacja Wcielenia")
        self.assertEqual(delay.call_args.kwargs["recipient_ids"], [str(self.reviewer.id)])

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_a_reported_sitting_is_never_reported_twice(self, delay):
        self._propose(self.polish)
        self._age_everything()
        dispatch_copy_proposal_digests()
        delay.reset_mock()

        self.assertEqual(dispatch_copy_proposal_digests(), {"digests": 0})
        delay.assert_not_called()

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_one_editor_still_typing_does_not_hold_up_another(self, delay):
        other = make_user("ania@example.com", editor=True)
        self._propose(self.polish)
        self._age_everything()
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.about.id, value="Ania pisze"),
            author=other,
        )

        self.assertEqual(dispatch_copy_proposal_digests(), {"digests": 1})
        self.assertEqual(
            delay.call_args.kwargs["metadata"]["author_id"], self.editor.id
        )

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_one_still_open_proposal_holds_back_the_whole_sitting(self, delay):
        # The Max is over all of an author's unannounced work, so an editor mid
        # sentence never has the older half of their sitting reported out from
        # under them.
        self._propose(self.polish)
        self._age_everything()
        self._propose(self.about, "Wciąż piszę")

        self.assertEqual(dispatch_copy_proposal_digests(), {"digests": 0})
        delay.assert_not_called()

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_drafts_are_not_announced(self, delay):
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(
                segment_id=self.polish.id, value="Szkic", status=ProposalStatus.DRAFT,
            ),
            author=self.editor,
        )
        self._age_everything()
        self.assertEqual(dispatch_copy_proposal_digests(), {"digests": 0})
        delay.assert_not_called()

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_an_editor_who_also_reviews_is_not_told_about_themselves(self, delay):
        self.reviewer.profile.can_edit_site_copy = True
        self.reviewer.profile.save(update_fields=["can_edit_site_copy", "updated_at"])
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.polish.id, value="Sam sobie"),
            author=self.reviewer,
        )
        self._age_everything()

        self.assertEqual(dispatch_copy_proposal_digests(), {"digests": 0})
        delay.assert_not_called()
        # Still claimed, so the sweep does not re-examine them on every beat.
        self.assertIsNotNone(CopyProposal.objects.get().notified_at)


class EarlyDigestTests(TestCase):
    """"I have finished" — the same digest, asked for before the pause elapses.

    The claim it must make is that nothing DEPENDS on it: an editor who never
    finds the control is reported by the clock exactly as before, which is the
    difference between an accelerator and a submit button.
    """

    def setUp(self):
        self.api = APIClient()
        self.editor = make_user("florent@example.com", editor=True)
        self.reviewer = make_user("dev@example.com", staff=True)
        self.segment = make_segment(
            "concert.wcielenie.essence", SiteLocale.POLISH, "Treść"
        )
        self.url = reverse("copydesk-notify")

    def _propose(self, value="Nowa treść"):
        return CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value=value),
            author=self.editor,
        )

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_a_sitting_can_be_reported_before_the_pause_elapses(self, delay):
        self._propose()
        self.api.force_authenticate(user=self.editor)

        response = self.api.post(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"proposals": 1, "delivered": True})
        self.assertEqual(delay.call_args.kwargs["metadata"]["proposal_count"], 1)

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_the_clock_does_not_report_it_a_second_time(self, delay):
        self._propose()
        self.api.force_authenticate(user=self.editor)
        self.api.post(self.url)
        delay.reset_mock()

        CopyProposal.objects.all().update(
            updated_at=timezone.now() - QUIET_PERIOD - timedelta(minutes=1)
        )
        self.assertEqual(dispatch_copy_proposal_digests(), {"digests": 0})
        delay.assert_not_called()

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_pressing_it_with_nothing_new_announces_nothing(self, delay):
        self.api.force_authenticate(user=self.editor)

        response = self.api.post(self.url)

        self.assertEqual(response.data, {"proposals": 0, "delivered": False})
        delay.assert_not_called()

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_an_edit_after_the_digest_is_news_again(self, delay):
        proposal = self._propose()
        self.api.force_authenticate(user=self.editor)
        self.api.post(self.url)
        delay.reset_mock()

        self._propose("Jednak inaczej")
        proposal.refresh_from_db()
        self.assertIsNone(proposal.notified_at)

        response = self.api.post(self.url)
        self.assertEqual(response.data["proposals"], 1)
        self.assertEqual(delay.call_count, 1)

    @patch("copydesk.tasks.send_bulk_notifications_task.delay")
    def test_it_announces_only_the_caller_s_own_work(self, delay):
        other = make_user("ania@example.com", editor=True)
        CopyDeskService.save_proposal(
            dto=ProposalWriteDTO(segment_id=self.segment.id, value="Ania pisze"),
            author=other,
        )
        self._propose()
        self.api.force_authenticate(user=self.editor)

        response = self.api.post(self.url)

        self.assertEqual(response.data["proposals"], 1)
        self.assertEqual(
            delay.call_args.kwargs["metadata"]["author_id"], self.editor.id
        )
        self.assertIsNone(
            CopyProposal.objects.get(author=other).notified_at
        )

    def test_a_singer_cannot_raise_a_digest(self):
        singer = make_user("singer@example.com")
        self.api.force_authenticate(user=singer)

        self.assertEqual(self.api.post(self.url).status_code, 403)


class NotificationWiringTests(TestCase):
    """The checklist that silently degrades to generic copy when a layer is missed."""

    def test_the_type_has_a_delivery_group(self):
        assert_preference_policy_is_coherent()
        self.assertEqual(GROUP_OF_TYPE[NotificationType.SITE_COPY_PROPOSED], "site_copy")

    def test_it_reaches_an_inbox_and_is_not_folded_into_the_daily_digest(self):
        defaults = default_channel_preferences(NotificationType.SITE_COPY_PROPOSED)
        self.assertTrue(defaults["email_enabled"])
        self.assertTrue(defaults["push_enabled"])
        # It is already a digest; batching a batch would cost it up to a day.
        self.assertFalse(
            is_digestible(NotificationType.SITE_COPY_PROPOSED, NotificationLevel.INFO)
        )

    def test_the_ledger_row_is_staff_only(self):
        self.assertIn(NotificationType.SITE_COPY_PROPOSED, STAFF_ONLY_TYPES)

    def test_a_composer_is_registered_so_copy_is_not_generic(self):
        content = MessageContentBuilder.build(
            NotificationType.SITE_COPY_PROPOSED,
            NotificationLevel.INFO,
            {
                "author_name": "Florent",
                "proposal_count": 12,
                "scopes": [
                    {"scope": "concert.wcielenie", "label": "Kontemplacja Wcielenia", "count": 12},
                ],
                "locales": ["pl", "en"],
            },
            is_manager=True,
        )
        self.assertIn("Florent", content.title)
        self.assertIn("12", content.title)
        self.assertEqual(content.body, "Kontemplacja Wcielenia")
        self.assertEqual(content.url_path, "/redakcja/przeglad")
        self.assertNotEqual(content.title, "Something new for you")

    def test_the_ledger_hides_the_row_from_a_non_staff_manager(self):
        from core.constants import AppRole

        manager = make_user("manager@example.com")
        manager.profile.role = AppRole.MANAGER
        manager.profile.save(update_fields=["role", "updated_at"])

        client = APIClient()
        client.force_authenticate(user=manager)
        response = client.get(reverse("notification-preferences"))
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(
            "site_copy", [group["id"] for group in response.data["groups"]],
        )

    def test_the_ledger_shows_the_row_to_staff(self):
        client = APIClient()
        client.force_authenticate(user=make_user("dev@example.com", staff=True))
        response = client.get(reverse("notification-preferences"))
        self.assertIn("site_copy", [group["id"] for group in response.data["groups"]])
