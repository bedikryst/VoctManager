"""
Django Admin interface configuration for the Roster application.
Author: Krystian Bugalski

Customizes the administrative dashboard for managing artists, projects, 
rehearsals, and cast assignments. Focuses on providing an intuitive 
interface for the ensemble's management and artistic director.
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Artist, Project, Participation, ProgramItem, 
    Rehearsal, Attendance, ProjectPieceCasting, 
    Collaborator, CrewAssignment
)

__author__ = "Krystian Bugalski"

@admin.register(Artist)
class ArtistAdmin(admin.ModelAdmin):
    """Admin view for managing ensemble members and their vocal profiles."""
    list_display = ('first_name', 'last_name', 'email', 'voice_type', 'user', 'is_active')
    list_filter = ('voice_type', 'is_active')
    search_fields = ('first_name', 'last_name', 'email')
    fields = ('user', 'first_name', 'last_name', 'email', 'voice_type', 'is_active', 'sight_reading_skill', 'vocal_range_bottom', 'vocal_range_top')


class ProgramItemInline(admin.TabularInline):
    """
    Inline admin interface for the concert program.
    Allows the conductor to build and reorder the setlist directly from the Project view.
    """
    model = ProgramItem
    extra = 1


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    """Admin view for managing concert logistics and programs."""
    list_display = ('title', 'start_date', 'end_date', 'location')
    list_filter = ('start_date',)
    search_fields = ('title', 'location')
    inlines = [ProgramItemInline]


@admin.register(Participation)
class ParticipationAdmin(admin.ModelAdmin):
    """Admin view for managing artist contracts and project assignments."""
    list_display = ('artist', 'project', 'status', 'fee', 'download_pdf_button')
    list_filter = ('status', 'project')
    search_fields = ('artist__first_name', 'artist__last_name', 'project__title')
    
    def download_pdf_button(self, obj):
        """Generates a direct download button for the artist's PDF contract."""
        return format_html(
            '<a href="/api/participations/{}/contract/" target="_blank" '
            'style="background-color: #417690; color: white; padding: 5px 10px; '
            'border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 11px;">'
            '📄 Pobierz Umowę</a>',
            obj.id
        )
    download_pdf_button.short_description = "Dokumenty"


# Registering secondary models for standard CRUD operations
admin.site.register(ProjectPieceCasting)
admin.site.register(Rehearsal)
admin.site.register(Attendance)
admin.site.register(Collaborator)
admin.site.register(CrewAssignment)