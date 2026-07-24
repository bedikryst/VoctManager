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

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from core.permissions import user_is_manager
from core.serializers import UserProfileSerializer
from logistics.models import Location

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
        """Returns ordered setlist configuration."""
        items = obj.program_items.all()
        return [
            {
                'order': item.order,
                'piece_id': item.piece.id,
                'title': item.piece.title,
                'is_encore': item.is_encore
            }
            for item in items
        ]


class RehearsalSerializer(serializers.ModelSerializer):
    """
    Serializes Rehearsal schedules.
    ENTERPRISE NOTE: 'absent_count' is now expected to be pre-annotated by the DB 
    via the QuerySet to prevent N+1 serialization bottlenecks.
    """
    absent_count = serializers.IntegerField(read_only=True, default=0)
    location = LocationSnippetSerializer(read_only=True)
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

# --- 4. RELATIONAL & JUNCTION SERIALIZERS ---

class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = '__all__'

class ProgramItemSerializer(serializers.ModelSerializer):
    piece_title = serializers.CharField(source='piece.title', read_only=True)

    class Meta:
        model = ProgramItem
        fields = '__all__'

class ProjectPieceCastingSerializer(serializers.ModelSerializer):
    voice_line_display = serializers.CharField(source='get_voice_line_display', read_only=True)
    artist_name = serializers.SerializerMethodField()
    project_id = serializers.SerializerMethodField()
    artist_id = serializers.SerializerMethodField()

    class Meta:
        model = ProjectPieceCasting
        fields = '__all__'

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
