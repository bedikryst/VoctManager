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
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

from core.models import UserProfile

from .models import (
    Artist,
    Attendance,
    Collaborator,
    CrewAssignment,
    Participation,
    ProgramItem,
    Project,
    ProjectPieceCasting,
    Rehearsal,
)

User = get_user_model()

# --- One person, one screen ------------------------------------------------
#
# A member is spread over three tables — the account, its preferences, and the
# choral profile — which as three separate admin entries reads as three separate
# people. Composing the latter two as inlines on the account restores the single
# subject. Assembled here rather than in `core` because roster is the layer
# permitted to know about both sides; core must not import from it.


class UserProfileInline(admin.StackedInline):
    """Preferences and business role, edited in place on the person."""
    model = UserProfile
    fk_name = 'user'
    can_delete = False
    max_num = 1
    verbose_name_plural = _("Preferences & role")
    readonly_fields = ('calendar_token', 'terms_accepted_at', 'terms_accepted_version')

    def get_queryset(self, request):
        # The default manager hides soft-deleted rows, which would render this
        # section deceptively empty for a person whose data is still on file.
        return UserProfile.all_objects.all()


class ArtistInline(admin.StackedInline):
    """Choral profile, edited in place on the person."""
    model = Artist
    fk_name = 'user'
    can_delete = False
    max_num = 1
    verbose_name_plural = _("Choral profile")
    # Roster standing moves only through ArtistHRService.archive_artist /
    # restore_artist, which also revoke or restore the login. Editing either flag
    # by hand is what lets a singer read as archived while still signing in.
    readonly_fields = ('is_active', 'is_deleted', 'activation_email_sent_at')

    def get_queryset(self, request):
        return Artist.all_objects.all()


admin.site.unregister(User)


@admin.register(User)
class PersonAdmin(DjangoUserAdmin):
    """The account, with its preferences and choral profile attached."""
    inlines = [UserProfileInline, ArtistInline]
    list_display = ('email', 'first_name', 'last_name', 'business_role', 'voice', 'is_active', 'is_staff')
    list_filter = ('is_active', 'is_staff', 'profile__role', 'artist_profile__voice_type')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('email',)
    list_select_related = ('profile', 'artist_profile')

    @admin.display(description=_("Role"), ordering='profile__role')
    def business_role(self, obj) -> str:
        profile = getattr(obj, 'profile', None)
        return profile.get_role_display() if profile else "—"

    @admin.display(description=_("Voice"), ordering='artist_profile__voice_type')
    def voice(self, obj) -> str:
        artist = getattr(obj, 'artist_profile', None)
        return artist.get_voice_type_display() if artist else "—"


@admin.register(Artist)
class ArtistAdmin(admin.ModelAdmin):
    """
    Choral profiles on their own.

    Kept alongside the person screen rather than folded into it, because an
    Artist outlives its account: GDPR erasure detaches the login (`user` becomes
    null) and the row survives to keep concert history intact. Reachable only
    from here.
    """
    list_display = ('first_name', 'last_name', 'email', 'voice_type', 'user', 'is_active')
    list_filter = ('voice_type', 'is_active')
    search_fields = ('first_name', 'last_name', 'email')
    # See ArtistInline: the archived state is a service's to move, not a form's.
    readonly_fields = ('is_active',)
    # No vocative here: it belongs to the account profile, edited on the person
    # screen above, which is also where a manager or crew member gets one.
    fields = (
        'user', 'first_name', 'last_name', 'email', 'phone_number',
        'voice_type', 'is_active', 'sight_reading_skill', 'vocal_range_bottom', 'vocal_range_top',
    )

    def get_queryset(self, request):
        # Detached and archived rows are exactly the ones that need this screen.
        return Artist.all_objects.select_related('user')


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
    
    @admin.display(description="Dokumenty")
    def download_pdf_button(self, obj):
        """Generates a direct download button for the artist's PDF legal contract."""
        return format_html(
            '<a href="/api/participations/{}/contract/" target="_blank" '
            'style="background-color: #417690; color: white; padding: 5px 10px; '
            'border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 11px;">'
            '📄 Pobierz Umowę</a>',
            obj.id
        )


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