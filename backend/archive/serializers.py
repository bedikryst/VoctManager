# archive/serializers.py
# ==========================================
# Archive API Serializers
# ==========================================
"""
REST API serializers for the Archive bounded context.

Read shape: PieceSerializer embeds composer + all AI-enriched relations
(movements, translations, recordings, program_notes, editions). One JSON
shape across every consumer — the Archive list, the AI Review tab, the
Materials dashboard.

Write shape: PATCH `/api/pieces/{id}/` accepts the JSON subset described by
[archive.dtos.PieceWriteDTO] plus `composer_id` (UUID). Sub-entities (PDF
editions, recordings, translations) have their own endpoints — never
mutated through PieceSerializer.

Ingestion status is computed at read-time from the attached editions —
a Piece has no status of its own. See [_aggregate_ingestion_status].
"""

import json
from collections.abc import Mapping
from typing import Any, cast

from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from pydantic import ValidationError as PydanticValidationError
from rest_framework import serializers

from .dtos import PieceWriteDTO, VoiceRequirementDTO
from .models import (
    Annotation,
    AnnotationType,
    Composer,
    IngestionStatus,
    Movement,
    Piece,
    PieceVoiceRequirement,
    ProgramNote,
    ProvenanceRecord,
    ProvenanceSource,
    Recording,
    ScoreEdition,
    Track,
    Translation,
)


def build_piece_provenance_index(piece: "Piece") -> dict[str, dict[str, Any]]:
    """Latest `ProvenanceRecord` per (object, field) for a piece and its
    AI-enriched children (movements / translations / recordings), in ONE query.

    Keyed `"<object_id>:<field_name>"`, so the AI Review cockpit can show, per
    field, whether the value came from the AI (and at what self-rated
    confidence), from MusicBrainz / Wikidata, or from a human edit — i.e. the
    "AI-suggested vs verified" signal that the provenance log was built for but
    nothing surfaced. Children are read from the prefetch cache (`.all()`), so
    this stays a single extra query on the piece-detail endpoint.
    """
    target_ids: list[Any] = [piece.pk]
    for relation in ('movements', 'translations', 'recordings'):
        target_ids.extend(obj.pk for obj in getattr(piece, relation).all())

    source_labels = dict(ProvenanceSource.choices)
    index: dict[str, dict[str, Any]] = {}
    records = (
        ProvenanceRecord.objects
        .filter(object_id__in=target_ids)
        .order_by('object_id', 'field_name', '-retrieved_at')
    )
    for rec in records:
        key = f"{rec.object_id}:{rec.field_name}"
        if key in index:
            continue  # ordered newest-first; first row per key wins
        index[key] = {
            'source': rec.source,
            'source_display': str(source_labels.get(rec.source, rec.source)),
            'confidence': rec.confidence,
            'model_version': rec.model_version,
            'retrieved_at': rec.retrieved_at.isoformat() if rec.retrieved_at else None,
        }
    return index


def score_download_url(obj: "ScoreEdition", context: Mapping[str, Any]) -> str | None:
    """
    Resolve a ScoreEdition PDF to its authenticated, project-scoped download
    endpoint instead of a bare `/media/` link. Every consumer (manager Archive UI
    and chorister Songbook alike) goes through the same gate, so the raw files can
    be locked behind `internal` in nginx and access re-checked per request.
    """
    if not obj.pdf_file:
        return None
    url = reverse('score-edition-download', kwargs={'pk': obj.id})
    request = context.get('request')
    return request.build_absolute_uri(url) if request else url


# Lowest-status-wins across all attached editions; mirrors what the conductor
# would naturally describe ("we're still extracting" beats "one of three is done").
# Sorted from in-progress → terminal — first match returned.
_INGESTION_STATUS_PRIORITY: tuple[str, ...] = (
    IngestionStatus.EXTRACTING,
    IngestionStatus.ENRICHING,
    IngestionStatus.GENERATING,
    IngestionStatus.PENDING,
    IngestionStatus.FAILED,
    IngestionStatus.AWAITING,
    IngestionStatus.READY,
)


def _aggregate_ingestion_status(piece: Piece) -> str:
    """Derive a single piece-level ingestion status from its editions.

    Pieces with no editions are 'PEND' (manually entered, no AI run yet) so
    that the UI can still show a neutral chip. With editions present, we pick
    the lowest-progress status across all of them — that matches the user's
    mental model: "this piece is whatever the worst-positioned PDF is."
    """
    editions = getattr(piece, '_prefetched_editions', None)
    if editions is None:
        editions = list(piece.editions.all())
    if not editions:
        return IngestionStatus.PENDING

    present = {e.ingestion_status for e in editions}
    for status_value in _INGESTION_STATUS_PRIORITY:
        if status_value in present:
            return status_value
    return IngestionStatus.PENDING


class ComposerSerializer(serializers.ModelSerializer):
    """Serializes Composer entities and their biographical metadata.

    `pieces_count` is annotated by ComposerViewSet.get_queryset; falls back
    to a property lookup when this serializer is used outside the viewset
    (e.g. embedded in PieceSerializer responses).
    """
    full_name = serializers.SerializerMethodField()
    pieces_count = serializers.SerializerMethodField()
    is_orphan = serializers.SerializerMethodField()

    class Meta:
        model = Composer
        fields = [
            'id', 'first_name', 'last_name', 'full_name',
            'birth_year', 'death_year',
            'nationality', 'period', 'bio',
            'portrait_url', 'portrait_license',
            'mbid', 'wikidata_qid', 'aliases',
            'pieces_count', 'is_orphan',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'mbid', 'wikidata_qid',
            'pieces_count', 'is_orphan',
            'created_at', 'updated_at',
        ]

    def get_full_name(self, obj: Composer) -> str:
        return f"{obj.first_name} {obj.last_name}".strip()

    def get_pieces_count(self, obj: Composer) -> int:
        # Prefer the annotated value when present (composer list view).
        annotated = getattr(obj, 'pieces_count_annotated', None)
        if annotated is not None:
            return annotated
        # Fallback: live count. OK for single-composer detail responses.
        return obj.pieces.filter(is_deleted=False).count()

    def get_is_orphan(self, obj: Composer) -> bool:
        return self.get_pieces_count(obj) == 0


class TrackSerializer(serializers.ModelSerializer):
    """Serializes individual rehearsal tracks with human-readable voice line."""
    voice_part_display = serializers.CharField(source='get_voice_part_display', read_only=True)
    audio_file = serializers.FileField(use_url=True)

    class Meta:
        model = Track
        fields = ['id', 'piece', 'voice_part', 'voice_part_display', 'audio_file']


class PieceVoiceRequirementSerializer(serializers.ModelSerializer):
    """Serializes vocal arrangement requirements (divisi) for a specific piece."""
    voice_line_display = serializers.CharField(source='get_voice_line_display', read_only=True)

    class Meta:
        model = PieceVoiceRequirement
        fields = ['id', 'piece', 'voice_line', 'voice_line_display', 'quantity']


# ===========================================================================
# AI-enriched nested entities — read-only inside Piece responses
# ===========================================================================
# All four (Movement, Translation, Recording, ProgramNote) are populated by
# the Score Compiler pipeline. They have dedicated future write endpoints —
# inline editing inside Piece would conflate write semantics.

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


# ---------------------------------------------------------------------------
# Write serializers for the three AI artifacts the conductor corrects inline.
# The read-only variants above stay embedded in PieceSerializer; these power the
# standalone Movement/Translation/Recording endpoints so a hallucinated movement,
# a wrong translation line, or an irrelevant recording can actually be fixed or
# deleted from the review cockpit.
# ---------------------------------------------------------------------------

class MovementWriteSerializer(serializers.ModelSerializer):
    """Read+write Movement payload for `MovementViewSet`."""
    class Meta:
        model = Movement
        fields = ['id', 'piece', 'order_index', 'title', 'tempo_marking',
                  'duration_seconds', 'voicing_override', 'starts_on_page']
        read_only_fields = ['id']


class TranslationWriteSerializer(serializers.ModelSerializer):
    """Read+write Translation payload for `TranslationViewSet`."""
    class Meta:
        model = Translation
        fields = ['id', 'piece', 'movement', 'target_language', 'text', 'is_singable']
        read_only_fields = ['id']


class RecordingWriteSerializer(serializers.ModelSerializer):
    """Read+write Recording payload for `RecordingViewSet` — toggle the featured
    pick, drop an irrelevant hit, or paste a hand-picked URL."""
    source_display = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = Recording
        fields = ['id', 'piece', 'source', 'source_display', 'external_id', 'url',
                  'performer', 'year', 'duration_seconds', 'is_featured']
        read_only_fields = ['id', 'source_display']


# Hard limits on stored markup — defensive bounds so a malformed or hostile
# payload can never bloat the row or persist a shape the renderer drops silently.
_MAX_PATHS = 256
_MAX_POINTS_PER_PATH = 8000
_MAX_TEXT_LEN = 2000
_MAX_STROKE_WIDTH = 0.2  # fraction of page width
_NOTE_DISPLAY_MODES = ('pin', 'inline')


def _clamp01(value: Any) -> float:
    """Coerce to float and clamp into the normalized page box [0, 1]."""
    try:
        return min(1.0, max(0.0, float(value)))
    except (TypeError, ValueError) as exc:
        raise serializers.ValidationError(
            {'payload': _('Coordinates must be numbers.')}
        ) from exc


class AnnotationSerializer(serializers.ModelSerializer):
    """
    PDF markup overlay — conductor score annotations (freehand ink, highlighter
    strokes, pinned/inline rehearsal comments). Used both nested-read inside
    ScoreEditionDetailSerializer and as the write payload for AnnotationViewSet,
    hence `edition` is writable here. `created_by` is stamped server-side from
    the request user and never trusted from the client.

    The `payload` shape is validated AND sanitized per `annotation_type` on
    write: coordinates are clamped to the normalized page box, sizes are bounded,
    and the cleaned object is what gets persisted — the DB never holds a shape
    the frontend type-guards would silently discard.
    """
    class Meta:
        model = Annotation
        fields = ['id', 'edition', 'page_number', 'annotation_type', 'payload',
                  'color', 'layer_name', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        # On PATCH either field may be absent; resolve the effective pair so the
        # payload is always validated against the type it will be stored under.
        touches_shape = 'payload' in attrs or 'annotation_type' in attrs
        if not touches_shape:
            return attrs
        atype = attrs.get(
            'annotation_type', getattr(self.instance, 'annotation_type', None)
        )
        payload = attrs.get('payload', getattr(self.instance, 'payload', None))
        attrs['payload'] = self._clean_payload(atype, payload)
        return attrs

    def _clean_payload(self, atype: str | None, payload: Any) -> dict[str, Any]:
        if not isinstance(payload, Mapping):
            raise serializers.ValidationError(
                {'payload': _('Payload must be an object.')}
            )
        if atype in (AnnotationType.FREEHAND, AnnotationType.HIGHLIGHT):
            return self._clean_strokes(payload)
        if atype == AnnotationType.COMMENT:
            return self._clean_comment(payload)
        if atype == AnnotationType.STAMP:
            return self._clean_stamp(payload)
        raise serializers.ValidationError(
            {'annotation_type': _('Unsupported annotation type.')}
        )

    def _clean_strokes(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        raw_paths = payload.get('paths')
        if not isinstance(raw_paths, (list, tuple)) or not raw_paths:
            raise serializers.ValidationError(
                {'payload': _('Freehand payload requires a non-empty "paths" list.')}
            )
        if len(raw_paths) > _MAX_PATHS:
            raise serializers.ValidationError(
                {'payload': _('Too many strokes in one marking.')}
            )
        cleaned_paths: list[list[list[float]]] = []
        for path in raw_paths:
            if not isinstance(path, (list, tuple)) or not path:
                raise serializers.ValidationError(
                    {'payload': _('Each stroke must be a non-empty list of points.')}
                )
            if len(path) > _MAX_POINTS_PER_PATH:
                raise serializers.ValidationError(
                    {'payload': _('A stroke has too many points.')}
                )
            cleaned_points: list[list[float]] = []
            for point in path:
                if not isinstance(point, (list, tuple)) or len(point) != 2:
                    raise serializers.ValidationError(
                        {'payload': _('Each point must be an [x, y] pair.')}
                    )
                cleaned_points.append([_clamp01(point[0]), _clamp01(point[1])])
            cleaned_paths.append(cleaned_points)
        try:
            width = float(payload.get('width', 0.004))
        except (TypeError, ValueError) as exc:
            raise serializers.ValidationError(
                {'payload': _('Stroke width must be a number.')}
            ) from exc
        width = min(_MAX_STROKE_WIDTH, max(0.0005, width))
        return {'paths': cleaned_paths, 'width': width}

    def _clean_comment(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        text = payload.get('text')
        if not isinstance(text, str) or not text.strip():
            raise serializers.ValidationError(
                {'payload': _('A comment requires non-empty text.')}
            )
        display = payload.get('display', 'pin')
        if display not in _NOTE_DISPLAY_MODES:
            display = 'pin'
        return {
            'x': _clamp01(payload.get('x')),
            'y': _clamp01(payload.get('y')),
            'text': text.strip()[:_MAX_TEXT_LEN],
            'display': display,
        }

    def _clean_stamp(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        symbol = payload.get('symbol')
        if not isinstance(symbol, str) or not symbol.strip():
            raise serializers.ValidationError(
                {'payload': _('A stamp requires a "symbol" code.')}
            )
        return {
            'x': _clamp01(payload.get('x')),
            'y': _clamp01(payload.get('y')),
            'symbol': symbol.strip()[:40],
        }


# ===========================================================================
# Edition serializers (read + write + upload)
# ===========================================================================

class PieceEditionSummarySerializer(serializers.ModelSerializer):
    """Lean ScoreEdition payload embedded in Piece read responses.

    Powers the PDF download list and per-edition status chips inside the
    Archive editor. The full review payload (with annotations + sha256) is
    only served from the ScoreEdition detail endpoint.
    """
    pdf_file = serializers.SerializerMethodField()
    ingestion_status_display = serializers.CharField(
        source='get_ingestion_status_display', read_only=True,
    )

    class Meta:
        model = ScoreEdition
        fields = [
            'id', 'pdf_file', 'original_filename', 'publisher',
            'edition_year', 'editor_name', 'page_count',
            'is_default', 'ingestion_status', 'ingestion_status_display',
            'ingestion_progress', 'ingestion_cost_cents', 'ingestion_error',
            'created_at', 'updated_at',
        ]
        # `pdf_file` is a declared method field (read-only by nature) and must not
        # appear in read_only_fields, so list the model fields explicitly.
        read_only_fields = [f for f in fields if f != 'pdf_file']

    def get_pdf_file(self, obj: ScoreEdition) -> str | None:
        return score_download_url(obj, self.context)


class ScoreEditionListSerializer(serializers.ModelSerializer):
    """Lean ScoreEdition list payload — used by the Archive upload queue."""
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
            'ingestion_status', 'ingestion_status_display', 'ingestion_progress',
            'ingestion_cost_cents', 'ingestion_cost_cents_lifetime', 'ingestion_error',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_composer_name(self, obj: ScoreEdition) -> str:
        if not obj.piece or not obj.piece.composer:
            return ''
        c = obj.piece.composer
        return f"{c.first_name} {c.last_name}".strip()


class ScoreEditionDetailSerializer(serializers.ModelSerializer):
    """Full ScoreEdition payload — includes annotations and SHA-256."""
    pdf_file = serializers.SerializerMethodField()
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
            'ingestion_status', 'ingestion_status_display', 'ingestion_progress',
            'ingestion_cost_cents', 'ingestion_cost_cents_lifetime', 'ingestion_error',
            'created_at', 'updated_at',
        ]
        # `pdf_file` (declared method field) is read-only by nature; never list it
        # in read_only_fields or DRF raises an assertion error.
        read_only_fields = [
            'id', 'page_count', 'sha256', 'uploaded_by',
            'piece', 'annotations',
            'ingestion_status', 'ingestion_status_display', 'ingestion_progress',
            'ingestion_cost_cents', 'ingestion_cost_cents_lifetime', 'ingestion_error',
            'created_at', 'updated_at',
        ]

    def get_pdf_file(self, obj: ScoreEdition) -> str | None:
        return score_download_url(obj, self.context)


class ScoreEditionUploadSerializer(serializers.Serializer):
    """Multipart payload — pdf_file plus optional descriptive metadata."""
    pdf_file = serializers.FileField(required=True)
    original_filename = serializers.CharField(max_length=255, required=False, allow_blank=True)
    publisher = serializers.CharField(max_length=120, required=False, allow_blank=True)
    edition_year = serializers.IntegerField(required=False, allow_null=True)
    editor_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    is_default = serializers.BooleanField(required=False, default=False)
    # When uploading a PDF for an *existing* Piece, the resolver step is
    # skipped — the caller already knows the work identity. Untyped Pieces
    # (no PDFs yet) get this from the manual-create flow; AI-discovered
    # Pieces get it from the resolver. Either way the FK is set explicitly.
    piece_id = serializers.UUIDField(required=False, allow_null=True)


# ===========================================================================
# Piece — the aggregate root serializer
# ===========================================================================

# Fields the manager can edit by hand from the Archive editor.
# Sub-entities (editions, recordings, translations, movements, program_notes)
# go through their own endpoints.
_PIECE_WRITABLE_FIELDS: tuple[str, ...] = (
    'title',
    'composer_id',
    'arranger',
    'language',
    'estimated_duration',
    'voicing',
    'description',
    'lyrics_original',
    'lyrics_ipa',
    'composition_year',
    'epoch',
    'opus_catalog',
    'musical_key',
    'text_source',
    'voice_requirements',
)


class PieceSerializer(serializers.ModelSerializer):
    """
    Single read+write serializer for the Piece aggregate root.

    Read shape: nested composer + all AI-enriched relations + editions list.
    Ingestion status is derived from editions.

    Write shape: send any subset of [_PIECE_WRITABLE_FIELDS] as JSON.
    `composer_id` (UUID) sets the composer FK. `voice_requirements` is a
    JSON list of `{voice_line, quantity}` objects — replaces the prior
    `requirements_data` write-only field with a same-named, same-shape field
    that round-trips cleanly with the read payload.
    """
    composer = ComposerSerializer(read_only=True)
    composer_id = serializers.PrimaryKeyRelatedField(
        source='composer',
        queryset=Composer.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

    tracks = TrackSerializer(many=True, read_only=True)
    voice_requirements_read = PieceVoiceRequirementSerializer(
        source='voice_requirements', many=True, read_only=True,
    )
    voice_requirements = serializers.JSONField(write_only=True, required=False)

    movements = MovementSerializer(many=True, read_only=True)
    translations = TranslationSerializer(many=True, read_only=True)
    recordings = RecordingSerializer(many=True, read_only=True)
    program_notes = ProgramNoteSerializer(many=True, read_only=True)
    editions = PieceEditionSummarySerializer(many=True, read_only=True)

    epoch_display = serializers.CharField(source='get_epoch_display', read_only=True)
    ingestion_status = serializers.SerializerMethodField()
    ingestion_status_display = serializers.SerializerMethodField()
    # Per-field source attribution (AI / MusicBrainz / verified) + confidence.
    # Only populated on the piece-detail endpoint (review cockpit) — see
    # `PieceViewSet.get_serializer_context` — so the list stays a single query.
    provenance = serializers.SerializerMethodField()

    class Meta:
        model = Piece
        fields = [
            'id',
            'title',
            'composer', 'composer_id',
            'arranger',
            'language',
            'estimated_duration',
            'voicing',
            'description',
            'lyrics_original',
            'lyrics_ipa',
            'composition_year',
            'epoch', 'epoch_display',
            'opus_catalog',
            'musical_key',
            'text_source',
            'mbid_work',
            # Derived
            'ingestion_status', 'ingestion_status_display',
            'provenance',
            # Read-only nested relations
            'tracks',
            'voice_requirements',          # write-only
            'voice_requirements_read',     # read-only mirror
            'movements',
            'translations',
            'recordings',
            'program_notes',
            'editions',
            # Audit
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'mbid_work', 'created_at', 'updated_at',
        ]

    # ---- Derived fields ----------------------------------------------------

    def get_ingestion_status(self, obj: Piece) -> str:
        return _aggregate_ingestion_status(obj)

    def get_ingestion_status_display(self, obj: Piece) -> str:
        code = _aggregate_ingestion_status(obj)
        return str(dict(IngestionStatus.choices).get(code, code))

    def get_provenance(self, obj: Piece) -> dict[str, Any]:
        # Gated: skip the extra query on list responses (many pieces, no review).
        if not self.context.get('include_provenance'):
            return {}
        return build_piece_provenance_index(obj)

    # ---- Write validation --------------------------------------------------

    def validate_voice_requirements(self, value: Any) -> list[dict[str, Any]] | None:
        """Validate the list-of-{voice_line, quantity} payload via Pydantic.

        Multipart uploads serialise nested JSON as a string; accept both raw
        lists and JSON strings so the form doesn't have to know the transport.
        """
        if value is None or value == '':
            return None

        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError(
                    'voice_requirements must be valid JSON.',
                ) from exc

        if not isinstance(value, list):
            raise serializers.ValidationError(
                'voice_requirements must be a list of {voice_line, quantity} objects.',
            )

        validated: list[dict[str, Any]] = []
        seen: set[str] = set()
        duplicates: set[str] = set()
        for index, requirement in enumerate(value):
            if not isinstance(requirement, dict):
                raise serializers.ValidationError({
                    str(index): 'Requirement entries must be objects.',
                })
            try:
                dto = VoiceRequirementDTO(**requirement)
            except PydanticValidationError as exc:
                clean = exc.errors(include_url=False, include_input=False, include_context=False)
                raise serializers.ValidationError({str(index): cast("list[Any]", clean)}) from exc
            if dto.voice_line in seen:
                duplicates.add(dto.voice_line)
            seen.add(dto.voice_line)
            validated.append(dto.model_dump())

        if duplicates:
            raise serializers.ValidationError(
                f"voice_requirements contains duplicate voice lines: "
                f"{', '.join(sorted(duplicates))}.",
            )
        return validated

    # ---- DTO assembly ------------------------------------------------------

    def to_dto(self, instance: Piece | None = None) -> PieceWriteDTO:
        """Assemble a PieceWriteDTO from validated data, defaulting from the instance for PATCH."""
        vd = self.validated_data

        req_dtos: tuple[VoiceRequirementDTO, ...] | None = None
        if 'voice_requirements' in vd and vd['voice_requirements'] is not None:
            req_dtos = tuple(
                VoiceRequirementDTO(voice_line=req['voice_line'], quantity=req['quantity'])
                for req in vd['voice_requirements']
            )

        composer_id = None
        if 'composer' in vd:
            composer_id = vd['composer'].id if vd['composer'] else None
        elif instance is not None and instance.composer_id:
            composer_id = instance.composer_id

        def pick(field: str, default: Any) -> Any:
            return vd.get(field, getattr(instance, field, default) if instance else default)

        return PieceWriteDTO(
            title=pick('title', ''),
            composer_id=composer_id,
            arranger=pick('arranger', ''),
            language=pick('language', ''),
            estimated_duration=pick('estimated_duration', None),
            voicing=pick('voicing', ''),
            description=pick('description', ''),
            lyrics_original=pick('lyrics_original', ''),
            lyrics_ipa=pick('lyrics_ipa', ''),
            composition_year=pick('composition_year', None),
            epoch=pick('epoch', ''),
            opus_catalog=pick('opus_catalog', ''),
            musical_key=pick('musical_key', ''),
            text_source=pick('text_source', ''),
            voice_requirements=req_dtos,
        )
