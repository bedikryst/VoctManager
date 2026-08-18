# core/ical_service.py
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta

from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import override

from roster.domain.day_timeline import format_time_window, localize
from roster.models import Participation, Project, Rehearsal


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
            # `Participation.live_seats` and nothing else. This feed used to
            # write its own three conditions and disagreed with the panel on the
            # third: it dropped only cancelled projects, so a DRAFT concert —
            # invisible in the schedule, never announced to anybody — was
            # published into the singer's subscribed calendar.
            seats = Participation.live_seats(artist=artist)
            projects = Project.objects.filter(
                id__in=seats.values('project_id')
            ).select_related('location')

            # The same rule the schedule reads: a sectional IS its list of
            # names, so a soprano's calendar does not fill with the basses'
            # rehearsals — and a deleted session leaves the calendar with it.
            rehearsals = (
                Rehearsal.objects.filter(project__in=projects, is_deleted=False)
                .filter(
                    Q(invited_participations__isnull=True)
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
        return "\r\n".join(lines)

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
            rows.append((_('Concert'), event_local.strftime('%H:%M')))

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
    def _build_ics(cls, projects, rehearsals) -> str:
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//VoctManager Enterprise//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "X-WR-CALNAME:VoctManager Schedule",
            "X-WR-TIMEZONE:UTC",
        ]

        now_utc = timezone.now().strftime('%Y%m%dT%H%M%SZ')

        for reh in rehearsals:
            start_time = reh.date_time
            end_time = start_time + timedelta(hours=3)
            
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
            end_time = proj.date_time + timedelta(hours=4)
            
            title = cls._escape_ics_text(f"[{_('Concert')}] {proj.title}")
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
        # RFC 5545 strictly requires CRLF (\r\n) line endings
        return "\r\n".join(lines)

    @staticmethod
    def _generate_empty_ics() -> str:
        return "\r\n".join([
            "BEGIN:VCALENDAR", 
            "VERSION:2.0", 
            "PRODID:-//VoctManager Enterprise//EN", 
            "END:VCALENDAR"
        ])