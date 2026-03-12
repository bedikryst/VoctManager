"""
REST API Serializers for the Roster application.
Author: Krystian Bugalski

Handles data transformation for Artists, Projects, and Participations.
Includes custom method fields to provide optimized, nested data for the frontend.
"""

from rest_framework import serializers
from .models import Artist, Project, Participation

__author__ = "Krystian Bugalski"


class ArtistSerializer(serializers.ModelSerializer):
    # Injecting user role and human-readable choice fields for the React frontend
    is_admin = serializers.BooleanField(source='user.is_superuser', read_only=True)
    voice_part_display = serializers.CharField(source='get_voice_part_display', read_only=True)

    class Meta:
        model = Artist
        fields = '__all__'


class ProjectSerializer(serializers.ModelSerializer):
    # Custom field to attach a simplified list of cast members directly to the project payload
    cast = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'

    def get_cast(self, obj):
        """
        Retrieves all artists participating in this project.
        Returns a stripped-down dictionary to minimize API payload size 
        and prevent leaking sensitive user data (like emails or phone numbers).
        """
        participations = obj.participations.select_related('artist').all()
        return [
            {
                'id': p.artist.id,
                'first_name': p.artist.first_name,
                'last_name': p.artist.last_name,
                'voice_part': p.artist.voice_part,
                'voice_part_display': p.artist.get_voice_part_display()
            }
            for p in participations
        ]


class ParticipationSerializer(serializers.ModelSerializer):
    # Read-only fields injected to avoid extra API calls on the frontend
    artist_name = serializers.CharField(source='artist.__str__', read_only=True)
    project_name = serializers.CharField(source='project.title', read_only=True)
    artist_voice_part_display = serializers.CharField(source='artist.get_voice_part_display', read_only=True)
    
    class Meta:
        model = Participation
        fields = '__all__'