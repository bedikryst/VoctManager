"""
REST API Serializers for the Roster application.
Author: Krystian Bugalski

Handles data transformation for the HR and logistics entities.
Leverages custom MethodFields to provide nested, read-only data 
(e.g., cast lists, setlists) to minimize frontend API calls.
"""

from rest_framework import serializers
from .models import Artist, Project, Participation, ProgramItem, Rehearsal, Attendance, ProgramItem

__author__ = "Krystian Bugalski"

class ArtistSerializer(serializers.ModelSerializer):
    is_admin = serializers.BooleanField(source='user.is_superuser', read_only=True)
    voice_type_display = serializers.CharField(source='get_voice_type_display', read_only=True)

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
        """Serializes a lightweight list of artists participating in the project."""
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
        """Serializes the ordered setlist of musical pieces for the project."""
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
    # Flatten related object properties for easier frontend consumption
    artist_name = serializers.CharField(source='artist.__str__', read_only=True)
    project_name = serializers.CharField(source='project.title', read_only=True)
    artist_voice_type_display = serializers.CharField(source='artist.get_voice_type_display', read_only=True)
    
    class Meta:
        model = Participation
        fields = '__all__'

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