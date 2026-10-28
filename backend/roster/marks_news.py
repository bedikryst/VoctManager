"""
@file marks_news.py
@description "Powiadom chór": which pieces of one project carry choir marks that
    said something new since the cast was last told, and the one notice that
    tells them. The choir is never told on its own: a stroke drawn mid-rehearsal
    is not news until the conductor says it is.

    "New" keys on `Annotation.content_at`, never on `updated_at`, so tidying a
    page — moving, resizing, recolouring — is not news, while a restored set is.
    Only the `shared` layer counts: it is the one written to the choir.

    A mark addressed to some voices is news to those voices only
    (`archive.annotation_voices.addresses`): a piece whose new marks are all
    for the tenors is listed to the tenors, and to whoever answers to no
    section, never to the sopranos. A singer answers to their seat and, piece
    by piece, to the line they are cast on there.

    A piece whose new marks reach nobody in the cast is left out of what the
    button offers. When that leaves nothing, the button says which voices the
    marks are for, rather than offering a press that can only be refused.
@module roster/marks_news
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from django.utils import timezone

from archive.annotation_voices import addresses, mark_letters, reader_letters_of_seats
from archive.models import SHARED_ANNOTATION_LAYER, Annotation
from core.voice_labels import canonical_section_letters
from notifications.dtos import MarkedPieceMetadata, ScoreMarksSharedMetadata
from notifications.models import NotificationLevel, NotificationType
from notifications.tasks import send_bulk_notifications_task
from roster.models import (
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    VoiceType,
    instrumental_item_exists,
)

logger = logging.getLogger(__name__)

#: The least time between two notices about one project's marks. A conductor
#: who forgot a piece waits a few minutes; a choir is not paged per stroke.
MARKS_NOTICE_COOLDOWN = timedelta(minutes=10)


@dataclass(frozen=True)
class MarkedPiece:
    """One programme piece whose choir marks are news."""

    piece_id: UUID
    title: str
    composer_name: str
    #: How many of its choir marks said something new in the window.
    count: int
    #: Instrumental in this project: a singer is not told about music they are
    #: not handed, the same rule that withholds its score.
    instrumental: bool
    #: The section letters its new marks are addressed to, '' when any of them
    #: is tutti — which makes the piece news to everyone.
    sections: str = ''

    def is_news_to(self, reader_letters: str) -> bool:
        return addresses(list(self.sections), reader_letters)


@dataclass(frozen=True)
class MarksNews:
    """What the button would send now, and to how many people."""

    #: The window opens here: the last notice, or the project's creation.
    since: datetime
    notified_at: datetime | None
    pieces: list[MarkedPiece]
    recipients: int
    #: When the cooldown ends, while it runs; None once a press is allowed.
    next_allowed_at: datetime | None
    #: The sections of the new marks nobody in the cast would hear of, '' when
    #: there are none to name (see `_Reach.unreached_sections`).
    unreached_sections: str = ''


@dataclass(frozen=True)
class MarksNoticeSent:
    notified_at: datetime
    recipients: int
    pieces: int


class MarksNoticeRefused(Exception):
    """Why a press sent nothing. `reason` is a stable code for the client."""

    NOTHING_NEW = "nothing_new"
    NOBODY = "nobody"
    #: The new marks are all for sections nobody in the cast can be told in;
    #: `sections` names them.
    UNREACHED = "unreached"
    TOO_SOON = "too_soon"

    def __init__(
        self,
        reason: str,
        next_allowed_at: datetime | None = None,
        sections: str = '',
    ) -> None:
        super().__init__(reason)
        self.reason = reason
        self.next_allowed_at = next_allowed_at
        self.sections = sections


class MarksNoticeUndelivered(Exception):
    """The notice could not be handed to the task queue. The stamp is back
    where it was, so the same marks are on offer to the next press."""


def _window_start(project: Project) -> datetime:
    """Before the first press, marks are news from the project's creation on:
    a piece back for a new season brings last season's marks, and those were
    not written for this concert."""
    return project.marks_notified_at or project.created_at


def _cooldown_end(project: Project, now: datetime) -> datetime | None:
    if project.marks_notified_at is None:
        return None
    end = project.marks_notified_at + MARKS_NOTICE_COOLDOWN
    return end if end > now else None


def marked_pieces(project: Project, *, since: datetime, until: datetime) -> list[MarkedPiece]:
    """The programme's pieces, in programme order, with choir marks whose
    `content_at` falls in (since, until]. Marks on any live edition of the
    piece count: a singer may open whichever one the library hands them."""
    items = list(
        ProgramItem.objects
        .filter(project=project)
        .select_related('piece__composer')
        .annotate(is_instrumental=instrumental_item_exists())
        .order_by('order')
    )
    if not items:
        return []
    counts: dict[Any, int] = {}
    # Per piece: the letters its voiced marks reach, or None once one tutti
    # mark makes it news to everyone.
    letters: dict[Any, set[str] | None] = {}
    rows = (
        Annotation.objects
        .filter(
            edition__piece_id__in=[item.piece_id for item in items],
            edition__is_deleted=False,
            layer_name=SHARED_ANNOTATION_LAYER,
            archived_at__isnull=True,
            content_at__gt=since,
            content_at__lte=until,
        )
        .order_by()
        .values_list('edition__piece_id', 'voices')
    )
    for piece_id, voices in rows:
        counts[piece_id] = counts.get(piece_id, 0) + 1
        reached = letters.setdefault(piece_id, set())
        if reached is None:
            continue
        mark = mark_letters(voices)
        if mark:
            reached.update(mark)
        else:
            letters[piece_id] = None
    pieces: list[MarkedPiece] = []
    seen: set[Any] = set()
    for item in items:
        if item.piece_id in seen or not counts.get(item.piece_id):
            continue
        seen.add(item.piece_id)
        composer = item.piece.composer
        reached = letters[item.piece_id]
        pieces.append(MarkedPiece(
            piece_id=item.piece_id,
            title=item.piece.title,
            composer_name=str(composer) if composer is not None else "",
            count=counts[item.piece_id],
            instrumental=bool(getattr(item, 'is_instrumental', False)),
            sections=canonical_section_letters(reached) if reached is not None else '',
        ))
    return pieces


@dataclass(frozen=True)
class _Reach:
    """Who would hear about which pieces, and what nobody would hear."""

    #: One per distinct list of pieces: the recipients' ids, and those pieces.
    audiences: list[tuple[list[str], list[MarkedPiece]]]
    #: The pieces somebody would hear of, in programme order.
    reached: list[MarkedPiece]
    #: The section letters of the new marks on pieces nobody would hear of.
    #: '' when every piece reaches somebody, and when nobody in the cast can
    #: be told anything at all: the reason is then the cast, not the voices.
    unreached_sections: str


def _reach(project: Project, sender: Any, pieces: list[MarkedPiece]) -> _Reach:
    """Who hears about which pieces: the live cast, minus the one pressing the
    button and the podium. A singer is told of the sung pieces whose new marks
    reach their section, which in one piece is their seat's and the line they
    are cast on there; a player of every piece, by the instrumental rule and
    because a player answers to no section. One audience per distinct list of
    pieces, so one notice says the same thing to everyone it reaches. Nobody
    once the concert is over — the scores are no longer theirs to open."""
    if not pieces or project.status in Project.CLOSED_STATUSES:
        return _Reach(audiences=[], reached=[], unreached_sections='')
    live = (
        Participation.live_seats()
        .filter(project=project, artist__user__isnull=False)
        .exclude(artist__voice_type=VoiceType.CONDUCTOR)
    )
    if sender is not None:
        live = live.exclude(artist__user=sender)
    seats = list(
        live.values_list('id', 'artist__user_id', 'artist__voice_type', 'default_voice_line')
    )
    sung = [piece for piece in pieces if not piece.instrumental]
    cast_lines: dict[tuple[Any, Any], list[str]] = {}
    for seat_id, piece_id, line in (
        ProjectPieceCasting.objects
        .filter(
            participation_id__in=[seat[0] for seat in seats],
            piece_id__in=[piece.piece_id for piece in sung],
        )
        .values_list('participation_id', 'piece_id', 'voice_line')
    ):
        cast_lines.setdefault((seat_id, piece_id), []).append(line)
    by_pieces: dict[tuple[UUID, ...], set[str]] = {}
    for seat_id, user_id, voice_type, voice_line in seats:
        if voice_type == VoiceType.INSTRUMENTALIST:
            told = pieces
        else:
            told = [
                piece for piece in sung
                if piece.is_news_to(reader_letters_of_seats([
                    (voice_type, voice_line),
                    *((voice_type, line) for line in cast_lines.get((seat_id, piece.piece_id), ())),
                ]))
            ]
        if told:
            by_pieces.setdefault(tuple(piece.piece_id for piece in told), set()).add(str(user_id))
    in_order = {piece.piece_id: piece for piece in pieces}
    reached_ids = {piece_id for key in by_pieces for piece_id in key}
    return _Reach(
        audiences=[
            (sorted(user_ids), [in_order[piece_id] for piece_id in key])
            for key, user_ids in by_pieces.items()
        ],
        reached=[piece for piece in pieces if piece.piece_id in reached_ids],
        unreached_sections=canonical_section_letters(
            letter
            for piece in pieces
            if piece.piece_id not in reached_ids
            for letter in piece.sections
        ) if seats else '',
    )


def _send_notice(recipient_ids: list[str], metadata: dict[str, Any]) -> None:
    send_bulk_notifications_task.delay(
        recipient_ids=recipient_ids,
        notification_type=NotificationType.SCORE_MARKS_SHARED,
        level=NotificationLevel.INFO,
        metadata=metadata,
    )


def read_marks_news(project: Project, sender: Any) -> MarksNews:
    """What "Powiadom chór" would say if pressed now."""
    now = timezone.now()
    since = _window_start(project)
    pieces = marked_pieces(project, since=since, until=now)
    reach = _reach(project, sender, pieces)
    return MarksNews(
        since=since,
        notified_at=project.marks_notified_at,
        # A piece nobody would hear of is not on offer. When nobody hears of
        # anything and no voices explain it, the pieces stay listed beside a
        # count of nobody: the cast is the reason, not the marks.
        pieces=reach.reached if reach.reached or reach.unreached_sections else pieces,
        recipients=sum(len(ids) for ids, _ in reach.audiences),
        next_allowed_at=_cooldown_end(project, now),
        unreached_sections=reach.unreached_sections,
    )


def notify_choir(project: Project, sender: Any) -> MarksNoticeSent:
    """Sends one notice per live cast member, listing the pieces whose choir
    marks are new to them, and moves `marks_notified_at` to now.

    The stamp is claimed with a conditional update on the value read, so two
    managers pressing at once send one notice, not two. Raises
    `MarksNoticeRefused` when there is nothing to say, nobody to say it to (or
    nobody in the sections the marks are for), or the last notice is too
    recent.

    The notices are queued right after the claim, outside any transaction. If
    the broker refuses one, the claim is undone and `MarksNoticeUndelivered`
    raised: a closed window with nothing sent would keep those marks from ever
    being offered again, and the cooldown would block the retry. An audience
    queued before the failure hears the notice twice on that retry, which is
    the lesser loss.
    """
    now = timezone.now()
    previous = project.marks_notified_at
    cooldown = _cooldown_end(project, now)
    if cooldown is not None:
        raise MarksNoticeRefused(MarksNoticeRefused.TOO_SOON, cooldown)
    pieces = marked_pieces(project, since=_window_start(project), until=now)
    if not pieces:
        raise MarksNoticeRefused(MarksNoticeRefused.NOTHING_NEW)
    reach = _reach(project, sender, pieces)
    audiences = reach.audiences
    if not audiences:
        if reach.unreached_sections:
            raise MarksNoticeRefused(
                MarksNoticeRefused.UNREACHED, sections=reach.unreached_sections,
            )
        raise MarksNoticeRefused(MarksNoticeRefused.NOBODY)

    claimed = (
        Project.objects
        .filter(pk=project.pk, marks_notified_at=previous)
        .update(marks_notified_at=now)
    )
    if not claimed:
        raise MarksNoticeRefused(MarksNoticeRefused.TOO_SOON, now + MARKS_NOTICE_COOLDOWN)
    project.marks_notified_at = now

    try:
        for recipient_ids, subset in audiences:
            metadata = ScoreMarksSharedMetadata(
                project_id=project.pk,
                project_name=project.title,
                event_kind=project.event_kind,
                pieces=tuple(
                    MarkedPieceMetadata(
                        piece_id=piece.piece_id,
                        title=piece.title,
                        composer_name=piece.composer_name,
                    )
                    for piece in subset
                ),
            ).model_dump(mode="json")
            _send_notice(recipient_ids, metadata)
    except Exception as exc:
        logger.exception("marks_news.dispatch_failed project=%s", project.pk)
        # Conditional, so a press that claimed the stamp since is not undone.
        Project.objects.filter(pk=project.pk, marks_notified_at=now).update(
            marks_notified_at=previous,
        )
        project.marks_notified_at = previous
        raise MarksNoticeUndelivered() from exc
    return MarksNoticeSent(
        notified_at=now,
        recipients=sum(len(ids) for ids, _ in audiences),
        pieces=len(reach.reached),
    )


def marks_news_payload(news: MarksNews) -> dict[str, Any]:
    """The wire shape of `read_marks_news`."""
    return {
        "since": news.since.isoformat(),
        "notified_at": news.notified_at.isoformat() if news.notified_at else None,
        "next_allowed_at": news.next_allowed_at.isoformat() if news.next_allowed_at else None,
        "recipients": news.recipients,
        "unreached_sections": news.unreached_sections,
        "pieces": [
            {
                "piece_id": str(piece.piece_id),
                "title": piece.title,
                "composer_name": piece.composer_name,
                "count": piece.count,
            }
            for piece in news.pieces
        ],
    }


__all__ = [
    "MARKS_NOTICE_COOLDOWN",
    "MarkedPiece",
    "MarksNews",
    "MarksNoticeRefused",
    "MarksNoticeSent",
    "MarksNoticeUndelivered",
    "marked_pieces",
    "marks_news_payload",
    "notify_choir",
    "read_marks_news",
]
