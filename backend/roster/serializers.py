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
from rest_framework import serializers
from .models import (
    Artist, Collaborator, CrewAssignment, Project, Participation, 
    ProgramItem, Rehearsal, Attendance, ProjectPieceCasting
)
from logistics.models import Location
from core.serializers import UserProfileSerializer

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
    
    class Meta:
        model = Artist
        exclude = (
            'sight_reading_skill', 
            'vocal_range_bottom', 
            'vocal_range_top', 
            'phone_number', 
            'email'
        )
        
class ArtistMeSerializer(serializers.ModelSerializer):
    """
    Self-profile view for the artist.
    Exposes personal contact info, but safely maps nested profile data.
    """
    is_manager = serializers.BooleanField(source='user.profile.is_manager', read_only=True)
    voice_type_display = serializers.CharField(source='get_voice_type_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    profile = UserProfileSerializer(source='user.profile', read_only=True)
    
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
    """
    class Meta:
        model = Artist
        fields = '__all__'


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
    """
    class Meta:
        model = Participation
        fields = '__all__'

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
    
    class Meta:
        model = Project
        fields = '__all__'

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

class CollaboratorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collaborator
        fields = '__all__'

class CrewAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrewAssignment
        fields = '__all__'
