"""
Django Admin interface configuration for the Archive application.
Author: Krystian Bugalski

This module customizes how Composer, Piece, and Track models are displayed 
and managed within the built-in Django administrative panel.
"""

from django.contrib import admin
from .models import Composer, Piece, Track

__author__ = "Krystian Bugalski"

@admin.register(Composer)
class ComposerAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'birth_year', 'death_year')
    search_fields = ('first_name', 'last_name')
    ordering = ('last_name', 'first_name')

class TrackInline(admin.TabularInline):
    """
    Allows adding multiple audio tracks directly from the Piece admin page.
    """
    model = Track
    extra = 1  # Number of empty rows displayed by default for uploading new files
    fields = ('voice_part', 'audio_file')

@admin.register(Piece)
class PieceAdmin(admin.ModelAdmin):
    list_display = ('title', 'composer', 'voicing')
    list_filter = ('voicing', 'composer')
    search_fields = ('title', 'composer__last_name')
    
    # Attach the Track form inside the Piece form
    inlines = [TrackInline]