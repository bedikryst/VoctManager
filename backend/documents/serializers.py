# documents/serializers.py
# ==========================================
# Chorister Hub DRF Serializers
# Standard: Enterprise SaaS 2026
# ==========================================
import magic
from rest_framework import serializers

from core.constants import AppRole
from .models import DocumentCategory, Document, DocumentIconKey

_ALLOWED_MIME_TYPES: frozenset[str] = frozenset({
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/csv',
})

_MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
_MAGIC_CHUNK_BYTES: int = 2048


class DocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'title', 'description', 'file_url',
            'file_size_bytes', 'mime_type', 'allowed_roles',
            'order', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_file_url(self, obj: Document) -> str:
        request = self.context.get('request')
        if not request:
            return ''
        from django.urls import reverse
        return request.build_absolute_uri(
            reverse('document-download', kwargs={'pk': obj.id})
        )


class DocumentCategorySerializer(serializers.ModelSerializer):
    documents = serializers.SerializerMethodField()

    class Meta:
        model = DocumentCategory
        fields = [
            'id', 'name', 'slug', 'description', 'icon_key',
            'order', 'allowed_roles', 'documents',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_documents(self, obj: DocumentCategory) -> list[dict]:
        docs = obj.documents.all()
        return DocumentSerializer(docs, many=True, context=self.context).data


class DocumentCategoryCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    description = serializers.CharField(max_length=2000, default='', allow_blank=True)
    icon_key = serializers.ChoiceField(choices=DocumentIconKey.values)
    order = serializers.IntegerField(min_value=0, default=0)
    allowed_roles = serializers.ListField(
        child=serializers.ChoiceField(choices=AppRole.values),
        min_length=1,
    )

    def validate_name(self, value: str) -> str:
        return value.strip()


class DocumentCategoryUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    icon_key = serializers.ChoiceField(choices=DocumentIconKey.values, required=False)
    order = serializers.IntegerField(min_value=0, required=False)
    allowed_roles = serializers.ListField(
        child=serializers.ChoiceField(choices=AppRole.values),
        min_length=1,
        required=False,
    )


class DocumentUploadSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(max_length=2000, default='', allow_blank=True)
    file = serializers.FileField()
    allowed_roles = serializers.ListField(
        child=serializers.ChoiceField(choices=AppRole.values),
        default=list,
    )
    order = serializers.IntegerField(min_value=0, default=0)

    def validate_title(self, value: str) -> str:
        return value.strip()

    def validate_file(self, value):
        if value.size > _MAX_UPLOAD_SIZE_BYTES:
            raise serializers.ValidationError("File exceeds the maximum allowed size of 50 MB.")

        chunk = value.read(_MAGIC_CHUNK_BYTES)
        value.seek(0)

        detected_mime = magic.from_buffer(chunk, mime=True)
        if detected_mime not in _ALLOWED_MIME_TYPES:
            raise serializers.ValidationError(
                f"File type '{detected_mime}' is not permitted. "
                "Allowed types: PDF, Office documents, images, plain text, CSV."
            )
        return value
