"""
CQRS read model for the Artist Dossier (manager-only HR analytics).

Aggregates an artist's *project track record* straight from the authoritative
relational state — Participation (invite/confirm/decline), ProjectPieceCasting
(which voice line on which piece) and Attendance (reliability) — rather than from
the notification stream, which is recipient-scoped, opt-in and deletable. A
bounded number of queries is issued regardless of how many projects the artist
has appeared in.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Any

from django.db.models import Count, Prefetch
from django.utils import timezone

from core.constants import VoiceLine
from roster.models import (
    Attendance,
    Participation,
    Project,
    ProjectPieceCasting,
    Rehearsal,
)

if TYPE_CHECKING:
    from roster.models import Artist

VOICE_LINE_LABELS: dict[str, str] = {
    str(value): str(label) for value, label in VoiceLine.choices
}


def get_artist_dossier(artist: Artist) -> dict[str, Any]:
    """Build the read-only dossier payload (stats + per-project history) for one artist."""
    now = timezone.now()

    participations = list(
        Participation.objects.filter(artist=artist, is_deleted=False)
        .select_related("project")
        .prefetch_related(
            Prefetch(
                "castings",
                queryset=ProjectPieceCasting.objects.select_related("piece").order_by(
                    "piece__title"
                ),
                to_attr="pf_castings",
            )
        )
        .order_by("-project__date_time")
    )

    confirmed = [p for p in participations if p.status == Participation.Status.CONFIRMED]
    declined = [p for p in participations if p.status == Participation.Status.DECLINED]
    invited = [p for p in participations if p.status == Participation.Status.INVITED]

    # "Engaged" projects exclude cancelled events so the record reflects real work.
    engaged = [p for p in confirmed if p.project.status != Project.Status.CANCELLED]
    upcoming = [
        p
        for p in engaged
        if p.project.status != Project.Status.COMPLETED
        and p.project.date_time is not None
        and p.project.date_time >= now
    ]
    completed = [
        p
        for p in engaged
        if p.project.status == Project.Status.COMPLETED
        or (p.project.date_time is not None and p.project.date_time < now)
    ]

    decided = len(confirmed) + len(declined)
    acceptance_rate = (len(confirmed) / decided) if decided else None

    # Settlement footprint, derived straight from the participation fees. Declined
    # invitations are excluded — that artist withdrew, so any stray fee on them is
    # not money owed. A zero/None fee never counts as a real payment.
    billable = [p for p in participations if p.status != Participation.Status.DECLINED]
    earnings_paid = sum((p.fee for p in billable if p.is_paid and p.fee), Decimal("0"))
    earnings_outstanding = sum(
        (p.fee for p in billable if not p.is_paid and p.fee), Decimal("0")
    )
    projects_paid = sum(1 for p in billable if p.is_paid and p.fee)

    participation_ids = [p.id for p in participations]

    attendance_rows = (
        Attendance.objects.filter(participation_id__in=participation_ids)
        .values("status")
        .annotate(n=Count("id"))
    )
    att = {row["status"]: row["n"] for row in attendance_rows}
    present = att.get(Attendance.Status.PRESENT, 0)
    late = att.get(Attendance.Status.LATE, 0)
    absent = att.get(Attendance.Status.ABSENT, 0)
    excused = att.get(Attendance.Status.EXCUSED, 0)
    # Reliability denominator excludes excused absences — those are agreed in advance.
    reliability_base = present + late + absent
    attendance_rate = ((present + late) / reliability_base) if reliability_base else None

    rehearsals_invited = (
        Rehearsal.objects.filter(
            invited_participations__in=participation_ids, is_deleted=False
        )
        .distinct()
        .count()
    )

    line_counter: dict[str, int] = {}
    projects: list[dict[str, Any]] = []
    for participation in participations:
        castings = getattr(participation, "pf_castings", [])
        casting_payload = []
        for casting in castings:
            line_counter[casting.voice_line] = line_counter.get(casting.voice_line, 0) + 1
            casting_payload.append(
                {
                    "piece_title": casting.piece.title,
                    "voice_line": casting.voice_line,
                    "voice_line_label": VOICE_LINE_LABELS.get(
                        casting.voice_line, casting.voice_line
                    ),
                    "gives_pitch": casting.gives_pitch,
                }
            )
        projects.append(
            {
                "project_id": str(participation.project_id),
                "title": participation.project.title,
                "date_time": participation.project.date_time,
                "status": participation.project.status,
                "participation_status": participation.status,
                "castings": casting_payload,
            }
        )

    top_voice_lines = [
        {
            "voice_line": line,
            "label": VOICE_LINE_LABELS.get(line, line),
            "count": count,
        }
        for line, count in sorted(
            line_counter.items(), key=lambda item: item[1], reverse=True
        )
    ]

    return {
        "artist_id": str(artist.id),
        "stats": {
            "projects_total": len(participations),
            "projects_confirmed": len(confirmed),
            "projects_upcoming": len(upcoming),
            "projects_completed": len(completed),
            "invitations_pending": len(invited),
            "invitations_declined": len(declined),
            "acceptance_rate": acceptance_rate,
            "rehearsals_invited": rehearsals_invited,
            "attendance_present": present,
            "attendance_late": late,
            "attendance_absent": absent,
            "attendance_excused": excused,
            "attendance_rate": attendance_rate,
            "top_voice_lines": top_voice_lines,
            "earnings_paid": float(earnings_paid),
            "earnings_outstanding": float(earnings_outstanding),
            "projects_paid": projects_paid,
        },
        "projects": projects,
    }
