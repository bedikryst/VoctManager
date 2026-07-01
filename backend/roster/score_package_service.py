"""
@file score_package_service.py
@description Orchestration façade for the concert score-book generator. Owns the
    config-hash (staleness) logic, the build-state read model (including the
    per-item build cockpit), per-item override persistence, the live card preview,
    and the async dispatch + persistence lifecycle. Views and tasks talk to this —
    never to the builder directly.
@architecture Enterprise SaaS 2026
@module roster/score_package_service
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
from typing import Any

from django.core.cache import cache
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from archive.models import ScoreEdition
from roster.infrastructure.pdf_raster import (
    DEFAULT_THUMBNAIL_WIDTH_PX,
    PdfRasterDependencyError,
    render_pdf_thumbnails,
)
from roster.infrastructure.score_package_builder import (
    DocumentRenderDependencyError,
    ScorePackageBuildError,
    build_score_package,
    render_item_card_preview,
)
from roster.models import ProgramItem, Project, ScorePackage
from roster.score_package_config import (
    CARD_ELEMENTS,
    active_editions,
    composer_label,
    edition_label,
    pinnable_translations,
    resolve_card_config,
    resolve_item_edition,
    resolve_item_translation,
    sanitize_card_elements,
    suggested_page_start,
)
from roster.score_package_readiness import compute_program_readiness

logger = logging.getLogger(__name__)

# Package-level settings a client is allowed to change via the API.
CONFIGURABLE_FIELDS: frozenset[str] = frozenset({
    "density_mode",
    "include_title_page",
    "include_toc",
    "include_page_numbers",
    "include_bookmarks",
    "normalize_to_a4",
    "duplex_mode",
    "include_cards",
    "card_default_elements",
    "translation_language",
})

_IN_FLIGHT_STATUSES = frozenset({ScorePackage.Status.QUEUED, ScorePackage.Status.BUILDING})

# Page-trim thumbnails. An edition's PDF is immutable once ingested, so its content
# hash is a perfect cache key — each edition is rasterised at most once and reused
# across every project/program that binds it. Bump the version to evict after a
# rasteriser/format change.
_THUMB_CACHE_VERSION = "v1"
_THUMB_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days


class ScorePackageItemError(ValueError):
    """Raised when a per-item cockpit update is invalid (bad edition / page range)."""


def _safe_filename(title: str) -> str:
    """Filesystem-safe stem for the generated PDF."""
    stem = "".join(c if c.isalnum() or c in " -_" else "_" for c in title).strip()
    stem = stem.replace(" ", "_") or "partytura"
    return f"score_{stem}.pdf"


def _thumbnail_data_uri(blob: bytes) -> str:
    """Encode one WebP thumbnail as a data URI, so the cockpit can render the whole
    strip from a single gated JSON response (no per-image authenticated request)."""
    return f"data:image/webp;base64,{base64.b64encode(blob).decode('ascii')}"


class ScorePackageService:
    """Stateless service over the ScorePackage aggregate."""

    @staticmethod
    def get_or_create(project: Project) -> ScorePackage:
        package, _ = ScorePackage.objects.get_or_create(project=project)
        return package

    @staticmethod
    def _ordered_items(project: Project) -> QuerySet[ProgramItem]:
        return (
            ProgramItem.objects.filter(project=project)
            .select_related("piece", "piece__composer", "score_edition")
            .prefetch_related(
                "piece__editions",
                "piece__translations",
                "piece__program_notes",
                "piece__movements",
            )
            .order_by("order")
        )

    @staticmethod
    def _item_signature(item: ProgramItem, package: ScorePackage) -> dict[str, Any]:
        """Everything about one program item that affects the assembled output."""
        piece = item.piece
        edition = resolve_item_edition(item)
        # Content signature: any edit to the piece, its translations, movements
        # or programme notes bumps the hash, so the output is flagged stale.
        timestamps = [piece.updated_at]
        timestamps += [t.updated_at for t in piece.translations.all()]
        timestamps += [n.updated_at for n in piece.program_notes.all()]
        timestamps += [m.updated_at for m in piece.movements.all()]
        return {
            "order": item.order,
            "piece": str(item.piece_id),
            "edition": str(edition.pk) if edition else None,
            "sha256": edition.sha256 if edition else None,
            "pages": edition.page_count if edition else None,
            "page_start": item.pdf_page_start,
            "page_end": item.pdf_page_end,
            "section": item.section_label,
            "role": item.role_prefix,
            "card_enabled": item.card_enabled,
            "card_elements": item.card_elements,
            "text_override": item.text_override,
            "note_override": item.note_override,
            "translation_pin": str(item.translation_id) if item.translation_id else None,
            "performers": item.performers,
            "content_ts": max(timestamps).isoformat(),
        }

    @staticmethod
    def compute_source_hash(
        project: Project,
        package: ScorePackage,
        items: list[ProgramItem] | None = None,
    ) -> str:
        """
        Stable SHA-256 over everything that affects the output: the ordered
        repertoire (with each item's resolved edition, page-range and card
        overrides) plus the layout settings and the title-page facts. Reads the DB
        only (uses the edition's stored ``sha256``/``page_count``), never a PDF.

        ``items`` may be passed to reuse an already-fetched, prefetched queryset
        (the cockpit read does this so the programme is loaded once, not twice).
        """
        if items is None:
            items = list(ScorePackageService._ordered_items(project))
        repertoire = [
            ScorePackageService._item_signature(item, package)
            for item in items
        ]
        payload = {
            "repertoire": repertoire,
            "cfg": {
                "density": package.density_mode,
                "title": package.include_title_page,
                "toc": package.include_toc,
                "numbers": package.include_page_numbers,
                "bookmarks": package.include_bookmarks,
                "a4": package.normalize_to_a4,
                "duplex": package.duplex_mode,
                "cards": package.include_cards,
                "card_els": sorted(package.card_default_elements or []),
                "lang": package.translation_language,
            },
            "project_title": project.title,
            "date": project.date_time.isoformat() if project.date_time else None,
            "venue": project.location.name if project.location else None,
        }
        blob = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()

    @staticmethod
    def _serialize_item(
        item: ProgramItem, package: ScorePackage, readiness: dict[str, Any]
    ) -> dict[str, Any]:
        """Cockpit read model for one program item."""
        piece = item.piece
        editions = active_editions(piece)
        resolved = resolve_item_edition(item)
        resolved_translation = resolve_item_translation(item, package.translation_language)
        config = resolve_card_config(item, package)
        return {
            "id": str(item.pk),
            "order": item.order,
            "piece_id": str(item.piece_id),
            "title": piece.title,
            "composer": composer_label(piece),
            "is_encore": item.is_encore,
            "editions": [
                {
                    "id": str(edition.pk),
                    "label": edition_label(edition),
                    "page_count": edition.page_count,
                    "is_default": edition.is_default,
                    "ingestion_status": edition.ingestion_status,
                }
                for edition in editions
            ],
            "explicit_edition_id": str(item.score_edition_id) if item.score_edition_id else None,
            "selected_edition_id": str(resolved.pk) if resolved else None,
            "edition_page_count": resolved.page_count if resolved else None,
            "has_pdf": resolved is not None,
            "suggested_start": suggested_page_start(piece),
            "pdf_page_start": item.pdf_page_start,
            "pdf_page_end": item.pdf_page_end,
            # Piece-level translations the conductor can pin for the card; the
            # cockpit composes the labels (language + singable/literal) via i18n.
            "translations": [
                {
                    "id": str(t.pk),
                    "language": t.target_language,
                    "is_singable": t.is_singable,
                    "translator": t.translator,
                }
                for t in pinnable_translations(piece)
            ],
            "explicit_translation_id": str(item.translation_id) if item.translation_id else None,
            "selected_translation_id": str(resolved_translation.pk) if resolved_translation else None,
            "performers": item.performers,
            "section_label": item.section_label,
            "role_prefix": item.role_prefix,
            "card_enabled": item.card_enabled,
            "card_enabled_effective": config.enabled,
            "card_elements": item.card_elements,
            "card_elements_effective": [e for e in CARD_ELEMENTS if e in config.elements],
            "text_override": item.text_override,
            "note_override": item.note_override,
            "readiness": readiness,
        }

    @staticmethod
    def compute_state(project: Project) -> dict[str, Any]:
        """Read model for the cockpit panel: status, staleness, settings, and the
        per-item build rows with their readiness."""
        package = ScorePackageService.get_or_create(project)
        items = list(ScorePackageService._ordered_items(project))
        live_hash = ScorePackageService.compute_source_hash(project, package, items=items)
        readiness = compute_program_readiness(project, items, package)
        serialized_items = [
            ScorePackageService._serialize_item(item, package, readiness[item.pk])
            for item in items
        ]
        missing = [it["title"] for it in serialized_items if not it["has_pdf"]]

        is_stale = (
            package.status == ScorePackage.Status.READY
            and bool(package.source_hash)
            and package.source_hash != live_hash
        )
        return {
            "status": package.status,
            "status_display": package.get_status_display().strip(),
            "is_stale": is_stale,
            "has_pdf": bool(project.score_pdf),
            "page_count": package.page_count,
            "generated_at": package.generated_at,
            "build_version": package.build_version,
            "distributed_at": package.distributed_at,
            # The book is "out there" once a singer has downloaded the current build
            # — only then is a silent rebuild a trust problem worth flagging.
            "is_distributed": package.distributed_at is not None and bool(project.score_pdf),
            # When the current PDF was hand-uploaded, the cockpit hides the build
            # version / staleness (they describe a generated output, not this file).
            "is_manual_upload": package.is_manual_upload and bool(project.score_pdf),
            "error": package.error,
            "total_pieces": len(items),
            "bindable_pieces": len(items) - len(missing),
            "pieces_without_pdf": missing,
            "card_elements": list(CARD_ELEMENTS),
            "config": {
                "density_mode": package.density_mode,
                "include_title_page": package.include_title_page,
                "include_toc": package.include_toc,
                "include_page_numbers": package.include_page_numbers,
                "include_bookmarks": package.include_bookmarks,
                "normalize_to_a4": package.normalize_to_a4,
                "duplex_mode": package.duplex_mode,
                "include_cards": package.include_cards,
                "card_default_elements": list(package.card_default_elements or []),
                "translation_language": package.translation_language,
            },
            "items": serialized_items,
        }

    @staticmethod
    def _apply_config(package: ScorePackage, patch: dict[str, Any]) -> list[str]:
        changed: list[str] = []
        for key, value in patch.items():
            if key not in CONFIGURABLE_FIELDS:
                continue
            if key == "density_mode":
                if value not in ScorePackage.Density.values:
                    continue
            elif key == "translation_language":
                value = str(value)[:8]
            elif key == "card_default_elements":
                # Coerce to the canonical, ordered element subset (empty list is
                # valid — a card carrying only its title/composer divider).
                value = sanitize_card_elements(value) or []
            else:
                value = bool(value)
            if getattr(package, key) != value:
                setattr(package, key, value)
                changed.append(key)
        return changed

    @staticmethod
    @transaction.atomic
    def update_config(project: Project, patch: dict[str, Any]) -> dict[str, Any]:
        """Persist global layout settings without queuing a build, returning the
        recomputed cockpit state. Keeps the saved config the single source of
        truth, so readiness/effective per-item settings and the stale flag react
        the instant a global toggle changes."""
        package = ScorePackageService.get_or_create(project)
        changed = ScorePackageService._apply_config(package, patch)
        if changed:
            package.save(update_fields=[*changed, "updated_at"])
        return ScorePackageService.compute_state(project)

    @staticmethod
    @transaction.atomic
    def request_generation(project: Project, config_patch: dict[str, Any] | None = None) -> ScorePackage:
        """
        Persist any config changes, mark the package QUEUED, and dispatch the
        build after commit. A build already in flight is left untouched.
        """
        package = ScorePackageService.get_or_create(project)
        changed = ScorePackageService._apply_config(package, config_patch or {})

        if package.status in _IN_FLIGHT_STATUSES:
            if changed:
                package.save(update_fields=[*changed, "updated_at"])
            return package

        package.status = ScorePackage.Status.QUEUED
        package.error = ""
        package.save(update_fields=[*changed, "status", "error", "updated_at"])

        from roster.tasks import generate_score_package_task

        transaction.on_commit(
            lambda: generate_score_package_task.delay(str(package.pk))
        )
        return package

    # ------------------------------------------------------------------ #
    # Per-item build cockpit                                              #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _coerce_page(value: Any) -> int | None:
        """Coerce a page-number patch value to a positive int or None (clear)."""
        if value in (None, "", "null"):
            return None
        try:
            page = int(value)
        except (TypeError, ValueError) as exc:
            raise ScorePackageItemError("Numer strony musi być liczbą.") from exc
        if page < 1:
            raise ScorePackageItemError("Numer strony musi być dodatni.")
        return page

    @staticmethod
    @transaction.atomic
    def update_item(project: Project, item_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        """Persist a single program item's cockpit overrides, then return the
        recomputed cockpit state."""
        try:
            item = (
                ProgramItem.objects
                .select_related("piece")
                .prefetch_related("piece__editions", "piece__translations")
                .get(pk=item_id, project=project)
            )
        except ProgramItem.DoesNotExist as exc:
            raise ScorePackageItemError("Pozycja programu nie istnieje.") from exc

        changed: list[str] = []

        def _set(field: str, value: Any) -> None:
            if getattr(item, field) != value:
                setattr(item, field, value)
                changed.append(field)

        if "score_edition_id" in patch:
            raw = patch["score_edition_id"]
            if raw in (None, "", "null"):
                _set("score_edition_id", None)
            else:
                valid = {str(e.pk) for e in active_editions(item.piece)}
                if str(raw) not in valid:
                    raise ScorePackageItemError("Wybrane wydanie nie należy do tego utworu.")
                _set("score_edition_id", raw)

        if "pdf_page_start" in patch:
            _set("pdf_page_start", ScorePackageService._coerce_page(patch["pdf_page_start"]))
        if "pdf_page_end" in patch:
            _set("pdf_page_end", ScorePackageService._coerce_page(patch["pdf_page_end"]))
        if (
            item.pdf_page_start is not None
            and item.pdf_page_end is not None
            and item.pdf_page_start > item.pdf_page_end
        ):
            raise ScorePackageItemError("Strona początkowa nie może być za końcową.")

        if "translation_id" in patch:
            raw = patch["translation_id"]
            if raw in (None, "", "null"):
                _set("translation_id", None)
            else:
                valid = {str(t.pk) for t in pinnable_translations(item.piece)}
                if str(raw) not in valid:
                    raise ScorePackageItemError("Wybrane tłumaczenie nie należy do tego utworu.")
                _set("translation_id", raw)

        if "performers" in patch:
            _set("performers", str(patch["performers"] or "")[:200])

        if "section_label" in patch:
            _set("section_label", str(patch["section_label"] or "")[:80])
        if "role_prefix" in patch:
            _set("role_prefix", str(patch["role_prefix"] or "")[:60])
        if "text_override" in patch:
            _set("text_override", str(patch["text_override"] or ""))
        if "note_override" in patch:
            _set("note_override", str(patch["note_override"] or ""))

        if "card_enabled" in patch:
            raw = patch["card_enabled"]
            _set("card_enabled", None if raw is None else bool(raw))
        if "card_elements" in patch:
            _set("card_elements", sanitize_card_elements(patch["card_elements"]))

        if changed:
            item.save(update_fields=changed)

        return ScorePackageService.compute_state(project)

    @staticmethod
    def render_item_preview(project: Project, item_id: str) -> bytes:
        """Render a single program item's card to a PDF for the live cockpit preview."""
        package = ScorePackageService.get_or_create(project)
        try:
            item = (
                ScorePackageService._ordered_items(project).get(pk=item_id)
            )
        except ProgramItem.DoesNotExist as exc:
            raise ScorePackageItemError("Pozycja programu nie istnieje.") from exc
        return render_item_card_preview(project, package, item)

    # ------------------------------------------------------------------ #
    # Page-trim thumbnails                                                #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _cached_edition_thumbnails(edition: ScoreEdition, width: int) -> list[bytes]:
        """Rasterised WebP pages for one edition, memoised by its content hash.
        Reads the PDF (and renders) only on a cache miss."""
        key_part = edition.sha256 or f"pk-{edition.pk}"
        cache_key = f"score_thumbs:{_THUMB_CACHE_VERSION}:{key_part}:{width}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
        with edition.pdf_file.open("rb") as handle:
            data = handle.read()
        images = render_pdf_thumbnails(data, width_px=width)
        cache.set(cache_key, images, _THUMB_CACHE_TTL_SECONDS)
        return images

    @staticmethod
    def thumbnails_for_item(project: Project, item_id: str) -> dict[str, Any]:
        """
        Page thumbnails for a program item's resolved edition, so the cockpit can
        offer visual page-range trimming instead of blind page-number entry.

        Always 200-shaped: an item with no readable edition yields an empty strip,
        and a host without the rasteriser yields ``available: False`` so the front
        keeps its manual page inputs rather than surfacing an error.
        """
        try:
            item = ScorePackageService._ordered_items(project).get(pk=item_id)
        except ProgramItem.DoesNotExist as exc:
            raise ScorePackageItemError("Pozycja programu nie istnieje.") from exc

        width = DEFAULT_THUMBNAIL_WIDTH_PX
        edition = resolve_item_edition(item)
        if edition is None or not edition.pdf_file:
            return {
                "available": True,
                "edition_id": None,
                "width": width,
                "page_count": 0,
                "thumbnails": [],
            }

        try:
            images = ScorePackageService._cached_edition_thumbnails(edition, width)
        except PdfRasterDependencyError:
            logger.warning(
                "score_package.thumbnails_unavailable project=%s edition=%s",
                project.pk, edition.pk,
            )
            return {
                "available": False,
                "edition_id": str(edition.pk),
                "width": width,
                "page_count": edition.page_count,
                "thumbnails": [],
            }
        except Exception:
            logger.exception(
                "score_package.thumbnails_failed project=%s edition=%s", project.pk, edition.pk
            )
            return {
                "available": False,
                "edition_id": str(edition.pk),
                "width": width,
                "page_count": edition.page_count,
                "thumbnails": [],
            }

        return {
            "available": True,
            "edition_id": str(edition.pk),
            "width": width,
            "page_count": len(images),
            "thumbnails": [
                {"page": index + 1, "src": _thumbnail_data_uri(blob)}
                for index, blob in enumerate(images)
            ],
        }

    # ------------------------------------------------------------------ #
    # Async build lifecycle                                              #
    # ------------------------------------------------------------------ #

    @staticmethod
    def run_build(package_id: str) -> None:
        """
        Execute the synchronous build (invoked from the Celery task). Always
        leaves the package in a terminal state (READY or FAILED).
        """
        package = (
            ScorePackage.objects.select_related("project", "project__location")
            .get(pk=package_id)
        )
        project = package.project

        package.status = ScorePackage.Status.BUILDING
        package.error = ""
        package.save(update_fields=["status", "error", "updated_at"])

        try:
            result = build_score_package(project, package)
        except ScorePackageBuildError as exc:
            ScorePackageService._fail(package, str(exc))
            return
        except DocumentRenderDependencyError:
            ScorePackageService._fail(
                package,
                "Silnik PDF (WeasyPrint) nie ma natywnych bibliotek (Pango/Cairo) na serwerze.",
            )
            return
        except Exception:
            logger.exception("score_package.build_failed package=%s project=%s", package_id, project.pk)
            ScorePackageService._fail(package, "Nieoczekiwany błąd podczas składania partytury.")
            return

        if project.score_pdf:
            project.score_pdf.delete(save=False)
        project.score_pdf.save(_safe_filename(project.title), ContentFile(result.pdf_bytes), save=False)
        project.save(update_fields=["score_pdf", "updated_at"])

        package.status = ScorePackage.Status.READY
        package.source_hash = ScorePackageService.compute_source_hash(project, package)
        package.page_count = result.page_count
        package.generated_at = timezone.now()
        # A fresh build is a new version that no singer has yet — stamp it and reset
        # the distribution flag, so the "already in their folders" warning re-arms
        # only once someone downloads this build.
        package.build_version = package.build_version + 1
        package.distributed_at = None
        package.is_manual_upload = False  # this is a generated build, not a hand-upload
        package.error = ""
        package.save(
            update_fields=[
                "status", "source_hash", "page_count", "generated_at",
                "build_version", "distributed_at", "is_manual_upload", "error", "updated_at",
            ]
        )

        if result.skipped_titles:
            logger.info(
                "score_package.skipped project=%s titles=%s",
                project.pk, "; ".join(result.skipped_titles),
            )

    @staticmethod
    def _fail(package: ScorePackage, message: str) -> None:
        package.status = ScorePackage.Status.FAILED
        package.error = message
        package.save(update_fields=["status", "error", "updated_at"])

    @staticmethod
    def mark_distributed(project: Project) -> None:
        """
        Record that the current build has left the building — a singer downloaded
        it through the gated ``score_pdf`` action. First access only: a single
        race-safe UPDATE that no-ops once already flagged (or when the project has
        no package), so it is cheap to call on every download.
        """
        ScorePackage.objects.filter(
            project=project, distributed_at__isnull=True
        ).update(distributed_at=timezone.now())

    @staticmethod
    def mark_manual_upload(project: Project) -> None:
        """
        Reconcile package state with a hand-uploaded score_pdf. The two producers
        (generator vs upload) write the same field; this keeps the cockpit honest:
        the book reads READY + manual, never as a stale generated version. Clears
        the source hash (a hand file is never 'stale' against the repertoire) and
        resets distribution (a new file the singers do not have yet).
        """
        package = ScorePackageService.get_or_create(project)
        package.status = ScorePackage.Status.READY
        package.is_manual_upload = True
        package.source_hash = ""
        package.page_count = None
        package.generated_at = timezone.now()
        package.distributed_at = None
        package.error = ""
        package.save(update_fields=[
            "status", "is_manual_upload", "source_hash", "page_count",
            "generated_at", "distributed_at", "error", "updated_at",
        ])

    @staticmethod
    def mark_score_cleared(project: Project) -> None:
        """Reset the package to the no-output state when the score_pdf is removed,
        so the cockpit shows 'not generated' rather than a phantom ready book."""
        package = ScorePackageService.get_or_create(project)
        package.status = ScorePackage.Status.IDLE
        package.is_manual_upload = False
        package.source_hash = ""
        package.page_count = None
        package.generated_at = None
        package.distributed_at = None
        package.error = ""
        package.save(update_fields=[
            "status", "is_manual_upload", "source_hash", "page_count",
            "generated_at", "distributed_at", "error", "updated_at",
        ])


__all__ = ["ScorePackageItemError", "ScorePackageService"]
