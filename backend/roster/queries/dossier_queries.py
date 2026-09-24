"""
CQRS read model for the Artist Dossier (manager-only HR analytics).

Aggregates an artist's *project track record* straight from the authoritative
relational state — Participation (invite/confirm/decline), ProjectPieceCasting
(which voice line on which piece), ProjectSoloAssignment (which named solos),
Attendance (reliability),
RehearsalDelegate + `Rehearsal.led_by` (leadership) and the finance ledger's
cost items (earnings) — rather than from the
notification stream, which is recipient-scoped, opt-in and deletable. A
bounded number of queries is issued regardless of how many projects the artist
has appeared in.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Any

from django.db.models import Count, Prefetch, Sum
from django.utils import timezone

from core.constants import VoiceLine
from core.voice_labels import (
    canonical_section_letters,
    plain_voice_line_label,
    section_letters_of_seat,
)
from finance.models import CostItem
from finance.rules import money
from roster.domain.solo_duties import is_legacy_solo
from roster.models import (
    Attendance,
    Participation,
    Project,
    ProjectPieceCasting,
    ProjectSoloAssignment,
    Rehearsal,
    RehearsalDelegate,
    VoiceType,
)
from roster.permissions import live_delegate_q
from roster.queries.voice_naming import project_voice_labels

if TYPE_CHECKING:
    from roster.models import Artist


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
            ),
            Prefetch(
                "solo_assignments",
                queryset=ProjectSoloAssignment.objects.select_related("piece").order_by(
                    "piece__title", "position"
                ),
                to_attr="pf_solos",
            ),
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

    # Settlement footprint, read from the finance ledger, which alone holds the
    # money. Paid is every payment made against this artist's seats: as in the
    # ledger, a payment stays a payment after the seat is declined or removed.
    # Outstanding is what is priced and unpaid on the seats still in the cast.
    # A volunteer's 0 is never earnings.
    fee_items = CostItem.objects.filter(participation__artist=artist, contract_amount__gt=0)
    paid_items = fee_items.filter(paid_on__isnull=False)
    earnings_paid = paid_items.aggregate(total=Sum("contract_amount"))["total"] or Decimal("0")
    earnings_outstanding = (
        fee_items.filter(paid_on__isnull=True, participation__is_deleted=False)
        .exclude(participation__status=Participation.Status.DECLINED)
        .aggregate(total=Sum("contract_amount"))["total"]
        or Decimal("0")
    )
    projects_paid = paid_items.values("budget__project_id").distinct().count()

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

    # `Rehearsal.calling_q` — the same rule the schedule, the reminder and the
    # invitation read by. Counting only the named sessions would report zero
    # rehearsals for a singer whose project runs entirely on tutti calls, which
    # is the normal shape of a concert; counting every tutti would credit an
    # organist with the choir's evenings.
    rehearsals_invited = (
        Rehearsal.objects.filter(
            project_id__in={p.project_id for p in participations}, is_deleted=False
        )
        .filter(
            Rehearsal.calling_q(
                participation_ids,
                instrumentalist=artist.voice_type == VoiceType.INSTRUMENTALIST,
                # `Participation.section_letters` without the per-seat `artist`
                # join: every seat here belongs to the one artist in hand.
                section_letters=canonical_section_letters(
                    letter
                    for p in participations
                    for letter in section_letters_of_seat(
                        artist.voice_type, p.default_voice_line
                    )
                ),
            )
        )
        .distinct()
        .count()
    )

    # Leadership is read from every delegation row ever written, revoked ones
    # included: a grant that ended is still a project this person once led.
    # Whether a row still opens anything is asked with the permission's own
    # predicate, not re-derived here, so the dossier and the gates cannot
    # disagree about who leads what today.
    delegations = list(
        RehearsalDelegate.all_objects.filter(artist=artist)
        .select_related("project")
        .order_by("-project__date_time", "-created_at")
    )
    live_delegation_ids = set(
        RehearsalDelegate.objects.filter(live_delegate_q(scope="any"), artist=artist)
        .exclude(project__status__in=Project.CLOSED_STATUSES)
        .values_list("id", flat=True)
    )
    # One entry per project. A revoked row and a later live one on the same
    # project are one leadership, and the live row is the one worth showing.
    led_by_project: dict[Any, RehearsalDelegate] = {}
    for delegation in delegations:
        current = led_by_project.get(delegation.project_id)
        if current is None or (
            delegation.id in live_delegation_ids
            and current.id not in live_delegation_ids
        ):
            led_by_project[delegation.project_id] = delegation

    # A grant says the conductor trusted her; `led_by` says she stood there.
    # Only the second is a count of evenings — see the RehearsalDelegate
    # docstring on why the grant's timestamps say nothing about that.
    rehearsals_led = Rehearsal.objects.filter(
        led_by=artist, date_time__lt=now, is_deleted=False
    ).count()
    # Evenings she handed back in writing. Counted by the author stamp, not by
    # `led_by`: a leader may write up a rehearsal she covered without being
    # announced for it, and that report is still hers.
    debriefs_written = (
        Rehearsal.objects.filter(debrief_by=artist, is_deleted=False)
        .exclude(debrief="")
        .count()
    )

    led_projects_payload = [
        {
            "project_id": str(delegation.project_id),
            "title": delegation.project.title,
            "date_time": delegation.project.date_time,
            "status": delegation.project.status,
            "is_live": delegation.id in live_delegation_ids,
            "expires_at": delegation.expires_at,
            "scopes": {
                "marks": delegation.can_see_leader_marks,
                "roll_call": delegation.can_take_roll_call,
                "materials": delegation.can_open_materials,
                "choir_marks": delegation.can_mark_for_choir,
            },
        }
        for delegation in led_by_project.values()
    ]

    # A seat is named inside the concert it was taken in, so the record reads
    # the same as the call sheet that singer was handed. Resolved for the whole
    # history at once — see [roster.queries.voice_naming].
    labels_by_pair = project_voice_labels(
        (participation.project_id, casting.piece_id)
        for participation in participations
        for casting in getattr(participation, "pf_castings", [])
    )

    # Tallied by NAME, not by code: ten evenings on the sole tenor line of ten
    # unison pieces are ten evenings of "Tenor", and folding them by code would
    # split that history across rows the singer never read anywhere.
    line_counter: dict[str, int] = {}
    line_codes: dict[str, str] = {}
    projects: list[dict[str, Any]] = []
    solo_label = plain_voice_line_label(VoiceLine.SOLO)
    for participation in participations:
        castings = getattr(participation, "pf_castings", [])
        named_solos = getattr(participation, "pf_solos", [])
        casting_payload = []
        # A solo is tallied once per piece however many passages it spans:
        # three named positions in one motet are one solo performance of it,
        # and a legacy row beside them is the same performance again.
        solo_pieces: set[Any] = set()
        for casting in castings:
            if is_legacy_solo(casting):
                solo_pieces.add(casting.piece_id)
                label = solo_label
            else:
                piece_labels = labels_by_pair.get(
                    (participation.project_id, casting.piece_id), {}
                )
                label = piece_labels.get(casting.voice_line) or plain_voice_line_label(
                    casting.voice_line
                )
                line_counter[label] = line_counter.get(label, 0) + 1
                line_codes.setdefault(label, casting.voice_line)
            casting_payload.append(
                {
                    "piece_title": casting.piece.title,
                    "voice_line": casting.voice_line,
                    "voice_line_label": label,
                    "gives_pitch": casting.gives_pitch,
                }
            )
        for solo in named_solos:
            solo_pieces.add(solo.piece_id)
            casting_payload.append(
                {
                    "piece_title": solo.piece.title,
                    "voice_line": VoiceLine.SOLO.value,
                    "voice_line_label": f"{solo_label} · {solo.label}",
                    "gives_pitch": solo.gives_pitch,
                }
            )
        if solo_pieces:
            line_counter[solo_label] = line_counter.get(solo_label, 0) + len(solo_pieces)
            line_codes.setdefault(solo_label, VoiceLine.SOLO.value)
        projects.append(
            {
                "project_id": str(participation.project_id),
                "title": participation.project.title,
                "date_time": participation.project.date_time,
                "status": participation.project.status,
                "participation_status": participation.status,
                "castings": casting_payload,
                "led": participation.project_id in led_by_project,
            }
        )

    top_voice_lines = [
        {
            "voice_line": line_codes[label],
            "label": label,
            "count": count,
        }
        for label, count in sorted(
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
            # Decimal strings ("1250.00"), as every amount the finance API
            # sends: a float would lose the grosz before the client sees it.
            "earnings_paid": f"{money(earnings_paid)}",
            "earnings_outstanding": f"{money(earnings_outstanding)}",
            "projects_paid": projects_paid,
        },
        "leadership": {
            "projects_led": len(led_by_project),
            "rehearsals_led": rehearsals_led,
            "debriefs_written": debriefs_written,
            "projects": led_projects_payload,
        },
        "projects": projects,
    }
