"""
REST API Serializers for the Archive application.
Author: Krystian Bugalski

These classes manage the conversion of complex Django models (Composer, Piece, Track)
into JSON representations, enabling seamless communication with the frontend.
"""

from rest_framework import serializers
from .models import Composer, Piece, Track

__author__ = "Krystian Bugalski"

class ComposerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Composer
        fields = '__all__'

class TrackSerializer(serializers.ModelSerializer):
    # Dynamically inject the human-readable display value of the voice_part choices
    voice_part_display = serializers.CharField(source='get_voice_part_display', read_only=True)
    audio_file = serializers.FileField(use_url=True)

    class Meta:
        model = Track
        fields = ['id', 'piece', 'voice_part', 'voice_part_display', 'audio_file']

class PieceSerializer(serializers.ModelSerializer):
    tracks = TrackSerializer(many=True, read_only=True)
    
    # Flattening related composer fields to avoid extra frontend logic
    composer_name = serializers.CharField(source='composer.last_name', read_only=True)
    composer_full_name = serializers.StringRelatedField(source='composer', read_only=True)

    sheet_music = serializers.FileField(use_url=True, required=False, allow_null=True)
    
    class Meta:
        model = Piece
        fields = '__all__'