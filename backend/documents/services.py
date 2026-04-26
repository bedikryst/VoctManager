# documents/services.py
# ==========================================
# Chorister Hub Service Layer
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
from uuid import UUID
from django.core.files.uploadedfile import UploadedFile
from django.db.models import Count, Q, Prefetch

from .models import DocumentCategory, Document
from .dtos import (
    DocumentCategoryCreateDTO,
    DocumentCategoryUpdateDTO,
    DocumentCreateDTO,
    VocalLineEntryDTO,
    ArtistIdentityMetricsDTO,
)
from core.constants import AppRole, VoiceLine

logger = logging.getLogger(__name__)


class DocumentCategoryNotFoundError(Exception):
    pass


class DocumentNotFoundError(Exception):
    pass


class InsufficientRoleError(Exception):
    pass


class DocumentService:
    """Encapsulates all business logic for the Knowledge Base module."""

    @staticmethod
    def get_visible_categories(user_role: str) -> list[DocumentCategory]:
        """
        Returns categories with their visible documents, filtered by the caller's role.
        Managers see all categories regardless of their allowed_roles configuration.
        """
        if user_role == AppRole.MANAGER:
            doc_qs = Document.objects.filter(is_deleted=False)
        else:
            doc_qs = Document.objects.filter(is_deleted=False).filter(
                Q(allowed_roles__contains=['ARTIST']) | Q(allowed_roles=[])
            )

        base_qs = DocumentCategory.objects.filter(
            is_deleted=False,
        ).prefetch_related(Prefetch('documents', queryset=doc_qs))

        if user_role == AppRole.MANAGER:
            return list(base_qs)

        return list(base_qs.filter(allowed_roles__contains=['ARTIST']))

    @staticmethod
    def get_all_categories_for_manager() -> list[DocumentCategory]:
        return list(
            DocumentCategory.objects.filter(is_deleted=False).prefetch_related(
                Prefetch('documents', queryset=Document.objects.filter(is_deleted=False))
            )
        )

    @staticmethod
    def get_artist_visible_categories() -> list[DocumentCategory]:
        return list(
            DocumentCategory.objects.filter(
                is_deleted=False,
                allowed_roles__contains=['ARTIST'],
            ).prefetch_related(
                Prefetch(
                    'documents',
                    queryset=Document.objects.filter(is_deleted=False).filter(
                        Q(allowed_roles__contains=['ARTIST']) | Q(allowed_roles=[])
                    ),
                )
            )
        )

    @staticmethod
    def create_category(dto: DocumentCategoryCreateDTO) -> DocumentCategory:
        return DocumentCategory.objects.create(
            name=dto.name,
            slug=dto.slug,
            description=dto.description,
            icon_key=dto.icon_key,
            order=dto.order,
            allowed_roles=dto.allowed_roles,
        )

    @staticmethod
    def update_category(category_id: UUID, dto: DocumentCategoryUpdateDTO) -> DocumentCategory:
        try:
            category = DocumentCategory.objects.get(id=category_id, is_deleted=False)
        except DocumentCategory.DoesNotExist:
            raise DocumentCategoryNotFoundError(f"DocumentCategory {category_id} not found.")

        patch_data = dto.model_dump(exclude_none=True)
        for field, value in patch_data.items():
            setattr(category, field, value)
        category.save()
        return category

    @staticmethod
    def delete_category(category_id: UUID) -> None:
        updated = DocumentCategory.objects.filter(id=category_id, is_deleted=False).update(is_deleted=True)
        if not updated:
            raise DocumentCategoryNotFoundError(f"DocumentCategory {category_id} not found.")

    @staticmethod
    def create_document(
        dto: DocumentCreateDTO,
        file: UploadedFile,
        file_size_bytes: int,
        mime_type: str,
    ) -> Document:
        try:
            category = DocumentCategory.objects.get(id=dto.category_id, is_deleted=False)
        except DocumentCategory.DoesNotExist:
            raise DocumentCategoryNotFoundError(f"DocumentCategory {dto.category_id} not found.")

        return Document.objects.create(
            category=category,
            title=dto.title,
            description=dto.description,
            file=file,
            file_size_bytes=file_size_bytes,
            mime_type=mime_type,
            allowed_roles=dto.allowed_roles,
            order=dto.order,
            uploaded_by_id=dto.uploaded_by_id,
        )

    @staticmethod
    def delete_document(document_id: UUID) -> None:
        updated = Document.objects.filter(id=document_id, is_deleted=False).update(is_deleted=True)
        if not updated:
            raise DocumentNotFoundError(f"Document {document_id} not found.")



class ArtistMetricsService:
    """
    Read-only analytics service for the Identity & Metrics module.
    Aggregates completed project history for a given artist.
    This service intentionally imports from `roster` as a read-only analytics layer.
    """

    _VOICE_LINE_LABELS: dict[str, str] = {
        vl.value: vl.label for vl in VoiceLine
    }

    @classmethod
    def get_metrics_for_artist(cls, artist_id: UUID) -> ArtistIdentityMetricsDTO:
        from roster.models import Participation, ProjectPieceCasting

        completed_participations = list(
            Participation.objects.filter(
                artist_id=artist_id,
                status='CON',
                project__status='DONE',
                is_deleted=False,
            ).select_related('project')
        )

        completed_projects = [p.project for p in completed_participations]
        participation_ids = [p.id for p in completed_participations]

        total_concerts = len(completed_projects)
        season_years = sorted({p.date_time.year for p in completed_projects})
        active_seasons = len(season_years)
        first_project_year = min(season_years) if season_years else None

        casting_counts = (
            ProjectPieceCasting.objects.filter(participation_id__in=participation_ids)
            .values('voice_line')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        vocal_distribution = [
            VocalLineEntryDTO(
                voice_line=entry['voice_line'],
                voice_line_display=cls._VOICE_LINE_LABELS.get(entry['voice_line'], entry['voice_line']),
                count=entry['count'],
            )
            for entry in casting_counts
        ]

        return ArtistIdentityMetricsDTO(
            total_concerts=total_concerts,
            active_seasons=active_seasons,
            season_years=season_years,
            vocal_line_distribution=vocal_distribution,
            first_project_year=first_project_year,
        )

    @classmethod
    def get_empty_metrics(cls) -> ArtistIdentityMetricsDTO:
        return ArtistIdentityMetricsDTO(
            total_concerts=0,
            active_seasons=0,
            season_years=[],
            vocal_line_distribution=[],
            first_project_year=None,
        )
