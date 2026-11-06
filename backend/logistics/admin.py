"""
@file admin.py
@description Django admin for venues. Columns and search read only fields the
    Location model stores: the address is the single formatted line, with no
    separate city or country.
@module logistics/admin
"""

from django.contrib import admin

from .models import Location


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'formatted_address', 'timezone', 'is_active')
    search_fields = ('name', 'formatted_address')
    list_filter = ('category', 'is_active')
