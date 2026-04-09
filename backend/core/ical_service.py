# core/ical_service.py
import uuid
from datetime import timedelta
from django.utils import timezone
from django.utils.translation import gettext as _, override
from roster.models import Project, Rehearsal, Participation

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
            ).exclude(status=Project.Status.CANCELLED)

            rehearsals = Rehearsal.objects.filter(
                project__in=projects
            ).distinct().select_related('project')

            return cls._build_ics(projects, rehearsals)

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
            location = cls._escape_ics_text(reh.location)
            focus_text = cls._escape_ics_text(reh.focus) if reh.focus else _('None')
            description = cls._escape_ics_text(f"{_('Focus')}: {focus_text}\n{_('Project')}: {reh.project.title}")

            lines.extend([
                "BEGIN:VEVENT",
                f"UID:rehearsal_{reh.id}@voctmanager.com",
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
            location = cls._escape_ics_text(proj.location)
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
                f"UID:project_{proj.id}@voctmanager.com",
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