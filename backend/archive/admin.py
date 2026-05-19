# archive/admin.py
# ==========================================
# Archive Admin Configuration
# ==========================================
"""
Django Admin interface configuration for the Archive application.
@author Krystian Bugalski

Customizes the administrative panel to provide a seamless data entry 
experience for the management team. Includes deeply integrated inline 
management for audio tracks and divis/vocal requirements.
"""

from django.contrib import admin
from .models import (
    Composer, Piece, Track, PieceVoiceRequirement,
    Movement, ScoreEdition, Translation, Recording,
    Annotation, ProgramNote, ProvenanceRecord,
)

@admin.register(Composer)
class ComposerAdmin(admin.ModelAdmin):
    """Admin view for managing composers and arrangers."""
    list_display = ('first_name', 'last_name', 'birth_year', 'death_year', 'nationality', 'period', 'mbid')
    list_filter = ('period', 'nationality')
    search_fields = ('first_name', 'last_name', 'mbid', 'wikidata_qid')
    ordering = ('last_name', 'first_name')
    readonly_fields = ('mbid', 'wikidata_qid')


class TrackInline(admin.TabularInline):
    """
    Inline admin interface for Tracks.
    Allows adding multiple audio tracks directly from the Piece admin page.
    """
    model = Track
    extra = 1
    fields = ('voice_part', 'audio_file')


class PieceVoiceRequirementInline(admin.TabularInline):
    """
    Inline admin interface for Voice Requirements.
    Allows defining required vocal lines (divisi) directly within the Piece view.
    """
    model = PieceVoiceRequirement
    extra = 1


class MovementInline(admin.TabularInline):
    model = Movement
    extra = 0
    fields = ('order_index', 'title', 'tempo_marking', 'duration_seconds', 'starts_on_page')
    ordering = ('order_index',)


class ScoreEditionInline(admin.TabularInline):
    model = ScoreEdition
    extra = 0
    fields = ('original_filename', 'publisher', 'edition_year', 'page_count', 'is_default', 'ingestion_status')
    readonly_fields = ('page_count', 'ingestion_status')


@admin.register(Piece)
class PieceAdmin(admin.ModelAdmin):
    """Admin view for managing musical pieces, sheet music, and historical metadata."""
    list_display = ('title', 'composer', 'epoch', 'composition_year', 'arranger', 'voicing', 'ingestion_status')
    list_filter = ('epoch', 'language', 'composer', 'ingestion_status')
    search_fields = ('title', 'composer__last_name', 'arranger', 'opus_catalog', 'mbid_work')
    inlines = [PieceVoiceRequirementInline, MovementInline, ScoreEditionInline, TrackInline]
    readonly_fields = ('mbid_work',)


@admin.register(Movement)
class MovementAdmin(admin.ModelAdmin):
    list_display = ('piece', 'order_index', 'title', 'tempo_marking', 'duration_seconds')
    list_filter = ('piece',)
    search_fields = ('title', 'piece__title')
    ordering = ('piece', 'order_index')


class AnnotationInline(admin.TabularInline):
    model = Annotation
    extra = 0
    fields = ('page_number', 'annotation_type', 'layer_name', 'color', 'created_by')
    readonly_fields = ('created_by',)


@admin.register(ScoreEdition)
class ScoreEditionAdmin(admin.ModelAdmin):
    list_display = ('piece', 'publisher', 'edition_year', 'page_count', 'is_default', 'ingestion_status', 'ingestion_cost_cents')
    list_filter = ('ingestion_status', 'is_default', 'publisher')
    search_fields = ('piece__title', 'publisher', 'editor_name', 'original_filename', 'sha256')
    readonly_fields = ('sha256', 'page_count', 'ingestion_cost_cents', 'ingestion_error', 'uploaded_by')
    inlines = [AnnotationInline]


@admin.register(Translation)
class TranslationAdmin(admin.ModelAdmin):
    list_display = ('piece', 'movement', 'target_language', 'is_singable')
    list_filter = ('target_language', 'is_singable')
    search_fields = ('piece__title', 'movement__title', 'text')


@admin.register(Recording)
class RecordingAdmin(admin.ModelAdmin):
    list_display = ('piece', 'source', 'performer', 'year', 'is_featured')
    list_filter = ('source', 'is_featured')
    search_fields = ('piece__title', 'performer', 'external_id')


@admin.register(Annotation)
class AnnotationAdmin(admin.ModelAdmin):
    list_display = ('edition', 'page_number', 'annotation_type', 'layer_name', 'created_by', 'created_at')
    list_filter = ('annotation_type', 'layer_name')
    search_fields = ('edition__piece__title', 'layer_name')


@admin.register(ProgramNote)
class ProgramNoteAdmin(admin.ModelAdmin):
    list_display = ('piece', 'project', 'language', 'target_tone', 'word_count_target', 'is_approved')
    list_filter = ('language', 'target_tone', 'is_approved')
    search_fields = ('piece__title', 'project__title', 'content')


@admin.register(ProvenanceRecord)
class ProvenanceRecordAdmin(admin.ModelAdmin):
    list_display = ('field_name', 'source', 'source_reference', 'confidence', 'model_version', 'prompt_version', 'retrieved_at')
    list_filter = ('source', 'content_type')
    search_fields = ('field_name', 'source_reference', 'prompt_version', 'model_version')
    readonly_fields = (
        'content_type', 'object_id', 'field_name', 'source', 'source_reference',
        'confidence', 'prompt_version', 'model_version', 'retrieved_at',
    )