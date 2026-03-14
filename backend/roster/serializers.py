# roster/serializers.py
# ==========================================
# Roster API Serializers
# ==========================================
"""
REST API Serializers for the Roster application.
Author: Krystian Bugalski

Handles data transformation for the HR and logistics entities.
Implements dynamic field masking to prevent financial data leakage,
and leverages custom MethodFields to provide nested, read-only data.
"""

from rest_framework import serializers
from .models import Artist, Project, Participation, ProgramItem, Rehearsal, Attendance

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
    """
    Serializes contract and participation data.
    Includes security logic to strip financial data from non-admin users.
    """
    artist_name = serializers.CharField(source='artist.__str__', read_only=True)
    project_name = serializers.CharField(source='project.title', read_only=True)
    artist_voice_type_display = serializers.CharField(source='artist.get_voice_type_display', read_only=True)
    
    class Meta:
        model = Participation
        fields = '__all__'

    def to_representation(self, instance):
        """
        Dynamic Data Masking: Removes the 'fee' field from the API response 
        if the requesting user is not a superuser (conductor/manager).
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