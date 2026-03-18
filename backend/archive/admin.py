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
from .models import Composer, Piece, Track, PieceVoiceRequirement

@admin.register(Composer)
class ComposerAdmin(admin.ModelAdmin):
    """Admin view for managing composers and arrangers."""
    list_display = ('first_name', 'last_name', 'birth_year', 'death_year')
    search_fields = ('first_name', 'last_name')
    ordering = ('last_name', 'first_name')


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


@admin.register(Piece)
class PieceAdmin(admin.ModelAdmin):
    """Admin view for managing musical pieces, sheet music, and historical metadata."""
    list_display = ('title', 'composer', 'epoch', 'composition_year', 'arranger', 'voicing')
    list_filter = ('epoch', 'language', 'composer')
    search_fields = ('title', 'composer__last_name', 'arranger')
    inlines = [PieceVoiceRequirementInline, TrackInline]