# core/ical_service.py
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta

from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import override

from roster.domain.day_timeline import format_time_window, localize
from roster.domain.event_kind import event_moment_label
from roster.models import (
    FALLBACK_EVENT_DURATION_MINUTES,
    FALLBACK_REHEARSAL_DURATION_MINUTES,
    Participation,
    Project,
    Rehearsal,
)

# The label a member reads in their phone's calendar list, between "Work" and
# "Birthdays" — so it is the ensemble's name, not the product's. Deliberately
# untranslated: a proper noun, and a member reading the panel in French still
# sings in this choir.
CALENDAR_NAME = "VoctEnsemble"


class ICalGeneratorService:
    """
    Enterprise service for generating secure, RFC-5545 compliant iCalendar feeds.
    """

    @staticmethod
    def _escape_ics_text(text: str) -> str:
        """
        Sanitizes user input to prevent CRLF injection and format corruption.
        Escapes characters according to RFC-5545 specifications.
        """
        if not text:
            return ""
        # Prevent CRLF injection by stripping stray carriage returns
        text = text.replace('\r\n', ' ').replace('\r', ' ')
        # Escape required characters
        text = text.replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,')
        # Represent deliberate newlines correctly for ICS
        text = text.replace('\n', '\\n')
        return text

    @staticmethod
    def _fold(line: str) -> str:
        """Splits one content line to the 75-octet ceiling of RFC 5545 §3.1.

        The limit is counted in octets, not characters, and the continuation
        marker (CRLF + one space) is part of the following line's budget. A
        Polish day card blows through it easily — a filled DESCRIPTION reaches
        ~550 octets — and the strict end of the parser spectrum, which is where
        Apple sits, is entitled to reject that.

        The cut must land on a UTF-8 lead byte: slicing `ł` or `ę` down the
        middle would hand the client a broken sequence, which is a worse feed
        than a long line.
        """
        raw = line.encode('utf-8')
        if len(raw) <= 75:
            return line

        chunks: list[str] = []
        start, budget = 0, 75
        while start < len(raw):
            end = min(start + budget, len(raw))
            while end < len(raw) and (raw[end] & 0xC0) == 0x80:
                end -= 1
            chunks.append(raw[start:end].decode('utf-8'))
            start, budget = end, 74  # the leading space costs one octet
        return "\r\n ".join(chunks)

    @classmethod
    def _render(cls, lines: Sequence[str]) -> str:
        """The one exit from this service: fold every content line, then join
        with the CRLF that RFC 5545 requires."""
        return "\r\n".join(cls._fold(line) for line in lines)

    @classmethod
    def generate_user_feed(cls, user) -> str:
        """
        Generates the localized ICS feed for a specific user.
        """
        if not hasattr(user, 'artist_profile'):
            return cls._generate_empty_ics()

        artist = user.artist_profile
        language = getattr(user.profile, 'language', 'en')

        # We force the translation to the user's preferred language,
        # because calendar clients might not send 'Accept-Language' headers.
        with override(language):
            # `Participation.live_seats` and nothing else for the cast. This
            # feed used to write its own three conditions and disagreed with the
            # panel on the third: it dropped only cancelled projects, so a DRAFT
            # concert — invisible in the schedule, never announced to anybody —
            # was published into the singer's subscribed calendar.
            seats = Participation.live_seats(artist=artist)

            # A conductor holds no seat, so the query above cannot see the
            # projects they only conduct — their subscribed calendar was empty
            # of the dates they are the reason for.
            #
            # `get_artist_schedule` hands them their drafts as well, deliberately:
            # they are the one assembling them. This file is a different room.
            # It leaves the panel, is mirrored onto a calendar provider's servers
            # and refreshed on that provider's cadence — hours to days — so a
            # plan still moving daily would sit there wrong, and would sit there
            # after being abandoned. Published only, therefore: the same gate the
            # cast's own seats pass through.
            conducted_ids = set(
                Project.objects.filter(
                    conductor__user=user, conductor__is_deleted=False
                )
                .exclude(status__in=Project.HIDDEN_FROM_CAST_STATUSES)
                .values_list('id', flat=True)
            )

            projects = Project.objects.filter(
                Q(id__in=seats.values('project_id')) | Q(id__in=conducted_ids)
            ).select_related('location')

            # The same rule the schedule reads: a sectional IS its list of
            # names, so a soprano's calendar does not fill with the basses'
            # rehearsals — and a deleted session leaves the calendar with it.
            # A conductor runs every rehearsal of their own project, which is
            # why that project's id short-circuits the invite list.
            rehearsals = (
                Rehearsal.objects.filter(project__in=projects, is_deleted=False)
                .filter(
                    Q(project_id__in=conducted_ids)
                    | Q(invited_participations__isnull=True)
                    | Q(invited_participations__in=seats)
                )
                .distinct()
                .select_related('project', 'location')
            )

            return cls._build_ics(projects, rehearsals)

    @classmethod
    def build_single_event(
        cls,
        *,
        uid: str,
        summary: str,
        start_iso: str,
        end_iso: str,
        location: str = "",
        description: str = "",
    ) -> str:
        """
        Builds a one-event RFC-5545 calendar for an email 'add to calendar'
        attachment. start_iso/end_iso are ISO-8601 timestamps (aware preferred;
        naive is treated as UTC). The caller localizes summary/description.
        """
        return cls.build_events([{
            "uid": uid,
            "summary": summary,
            "start_iso": start_iso,
            "end_iso": end_iso,
            "location": location,
            "description": description,
        }])

    @classmethod
    def build_events(cls, events: Sequence[Mapping[str, str]]) -> str:
        """
        Builds one RFC-5545 calendar carrying several events, for an email that
        announces more than one date. A briefing about five rehearsals attaches
        this once instead of five separate invites — five attachments read as five
        pieces of news, which is precisely what the announcement queue exists to
        avoid. The caller localizes summary/description.
        """
        def _fmt(iso: str) -> str:
            dt = datetime.fromisoformat(iso)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            return dt.astimezone(UTC).strftime('%Y%m%dT%H%M%SZ')

        now_utc = timezone.now().strftime('%Y%m%dT%H%M%SZ')
        # No calendar name here on purpose: an invite attached to an e-mail is
        # dropped into a calendar the reader already has. Naming it would offer
        # some clients a whole new subscribed calendar per message.
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//VoctManager Enterprise//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
        ]
        for event in events:
            lines.extend([
                "BEGIN:VEVENT",
                f"UID:{event['uid']}",
                f"DTSTAMP:{now_utc}",
                f"DTSTART:{_fmt(event['start_iso'])}",
                f"DTEND:{_fmt(event['end_iso'])}",
                f"SUMMARY:{cls._escape_ics_text(event.get('summary', ''))}",
                f"LOCATION:{cls._escape_ics_text(event.get('location', ''))}",
                f"DESCRIPTION:{cls._escape_ics_text(event.get('description', ''))}",
                "END:VEVENT",
            ])
        lines.append("END:VCALENDAR")
        return cls._render(lines)

    @staticmethod
    def _project_description(project: Project) -> str:
        """What the singer needs on the day, in the calendar entry itself.

        A subscribed calendar is where a chorister looks on the morning of a
        concert, so the facts that used to exist only on the printed day card
        belong here as well — the door, the parking, the room, the number to
        call. Only what was actually entered: a line reading "Parking: —"
        answers nothing and pushes the fact that does answer something off a
        phone screen.

        The entry opens at the call time, so the downbeat is stated here rather
        than left for the reader to infer from an event that has already begun.
        """
        rows: list[tuple[str, str]] = []

        event_local = localize(project.date_time, project.timezone)
        if project.call_time and event_local is not None:
            # The entry opens at the call time, so this row is what the reader is
            # actually being called for — named by kind, because "Koncert 18:00"
            # inside a wedding Mass's entry is the one line they would act on.
            rows.append((event_moment_label(project.event_kind), event_local.strftime('%H:%M')))

        for label, value in (
            (_('Warm-up'), format_time_window(project.warmup_start, project.warmup_end)),
            (
                _('Sound check'),
                format_time_window(project.soundcheck_start, project.soundcheck_end),
            ),
            (_('Entrance'), project.entrance_note),
            (_('Parking'), project.parking_note),
            (_('Dressing room'), project.dressing_room_note),
            (_('Dress Code (Female)'), project.dress_code_female),
            (_('Dress Code (Male)'), project.dress_code_male),
        ):
            if value:
                rows.append((label, value))

        contact = ', '.join(
            part
            for part in (project.onsite_contact_name, project.onsite_contact_phone)
            if part
        )
        if contact:
            rows.append((_('On-site contact'), contact))

        lines = [f'{label}: {value}' for label, value in rows]
        if project.description:
            lines.append(project.description)
        return '\n'.join(lines)

    @classmethod
    def _calendar_preamble(cls) -> list[str]:
        """The VCALENDAR header both feeds share.

        It used to be typed out twice and the copies disagreed: the empty feed
        carried no name at all, so a member with nothing scheduled yet — or an
        account with no artist profile behind it — got a calendar labelled with
        the entire subscription URL, token included, sitting in their phone's
        calendar list.

        `NAME` is the RFC 7986 property; `X-WR-CALNAME` is the older X-property
        that Apple, Google and Outlook actually read. Both are emitted because
        neither alone covers the clients members use.
        """
        name = cls._escape_ics_text(CALENDAR_NAME)
        return [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//VoctManager Enterprise//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            f"NAME:{name}",
            f"X-WR-CALNAME:{name}",
            "X-WR-TIMEZONE:UTC",
        ]

    @classmethod
    def _build_ics(cls, projects, rehearsals) -> str:
        lines = cls._calendar_preamble()

        now_utc = timezone.now().strftime('%Y%m%dT%H%M%SZ')

        for reh in rehearsals:
            start_time = reh.date_time
            # The conductor's own end where there is one. The fallback is a
            # calendar necessity, not a claim: a VEVENT with no end renders as a
            # zero-length mark, so an untimed session still reserves a block.
            end_time = reh.end_date_time or (
                start_time + timedelta(minutes=FALLBACK_REHEARSAL_DURATION_MINUTES)
            )

            title = cls._escape_ics_text(f"[{_('Rehearsal')}] {reh.project.title}")
            location = cls._escape_ics_text(reh.location.name if reh.location else "")
            # Escaped once, on the assembled text. Escaping a part and then the
            # whole doubled every backslash the first pass wrote, so a comma in
            # a conductor's focus note reached the calendar as `\,`.
            focus_text = reh.focus or _('None')
            description = cls._escape_ics_text(
                f"{_('Focus')}: {focus_text}\n{_('Project')}: {reh.project.title}"
            )

            lines.extend([
                "BEGIN:VEVENT",
                f"UID:rehearsal_{reh.id}@voctensemble.com",
                f"DTSTAMP:{now_utc}",
                f"DTSTART:{start_time.strftime('%Y%m%dT%H%M%SZ')}",
                f"DTEND:{end_time.strftime('%Y%m%dT%H%M%SZ')}",
                f"SUMMARY:{title}",
                f"LOCATION:{location}",
                f"DESCRIPTION:{description}",
                "END:VEVENT"
            ])

        for proj in projects:
            start_time = proj.call_time if proj.call_time else proj.date_time
            # A concert's end is nowhere stored — not even the run sheet has to
            # reach past the downbeat — so this block is the same calendar-only
            # reservation the rehearsals get, from the same table of constants.
            end_time = proj.date_time + timedelta(minutes=FALLBACK_EVENT_DURATION_MINUTES)

            title = cls._escape_ics_text(
                f"[{event_moment_label(proj.event_kind)}] {proj.title}"
            )
            location = cls._escape_ics_text(proj.location.name if proj.location else "")
            description = cls._escape_ics_text(cls._project_description(proj))

            lines.extend([
                "BEGIN:VEVENT",
                f"UID:project_{proj.id}@voctensemble.com",
                f"DTSTAMP:{now_utc}",
                f"DTSTART:{start_time.strftime('%Y%m%dT%H%M%SZ')}",
                f"DTEND:{end_time.strftime('%Y%m%dT%H%M%SZ')}",
                f"SUMMARY:{title}",
                f"LOCATION:{location}",
                f"DESCRIPTION:{description}",
                "END:VEVENT"
            ])

        lines.append("END:VCALENDAR")
        return cls._render(lines)

    @classmethod
    def _generate_empty_ics(cls) -> str:
        """A calendar with no events is still a calendar the member sees named
        in their list, so it carries the same identity as a full one."""
        return cls._render([*cls._calendar_preamble(), "END:VCALENDAR"])