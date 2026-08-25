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
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from archive.services.voice_scope import voice_scope
from core.permissions import user_is_manager
from core.serializers import UserProfileSerializer
from core.voice_labels import voice_line_label
from logistics.models import Location
from roster.domain.liturgy import (
    ProgramItemPresentation,
    build_program_presentation,
)

from .models import (
    Artist,
    Attendance,
    Collaborator,
    CrewAssignment,
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    Rehearsal,
)

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
            'voice_type', 'voice_type_display',
            'sight_reading_skill', 'vocal_range_bottom', 'vocal_range_top',

            # Roster standing
            'is_active',

            # Onboarding state
            'activation_email_sent_at', 'account_activated', 'activation_link_expired',
        )
        read_only_fields = (
            'id', 'created_at', 'updated_at', 'is_deleted',
            'user', 'is_active', 'activation_email_sent_at',
        )

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


class ParticipationBasicSerializer(serializers.ModelSerializer):
    """
    Contract configuration safe for general cast consumption.
    Strictly omits the financial payload ('fee').
    """
    artist_name = serializers.CharField(source='artist.__str__', read_only=True)
    project_name = serializers.CharField(source='project.title', read_only=True)
    artist_voice_type_display = serializers.CharField(source='artist.get_voice_type_display', read_only=True)

    class Meta:
        model = Participation
        exclude = ('fee',)
        validators = PARTICIPATION_UNIQUENESS

class ParticipationDetailedSerializer(ParticipationBasicSerializer):
    """
    Privileged contract configuration including financial metrics for Management.
    Settlement fields (`paid_at`, `is_paid`) are read-only here so the only path
    that mutates them is the dedicated `payment` action, which keeps `paid_at`
    consistent with `is_paid`.
    """
    class Meta:
        model = Participation
        fields = '__all__'
        read_only_fields = ('is_paid', 'paid_at')
        validators = PARTICIPATION_UNIQUENESS

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
                'voice_type_display': p.artist.get_voice_type_display()
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


class RehearsalSerializer(serializers.ModelSerializer):
    """
    Serializes Rehearsal schedules.
    ENTERPRISE NOTE: 'absent_count' is now expected to be pre-annotated by the DB 
    via the QuerySet to prevent N+1 serialization bottlenecks.
    """
    absent_count = serializers.IntegerField(read_only=True, default=0)
    location = LocationSnippetSerializer(read_only=True)
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

    class Meta:
        model = Rehearsal
        fields = (
            'id',
            'created_at',
            'updated_at',
            'is_deleted',
            'project',
            'project_id',
            'date_time',
            'duration_minutes',
            'end_date_time',
            'timezone',
            'location',
            'location_id',
            'focus',
            'is_mandatory',
            'invited_participations',
            'absent_count',
        )
        read_only_fields = (
            'id',
            'created_at',
            'updated_at',
            'is_deleted',
            'project',
            'location',
            'end_date_time',
            'absent_count',
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

class ProjectPieceCastingSerializer(serializers.ModelSerializer):
    voice_line_display = serializers.SerializerMethodField()
    artist_name = serializers.SerializerMethodField()
    project_id = serializers.SerializerMethodField()
    artist_id = serializers.SerializerMethodField()

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

class CrewAssignmentBasicSerializer(serializers.ModelSerializer):
    """
    Crew booking without the financial payload. Surfaces the collaborator's
    display name and specialty (non-sensitive) so any authenticated user can see
    who is on a project's team, while `fee` / `is_paid` / `paid_at` stay hidden.
    """
    collaborator_name = serializers.CharField(source='collaborator.__str__', read_only=True)
    collaborator_specialty_display = serializers.CharField(
        source='collaborator.get_specialty_display', read_only=True
    )

    class Meta:
        model = CrewAssignment
        exclude = ('fee', 'is_paid', 'paid_at')


class CrewAssignmentSerializer(CrewAssignmentBasicSerializer):
    """
    Privileged crew booking for the settlement workspace, including financial
    metrics. Settlement fields (`paid_at`, `is_paid`) are read-only — they are
    mutated only by the dedicated `payment` action so `paid_at` stays consistent
    with `is_paid`.
    """

    class Meta:
        model = CrewAssignment
        fields = '__all__'
        read_only_fields = ('is_paid', 'paid_at')
