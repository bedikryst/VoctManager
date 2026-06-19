# documents/services.py
# ==========================================
# Chorister Hub Service Layer
# Standard: Enterprise SaaS 2026
# ==========================================
import logging
from typing import TYPE_CHECKING, ClassVar
from uuid import UUID

from django.core.files.uploadedfile import UploadedFile
from django.db.models import Count, Prefetch, Q
from django.utils.functional import Promise

if TYPE_CHECKING:
    from rest_framework.request import Request

from core.constants import AppRole, VoiceLine

from .dtos import (
    ArtistIdentityMetricsDTO,
    ConcertPieceDTO,
    ConcertRosterDTO,
    DocumentCategoryCreateDTO,
    DocumentCategoryUpdateDTO,
    DocumentCreateDTO,
    EnsembleMeDTO,
    MyEnsembleDTO,
    PieceVoiceSectionDTO,
    RepertoireEntryDTO,
    SectionMemberDTO,
    VocalLineEntryDTO,
)
from .models import Document, DocumentCategory

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
            allowed_roles=list(dto.allowed_roles),
        )

    @staticmethod
    def update_category(category_id: UUID, dto: DocumentCategoryUpdateDTO) -> DocumentCategory:
        try:
            category = DocumentCategory.objects.get(id=category_id, is_deleted=False)
        except DocumentCategory.DoesNotExist:
            raise DocumentCategoryNotFoundError(f"DocumentCategory {category_id} not found.")

        patch_data = dto.model_dump(exclude_none=True, mode="json")
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
            allowed_roles=list(dto.allowed_roles),
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

    # Labels stay lazy here so translation resolves in the active request language;
    # they are materialized to concrete strings at the DTO boundary below.
    _VOICE_LINE_LABELS: ClassVar[dict[str, str | Promise]] = {
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
                voice_line_display=str(cls._VOICE_LINE_LABELS.get(entry['voice_line'], entry['voice_line'])),
                count=entry['count'],
            )
            for entry in casting_counts
        ]

        repertoire = cls._build_repertoire(participation_ids)
        composer_names = {entry.composer_name for entry in repertoire if entry.composer_name}

        return ArtistIdentityMetricsDTO(
            total_concerts=total_concerts,
            active_seasons=active_seasons,
            season_years=season_years,
            vocal_line_distribution=vocal_distribution,
            first_project_year=first_project_year,
            total_pieces=len(repertoire),
            total_composers=len(composer_names),
            attendance_rate=cls._compute_attendance_rate(participation_ids),
            repertoire=repertoire,
        )

    @classmethod
    def _build_repertoire(cls, participation_ids: list[UUID]) -> tuple[RepertoireEntryDTO, ...]:
        """
        Repertoire passport: every distinct piece the artist was cast on across
        completed projects, with performance counts, voice lines sung and years.
        """
        from roster.models import ProjectPieceCasting

        castings = (
            ProjectPieceCasting.objects.filter(participation_id__in=participation_ids)
            .select_related('piece__composer', 'participation__project')
        )

        grouped: dict[UUID, dict] = {}
        for casting in castings:
            piece = casting.piece
            bucket = grouped.setdefault(piece.pk, {
                'title': piece.title,
                'composer_name': (
                    f"{piece.composer.first_name} {piece.composer.last_name}".strip()
                    if piece.composer else ''
                ),
                'epoch': piece.epoch or '',
                'voice_lines': set(),
                'projects': set(),
                'years': set(),
            })
            bucket['voice_lines'].add(
                str(cls._VOICE_LINE_LABELS.get(casting.voice_line, casting.voice_line))
            )
            project = casting.participation.project
            bucket['projects'].add(project.pk)
            bucket['years'].add(project.date_time.year)

        entries = [
            RepertoireEntryDTO(
                piece_id=piece_id,
                title=data['title'],
                composer_name=data['composer_name'],
                epoch=data['epoch'],
                voice_lines=tuple(sorted(data['voice_lines'])),
                performances=len(data['projects']),
                years=tuple(sorted(data['years'])),
            )
            for piece_id, data in grouped.items()
        ]
        # Most recently performed first, then alphabetically for stable display.
        entries.sort(key=lambda e: (-max(e.years), e.title.lower()))
        return tuple(entries)

    @staticmethod
    def _compute_attendance_rate(participation_ids: list[UUID]) -> float | None:
        """
        Share of recorded rehearsal attendances marked PRESENT or LATE.
        Private to the chorister — never exposed in rankings.
        """
        from roster.models import Attendance

        rows = (
            Attendance.objects.filter(participation_id__in=participation_ids)
            .values('status')
            .annotate(count=Count('id'))
        )
        total = sum(row['count'] for row in rows)
        if total == 0:
            return None
        attended = sum(
            row['count'] for row in rows if row['status'] in ('PRESENT', 'LATE')
        )
        return round(attended / total * 100, 1)

    @classmethod
    def get_empty_metrics(cls) -> ArtistIdentityMetricsDTO:
        return ArtistIdentityMetricsDTO(
            total_concerts=0,
            active_seasons=0,
            season_years=[],
            vocal_line_distribution=[],
            first_project_year=None,
            total_pieces=0,
            total_composers=0,
            attendance_rate=None,
            repertoire=(),
        )


class EnsembleDirectoryService:
    """
    Concert roster for the authenticated chorister ("Z kim śpiewam").

    For each of the caller's OWN confirmed, upcoming concerts, and only for the
    pieces they are cast on, it returns the co-singers grouped by the voice line
    each sings IN THAT PIECE (which may differ piece to piece). It is strictly
    scoped to the caller's concerts — it never reveals the full ensemble, anyone's
    default/assigned voice type, nor the conductor's private capability data
    (sight-reading skill, vocal range). It exists only to serve the concert.

    The data it surfaces is the same already shown on the materials "Obsada" tab
    (roster.dashboard_serializers.CastingSnippetSerializer).
    """

    # Upcoming / in-prep concerts only — closed and cancelled projects drop off.
    _OPEN_PROJECT_STATUSES: ClassVar[tuple[str, ...]] = ('DRAFT', 'ACTIVE')

    @classmethod
    def get_ensemble(cls, user: object, request: "Request | None" = None) -> MyEnsembleDTO:
        from core.constants import VoiceLine
        from roster.models import ProjectPieceCasting

        me_artist = getattr(user, 'artist_profile', None)
        me = EnsembleMeDTO(
            voice_type_display=(
                me_artist.get_voice_type_display() if me_artist is not None else None
            ),
            is_active=bool(me_artist.is_active) if me_artist is not None else False,
            is_linked=me_artist is not None,
        )
        if me_artist is None:
            return MyEnsembleDTO(me=me, concerts=())

        # The pieces the caller themselves sings, across their open concerts, with
        # their own voice line per piece. This bounds the whole roster to "my pieces".
        my_castings = list(
            ProjectPieceCasting.objects.filter(
                participation__artist_id=me_artist.id,
                participation__status='CON',
                participation__is_deleted=False,
                participation__project__status__in=cls._OPEN_PROJECT_STATUSES,
                participation__project__is_deleted=False,
            ).select_related('participation__project')
        )
        if not my_castings:
            return MyEnsembleDTO(me=me, concerts=())

        my_pairs = {(c.participation.project_id, c.piece_id) for c in my_castings}
        my_voice_lines: dict[tuple, set[str]] = {}
        for c in my_castings:
            my_voice_lines.setdefault((c.participation.project_id, c.piece_id), set()).add(c.voice_line)

        project_ids = {pid for pid, _ in my_pairs}
        piece_ids = {pid for _, pid in my_pairs}

        # Every confirmed singer cast on one of my pieces within one of my concerts.
        all_castings = (
            ProjectPieceCasting.objects.filter(
                participation__project_id__in=project_ids,
                piece_id__in=piece_ids,
                participation__status='CON',
                participation__is_deleted=False,
            )
            .select_related(
                'participation__artist__user__profile',
                'participation__project',
                'piece',
            )
        )

        vl_order = {value: idx for idx, (value, _) in enumerate(VoiceLine.choices)}
        vl_label = {value: str(label) for value, label in VoiceLine.choices}

        # project_id → {title, date} and (project_id, piece_id) → {piece_title, voice_line → {artist_id → artist}}
        projects: dict = {}
        pieces: dict = {}
        for casting in all_castings:
            key = (casting.participation.project_id, casting.piece_id)
            if key not in my_pairs:
                continue
            project = casting.participation.project
            projects.setdefault(
                project.id,
                {'title': project.title, 'date': project.date_time},
            )
            bucket = pieces.setdefault(key, {'title': casting.piece.title, 'voices': {}})
            members = bucket['voices'].setdefault(casting.voice_line, {})
            members.setdefault(casting.participation.artist_id, casting.participation.artist)

        concerts = cls._build_concerts(
            user_artist_id=me_artist.id,
            my_pairs=my_pairs,
            my_voice_lines=my_voice_lines,
            projects=projects,
            pieces=pieces,
            vl_order=vl_order,
            vl_label=vl_label,
            request=request,
        )
        return MyEnsembleDTO(me=me, concerts=concerts)

    @classmethod
    def _build_concerts(
        cls,
        *,
        user_artist_id: object,
        my_pairs: set,
        my_voice_lines: dict,
        projects: dict,
        pieces: dict,
        vl_order: dict,
        vl_label: dict,
        request: "Request | None",
    ) -> tuple[ConcertRosterDTO, ...]:
        by_project: dict = {}
        for (project_id, piece_id), data in pieces.items():
            mine_lines = my_voice_lines.get((project_id, piece_id), set())
            sections = tuple(
                PieceVoiceSectionDTO(
                    voice_line=voice_line,
                    voice_line_display=vl_label.get(voice_line, voice_line),
                    is_mine=voice_line in mine_lines,
                    members=tuple(
                        SectionMemberDTO(
                            artist_id=artist.id,
                            first_name=artist.first_name,
                            last_name=artist.last_name,
                            avatar_thumb_url=cls._avatar_thumb_url(artist, request),
                            is_me=(artist.id == user_artist_id),
                        )
                        for artist in sorted(
                            members.values(), key=lambda a: (a.last_name.lower(), a.first_name.lower())
                        )
                    ),
                )
                for voice_line, members in sorted(
                    data['voices'].items(), key=lambda kv: vl_order.get(kv[0], 99)
                )
            )
            by_project.setdefault(project_id, []).append(
                ConcertPieceDTO(piece_id=piece_id, title=data['title'], sections=sections)
            )

        concerts = [
            ConcertRosterDTO(
                project_id=project_id,
                title=projects[project_id]['title'],
                date=(
                    projects[project_id]['date'].isoformat()
                    if projects[project_id]['date'] is not None
                    else None
                ),
                pieces=tuple(sorted(piece_list, key=lambda p: p.title.lower())),
            )
            for project_id, piece_list in by_project.items()
        ]
        # Soonest concert first; undated last.
        concerts.sort(key=lambda c: (c.date is None, c.date or ''))
        return tuple(concerts)

    @staticmethod
    def _avatar_thumb_url(artist: object, request: "Request | None") -> str | None:
        """Mirror of ArtistBasicSerializer.get_avatar_thumb_url — small roster avatar."""
        profile = getattr(getattr(artist, 'user', None), 'profile', None)
        thumb = getattr(profile, 'avatar_thumb', None)
        if not thumb:
            return None
        if request is not None:
            return request.build_absolute_uri(thumb.url)
        return str(thumb.url)
