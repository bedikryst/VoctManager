# roster/admin.py
# ==========================================
# Roster Admin Configuration
# ==========================================
"""
Django Admin interface configuration for the Roster application.
@author Krystian Bugalski

Customizes the administrative dashboard for managing artists, projects, 
rehearsals, and cast assignments. Upgraded to Enterprise standards 
with comprehensive list displays, dynamic buttons, and relational filtering.
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Artist, Project, Participation, ProgramItem, 
    Rehearsal, Attendance, ProjectPieceCasting, 
    Collaborator, CrewAssignment
)

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
    """Admin view for managing production lifecycles and global event logistics."""
    list_display = ('title', 'date_time', 'location', 'status')
    list_filter = ('status', 'date_time')
    search_fields = ('title', 'location')
    inlines = [ProgramItemInline]


@admin.register(Participation)
class ParticipationAdmin(admin.ModelAdmin):
    """Admin view for managing artist contracts and specific project assignments."""
    list_display = ('artist', 'project', 'status', 'fee', 'download_pdf_button')
    list_filter = ('status', 'project')
    search_fields = ('artist__first_name', 'artist__last_name', 'project__title')
    
    def download_pdf_button(self, obj):
        """Generates a direct download button for the artist's PDF legal contract."""
        return format_html(
            '<a href="/api/participations/{}/contract/" target="_blank" '
            'style="background-color: #417690; color: white; padding: 5px 10px; '
            'border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 11px;">'
            '📄 Pobierz Umowę</a>',
            obj.id
        )
    download_pdf_button.short_description = "Dokumenty"


@admin.register(ProjectPieceCasting)
class ProjectPieceCastingAdmin(admin.ModelAdmin):
    """Admin view for granular micro-casting (divisi) adjustments."""
    list_display = ('participation', 'piece', 'voice_line')
    list_filter = ('piece', 'participation__project')
    search_fields = ('participation__artist__last_name', 'piece__title')


@admin.register(Rehearsal)
class RehearsalAdmin(admin.ModelAdmin):
    """Admin view for physical rehearsal scheduling."""
    list_display = ('date_time', 'project', 'location', 'is_mandatory')
    list_filter = ('project', 'is_mandatory', 'date_time')
    search_fields = ('location', 'focus', 'project__title')


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    """Admin view for analyzing ensemble attendance compliance."""
    list_display = ('participation', 'rehearsal', 'status', 'minutes_late')
    list_filter = ('status', 'rehearsal__project')
    search_fields = ('participation__artist__last_name', 'excuse_note')


@admin.register(Collaborator)
class CollaboratorAdmin(admin.ModelAdmin):
    """Admin view for managing the database of external production vendors/staff."""
    list_display = ('first_name', 'last_name', 'specialty', 'company_name', 'phone_number')
    list_filter = ('specialty',)
    search_fields = ('first_name', 'last_name', 'company_name')


@admin.register(CrewAssignment)
class CrewAssignmentAdmin(admin.ModelAdmin):
    """Admin view for tracking external staff event assignments and fees."""
    list_display = ('collaborator', 'project', 'role_description', 'status', 'fee')
    list_filter = ('status', 'project')
    search_fields = ('collaborator__last_name', 'project__title', 'role_description')