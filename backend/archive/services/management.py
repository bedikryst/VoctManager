"""
===============================================================================
Archive Management Service
===============================================================================
Domain: Archive (Repertoire & Materials)
Description:
    Orchestrates Piece + Track mutations inside the Archive aggregate.

    Piece-level PDFs live in [ScoreEdition] (not on Piece directly) — uploading
    a PDF goes through [services.ingestion.start_ingestion] which dispatches
    the AI pipeline. Manual Piece creation here covers folk songs and other
    repertoire where no PDF / no AI extraction is needed.

    Material-update notifications fire from edition approval ([views.ScoreEditionViewSet.approve])
    and Track creation here — both moments where the chorus gets fresh content.

Standards: SaaS 2026, DDD, Event-Driven (`piece_material_updated_event`).
===============================================================================
"""

import logging
from collections.abc import Sequence

from django.db import transaction

from archive.dtos import PieceWriteDTO, VoiceRequirementDTO
from archive.exceptions import PieceValidationException
from archive.models import Composer, Piece, PieceVoiceRequirement, Track
from archive.signals import piece_material_updated_event

logger = logging.getLogger(__name__)


class ArchiveManagementService:
    """Mutations on the Piece aggregate plus rehearsal Tracks."""

    @staticmethod
    def _sync_piece_voice_requirements(
        piece: Piece,
        requirements: Sequence[VoiceRequirementDTO],
    ) -> None:
        """Atomically replace voice requirements — soft-delete preserves the unique constraint."""
        piece.voice_requirements.all().delete()

        new_requirements = [
            PieceVoiceRequirement(piece=piece, voice_line=req.voice_line, quantity=req.quantity)
            for req in requirements
        ]
        PieceVoiceRequirement.objects.bulk_create(new_requirements)

    @staticmethod
    def _normalize_blank_text(value: str | None) -> str:
        return value or ""

    @classmethod
    def _apply_piece_fields(cls, piece: Piece, dto: PieceWriteDTO) -> None:
        """Single source of truth for Piece field assignment from a DTO."""
        piece.title = dto.title
        piece.arranger = cls._normalize_blank_text(dto.arranger)
        piece.language = cls._normalize_blank_text(dto.language)
        piece.estimated_duration = dto.estimated_duration
        piece.voicing = cls._normalize_blank_text(dto.voicing)
        piece.description = cls._normalize_blank_text(dto.description)
        piece.lyrics_original = cls._normalize_blank_text(dto.lyrics_original)
        piece.composition_year = dto.composition_year
        piece.epoch = cls._normalize_blank_text(dto.epoch)
        piece.opus_catalog = cls._normalize_blank_text(dto.opus_catalog)
        piece.musical_key = cls._normalize_blank_text(dto.musical_key)
        piece.text_source = cls._normalize_blank_text(dto.text_source)
        piece.lyrics_ipa = cls._normalize_blank_text(dto.lyrics_ipa)

    @staticmethod
    def _resolve_composer(composer_id) -> Composer | None:
        if not composer_id:
            return None
        try:
            return Composer.objects.get(id=composer_id, is_deleted=False)
        except Composer.DoesNotExist as exc:
            raise PieceValidationException(
                f"Composer with ID {composer_id} does not exist or is deleted."
            ) from exc

    @classmethod
    def create_piece(cls, dto: PieceWriteDTO) -> Piece:
        """Provision a new piece manually (no PDF, no AI). PDFs go through the ingestion pipeline."""
        composer = cls._resolve_composer(dto.composer_id)

        with transaction.atomic():
            piece = Piece(composer=composer)
            cls._apply_piece_fields(piece, dto)
            piece.save()

            if dto.voice_requirements is not None:
                cls._sync_piece_voice_requirements(piece, dto.voice_requirements)

        logger.info("piece.created id=%s title=%r", piece.id, piece.title)
        return piece

    @classmethod
    def update_piece(cls, piece: Piece, dto: PieceWriteDTO) -> Piece:
        """Update piece metadata. Does not touch PDFs (those live on ScoreEdition)."""
        composer = cls._resolve_composer(dto.composer_id)

        with transaction.atomic():
            piece.composer = composer
            cls._apply_piece_fields(piece, dto)
            piece.save()

            if dto.voice_requirements is not None:
                cls._sync_piece_voice_requirements(piece, dto.voice_requirements)

        logger.info("piece.updated id=%s title=%r", piece.id, piece.title)
        return piece

    @classmethod
    def create_track(cls, validated_data: dict) -> Track:
        """Provision a new rehearsal track and notify project participants on commit."""
        with transaction.atomic():
            track = Track.objects.create(**validated_data)
            transaction.on_commit(
                lambda: piece_material_updated_event.send(
                    sender=cls.__class__, piece=track.piece,
                ),
            )
            logger.info(
                "track.created piece=%s voice_part=%s",
                track.piece_id, track.voice_part,
            )
            return track

    @classmethod
    def delete_track(cls, track: Track) -> None:
        """Soft-delete an audio track."""
        with transaction.atomic():
            track_name = str(track)
            track.delete()
            logger.info("track.deleted %s", track_name)
