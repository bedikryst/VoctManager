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
from .dtos import PieceWriteDTO, VoiceRequirementDTO


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
    sheet_music = serializers.FileField(use_url=True, required=False)
    epoch_display = serializers.CharField(source='get_epoch_display', read_only=True)
    reference_recording = serializers.URLField(write_only=True, required=False, allow_blank=True)
    
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

    def validate(self, attrs):
        legacy_reference = attrs.pop('reference_recording', _LEGACY_REFERENCE_RECORDING)
        if legacy_reference is not _LEGACY_REFERENCE_RECORDING and legacy_reference:
            has_explicit_reference = bool(attrs.get('reference_recording_youtube') or attrs.get('reference_recording_spotify'))
            if not has_explicit_reference:
                attrs['reference_recording_youtube'] = legacy_reference
        return attrs
    
    def validate_requirements_data(self, value):
        """
        Parses raw multipart/form-data JSON strings into native Python lists.
        Handles the validation edge cases before the View ever sees it.
        """
        if value is None:
            return None
            
        if isinstance(value, str):
            try:
                parsed_data = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError("Invalid JSON format for requirements_data.")
        else:
            parsed_data = value

        # Validate the structure eagerly
        if not isinstance(parsed_data, list):
            raise serializers.ValidationError("Requirements data must be a list of objects.")
            
        return parsed_data

    def to_dto(self, instance=None) -> PieceWriteDTO:
        """
        Enterprise Factory Pattern: Assembles the DTO directly from validated data.
        Keeps the ViewSet ultra-thin.
        """
        vd = self.validated_data
        
        # Build Requirements DTOs
        req_dtos = None
        if 'requirements_data' in vd and vd['requirements_data'] is not None:
            req_dtos = [
                VoiceRequirementDTO(
                    voice_line=req.get('voice_line'), 
                    quantity=int(req.get('quantity', 1))
                )
                for req in vd['requirements_data'] if req.get('voice_line')
            ]

        # Handle fallback for updates
        composer_id = None
        if 'composer' in vd:
            composer_id = vd['composer'].id if vd['composer'] else None
        elif instance and instance.composer_id:
            composer_id = instance.composer_id

        return PieceWriteDTO(
            title=vd.get('title', instance.title if instance else ''),
            composer_id=composer_id,
            arranger=vd.get('arranger', getattr(instance, 'arranger', None)),
            language=vd.get('language', getattr(instance, 'language', None)),
            estimated_duration=vd.get('estimated_duration', getattr(instance, 'estimated_duration', None)),
            voicing=vd.get('voicing', getattr(instance, 'voicing', '')),
            description=vd.get('description', getattr(instance, 'description', '')),
            lyrics_original=vd.get('lyrics_original', getattr(instance, 'lyrics_original', None)),
            lyrics_translation=vd.get('lyrics_translation', getattr(instance, 'lyrics_translation', None)),
            reference_recording_youtube=vd.get('reference_recording_youtube', getattr(instance, 'reference_recording_youtube', None)),
            reference_recording_spotify=vd.get('reference_recording_spotify', getattr(instance, 'reference_recording_spotify', None)),
            composition_year=vd.get('composition_year', getattr(instance, 'composition_year', None)),
            epoch=vd.get('epoch', getattr(instance, 'epoch', None)),
            voice_requirements=req_dtos
        )