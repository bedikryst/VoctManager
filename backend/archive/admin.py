# archive/admin.py
# ==========================================
# Archive Admin Configuration
# ==========================================
"""
Django Admin interface configuration for the Archive application.
Author: Krystian Bugalski

Customizes the administrative panel to provide a seamless data entry 
experience for the management team.
"""

from django.contrib import admin
from .models import Composer, Piece, Track

@admin.register(Composer)
class ComposerAdmin(admin.ModelAdmin):
    """Admin view for managing composers."""
    list_display = ('first_name', 'last_name', 'birth_year', 'death_year')
    search_fields = ('first_name', 'last_name')
    ordering = ('last_name', 'first_name')


class TrackInline(admin.TabularInline):
    """
    Inline admin interface for Tracks.
    Allows adding multiple audio tracks directly from the Piece admin page,
    streamlining the data entry process.
    """
    model = Track
    extra = 1  
    fields = ('voice_part', 'audio_file')


@admin.register(Piece)
class PieceAdmin(admin.ModelAdmin):
    """Admin view for managing musical pieces, sheet music, and metadata."""
    list_display = ('title', 'composer', 'arranger', 'language', 'voicing')
    list_filter = ('language', 'voicing', 'composer')
    search_fields = ('title', 'composer__last_name', 'arranger')
    inlines = [TrackInline]