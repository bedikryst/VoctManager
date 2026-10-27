"""
@file marks_news.py
@description "Powiadom chór": which pieces of one project carry choir marks that
    said something new since the cast was last told, and the one notice that
    tells them. The choir is never told on its own: a stroke drawn mid-rehearsal
    is not news until the conductor says it is.

    "New" keys on `Annotation.content_at`, never on `updated_at`, so tidying a
    page — moving, resizing, recolouring — is not news, while a restored set is.
    Only the `shared` layer counts: it is the one written to the choir.
@module roster/marks_news
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from django.db.models import Count
from django.utils import timezone

from archive.models import SHARED_ANNOTATION_LAYER, Annotation
from notifications.dtos import MarkedPieceMetadata, ScoreMarksSharedMetadata
from notifications.models import NotificationLevel, NotificationType
from notifications.tasks import send_bulk_notifications_task
from roster.models import (
    Participation,
    ProgramItem,
    Project,
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


@dataclass(frozen=True)
class MarksNoticeSent:
    notified_at: datetime
    recipients: int
    pieces: int


class MarksNoticeRefused(Exception):
    """Why a press sent nothing. `reason` is a stable code for the client."""

    NOTHING_NEW = "nothing_new"
    NOBODY = "nobody"
    TOO_SOON = "too_soon"

    def __init__(self, reason: str, next_allowed_at: datetime | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.next_allowed_at = next_allowed_at


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
    counts: dict[Any, int] = dict(
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
        .values_list('edition__piece_id')
        .annotate(n=Count('id'))
    )
    pieces: list[MarkedPiece] = []
    seen: set[Any] = set()
    for item in items:
        if item.piece_id in seen or not counts.get(item.piece_id):
            continue
        seen.add(item.piece_id)
        composer = item.piece.composer
        pieces.append(MarkedPiece(
            piece_id=item.piece_id,
            title=item.piece.title,
            composer_name=str(composer) if composer is not None else "",
            count=counts[item.piece_id],
            instrumental=bool(getattr(item, 'is_instrumental', False)),
        ))
    return pieces


def _audiences(
    project: Project, sender: Any, pieces: list[MarkedPiece],
) -> list[tuple[list[str], list[MarkedPiece]]]:
    """Who hears about which pieces: the live cast, minus the one pressing the
    button and the podium, split by the instrumental rule. Nobody once the
    concert is over — the scores are no longer theirs to open."""
    if not pieces or project.status in Project.CLOSED_STATUSES:
        return []
    seats = (
        Participation.live_seats()
        .filter(project=project, artist__user__isnull=False)
        .exclude(artist__voice_type=VoiceType.CONDUCTOR)
        .values_list('artist__user_id', 'artist__voice_type')
    )
    if sender is not None:
        seats = seats.exclude(artist__user=sender)
    players: set[str] = set()
    singers: set[str] = set()
    for user_id, voice_type in seats:
        (players if voice_type == VoiceType.INSTRUMENTALIST else singers).add(str(user_id))
    sung = [piece for piece in pieces if not piece.instrumental]
    audiences: list[tuple[list[str], list[MarkedPiece]]] = []
    if singers and sung:
        audiences.append((sorted(singers), sung))
    if players:
        audiences.append((sorted(players), pieces))
    return audiences


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
    return MarksNews(
        since=since,
        notified_at=project.marks_notified_at,
        pieces=pieces,
        recipients=sum(len(ids) for ids, _ in _audiences(project, sender, pieces)),
        next_allowed_at=_cooldown_end(project, now),
    )


def notify_choir(project: Project, sender: Any) -> MarksNoticeSent:
    """Sends one notice per live cast member, listing the pieces whose choir
    marks are new to them, and moves `marks_notified_at` to now.

    The stamp is claimed with a conditional update on the value read, so two
    managers pressing at once send one notice, not two. Raises
    `MarksNoticeRefused` when there is nothing to say, nobody to say it to, or
    the last notice is too recent.

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
    audiences = _audiences(project, sender, pieces)
    if not audiences:
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
        pieces=len(pieces),
    )


def marks_news_payload(news: MarksNews) -> dict[str, Any]:
    """The wire shape of `read_marks_news`."""
    return {
        "since": news.since.isoformat(),
        "notified_at": news.notified_at.isoformat() if news.notified_at else None,
        "next_allowed_at": news.next_allowed_at.isoformat() if news.next_allowed_at else None,
        "recipients": news.recipients,
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
