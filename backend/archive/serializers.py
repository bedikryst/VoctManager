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

from .models import (
    Annotation, Composer, Movement, Piece, PieceVoiceRequirement,
    ProgramNote, Recording, ScoreEdition, Track, Translation,
)
from .dtos import PieceWriteDTO, VoiceRequirementDTO


_LEGACY_REFERENCE_RECORDING = object()


def _blank_to_none(value):
    """Converts empty strings to None for DTO fields that require semantic nullability."""
    return None if value in (None, '') else value


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




# ===========================================================================
# Score Package Compiler — read-only nested serializers
# ===========================================================================
# These power the conductor's review screen (Phase 3). Writes use:
#   * /api/archive/editions/        — multipart upload + ingestion dispatch
#   * /api/pieces/{id}/             — existing PieceSerializer for piece edits
#   * /api/composers/{id}/          — existing ComposerSerializer for composer edits
# Nested entities (movements, translations, recordings, program notes) are
# read-only in the edition serializer; mutations go through their own future
# endpoints once the UI calls for inline editing.
# ===========================================================================


class MovementSerializer(serializers.ModelSerializer):
    """One movement within a multi-movement Piece."""
    class Meta:
        model = Movement
        fields = ['id', 'order_index', 'title', 'tempo_marking',
                  'duration_seconds', 'voicing_override', 'starts_on_page']
        read_only_fields = fields


class TranslationSerializer(serializers.ModelSerializer):
    """One language translation of a Piece's sung text."""
    class Meta:
        model = Translation
        fields = ['id', 'movement', 'target_language', 'text', 'is_singable']
        read_only_fields = fields


class RecordingSerializer(serializers.ModelSerializer):
    """One reference recording (Spotify / YouTube / etc.) for a Piece."""
    source_display = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = Recording
        fields = ['id', 'source', 'source_display', 'external_id', 'url',
                  'performer', 'year', 'duration_seconds', 'is_featured']
        read_only_fields = fields


class ProgramNoteSerializer(serializers.ModelSerializer):
    """Audience-facing program note for one Piece (canonical or per-project)."""
    class Meta:
        model = ProgramNote
        fields = ['id', 'project', 'language', 'target_tone',
                  'word_count_target', 'content', 'is_approved']
        read_only_fields = ['id', 'project', 'word_count_target']


class AnnotationSerializer(serializers.ModelSerializer):
    """PDF markup overlay (Phase 4 — annotation editor)."""
    class Meta:
        model = Annotation
        fields = ['id', 'page_number', 'annotation_type', 'payload',
                  'color', 'layer_name', 'created_by']
        read_only_fields = ['id', 'created_by']


class _ComposerSummarySerializer(serializers.ModelSerializer):
    """Slim composer payload embedded in ScoreEdition.detail responses."""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Composer
        fields = ['id', 'first_name', 'last_name', 'full_name',
                  'birth_year', 'death_year', 'nationality', 'period',
                  'bio', 'portrait_url', 'portrait_license',
                  'mbid', 'wikidata_qid']

    def get_full_name(self, obj: Composer) -> str:
        return f"{obj.first_name} {obj.last_name}".strip()


class _PieceEditionSummarySerializer(serializers.ModelSerializer):
    """
    Lean ScoreEdition payload embedded in Piece read responses.

    Powers the Archive PDF badge + AI Context "Editions" section + Materials
    PDF download list. The full review-modal-grade ScoreEditionDetailSerializer
    lives separately and is fetched on demand by the Score Compiler.
    """
    pdf_file = serializers.FileField(read_only=True, use_url=True)
    ingestion_status_display = serializers.CharField(
        source='get_ingestion_status_display', read_only=True,
    )

    class Meta:
        model = ScoreEdition
        fields = [
            'id', 'pdf_file', 'original_filename', 'publisher',
            'edition_year', 'editor_name', 'page_count',
            'is_default', 'ingestion_status', 'ingestion_status_display',
            'created_at',
        ]
        read_only_fields = fields


class _PieceSummarySerializer(serializers.ModelSerializer):
    """Slim piece payload embedded in ScoreEdition.detail responses."""
    composer = _ComposerSummarySerializer(read_only=True)
    movements = MovementSerializer(many=True, read_only=True)
    translations = TranslationSerializer(many=True, read_only=True)
    recordings = RecordingSerializer(many=True, read_only=True)
    program_notes = ProgramNoteSerializer(many=True, read_only=True)

    class Meta:
        model = Piece
        fields = [
            'id', 'title', 'composer', 'opus_catalog', 'musical_key',
            'language', 'voicing', 'text_source',
            'lyrics_original', 'lyrics_translation', 'lyrics_ipa',
            'composition_year', 'epoch', 'mbid_work',
            'ingestion_status',
            'movements', 'translations', 'recordings', 'program_notes',
        ]


class ScoreEditionListSerializer(serializers.ModelSerializer):
    """
    Lean payload for the list view (used by the editions table on the
    conductor's review dashboard). Avoids hydrating movements/translations
    /recordings — those are only needed on the detail view.
    """
    piece_title = serializers.CharField(source='piece.title', read_only=True, default='')
    composer_name = serializers.SerializerMethodField()
    ingestion_status_display = serializers.CharField(
        source='get_ingestion_status_display', read_only=True,
    )

    class Meta:
        model = ScoreEdition
        fields = [
            'id', 'original_filename', 'publisher', 'edition_year',
            'page_count', 'is_default',
            'piece', 'piece_title', 'composer_name',
            'ingestion_status', 'ingestion_status_display',
            'ingestion_cost_cents', 'ingestion_error',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_composer_name(self, obj: ScoreEdition) -> str:
        if not obj.piece or not obj.piece.composer:
            return ''
        c = obj.piece.composer
        return f"{c.first_name} {c.last_name}".strip()


class ScoreEditionDetailSerializer(serializers.ModelSerializer):
    """
    Full payload for the conductor's review screen — embeds composer,
    piece, movements, translations, recordings, program notes, and the
    PDF file URL.
    """
    pdf_file = serializers.FileField(read_only=True, use_url=True)
    piece = _PieceSummarySerializer(read_only=True)
    annotations = AnnotationSerializer(many=True, read_only=True)
    ingestion_status_display = serializers.CharField(
        source='get_ingestion_status_display', read_only=True,
    )

    class Meta:
        model = ScoreEdition
        fields = [
            'id', 'pdf_file', 'original_filename', 'page_count',
            'publisher', 'edition_year', 'editor_name', 'is_default',
            'sha256', 'uploaded_by',
            'piece', 'annotations',
            'ingestion_status', 'ingestion_status_display',
            'ingestion_cost_cents', 'ingestion_error',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'pdf_file', 'page_count', 'sha256', 'uploaded_by',
            'piece', 'annotations',
            'ingestion_status', 'ingestion_status_display',
            'ingestion_cost_cents', 'ingestion_error',
            'created_at', 'updated_at',
        ]


class ScoreEditionUploadSerializer(serializers.Serializer):
    """
    Multipart upload payload. Caller posts a PDF file + optional metadata;
    the view creates the ScoreEdition row and dispatches the ingestion
    pipeline. Returns the ScoreEditionDetailSerializer payload.
    """
    pdf_file = serializers.FileField(required=True)
    original_filename = serializers.CharField(max_length=255, required=False, allow_blank=True)
    publisher = serializers.CharField(max_length=120, required=False, allow_blank=True)
    edition_year = serializers.IntegerField(required=False, allow_null=True)
    editor_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    is_default = serializers.BooleanField(required=False, default=False)

class PieceSerializer(serializers.ModelSerializer):
    """
    Main serializer for musical pieces.

    Read shape: `composer` is the nested summary object (matching what the
    Score Compiler returns from `_PieceSummarySerializer`), plus the four
    Score-Compiler relations are embedded (`movements`, `translations`,
    `recordings`, `program_notes`). One DTO across both surfaces.

    Write shape: callers POST/PATCH `composer_id` (UUID) — DRF maps it to the
    `composer` FK transparently. Old write payloads using `composer: <uuid>`
    keep working via `to_internal_value` aliasing below.
    """
    tracks = TrackSerializer(many=True, read_only=True)
    composer = _ComposerSummarySerializer(read_only=True)
    composer_id = serializers.PrimaryKeyRelatedField(
        source='composer',
        queryset=Composer.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    composer_name = serializers.CharField(source='composer.last_name', read_only=True)
    composer_full_name = serializers.SerializerMethodField()
    voice_requirements = PieceVoiceRequirementSerializer(many=True, read_only=True)

    # Score Compiler — AI-enriched and externally-sourced relations.
    movements = MovementSerializer(many=True, read_only=True)
    translations = TranslationSerializer(many=True, read_only=True)
    recordings = RecordingSerializer(many=True, read_only=True)
    program_notes = ProgramNoteSerializer(many=True, read_only=True)
    # All ScoreEditions attached to this Piece (legacy `sheet_music` is one
    # PDF per piece; the new flow allows multiple — Bärenreiter, IMSLP, etc.).
    editions = _PieceEditionSummarySerializer(many=True, read_only=True)

    # URL generation for static file serving
    sheet_music = serializers.FileField(use_url=True, required=False)
    epoch_display = serializers.CharField(source='get_epoch_display', read_only=True)
    ingestion_status_display = serializers.CharField(
        source='get_ingestion_status_display', read_only=True,
    )
    reference_recording = serializers.URLField(write_only=True, required=False, allow_blank=True)

    # Write-only field for handling nested requirement mutations
    requirements_data = serializers.JSONField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Piece
        fields = '__all__'

    def get_composer_full_name(self, obj: Piece) -> str:
        if not obj.composer:
            return ''
        return f"{obj.composer.first_name} {obj.composer.last_name}".strip()

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            data = data.copy()
        else:
            data = dict(data)

        # Back-compat: legacy write payloads send `composer: <uuid>`; the new
        # nested-read shape requires `composer_id` on write. Alias one to
        # the other without breaking existing clients.
        if 'composer_id' not in data and 'composer' in data:
            value = data.get('composer')
            # Distinguish "id string" from "nested object" — if a client ever
            # round-trips the read payload back as a write, ignore the nested.
            if isinstance(value, str) or value is None:
                data['composer_id'] = value
                data.pop('composer', None)
            elif isinstance(value, dict):
                data.pop('composer', None)

        nullable_fields = (
            'composer_id',
            'composition_year',
            'estimated_duration',
        )

        blank_string_fields = (
            'arranger',
            'language',
            'epoch',
            'lyrics_original',
            'lyrics_translation',
            'reference_recording',
            'reference_recording_youtube',
            'reference_recording_spotify',
            'voicing',
            'description',
        )

        for field in nullable_fields:
            if field in data and data.get(field) == '':
                data[field] = None

        for field in blank_string_fields:
            if field in data and data.get(field) is None:
                data[field] = ''

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
            arranger=vd.get('arranger', getattr(instance, 'arranger', '')),
            language=vd.get('language', getattr(instance, 'language', '')),
            estimated_duration=vd.get('estimated_duration', getattr(instance, 'estimated_duration', None)),
            voicing=vd.get('voicing', getattr(instance, 'voicing', '')),
            description=vd.get('description', getattr(instance, 'description', '')),
            lyrics_original=vd.get('lyrics_original', getattr(instance, 'lyrics_original', '')),
            lyrics_translation=vd.get('lyrics_translation', getattr(instance, 'lyrics_translation', '')),
            reference_recording_youtube=_blank_to_none(
                vd.get(
                    'reference_recording_youtube',
                    getattr(instance, 'reference_recording_youtube', ''),
                )
            ),
            reference_recording_spotify=_blank_to_none(
                vd.get(
                    'reference_recording_spotify',
                    getattr(instance, 'reference_recording_spotify', ''),
                )
            ),
            composition_year=vd.get('composition_year', getattr(instance, 'composition_year', None)),
            epoch=vd.get('epoch', getattr(instance, 'epoch', '')),
            voice_requirements=req_dtos
        )
