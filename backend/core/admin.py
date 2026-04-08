from django.contrib import admin
from .models import UserProfile
# Register your models here.

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """Admin view for managing user preferences and logistics data."""
    list_display = ('user', 'phone_number', 'language', 'timezone', 'dietary_preference')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
    list_filter = ('language', 'timezone', 'dietary_preference')