# documents/admin.py
from django.contrib import admin
from .models import DocumentCategory, Document


class DocumentInline(admin.TabularInline):
    model = Document
    extra = 0
    fields = ['title', 'file', 'mime_type', 'file_size_bytes', 'allowed_roles', 'order', 'is_deleted']
    readonly_fields = ['file_size_bytes', 'mime_type']


@admin.register(DocumentCategory)
class DocumentCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'icon_key', 'order', 'allowed_roles', 'is_deleted']
    list_filter = ['is_deleted', 'icon_key']
    search_fields = ['name', 'slug']
    ordering = ['order', 'name']
    inlines = [DocumentInline]
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'mime_type', 'file_size_bytes', 'order', 'is_deleted']
    list_filter = ['is_deleted', 'category', 'mime_type']
    search_fields = ['title', 'category__name']
    raw_id_fields = ['uploaded_by']
    ordering = ['category', 'order', 'title']
