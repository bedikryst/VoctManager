"""
Django Admin interface configuration for the Roster application.
Author: Krystian Bugalski

Customizes the management of Artists, Projects (Concerts), and their Participations.
Includes advanced UI enhancements like custom HTML buttons within the admin list view.
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import Artist, Project, Participation

__author__ = "Krystian Bugalski"

@admin.register(Artist)
class ArtistAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'email', 'voice_part', 'user', 'is_active')
    list_filter = ('voice_part', 'is_active')
    search_fields = ('first_name', 'last_name', 'email')
    fields = ('user', 'first_name', 'last_name', 'email', 'voice_part', 'is_active')

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'start_date', 'end_date', 'location')
    list_filter = ('start_date',)
    search_fields = ('title', 'location')
    # Provides an elegant dual-list box for selecting multiple repertoire pieces
    filter_horizontal = ('repertoire',)

@admin.register(Participation)
class ParticipationAdmin(admin.ModelAdmin):
    list_display = ('artist', 'project', 'status', 'fee', 'download_pdf_button')
    list_filter = ('status', 'project')
    search_fields = ('artist__first_name', 'artist__last_name', 'project__title')
    
    def download_pdf_button(self, obj):
        """
        Injects a custom HTML button directly into the admin list view.
        This provides admins with a one-click solution to download generated PDF contracts.
        """
        return format_html(
            '<a href="/contract/{}/" target="_blank" '
            'style="background-color: #417690; color: white; padding: 5px 10px; '
            'border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 11px;">'
            '📄 Pobierz Umowę</a>',
            obj.id
        )
    # Sets the column header name in the Django admin table
    download_pdf_button.short_description = "Dokumenty"