# core/ical_service.py
from collections.abc import Collection, Mapping, Sequence
from datetime import UTC, datetime, timedelta
from uuid import UUID

from django.db.models import Q, QuerySet
from django.utils import timezone
from django.utils.translation import gettext as _
from django.utils.translation import override

from roster.domain.day_timeline import (
    DATE_FORMAT,
    PlanBounds,
    PlanMoment,
    format_day_window,
    localize,
)
from roster.domain.event_kind import event_moment_label
from roster.models import (
    FALLBACK_REHEARSAL_DURATION_MINUTES,
    Participation,
    Project,
    Rehearsal,
    is_instrumentalist_account,
)
from roster.permissions import seatless_leader_calling_q, seatless_led_project_ids
from roster.queries.day_plan_queries import point_venue_name

from .permissions import user_is_manager

# The label a member reads in their phone's calendar list, between "Work" and
# "Birthdays" — so it is the ensemble's name, not the product's. Deliberately
# untranslated: a proper noun, and a member reading the panel in French still
# sings in this choir.
CALENDAR_NAME = "VoctEnsemble"


def _window_label(key: str) -> str:
    """A typed window named for the calendar, by its key in
    ``Project.day_windows()``."""
    return {'warmup': _('Warm-up'), 'soundcheck': _('Sound check')}[key]


def _plan_moment_line(project: Project, moment: PlanMoment) -> str:
    """A moment of the plan as one line: what, when (always dated, since it
    opens an entry that may span days) and where, when that is not the venue
    the entry's own location already names."""
    if moment.point is not None:
        title = moment.point.title
    elif moment.window:
        title = _window_label(moment.window)
    else:
        title = ''
    return ', '.join(
        part
        for part in (
            title,
            moment.at.strftime(f'{DATE_FORMAT} %H:%M'),
            point_venue_name(moment.point, project.location_id),
        )
        if part
    )


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

    @staticmethod
    def _language_of(user) -> str:
        """The account's own language. Calendar clients may send no
        `Accept-Language` at all, so the feed cannot negotiate one."""
        profile = getattr(user, 'profile', None)
        return getattr(profile, 'language', 'en')

    @classmethod
    def generate_user_feed(cls, user) -> str:
        """
        Generates the localized ICS feed for a specific user.
        """
        with override(cls._language_of(user)):
            projects, rehearsals, on_site_project_ids = cls._personal_events(user)
            return cls._build_ics(
                projects, rehearsals, on_site_project_ids=on_site_project_ids
            )

    @staticmethod
    def season_feed_is_served(user) -> bool:
        """Whether the season address answers with the season or with nothing.

        Asked on every fetch, never only at opt-in: the address outlives the
        role that earned it. A manager who is demoted, or whose account is
        switched off, keeps the subscription on their phone, and from that
        moment it has to empty rather than go on carrying every date the
        ensemble has.
        """
        profile = getattr(user, 'profile', None)
        return bool(
            profile is not None
            and profile.season_calendar_enabled
            and user.is_active
            and user_is_manager(user)
        )

    @classmethod
    def generate_season_feed(cls, user) -> str:
        """Everything published that the account's own feed does not carry.

        The complement rather than the whole season: a manager subscribed to
        both addresses would otherwise see every date they sing twice, once in
        each calendar. A date moves between the two as the account is cast or
        released, and each feed is its own subscription, so a UID crossing over
        is never a duplicate a client has to reconcile.

        Published only, on the same ground the podium's drafts stay out of the
        personal feed: this file is mirrored onto a provider's servers and read
        back on the provider's schedule, so a plan still being made would sit
        there stale, and would sit there after being abandoned. The panel's
        season view keeps its drafts.

        A switched-off feed answers with an empty calendar, not an error: a
        client holds on to its last good copy through a failing fetch, while an
        empty one clears the phone at the next poll.
        """
        with override(cls._language_of(user)):
            name = f"{CALENDAR_NAME} · {_('Season')}"
            if not cls.season_feed_is_served(user):
                return cls._generate_empty_ics(name)

            own_projects, own_rehearsals, _on_site = cls._personal_events(user)

            projects = (
                Project.objects.exclude(status__in=Project.HIDDEN_FROM_CAST_STATUSES)
                .exclude(id__in=own_projects.values('id'))
                .select_related('location')
            )
            # Every live rehearsal of a published project, the sectionals the
            # account is not called to included — even inside a project it
            # sings in, those dates are not in its own feed.
            rehearsals = (
                Rehearsal.objects.filter(is_deleted=False)
                .exclude(project__status__in=Project.HIDDEN_FROM_CAST_STATUSES)
                .exclude(id__in=own_rehearsals.values('id'))
                .select_related('project', 'location')
            )

            # Nobody's seat stands behind these dates, so each entry spans the
            # whole plan, the travelling party's points included.
            return cls._build_ics(
                projects, rehearsals, on_site_project_ids=frozenset(), name=name
            )

    @staticmethod
    def _personal_events(
        user,
    ) -> tuple[QuerySet[Project], QuerySet[Rehearsal], frozenset[UUID]]:
        """The dates this account is called to: its live seats with the
        rehearsals that call it, the published projects it conducts with
        every rehearsal in them, and the published projects it leads by grant
        without a seat with the evenings that call a leader
        (`seatless_leader_calling_q`). The third value is the projects where
        the account's seat joins on site, whose entries open where that singer
        is first due instead of at the group's departure."""
        if not hasattr(user, 'artist_profile'):
            return Project.objects.none(), Rehearsal.objects.none(), frozenset()

        artist = user.artist_profile

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

        # An assistant running a programme they do not sing in holds neither
        # a seat nor the podium. Published only, for the reason above.
        led_ids = (
            Project.objects.filter(id__in=seatless_led_project_ids(user))
            .exclude(status__in=Project.HIDDEN_FROM_CAST_STATUSES)
            .values('id')
        )

        projects = Project.objects.filter(
            Q(id__in=seats.values('project_id'))
            | Q(id__in=conducted_ids)
            | Q(id__in=led_ids)
        ).select_related('location')

        # The same rule the schedule reads: a sectional calls sections (or
        # a list of names), so a soprano's calendar does not fill with the
        # basses' rehearsals — and a deleted session leaves the calendar
        # with it. The seat's rule is held to the seat's projects: its tutti
        # branch names no project, and a led project must not call the
        # leader by a voice they sing elsewhere. A conductor runs every
        # rehearsal of their own project, which is why that project's id
        # short-circuits the call rule.
        rehearsals = (
            Rehearsal.objects.filter(project__in=projects, is_deleted=False)
            .filter(
                Q(project_id__in=conducted_ids)
                | (
                    Q(project_id__in=seats.values('project_id'))
                    & Rehearsal.calling_q(
                        seats,
                        instrumentalist=is_instrumentalist_account(user),
                        section_letters=Participation.section_letters_of_seats(
                            seats.select_related('artist')
                        ),
                    )
                )
                | seatless_leader_calling_q(user)
            )
            .distinct()
            .select_related('project', 'location')
        )

        on_site_project_ids = frozenset(
            seats.filter(joins_on_site=True).values_list('project_id', flat=True)
        )

        return projects, rehearsals, on_site_project_ids

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
    def _project_description(project: Project, bounds: PlanBounds | None = None) -> str:
        """What the singer needs on the day, in the calendar entry itself.

        A subscribed calendar is where a chorister looks on the morning of a
        concert, so the facts that used to exist only on the printed day card
        belong here as well — the door, the parking, the room, the number to
        call. Only what was actually entered: a line reading "Parking: —"
        answers nothing and pushes the fact that does answer something off a
        phone screen.

        ``bounds`` is the reader's plan, the whole plan when not given. The
        entry opens where it opens. When that is before the call — the
        departure, or for a singer who joins on site the acoustic rehearsal the
        evening before — the first row names what happens then, so an entry
        that opens at 14:00 on Saturday says what 14:00 is. The downbeat is
        stated whenever the entry opens before it, rather than left for the
        reader to infer from an event that has already begun.
        """
        if bounds is None:
            bounds = project.plan_bounds(include_travellers_only=True)
        rows: list[tuple[str, str]] = []

        event_local = localize(project.date_time, project.timezone)
        concert_date = event_local.date()
        if bounds is not None and bounds.opens_before_call:
            rows.append((_('Plan starts'), _plan_moment_line(project, bounds.first)))
        if bounds is not None and bounds.start < project.date_time:
            # Named by kind, because "Koncert 18:00" inside a wedding Mass's
            # entry is the one line the reader would act on. Dated when the
            # entry opens on another day: a bare hour reads as that first day's.
            downbeat = event_local.strftime('%H:%M')
            if bounds.start.date() != concert_date:
                downbeat = f"{concert_date.strftime(DATE_FORMAT)} {downbeat}"
            rows.append((event_moment_label(project.event_kind), downbeat))

        # A window off concert day states its date: a bare "19:15" inside an
        # entry reads as concert day's evening.
        windows = project.day_windows()
        for label, value in (
            (_window_label('warmup'), format_day_window(windows['warmup'], concert_date)),
            (
                _window_label('soundcheck'),
                format_day_window(windows['soundcheck'], concert_date),
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
    def _calendar_preamble(cls, name: str = CALENDAR_NAME) -> list[str]:
        """The VCALENDAR header every subscribed feed shares.

        It used to be typed out twice and the copies disagreed: the empty feed
        carried no name at all, so a member with nothing scheduled yet — or an
        account with no artist profile behind it — got a calendar labelled with
        the entire subscription URL, token included, sitting in their phone's
        calendar list.

        `NAME` is the RFC 7986 property; `X-WR-CALNAME` is the older X-property
        that Apple, Google and Outlook actually read. Both are emitted because
        neither alone covers the clients members use. The season feed passes a
        name of its own, or a manager subscribed to both would find two
        calendars called the same in their list.
        """
        name = cls._escape_ics_text(name)
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
    def _build_ics(
        cls,
        projects,
        rehearsals,
        *,
        on_site_project_ids: Collection[UUID] = frozenset(),
        name: str = CALENDAR_NAME,
    ) -> str:
        """The feed itself. A project whose id is in ``on_site_project_ids`` is
        read by a singer who joins on site, so its entry skips the travelling
        party's points: it opens where that singer is first due and ends at
        their last planned moment."""
        lines = cls._calendar_preamble(name)

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
            # The rehearsal's plan is deliberately NOT here. A subscribed
            # calendar refreshes a feed every few hours and keeps what it last
            # read, so a plan pasted into the description would be stale
            # exactly when somebody opens the event to read it. The VEVENT
            # states the evening's own window; the plan, and the reader's part
            # of it, live on the rehearsal page the reminder links to.
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
            # The entry spans the reader's own plan: from the first moment they
            # are due at (the departure, for a traveller) to its last planned
            # moment, never shorter than the concert's reservation.
            bounds = proj.plan_bounds(
                include_travellers_only=proj.id not in on_site_project_ids
            )
            start_time, end_time = proj.calendar_span(bounds)

            title = cls._escape_ics_text(
                f"[{event_moment_label(proj.event_kind)}] {proj.title}"
            )
            location = cls._escape_ics_text(proj.location.name if proj.location else "")
            description = cls._escape_ics_text(cls._project_description(proj, bounds))

            lines.extend([
                "BEGIN:VEVENT",
                f"UID:project_{proj.id}@voctensemble.com",
                f"DTSTAMP:{now_utc}",
                # The plan's moments are in the project's zone; the feed is UTC.
                f"DTSTART:{start_time.astimezone(UTC).strftime('%Y%m%dT%H%M%SZ')}",
                f"DTEND:{end_time.astimezone(UTC).strftime('%Y%m%dT%H%M%SZ')}",
                f"SUMMARY:{title}",
                f"LOCATION:{location}",
                f"DESCRIPTION:{description}",
                "END:VEVENT"
            ])

        lines.append("END:VCALENDAR")
        return cls._render(lines)

    @classmethod
    def _generate_empty_ics(cls, name: str = CALENDAR_NAME) -> str:
        """A calendar with no events is still a calendar the member sees named
        in their list, so it carries the same identity as a full one."""
        return cls._render([*cls._calendar_preamble(name), "END:VCALENDAR"])