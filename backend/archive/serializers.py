# archive/serializers.py
# ==========================================
# Archive API Serializers
# ==========================================
"""
REST API Serializers for the Archive application.
@author Krystian Bugalski

Handles the conversion of complex Django models (Composer, Piece, Track)
into JSON representations, optimizing nested queries for the frontend.
"""

import json
from django.db import transaction
from rest_framework import serializers

from .models import Composer, Piece, Track, PieceVoiceRequirement


_LEGACY_REFERENCE_RECORDING = object()


class ComposerSerializer(serializers.ModelSerializer):
    """Serializes Composer entities and their biographical metadata."""
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
    """Serializes vocal arrangement requirements for a specific piece."""
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
    composer_name = serializers.CharField(source='composer.last_name', read_only=True)
    composer_full_name = serializers.StringRelatedField(source='composer', read_only=True)
    voice_requirements = PieceVoiceRequirementSerializer(many=True, read_only=True)
    
    # URL generation for static file serving
    sheet_music = serializers.FileField(use_url=True, required=False, allow_null=True)
    epoch_display = serializers.CharField(source='get_epoch_display', read_only=True)
    reference_recording = serializers.URLField(write_only=True, required=False, allow_blank=True, allow_null=True)
    
    # Write-only field for handling nested requirement mutations
    requirements_data = serializers.JSONField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = Piece
        fields = '__all__'

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            data = data.copy()
        else:
            data = dict(data)

        nullable_fields = (
            'composer',
            'arranger',
            'language',
            'composition_year',
            'epoch',
            'estimated_duration',
            'lyrics_original',
            'lyrics_translation',
            'reference_recording',
            'reference_recording_youtube',
            'reference_recording_spotify',
        )

        for field in nullable_fields:
            if data.get(field) == '':
                data[field] = None

        if 'voicing' in data and data.get('voicing') is None:
            data['voicing'] = ''

        if 'description' in data and data.get('description') is None:
            data['description'] = ''

        return super().to_internal_value(data)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['reference_recording'] = (
            representation.get('reference_recording_youtube')
            or representation.get('reference_recording_spotify')
        )
        return representation

    def _apply_legacy_reference_recording(self, validated_data) -> None:
        legacy_reference = validated_data.pop('reference_recording', _LEGACY_REFERENCE_RECORDING)

        if legacy_reference is _LEGACY_REFERENCE_RECORDING:
            return

        if not legacy_reference:
            if 'reference_recording_youtube' not in validated_data:
                validated_data['reference_recording_youtube'] = None
            if 'reference_recording_spotify' not in validated_data:
                validated_data['reference_recording_spotify'] = None
            return

        has_explicit_reference = bool(
            validated_data.get('reference_recording_youtube')
            or validated_data.get('reference_recording_spotify')
        )
        if not has_explicit_reference:
            validated_data['reference_recording_youtube'] = legacy_reference

    def _sync_requirements(self, piece: Piece, requirements_raw) -> None:
        """
        Internal method for securely parsing and synchronizing vocal requirements.
        Executes within an atomic transaction to guarantee data integrity.
        """
        if requirements_raw is None:
            return
            
        # Parse payload based on transport format (FormData string vs JSON object)
        if isinstance(requirements_raw, str):
            try:
                requirements = json.loads(requirements_raw)
            except json.JSONDecodeError:
                requirements = []
        else:
            requirements = requirements_raw

        # Atomic block ensures that if creation fails, the deletion is rolled back
        with transaction.atomic():
            piece.voice_requirements.all().delete()
            
            # Bulk create prevents multiple database hits
            new_requirements = [
                PieceVoiceRequirement(
                    piece=piece,
                    voice_line=req.get('voice_line'),
                    quantity=req.get('quantity', 1)
                )
                for req in requirements if req.get('voice_line')
            ]
            PieceVoiceRequirement.objects.bulk_create(new_requirements)

    def create(self, validated_data) -> Piece:
        """Overrides creation to extract and process nested requirement data."""
        requirements_raw = validated_data.pop('requirements_data', None)
        self._apply_legacy_reference_recording(validated_data)
        piece = super().create(validated_data)
        self._sync_requirements(piece, requirements_raw)
        return piece

    def update(self, instance: Piece, validated_data) -> Piece:
        """Overrides update to handle conditional nested requirement synchronization."""
        requirements_raw = validated_data.pop('requirements_data', None)
        self._apply_legacy_reference_recording(validated_data)
        piece = super().update(instance, validated_data)
        
        # Only mutate requirements if explicitly transmitted from the client
        if requirements_raw is not None:
            self._sync_requirements(piece, requirements_raw)
            
        return piece
