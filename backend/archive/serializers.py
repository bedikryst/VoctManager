# archive/serializers.py
# ==========================================
# Archive API Serializers
# ==========================================
"""
REST API Serializers for the Archive application.
Author: Krystian Bugalski

Handles the conversion of complex Django models (Composer, Piece, Track)
into JSON representations, optimizing nested queries for the frontend.
"""

from rest_framework import serializers
from .models import Composer, Piece, Track

class ComposerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Composer
        fields = '__all__'


class TrackSerializer(serializers.ModelSerializer):
    """
    Serializes individual rehearsal tracks.
    Injects human-readable display values for vocal lines.
    """
    voice_part_display = serializers.CharField(source='get_voice_part_display', read_only=True)
    audio_file = serializers.FileField(use_url=True)

    class Meta:
        model = Track
        fields = ['id', 'piece', 'voice_part', 'voice_part_display', 'audio_file']


class PieceSerializer(serializers.ModelSerializer):
    """
    Main serializer for musical pieces.
    Embeds related tracks directly to reduce frontend HTTP requests.
    """
    tracks = TrackSerializer(many=True, read_only=True)
    
    # Flattening related composer fields to avoid extra frontend logic
    composer_name = serializers.CharField(source='composer.last_name', read_only=True)
    composer_full_name = serializers.StringRelatedField(source='composer', read_only=True)

    sheet_music = serializers.FileField(use_url=True, required=False, allow_null=True)
    
    class Meta:
        model = Piece
        fields = '__all__'