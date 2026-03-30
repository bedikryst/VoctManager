# roster/serializers.py
# ==========================================
# Roster API Serializers
# ==========================================
"""
REST API Serializers for the Roster application.
@author Krystian Bugalski

Handles structural data transformation for HR and logistics entities.
Implements Dynamic Data Masking to prevent financial data leakage,
and leverages custom MethodFields to provide contextual, read-only relations.
"""

from rest_framework import serializers
from .models import (
    Artist, Collaborator, CrewAssignment, Project, Participation, 
    ProgramItem, Rehearsal, Attendance, ProjectPieceCasting
)


class ArtistSerializer(serializers.ModelSerializer):
    """Serializes the core Artist entity with read-only user references."""
    is_admin = serializers.BooleanField(source='user.is_superuser', read_only=True)
    voice_type_display = serializers.CharField(source='get_voice_type_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Artist
        fields = '__all__'

    def to_representation(self, instance) -> dict:
        """
        Dynamic Data Masking
        """
        data = super().to_representation(instance)
        request = self.context.get('request')
        
        if request:
            is_admin = getattr(request.user, 'is_superuser', False)
            is_me = request.user.id == instance.user.id if hasattr(instance, 'user') and instance.user else False
            
            if not is_admin:
                data.pop('sight_reading_skill', None)
                data.pop('vocal_range_bottom', None)
                data.pop('vocal_range_top', None)
                if not is_me:
                    data.pop('phone_number', None)
                    data.pop('email', None)

                
        return data


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
        """
        Serializes a lightweight list of artists participating in the project.
        Explicitly constructs the dictionary to ensure no sensitive data 
        (like individual contracts or fees) is accidentally exposed.
        """
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
        """Serializes the ordered setlist of musical pieces assigned to the project."""
        items = obj.program_items.select_related('piece').all()
        return [
            {
                'order': item.order,
                'piece_id': item.piece.id,
                'title': item.piece.title,
                'is_encore': item.is_encore
            }
            for item in items
        ]


class ParticipationSerializer(serializers.ModelSerializer):
    """
    Serializes contract and participation state.
    Includes robust security logic to strip financial payload parameters from non-admin users.
    """
    artist_name = serializers.CharField(source='artist.__str__', read_only=True)
    project_name = serializers.CharField(source='project.title', read_only=True)
    artist_voice_type_display = serializers.CharField(source='artist.get_voice_type_display', read_only=True)
    
    class Meta:
        model = Participation
        fields = '__all__'

    def to_representation(self, instance) -> dict:
        """
        Dynamic Data Masking: Removes the 'fee' field from the outgoing API response 
        if the requesting user lacks administrative clearance.
        """
        data = super().to_representation(instance)
        request = self.context.get('request')
        
        # Enforce strict financial data isolation
        if request and not getattr(request.user, 'is_superuser', False):
            data.pop('fee', None)
            
        return data


class RehearsalSerializer(serializers.ModelSerializer):
    """
    Serializes Rehearsal schedules.
    Dynamically computes the aggregation of absent participants.
    """
    absent_count = serializers.SerializerMethodField()

    class Meta:
        model = Rehearsal
        fields = '__all__'

    def get_absent_count(self, obj) -> int:
        """Aggregates the count of negatively justified or absent personnel."""
        # Using a direct query count prevents loading the entire queryset into memory
        return obj.attendances.filter(status__in=['ABSENT', 'EXCUSED']).count()


class AttendanceSerializer(serializers.ModelSerializer):
    """Serializes individual attendance and delay metrics."""
    class Meta:
        model = Attendance
        fields = '__all__'


class ProgramItemSerializer(serializers.ModelSerializer):
    """Serializes junction configurations for setlist management."""
    piece_title = serializers.CharField(source='piece.title', read_only=True)

    class Meta:
        model = ProgramItem
        fields = '__all__'


class ProjectPieceCastingSerializer(serializers.ModelSerializer):
    """
    Serializes micro-casting decisions.
    Utilizes SerializerMethodField for critical relational lookups (like project_id)
    to bypass native DRF parsing anomalies associated with nested foreign keys.
    """
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
    """Serializes external crew profiles."""
    class Meta:
        model = Collaborator
        fields = '__all__'


class CrewAssignmentSerializer(serializers.ModelSerializer):
    """Serializes crew contractual assignments."""
    class Meta:
        model = CrewAssignment
        fields = '__all__'