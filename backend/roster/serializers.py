# roster/serializers.py
# ==========================================
# Roster API Serializers
# ==========================================
"""
REST API Serializers for the Roster application.
@architecture Enterprise SaaS 2026

Handles pure data transformation (Object <-> JSON). 
Adheres to the Single Responsibility Principle by completely omitting business,
financial, and permission logic. Role-based data exposure is handled by explicitly
defining separated serializers (Basic vs Detailed) routed via ViewSets.
"""

from rest_framework import serializers
from .models import (
    Artist, Collaborator, CrewAssignment, Project, Participation, 
    ProgramItem, Rehearsal, Attendance, ProjectPieceCasting
)

# --- 1. ARTIST SERIALIZERS ---

class ArtistBasicSerializer(serializers.ModelSerializer):
    """
    Publicly safe Artist entity. 
    Strips all sensitive contact and vocal capability data.
    """
    is_admin = serializers.BooleanField(source='user.is_superuser', read_only=True)
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
    Exposes personal contact info, but strictly hides HR evaluation metrics.
    """
    is_admin = serializers.BooleanField(source='user.is_superuser', read_only=True)
    voice_type_display = serializers.CharField(source='get_voice_type_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Artist
        exclude = (
            'sight_reading_skill', 
            'vocal_range_bottom', 
            'vocal_range_top'
        )

class ArtistDetailedSerializer(ArtistBasicSerializer):
    """
    Highly privileged Artist entity for Admins and self-profile views.
    Inherits from Basic but exposes all fields.
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
    Privileged contract configuration including financial metrics for HR/Admins.
    """
    class Meta:
        model = Participation
        fields = '__all__'


# --- 3. PROJECT & REHEARSAL SERIALIZERS ---

class ProjectSerializer(serializers.ModelSerializer):
    """
    Serializes the central Project entity.
    Injects lightweight relational payloads (cast, program) to minimize frontend requests.
    """
    cast = serializers.SerializerMethodField()
    program = serializers.SerializerMethodField()

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

    class Meta:
        model = Rehearsal
        fields = '__all__'


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

    class Meta:
        model = ProjectPieceCasting
        fields = '__all__'

    def get_artist_name(self, obj) -> str:
        return f"{obj.participation.artist.first_name} {obj.participation.artist.last_name}"

    def get_project_id(self, obj) -> str:
        return str(obj.participation.project_id)

class CollaboratorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collaborator
        fields = '__all__'

class CrewAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrewAssignment
        fields = '__all__'