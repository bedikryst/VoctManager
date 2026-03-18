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
from .models import Artist, Collaborator, CrewAssignment, Project, Participation, ProgramItem, Rehearsal, Attendance, ProjectPieceCasting

class ArtistSerializer(serializers.ModelSerializer):
    is_admin = serializers.BooleanField(source='user.is_superuser', read_only=True)
    voice_type_display = serializers.CharField(source='get_voice_type_display', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Artist
        fields = '__all__'


class ProjectSerializer(serializers.ModelSerializer):
    cast = serializers.SerializerMethodField()
    program = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'

    def get_cast(self, obj):
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
        
    def get_program(self, obj):
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

    def to_representation(self, instance):
        """
        Dynamic Data Masking: Removes the 'fee' field from the outgoing API response 
        if the requesting user lacks administrative clearance.
        """
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request and not request.user.is_superuser:
            data.pop('fee', None)
        return data


class RehearsalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rehearsal
        fields = '__all__'


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
    """
    Serializes micro-casting decisions.
    Utilizes SerializerMethodField for critical relational lookups (like project_id)
    to bypass native DRF parsing anomalies associated with nested foreign keys.
    """
    voice_line_display = serializers.CharField(source='get_voice_line_display', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    artist_name = serializers.SerializerMethodField()
    project_id = serializers.SerializerMethodField()

    class Meta:
        model = ProjectPieceCasting
        fields = '__all__'

    def get_artist_name(self, obj):
        return f"{obj.participation.artist.first_name} {obj.participation.artist.last_name}"

    def get_project_id(self, obj):
        return obj.participation.project_id


class CollaboratorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collaborator
        fields = '__all__'

class CrewAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrewAssignment
        fields = '__all__'