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
import json
from rest_framework import serializers
from .models import Composer, Piece, Track, PieceVoiceRequirement

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


class PieceVoiceRequirementSerializer(serializers.ModelSerializer):
    voice_line_display = serializers.CharField(source='get_voice_line_display', read_only=True)

    class Meta:
        model = PieceVoiceRequirement
        fields = ['id', 'piece', 'voice_line', 'voice_line_display', 'quantity']

class PieceSerializer(serializers.ModelSerializer):
    """
    Main serializer for musical pieces.
    Embeds related tracks directly to reduce frontend HTTP requests.
    """
    tracks = TrackSerializer(many=True, read_only=True)
    
    # Flattening related composer fields to avoid extra frontend logic
    tracks = TrackSerializer(many=True, read_only=True)
    composer_name = serializers.CharField(source='composer.last_name', read_only=True)
    composer_full_name = serializers.StringRelatedField(source='composer', read_only=True)
    voice_requirements = PieceVoiceRequirementSerializer(many=True, read_only=True)
    sheet_music = serializers.FileField(use_url=True, required=False, allow_null=True)
    epoch_display = serializers.CharField(source='get_epoch_display', read_only=True)
    requirements_data = serializers.JSONField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = Piece
        fields = '__all__'

    def _sync_requirements(self, piece, requirements_raw):
        """Pomocnicza metoda do bezpiecznego parsowania i zapisu wymagań głosowych."""
        if requirements_raw is None:
            return
            
        # Jeśli dane przyszły z FormData, będą stringiem. Jeśli z JSON, będą listą.
        if isinstance(requirements_raw, str):
            try:
                requirements = json.loads(requirements_raw)
            except json.JSONDecodeError:
                requirements = []
        else:
            requirements = requirements_raw

        # Twardy reset obecnych wymagań dla tego utworu i wgranie nowych (Batching)
        piece.voice_requirements.all().delete()
        
        for req in requirements:
            PieceVoiceRequirement.objects.create(
                piece=piece,
                voice_line=req.get('voice_line'),
                quantity=req.get('quantity', 1)
            )

    def create(self, validated_data):
        # Wyciągamy dane o wymaganiach z payloadu przed zapisem Utworu
        requirements_raw = validated_data.pop('requirements_data', None)
        piece = super().create(validated_data)
        self._sync_requirements(piece, requirements_raw)
        return piece

    def update(self, instance, validated_data):
        requirements_raw = validated_data.pop('requirements_data', None)
        piece = super().update(instance, validated_data)
        
        # Aktualizujemy wymagania tylko, jeśli zostały celowo przesłane z frontendu
        if requirements_raw is not None:
            self._sync_requirements(piece, requirements_raw)
            
        return piece