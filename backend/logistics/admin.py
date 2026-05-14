from django.contrib import admin
from .models import Location
# Register your models here.

class LocationAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'address', 'city', 'state', 'country')
    search_fields = ('name', 'address', 'city', 'state', 'country')
    list_filter = ('category',)

    def address(self, obj):
        return obj.formatted_address

    def city(self, obj):
        return obj.city

    def state(self, obj):
        return obj.state

    def country(self, obj):
        return obj.country

admin.site.register(Location, LocationAdmin)

# Register your models here.