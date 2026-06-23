# core/ical_service.py
from datetime import UTC, datetime, timedelta

from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import override

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
            active_statuses = [Participation.Status.INVITED, Participation.Status.CONFIRMED]
            
            projects = Project.objects.filter(
                participations__artist=artist,
                participations__status__in=active_statuses
            ).exclude(status=Project.Status.CANCELLED).select_related('location')

            rehearsals = Rehearsal.objects.filter(
                project__in=projects
            ).distinct().select_related('project', 'location')

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
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{now_utc}",
            f"DTSTART:{_fmt(start_iso)}",
            f"DTEND:{_fmt(end_iso)}",
            f"SUMMARY:{cls._escape_ics_text(summary)}",
            f"LOCATION:{cls._escape_ics_text(location)}",
            f"DESCRIPTION:{cls._escape_ics_text(description)}",
            "END:VEVENT",
            "END:VCALENDAR",
        ]
        return "\r\n".join(lines)

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
            focus_text = cls._escape_ics_text(reh.focus) if reh.focus else _('None')
            description = cls._escape_ics_text(f"{_('Focus')}: {focus_text}\n{_('Project')}: {reh.project.title}")

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
            desc_text = cls._escape_ics_text(proj.description)
            
            # Using gettext for labels
            dress_m_label = _('Dress Code (Male)')
            dress_f_label = _('Dress Code (Female)')
            description = cls._escape_ics_text(
                f"{dress_m_label}: {proj.dress_code_male}\n"
                f"{dress_f_label}: {proj.dress_code_female}\n"
                f"{desc_text}"
            )

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