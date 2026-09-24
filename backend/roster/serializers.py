# roster/serializers.py
# ==========================================
# Roster API Serializers
# Standard: Enterprise SaaS 2026
# ==========================================
"""
REST API Serializers for the Roster application.
Handles pure data transformation (Object <-> JSON). 
Delegates role-based data exposure to explicitly defined serializers routed via ViewSets.
"""
import zoneinfo
from datetime import date, timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from archive.services.voice_scope import voice_scope
from core.permissions import user_is_manager
from core.serializers import UserProfileSerializer
from core.voice_labels import voice_line_label
from logistics.models import Location
from roster.domain.day_timeline import localize
from roster.domain.liturgy import (
    ProgramItemPresentation,
    build_program_presentation,
)
from roster.domain.rehearsal_plan import EffectiveClock, row_done, window_payload
from roster.domain.solo_duties import is_legacy_solo

from .dtos import validate_instrument
from .models import (
    Artist,
    Attendance,
    Collaborator,
    CrewAssignment,
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    ProjectSoloAssignment,
    Rehearsal,
    RehearsalDelegate,
    RehearsalPlanItem,
    VoiceType,
)
from .permissions import live_delegate_q
from .queries.plan_queries import PlanReading, plan_row_context


def refuse_moving(instance: Any, attrs: dict[str, Any], fields: tuple[str, ...]) -> None:
    """A seat or a crew booking is one person's place on one project, and the
    fee ledger keys that person's pay on it. Moved to another person or
    project, it would carry a paid or contracted fee along, and the next edit
    would rename the payee. An existing one keeps both; a change of person is
    a removal and a new booking."""
    if instance is None:
        return
    moved = sorted(name for name in fields if name in attrs and getattr(instance, name) != attrs[name])
    if moved:
        message = _("An existing booking keeps its person and project; remove it and add a new one.")
        raise serializers.ValidationError({name: message for name in moved})


# --- 1. ARTIST SERIALIZERS ---

class ArtistBasicSerializer(serializers.ModelSerializer):
    """
    Publicly safe Artist entity. 
    Strips all sensitive contact, HR, and financial data.
    """
    # Enterprise RBAC: Expose business role, not DB admin status
    is_manager = serializers.BooleanField(source='user.profile.is_manager', read_only=True)
    voice_type_display = serializers.CharField(source='get_voice_type_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    avatar_thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = Artist
        exclude = (
            'sight_reading_skill',
            'vocal_range_bottom',
            'vocal_range_top',
            'phone_number',
            'email'
        )

    def get_avatar_thumb_url(self, obj: Artist) -> str | None:
        """Small avatar render for roster cards/rows; null when unset or no account."""
        profile = getattr(getattr(obj, 'user', None), 'profile', None)
        thumb = getattr(profile, 'avatar_thumb', None)
        if not thumb:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(thumb.url) if request else thumb.url
        
class ArtistMeSerializer(serializers.ModelSerializer):
    """
    Self-profile view for the artist.
    Exposes personal contact info, but safely maps nested profile data.
    """
    is_manager = serializers.BooleanField(source='user.profile.is_manager', read_only=True)
    voice_type_display = serializers.CharField(source='get_voice_type_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    profile = UserProfileSerializer(source='user.profile', read_only=True)
    # Read-through from the account profile (see Artist.first_name_vocative).
    # Declared because it is no longer a column here; kept flat because the
    # dashboards greet with it and read it at this level.
    first_name_vocative = serializers.CharField(read_only=True)

    class Meta:
        model = Artist
        exclude = (
            'sight_reading_skill',
            'vocal_range_bottom',
            'vocal_range_top'
        )

class ArtistDetailedSerializer(ArtistBasicSerializer):
    """
    Highly privileged Artist entity exclusively for Managers and HR.
    Exposes all operational and capability fields.

    Fields are enumerated rather than pulled in wholesale, because the model
    carries lifecycle state that is only correct when a service moves it:
    `is_deleted` and `is_active` belong to archive/restore (which also revoke or
    restore the login in the same transaction), `user` is the identity link
    itself, and `activation_email_sent_at` is the trail of a dispatch that
    actually happened. All are readable here; none may be written through the
    generic PATCH, which would otherwise bypass those guarantees entirely.
    """
    account_activated = serializers.SerializerMethodField()
    activation_link_expired = serializers.SerializerMethodField()
    is_project_leader = serializers.SerializerMethodField()
    # Stored on the account's profile, edited from the roster form. Declared
    # rather than inferred, because the model side is a read-through property;
    # `ArtistHRService.update_artist` is what routes a write to its real owner.
    first_name_vocative = serializers.CharField(
        required=False, allow_blank=True, max_length=150
    )

    class Meta:
        model = Artist
        fields = (
            # Record identity
            'id', 'created_at', 'updated_at', 'is_deleted',

            # Linked account
            'user', 'username', 'is_manager',

            # PII / contact
            'first_name', 'last_name', 'first_name_vocative',
            'email', 'phone_number', 'avatar_thumb_url',

            # Musical capability
            'voice_type', 'voice_type_display', 'instrument',
            'sight_reading_skill', 'vocal_range_bottom', 'vocal_range_top',

            # Roster standing
            'is_active', 'is_project_leader',

            # Onboarding state
            'activation_email_sent_at', 'account_activated', 'activation_link_expired',
        )
        read_only_fields = (
            'id', 'created_at', 'updated_at', 'is_deleted',
            'user', 'is_active', 'activation_email_sent_at',
        )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """The instrument rule on the PATCH path. A partial update may carry
        either field alone, so the missing one is read from the row; the create
        path applies the same rule in `ArtistCreateDTO`."""
        attrs = super().validate(attrs)
        instance = self.instance
        voice_type = attrs.get(
            'voice_type', instance.voice_type if instance is not None else None
        )
        if voice_type is None:
            return attrs
        instrument = attrs.get(
            'instrument', instance.instrument if instance is not None else ''
        )
        # A voice-type change away from INS leaves a stale instrument on the
        # row. That is not the client's mistake, so it is cleared in the same
        # write; an instrument the client SENT for a singer is, and is refused.
        if (
            voice_type != VoiceType.INSTRUMENTALIST
            and instrument
            and 'instrument' not in attrs
        ):
            attrs['instrument'] = instrument = ''
        try:
            validate_instrument(voice_type, instrument)
        except ValueError as exc:
            raise serializers.ValidationError({'instrument': str(exc)}) from exc
        return attrs

    def get_account_activated(self, obj: Artist) -> bool:
        """True once the invited member has set their password (finished
        activation). A usable password is the durable, unambiguous marker —
        unlike ``user.is_active``, it is not cleared when an artist is archived,
        so it never mistakes an archived-but-activated singer for a pending one.
        False both for a still-open invitation and for an account that was
        detached (GDPR erasure SET_NULLs ``user``)."""
        user = getattr(obj, 'user', None)
        return bool(user and user.has_usable_password())

    def get_activation_link_expired(self, obj: Artist) -> bool:
        """True when the most recently sent invite's signed link has passed its
        validity window, so the roster can flag that a *resend* is required (the
        old link is dead). Authoritative: the token is minted from
        ``default_token_generator`` and expires after ``PASSWORD_RESET_TIMEOUT``,
        and ``activation_email_sent_at`` is stamped in the same breath the token
        is generated — so ``now - sent_at > timeout`` tracks the live link.

        Only meaningful for a pending account: returns False for an activated or
        detached one (expiry is irrelevant there) and when no send was recorded."""
        user = getattr(obj, 'user', None)
        if not user or user.has_usable_password() or obj.activation_email_sent_at is None:
            return False
        timeout = getattr(settings, 'PASSWORD_RESET_TIMEOUT', 60 * 60 * 24 * 3)
        return timezone.now() > obj.activation_email_sent_at + timedelta(seconds=timeout)

    def get_is_project_leader(self, obj: Artist) -> bool:
        """Assists on at least one open project right now — the roster's
        "Asystent" badge. The list annotates it (`ArtistViewSet.get_queryset`); an instance
        that arrived another way (the PATCH response) asks the database with
        the same predicate, so saving a profile cannot switch the badge off."""
        annotated = getattr(obj, 'is_project_leader', None)
        if annotated is not None:
            return bool(annotated)
        return (
            RehearsalDelegate.objects
            .filter(live_delegate_q(scope='any'), artist=obj)
            .exclude(project__status__in=Project.CLOSED_STATUSES)
            .exists()
        )


# --- 2. PARTICIPATION SERIALIZERS ---

# The same rule as the model's `unique_active_project_participation` constraint —
# one live seat per artist per project — stated as a filtered queryset rather than
# left to DRF's constraint discovery. Discovery reads the CONDITION's fields
# (`is_deleted`) straight out of the payload, which no client sends, so every
# partial update of a seat died with a KeyError before it reached the view. A
# queryset needs nothing from the payload, and still lets a soft-deleted seat be
# re-created instead of being reported as a duplicate.
PARTICIPATION_UNIQUENESS = [
    UniqueTogetherValidator(
        queryset=Participation.objects.filter(is_deleted=False),
        fields=('artist', 'project'),
    )
]


class ParticipationSerializer(serializers.ModelSerializer):
    """
    One seat in a project's cast, the same for a manager and for the singer who
    holds it. It carries no money: fees, payments and contracts live in the
    finance ledger, which is manager-only and never embedded in roster payloads.
    """
    artist_name = serializers.CharField(source='artist.__str__', read_only=True)
    project_name = serializers.CharField(source='project.title', read_only=True)
    # The raw code beside the label: the client's "who is called to this
    # rehearsal" rule (`resolveInvited`) keys on it, and a localized label is
    # not a key.
    artist_voice_type = serializers.CharField(source='artist.voice_type', read_only=True)
    artist_voice_type_display = serializers.CharField(source='artist.get_voice_type_display', read_only=True)

    class Meta:
        model = Participation
        fields = '__all__'
        validators = PARTICIPATION_UNIQUENESS

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)
        refuse_moving(self.instance, attrs, ('artist', 'project'))
        return attrs

# --- 3. PROJECT & REHEARSAL SERIALIZERS ---

class LocationSnippetSerializer(serializers.Serializer):
    """Minimal representation of Location for read operations."""
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    category = serializers.CharField(read_only=True)
    timezone = serializers.CharField(read_only=True)

class ProjectSerializer(serializers.ModelSerializer):
    """
    Serializes the central Project entity.
    Injects lightweight relational payloads (cast, program) to minimize frontend requests.
    """
    cast = serializers.SerializerMethodField()
    program = serializers.SerializerMethodField()
    leaders = serializers.SerializerMethodField()
    location = LocationSnippetSerializer(read_only=True)
    location_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    conductor_name = serializers.CharField(source='conductor.__str__', read_only=True)
    score_pdf = serializers.SerializerMethodField()
    has_unannounced_changes = serializers.SerializerMethodField()
    rehearsals_total = serializers.IntegerField(read_only=True, default=0)
    rehearsals_upcoming = serializers.IntegerField(read_only=True, default=0)
    cast_total = serializers.IntegerField(read_only=True, default=0)
    cast_confirmed = serializers.IntegerField(read_only=True, default=0)
    cast_pending = serializers.IntegerField(read_only=True, default=0)
    cast_declined = serializers.IntegerField(read_only=True, default=0)
    crew_total = serializers.IntegerField(read_only=True, default=0)
    pieces_total = serializers.IntegerField(read_only=True, default=0)
    
    class Meta:
        model = Project
        fields = '__all__'

    def get_score_pdf(self, obj) -> str | None:
        """
        The concert score is delivered through the authenticated, status-aware
        `score_pdf` action — never a bare /media/ link. It is withheld from
        choristers once the project is completed or cancelled (the score is the
        conductor's property), while managers retain access unconditionally.
        """
        if not obj.score_pdf:
            return None
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user_is_manager(user) and obj.status in (Project.Status.COMPLETED, Project.Status.CANCELLED):
            return None
        url = f"/api/projects/{obj.pk}/score_pdf/"
        return request.build_absolute_uri(url) if request else url

    def get_has_unannounced_changes(self, obj) -> bool:
        """Whether this project is holding changes the cast has not been told about.

        Deliberately a flag and not a count: the review sheet counts *changes* after
        collapsing, while anything cheap enough for a list query can only see rows —
        and a dashboard badge reading "3" beside a sheet listing one would be a small
        lie told on every page load.

        Withheld from artists, which settles the plan's open question about marking
        unannounced-but-saved data on their side: the database is the truth and the
        app always shows it, so a badge saying "this is not official yet" would
        invite them to distrust what they can plainly see. The annotation is only
        added for managers; this check is what makes that a contract rather than a
        detail of one queryset branch.
        """
        if not user_is_manager(getattr(self.context.get('request'), 'user', None)):
            return False
        return bool(getattr(obj, 'has_pending_announcements', False))

    def get_leaders(self, obj) -> list[dict]:
        """Who leads this project — the live `RehearsalDelegate` rows, name and
        id only. A fact for the card beside "Conductor", not a permission: the
        scopes stay on the manager's own list.

        `ProjectViewSet.get_queryset` prefetches the rows as `live_leaders`; an
        instance that arrived another way (the create/update response) asks the
        database with the same predicate, so both paths name the same people.
        """
        rows = getattr(obj, 'live_leaders', None)
        if rows is None:
            rows = list(
                RehearsalDelegate.objects
                .filter(live_delegate_q(scope='any'), project=obj)
                .select_related('artist')
                .order_by('created_at')
            )
        # The bare name, as everywhere somebody is named as leading: the voice
        # they sing is a fact about their seat, not about the appointment.
        return [
            {
                'artist_id': str(row.artist_id),
                'name': f"{row.artist.first_name} {row.artist.last_name}".strip(),
            }
            for row in rows
        ]

    def get_cast(self, obj) -> list[dict]:
        """Returns non-sensitive casting snapshot."""
        # QuerySet prefetching ensures this does not trigger N+1
        participations = obj.participations.all()
        return [
            {
                'id': p.artist.id,
                'first_name': p.artist.first_name,
                'last_name': p.artist.last_name,
                'voice_type': p.artist.voice_type,
                'voice_type_display': p.artist.get_voice_type_display(),
                'instrument': p.artist.instrument,
            }
            for p in participations
        ]
    
    def validate_timezone(self, value: str) -> str:
        """
        Safely validates the timezone string against the server's IANA database.
        Prevents OS-dependent database constraints failure.
        """
        if value not in zoneinfo.available_timezones():
            raise serializers.ValidationError(
                f"Timezone '{value}' is not recognized by the server's tzdata."
            )
        return value
    
    def get_program(self, obj) -> list[dict]:
        """Returns ordered setlist configuration.

        Carries the liturgical labels because this snippet is what the overview
        widget and the singer's card read — a Mass whose order of service is
        visible only in the score-book PDF is the defect this feature exists to
        close.
        """
        items = list(obj.program_items.all())
        presentations = build_program_presentation(items)
        return [
            {
                'order': item.order,
                'piece_id': item.piece.id,
                'title': item.piece.title,
                'is_encore': item.is_encore,
                'liturgical_slot': item.liturgical_slot,
                'slot_label': presentation.slot_label,
                'section': presentation.section,
                # Which arrangement this item binds. Null = auto-select. The
                # overview's fulfilment counter needs it: a piece published in
                # unison and in three parts declares two divisi, and scoring a
                # concert against both reports it short of seats it never had.
                'score_edition': str(item.score_edition_id) if item.score_edition_id else None,
            }
            for item, presentation in zip(items, presentations, strict=True)
        ]


class RehearsalPlanItemSerializer(serializers.ModelSerializer):
    """One row of the plan, read-only: the plan is written whole through
    `RehearsalPlanDTO`, and the debrief verdict through its own door. Reads
    `piece`, so the rows must be prefetched with it.

    `done` is the one answer to "was it worked on" (`row_done`) and every
    client reads it rather than the stamps. It depends on whether the evening
    is over, which is one fact per rehearsal: the caller computes it once and
    passes `plan_over` in the context, so a list of rows never reaches back
    to its rehearsal row by row.

    `clock` is the row's effective clock (`effective_clocks`) and
    `clock_derived` whether it follows from minutes rather than an anchor;
    `starts_at` stays the raw anchor the editor writes back. A clock depends
    on every row above it, so the caller passes `plan_clocks` computed over
    the whole plan (`plan_row_context`)."""

    piece_title = serializers.SerializerMethodField()
    title = serializers.CharField(read_only=True)
    # A wall clock, in the rehearsal's zone, in the shape the run sheet uses.
    starts_at = serializers.TimeField(format='%H:%M', read_only=True, allow_null=True)
    clock = serializers.SerializerMethodField()
    clock_derived = serializers.SerializerMethodField()
    done = serializers.SerializerMethodField()

    class Meta:
        model = RehearsalPlanItem
        fields = (
            'id',
            'position',
            'piece',
            'piece_title',
            'label',
            'title',
            'note',
            'starts_at',
            'minutes',
            'clock',
            'clock_derived',
            'excluded_voice_lines',
            'excludes_instrumentalists',
            'is_reserve',
            'is_break',
            'done',
            'done_at',
            'skipped_at',
            'updated_at',
        )
        read_only_fields = fields

    def get_piece_title(self, obj: RehearsalPlanItem) -> str | None:
        return str(obj.piece.title) if obj.piece_id and obj.piece else None

    def _clock(self, obj: RehearsalPlanItem) -> EffectiveClock | None:
        clocks = self.context.get('plan_clocks') or {}
        entry = clocks.get(obj.id)
        return entry if isinstance(entry, EffectiveClock) else None

    def get_clock(self, obj: RehearsalPlanItem) -> str | None:
        entry = self._clock(obj)
        return entry.clock.strftime('%H:%M') if entry and entry.clock else None

    def get_clock_derived(self, obj: RehearsalPlanItem) -> bool:
        entry = self._clock(obj)
        return bool(entry and entry.derived)

    def get_done(self, obj: RehearsalPlanItem) -> bool | None:
        return row_done(
            ticked=obj.done_at is not None,
            skipped=obj.skipped_at is not None,
            is_reserve=obj.is_reserve,
            is_break=obj.is_break,
            over=bool(self.context.get('plan_over')),
        )


class RehearsalSerializer(serializers.ModelSerializer):
    """
    Serializes Rehearsal schedules.
    ENTERPRISE NOTE: 'absent_count' is now expected to be pre-annotated by the DB
    via the QuerySet to prevent N+1 serialization bottlenecks.
    """
    absent_count = serializers.IntegerField(read_only=True, default=0)
    # The plan, in order, for every reader once it is public
    # (`Rehearsal.plan_is_public`); before that only for the conductor's side,
    # and everybody else reads `[]` and no window — see `_plan_shown`. The
    # per-reader answers (`plan[].calls_me`, `my_plan_window`) appear only when
    # the view computed them for this reader (`plan_readings` in the context:
    # the schedule dashboard and the single-rehearsal read); elsewhere they
    # are null, never guessed.
    plan = serializers.SerializerMethodField()
    my_plan_window = serializers.SerializerMethodField()
    location = LocationSnippetSerializer(read_only=True)
    # The programme this evening belongs to, by name. A rehearsal read on its
    # own — the chorister's page, opened from a push — has no list around it to
    # borrow the title from, and "Próba" with no programme names nothing.
    project_title = serializers.CharField(source='project.title', read_only=True)
    # Derived here rather than in each client: the length is what is stored, and
    # a panel that added minutes to the start on its own would be a second place
    # able to disagree with the calendar export about when the evening ends.
    end_date_time = serializers.DateTimeField(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(
        source='project',
        queryset=Project.objects.all(),
        write_only=True,
        required=False,
    )
    location_id = serializers.PrimaryKeyRelatedField(
        source='location',
        queryset=Location.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    # Who stands in front of the choir. Written as an id, read back as an id
    # and a name so a row can say "Prowadzi: X" without an artist lookup; null
    # on both sides means the project's conductor.
    led_by_id = serializers.PrimaryKeyRelatedField(
        source='led_by',
        queryset=Artist.objects.filter(is_deleted=False),
        write_only=True,
        required=False,
        allow_null=True,
    )
    led_by_artist_id = serializers.UUIDField(
        source='led_by_id', read_only=True, allow_null=True,
    )
    led_by_name = serializers.SerializerMethodField()
    # The evening handed back. Read-only here: the only write door is the
    # lead sheet's PATCH, which stamps the author and the time itself. Withheld
    # from a singer by `to_representation` — see there.
    debrief_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Rehearsal
        fields = (
            'id',
            'created_at',
            'updated_at',
            'is_deleted',
            'project',
            'project_id',
            'project_title',
            'date_time',
            'duration_minutes',
            'end_date_time',
            'timezone',
            'location',
            'location_id',
            'focus',
            'is_mandatory',
            'calls_instrumentalists',
            'called_sections',
            'invited_participations',
            'led_by_id',
            'led_by_artist_id',
            'led_by_name',
            'debrief',
            'debrief_by_name',
            'debrief_at',
            'plan',
            'plan_announced_at',
            'plan_changed_at',
            'my_plan_window',
            'absent_count',
        )
        read_only_fields = (
            'id',
            'created_at',
            'updated_at',
            'is_deleted',
            'project',
            'project_title',
            'location',
            'end_date_time',
            'debrief',
            'debrief_at',
            'plan_announced_at',
            'plan_changed_at',
            'absent_count',
        )

    #: Fields of the report the leader writes after the evening. Manager-facing:
    #: the text is candid about how a section sang and who was missing, so it
    #: travels only to a reader who is entitled to that account.
    DEBRIEF_FIELDS = ('debrief', 'debrief_by_name', 'debrief_at')

    def to_representation(self, instance: Rehearsal) -> dict[str, Any]:
        """Drop the debrief for a reader it was not written for.

        The rehearsal list is served to singers as well as managers (see
        `RehearsalViewSet.get_queryset`), and a report saying the tenors
        dragged is not a fact about the evening the way its hour is. The lead
        sheet says `show_debrief` because the reader there has already passed
        the `roll_call` gate — that is how a leader reads back their own text.
        """
        data = super().to_representation(instance)
        if self.context.get('show_debrief'):
            return data
        if user_is_manager(getattr(self.context.get('request'), 'user', None)):
            return data
        for field in self.DEBRIEF_FIELDS:
            data.pop(field, None)
        return data

    def _plan_reading(self, obj: Rehearsal) -> PlanReading | None:
        readings = self.context.get('plan_readings')
        if not isinstance(readings, dict):
            return None
        reading = readings.get(obj.id)
        return reading if isinstance(reading, PlanReading) else None

    def _plan_shown(self, obj: Rehearsal) -> bool:
        """The publish gate for this read. A draft is shown to the
        conductor's side only, and whose view it is comes from the view:
        `plan_drafts_visible` in the context — false for a manager previewing
        a member, whose read must be the member's; true on the lead sheet.
        Without it (the plain rehearsal list), a manager sees drafts and a
        member does not."""
        drafts_visible = self.context.get('plan_drafts_visible')
        if drafts_visible is None:
            drafts_visible = user_is_manager(getattr(self.context.get('request'), 'user', None))
        return bool(drafts_visible) or obj.plan_is_public()

    def get_plan(self, obj: Rehearsal) -> list[dict[str, Any]]:
        if not self._plan_shown(obj):
            return []
        items = list(obj.plan_items.all())
        rows = RehearsalPlanItemSerializer(
            items, many=True, context=plan_row_context(obj, items),
        ).data
        reading = self._plan_reading(obj)
        for index, row in enumerate(rows):
            row['calls_me'] = (
                reading.calls[index]
                if reading is not None and index < len(reading.calls)
                else None
            )
            # Whether the row's music opens for this reader — false for an
            # instrumental item read through a singer's seat. Null when not
            # computed, and a client then links as before: the readers without
            # a reading (a manager, a stand-in) are the ones nothing is
            # withheld from.
            row['piece_open'] = (
                reading.opens[index]
                if reading is not None and index < len(reading.opens)
                else None
            )
        return list(rows)

    def get_my_plan_window(self, obj: Rehearsal) -> dict[str, Any] | None:
        reading = self._plan_reading(obj)
        if reading is None or not self._plan_shown(obj):
            return None
        return window_payload(reading.window)

    def get_led_by_name(self, obj: Rehearsal) -> str | None:
        # The bare name, as for `debrief_by_name`: this line names whoever
        # stands in front of the choir, and the voice they sing when they are
        # not standing there is noise on every card that renders it.
        if not (obj.led_by_id and obj.led_by):
            return None
        return f"{obj.led_by.first_name} {obj.led_by.last_name}".strip()

    def get_debrief_by_name(self, obj: Rehearsal) -> str | None:
        # The bare name: a signature under a paragraph, where the voice in
        # brackets would read as a credit rather than an author.
        if not (obj.debrief_by_id and obj.debrief_by):
            return None
        return f"{obj.debrief_by.first_name} {obj.debrief_by.last_name}".strip()

    @staticmethod
    def _may_lead(artist: Artist, project: Project) -> bool:
        """Only somebody who may actually run the evening can be named as
        running it: the project's conductor, or an artist holding a live
        leader grant with the roll call on this project. Naming anyone else
        would announce a leader the register then refuses. A direct row filter
        rather than `led_projects_q` — the row has the artist, no user hop —
        with the same closed-project exclusion every other gate applies, so a
        grant does not outlive the concert here alone."""
        if project.conductor_id == artist.pk:
            return True
        return (
            RehearsalDelegate.objects
            .filter(live_delegate_q(scope='roll_call'), project=project, artist=artist)
            .exclude(project__status__in=Project.CLOSED_STATUSES)
            .exists()
        )

    def validate_timezone(self, value: str) -> str:
        """
        Safely validates the timezone string against the server's IANA database.
        Prevents OS-dependent database constraints failure.
        """
        if value not in zoneinfo.available_timezones():
            raise serializers.ValidationError(
                f"Timezone '{value}' is not recognized by the server's tzdata."
            )
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if self.instance is None and 'project' not in attrs:
            raise serializers.ValidationError({
                'project_id': ['This field is required.']
            })

        led_by = attrs.get('led_by')
        # An unchanged value announces nothing, so it is not re-judged: the rule
        # is "you may not NAME somebody who cannot lead", not "an evening whose
        # leader's grant has since run out can never be edited again". The form
        # re-sends this field on every save, and judging it there would leave a
        # rehearsal unmovable with no way out of it on screen.
        is_unchanged = (
            self.instance is not None
            and led_by is not None
            and self.instance.led_by_id == led_by.pk
        )
        if led_by is not None and not is_unchanged:
            project = attrs.get('project')
            if project is None and self.instance is not None:
                project = self.instance.project
            if project is not None and not self._may_lead(led_by, project):
                raise serializers.ValidationError({
                    'led_by_id': [
                        "This person is neither the conductor nor a leader of "
                        "the project with the roll call."
                    ]
                })

        return attrs

class AnnouncementPublishSerializer(serializers.Serializer):
    """Validates the payload that publishes a project's announcement queue.

    The note is the conductor's own words alongside the changes — the one part of
    a briefing nothing else can compose. Its presence also forces the fold: a note
    is addressed to the reader, so it belongs in a briefing even when there is
    only one change to report.

    `exclude` holds rows back rather than dropping them: an unticked line stays in
    the queue and turns up in the next review, collapsed against anything that has
    happened to it since. Discarding is a separate, explicit verb.
    """
    note = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=True, max_length=2000,
    )
    exclude = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True,
    )


# --- 4. RELATIONAL & JUNCTION SERIALIZERS ---

class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = '__all__'

# Fallback for a row deleted between the queryset read and the presentation load
# in a concurrent session: the response still serializes, simply without labels.
_BLANK_PRESENTATION = ProgramItemPresentation(
    slot='', slot_label='', section='', role_prefix='', rank=None,
)


class ProgramItemSerializer(serializers.ModelSerializer):
    """One setlist row, plus the liturgical labels resolved against its siblings.

    The three derived fields are read-only: what prints is `override or derived`,
    and only the override is writable. They are computed per project rather than
    per row because numbering a repeated slot ("Na Komunię 2") is a fact about the
    whole programme — the same reason `roster.domain.liturgy` exists at all.
    """

    piece_title = serializers.CharField(source='piece.title', read_only=True)
    slot_label = serializers.SerializerMethodField()
    section = serializers.SerializerMethodField()
    role_prefix_effective = serializers.SerializerMethodField()
    rehearsed_count = serializers.SerializerMethodField()
    last_rehearsed_on = serializers.SerializerMethodField()

    class Meta:
        model = ProgramItem
        fields = '__all__'

    def _presentation(self, item: ProgramItem) -> ProgramItemPresentation:
        """Resolved labels for one item, memoized per project on the serializer
        instance — `many=True` reuses one child, so a whole setlist costs one
        extra query.

        Loads the project's programme in full rather than reusing the view's
        queryset on purpose: a filtered or paginated read still has to number a
        repeated slot against every sibling, not against the ones that survived
        the filter.
        """
        cache: dict[Any, dict[Any, ProgramItemPresentation]]
        cache = getattr(self, '_liturgy_presentations', None) or {}
        self._liturgy_presentations = cache
        if item.project_id not in cache:
            siblings = list(
                ProgramItem.objects.filter(project_id=item.project_id).order_by('order')
            )
            cache[item.project_id] = dict(
                zip(
                    (sibling.pk for sibling in siblings),
                    build_program_presentation(siblings),
                    strict=True,
                )
            )
        return cache[item.project_id].get(item.pk, _BLANK_PRESENTATION)

    def get_slot_label(self, obj: ProgramItem) -> str:
        return self._presentation(obj).slot_label

    def get_section(self, obj: ProgramItem) -> str:
        return self._presentation(obj).section

    def get_role_prefix_effective(self, obj: ProgramItem) -> str:
        return self._presentation(obj).role_prefix

    def _rehearsed(self, item: ProgramItem) -> dict[Any, tuple[int, date]] | None:
        """On how many evenings each piece of this programme was actually
        worked on, and the last of them — memoized per project like the
        liturgical labels above, two queries for a whole setlist.

        Read off `row_done`, never off the stamps: an evening that ended
        without a debrief counts its main rows as done, as the plan said. A
        piece counts once per EVENING — worked in the sectional slot and again
        in the tutti is one rehearsal of it, not two. Breaks never count.

        ``None`` while no row of the project has a verdict yet — no evening
        with a plan is over and nothing was ticked: until then every piece
        stands at zero, and a setlist of "nie ćwiczone" says nothing about the
        programme. From the first verdict on, the zero is the point — it is
        the piece nobody has touched a week before the concert.

        Dated by the REHEARSAL, not by the tick: a conductor who writes the
        debrief on Sunday still rehearsed the piece on Wednesday, and the
        caption is read as "when we last sang it".
        """
        cache: dict[Any, dict[Any, tuple[int, date]] | None]
        cache = getattr(self, '_rehearsed_counts', None) or {}
        self._rehearsed_counts = cache
        if item.project_id not in cache:
            now = timezone.now()
            # Per evening: is it over, and on which local day did it happen.
            held: dict[Any, tuple[bool, date | None]] = {}
            for rehearsal in Rehearsal.objects.filter(
                project_id=item.project_id, is_deleted=False,
            ):
                local = localize(rehearsal.date_time, rehearsal.timezone)
                held[rehearsal.id] = (
                    rehearsal.is_over(now), local.date() if local is not None else None,
                )
            evenings: dict[Any, set[Any]] = {}
            last_on: dict[Any, date] = {}
            verdicts = False
            rows = RehearsalPlanItem.objects.filter(
                rehearsal_id__in=held.keys(), is_break=False,
            ).values_list('piece_id', 'is_reserve', 'done_at', 'skipped_at', 'rehearsal_id')
            for piece_id, is_reserve, done_at, skipped_at, rehearsal_id in rows:
                over, on = held[rehearsal_id]
                done = row_done(
                    ticked=done_at is not None,
                    skipped=skipped_at is not None,
                    is_reserve=is_reserve,
                    is_break=False,
                    over=over,
                )
                if done is None:
                    continue
                verdicts = True
                if not done or not piece_id or on is None:
                    continue
                evenings.setdefault(piece_id, set()).add(rehearsal_id)
                last_on[piece_id] = max(last_on.get(piece_id, on), on)
            cache[item.project_id] = (
                {
                    piece_id: (len(ids), last_on[piece_id])
                    for piece_id, ids in evenings.items()
                }
                if verdicts
                else None
            )
        return cache[item.project_id]

    def get_rehearsed_count(self, obj: ProgramItem) -> int | None:
        tallies = self._rehearsed(obj)
        if tallies is None:
            return None
        entry = tallies.get(obj.piece_id)
        return entry[0] if entry else 0

    def get_last_rehearsed_on(self, obj: ProgramItem) -> str | None:
        tallies = self._rehearsed(obj)
        if tallies is None:
            return None
        entry = tallies.get(obj.piece_id)
        return entry[1].isoformat() if entry else None

class ProjectPieceCastingSerializer(serializers.ModelSerializer):
    voice_line_display = serializers.SerializerMethodField()
    artist_name = serializers.SerializerMethodField()
    project_id = serializers.SerializerMethodField()
    artist_id = serializers.SerializerMethodField()
    is_legacy_solo = serializers.SerializerMethodField()

    class Meta:
        model = ProjectPieceCasting
        fields = '__all__'

    def get_voice_line_display(self, obj) -> str:
        """The seat's name as read on THIS piece: an undivided family drops its
        index, so a piece with one tenor line casts "Tenor", not "Tenor 1".

        The scope comes from the bound arrangement's divisi plus every seat
        already filled on the piece — both primed by
        [ProjectPieceCastingViewSet.get_serializer_context]. Without that
        context (a bare detail read) the piece-wide divisi still names it."""
        edition_id = self.context.get('bound_edition_by_piece', {}).get(obj.piece_id)
        cast_codes = self.context.get('cast_codes_by_piece', {}).get(obj.piece_id, ())
        return voice_line_label(
            obj.voice_line,
            voice_scope(
                list(obj.piece.voice_requirements.all()),
                edition_id,
                extra_codes=[obj.voice_line, *cast_codes],
            ),
        )

    def get_artist_name(self, obj) -> str:
        return f"{obj.participation.artist.first_name} {obj.participation.artist.last_name}"

    def get_project_id(self, obj) -> str:
        return str(obj.participation.project_id)
    
    def get_artist_id(self, obj) -> str:
        return str(obj.participation.artist_id)

    def get_is_legacy_solo(self, obj) -> bool:
        return is_legacy_solo(obj)


class ProjectSoloAssignmentSerializer(serializers.ModelSerializer):
    artist_name = serializers.SerializerMethodField()
    reference_needs_review = serializers.SerializerMethodField()

    class Meta:
        model = ProjectSoloAssignment
        fields = '__all__'

    def get_artist_name(self, obj: ProjectSoloAssignment) -> str | None:
        participation = obj.participation
        if participation is None:
            return None
        return f'{participation.artist.first_name} {participation.artist.last_name}'

    def get_reference_needs_review(self, obj: ProjectSoloAssignment) -> bool:
        """A reference written against an edition other than the one now bound."""
        if not obj.score_reference:
            return False
        return any(
            edition_id != obj.reference_edition_id
            for edition_id in self.context.get('edition_ids_by_piece', {}).get(obj.piece_id, ())
        )


class CollaboratorBasicSerializer(serializers.ModelSerializer):
    """
    Collaborator without personal contact details. Surfaces the professional
    identity (name, company, specialty) any authenticated user may legitimately
    see, while `email` and `phone_number` stay manager-only PII — mirroring the
    Artist/CrewAssignment basic-vs-detailed split. Without this, every singer
    could enumerate the foundation's full external-crew address book.
    """
    specialty_display = serializers.CharField(source='get_specialty_display', read_only=True)

    class Meta:
        model = Collaborator
        exclude = ('email', 'phone_number')


class CollaboratorSerializer(CollaboratorBasicSerializer):
    """Privileged collaborator record (full contact PII) for managers/HR."""

    class Meta:
        model = Collaborator
        fields = '__all__'

    def to_internal_value(self, data: Any) -> Any:
        """Fold a blank e-mail into NULL, the column's single spelling of "absent".

        The crew form always sends a string, so an untouched field arrives as
        ''. Left alone it would be stored as a value — one that every further
        contactless crew member would then repeat. Duck-typed rather than
        isinstance'd on Mapping: a multipart payload is a QueryDict, whose
        `copy()` is what keeps the remaining keys intact."""
        if hasattr(data, 'get') and data.get('email') == '':
            data = data.copy()
            data['email'] = None
        return super().to_internal_value(data)

class CrewAssignmentSerializer(serializers.ModelSerializer):
    """
    One crew booking. Surfaces the collaborator's display name and specialty
    (non-sensitive) so any authenticated user can see who is on a project's
    team. It carries no money — the crew's fees live in the finance ledger.
    """
    collaborator_name = serializers.CharField(source='collaborator.__str__', read_only=True)
    collaborator_specialty_display = serializers.CharField(
        source='collaborator.get_specialty_display', read_only=True
    )

    class Meta:
        model = CrewAssignment
        fields = '__all__'

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        attrs = super().validate(attrs)
        refuse_moving(self.instance, attrs, ('collaborator', 'project'))
        return attrs


class RehearsalDelegateSerializer(serializers.ModelSerializer):
    """One leader of one project, as the manager's leaders list reads it.

    `project` and `granted_by` are stamped by the view from the URL and the
    request — a delegation that could name its own project in the body would let
    one project's editor hand out access to another's music.

    `expires_at` is the only tense the client may set. Whether the grant is still
    LIVE is not stored and not serialised: it is recomputed against the clock and
    the project's status on every read, by `led_projects_q`, so a row that looks
    active in a list the browser cached an hour ago still opens nothing.
    """

    # The bare name, as on every other surface that names somebody as leading.
    # The voice is beside it in `artist_voice_display` for a reader who wants
    # it, rather than welded into the name of an appointment it says nothing
    # about.
    artist_name = serializers.SerializerMethodField()
    artist_voice_display = serializers.CharField(
        source='artist.get_voice_type_display', read_only=True,
    )
    granted_by_name = serializers.CharField(
        source='granted_by.get_full_name', read_only=True, default='',
    )

    class Meta:
        model = RehearsalDelegate
        fields = (
            'id', 'artist', 'artist_name', 'artist_voice_display',
            'can_see_leader_marks', 'can_take_roll_call', 'can_open_materials',
            'can_mark_for_choir',
            'expires_at', 'note', 'granted_by_name', 'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def get_artist_name(self, obj: RehearsalDelegate) -> str:
        return f"{obj.artist.first_name} {obj.artist.last_name}".strip()
