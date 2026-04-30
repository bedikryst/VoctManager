"""
===============================================================================
Archive Management Service
===============================================================================
Domain: Archive (Repertoire & Materials)
Description: 
    Enterprise domain service governing the lifecycle of the musical repertoire.
    Strictly adheres to Bounded Context principles by delegating cross-domain 
    side-effects to event listeners via django.dispatch.Signal.

Standards: SaaS 2026, DDD (Domain-Driven Design), Event-Driven Architecture.
===============================================================================
"""

import logging
from typing import List
from django.db import transaction

from .models import Piece, PieceVoiceRequirement, Composer, Track
from .dtos import PieceWriteDTO, VoiceRequirementDTO
from .exceptions import PieceValidationException
from .signals import piece_material_updated_event

logger = logging.getLogger(__name__)


class ArchiveManagementService:
    """
    Orchestrates mutations within the Archive aggregate root.
    Maintains transactional integrity for pieces and their vocal requirements.
    """

    @staticmethod
    def _sync_piece_voice_requirements(piece: Piece, requirements: List[VoiceRequirementDTO]) -> None:
        """
        Internal domain logic to atomically replace voice requirements.
        Relies on Soft Deletion to safely circumvent UniqueConstraints.
        """
        piece.voice_requirements.all().delete()
        
        new_requirements = [
            PieceVoiceRequirement(
                piece=piece,
                voice_line=req.voice_line,
                quantity=req.quantity
            )
            for req in requirements
        ]
        PieceVoiceRequirement.objects.bulk_create(new_requirements)
        logger.debug(f"[ArchiveService] Synchronized {len(new_requirements)} voice requirements for '{piece.title}'")

    @staticmethod
    def _normalize_blank_text(value: str | None) -> str:
        """
        Guarantees non-null writes for model fields that allow blank strings but disallow NULL.
        Keeps the aggregate root resilient even if upstream serialization changes.
        """
        return value or ""

    @classmethod
    def create_piece(cls, dto: PieceWriteDTO, sheet_music_file=None) -> Piece:
        """
        Provisions a new musical piece and its underlying requirements.
        """
        composer = None
        if dto.composer_id:
            try:
                composer = Composer.objects.get(id=dto.composer_id, is_deleted=False)
            except Composer.DoesNotExist:
                raise PieceValidationException(f"Composer with ID {dto.composer_id} does not exist or is deleted.")

        with transaction.atomic():
            piece = Piece.objects.create(
                title=dto.title,
                composer=composer,
                arranger=cls._normalize_blank_text(dto.arranger),
                language=cls._normalize_blank_text(dto.language),
                estimated_duration=dto.estimated_duration,
                voicing=cls._normalize_blank_text(dto.voicing),
                description=cls._normalize_blank_text(dto.description),
                lyrics_original=cls._normalize_blank_text(dto.lyrics_original),
                lyrics_translation=cls._normalize_blank_text(dto.lyrics_translation),
                reference_recording_youtube=cls._normalize_blank_text(
                    str(dto.reference_recording_youtube) if dto.reference_recording_youtube else None
                ),
                reference_recording_spotify=cls._normalize_blank_text(
                    str(dto.reference_recording_spotify) if dto.reference_recording_spotify else None
                ),
                composition_year=dto.composition_year,
                epoch=cls._normalize_blank_text(dto.epoch),
                sheet_music=sheet_music_file
            )
            
            if dto.voice_requirements is not None:
                cls._sync_piece_voice_requirements(piece, dto.voice_requirements)
                
        logger.info(f"[ArchiveService] Provisioned new repertoire piece: '{piece.title}'")
        return piece

    @classmethod
    def update_piece(cls, piece: Piece, dto: PieceWriteDTO, sheet_music_file=None, update_sheet_music: bool = False) -> Piece:
        """
        Mutates an existing piece. Broadcasts a domain event if critical materials 
        are updated, allowing decoupled systems to react asynchronously.
        """
        composer = None
        if dto.composer_id:
            try:
                composer = Composer.objects.get(id=dto.composer_id, is_deleted=False)
            except Composer.DoesNotExist:
                raise PieceValidationException(f"Composer with ID {dto.composer_id} does not exist.")

        with transaction.atomic():
            piece.title = dto.title
            piece.composer = composer
            piece.arranger = cls._normalize_blank_text(dto.arranger)
            piece.language = cls._normalize_blank_text(dto.language)
            piece.estimated_duration = dto.estimated_duration
            piece.voicing = cls._normalize_blank_text(dto.voicing)
            piece.description = cls._normalize_blank_text(dto.description)
            piece.lyrics_original = cls._normalize_blank_text(dto.lyrics_original)
            piece.lyrics_translation = cls._normalize_blank_text(dto.lyrics_translation)
            piece.reference_recording_youtube = cls._normalize_blank_text(
                str(dto.reference_recording_youtube) if dto.reference_recording_youtube else None
            )
            piece.reference_recording_spotify = cls._normalize_blank_text(
                str(dto.reference_recording_spotify) if dto.reference_recording_spotify else None
            )
            piece.composition_year = dto.composition_year
            piece.epoch = cls._normalize_blank_text(dto.epoch)
            
            if update_sheet_music:
                piece.sheet_music = sheet_music_file

            piece.save()

            if dto.voice_requirements is not None:
                cls._sync_piece_voice_requirements(piece, dto.voice_requirements)

            # --- DOMAIN EVENT DISPATCHING ---
            # Using on_commit ensures the event is only broadcasted if the DB transaction 
            # successfully commits, preventing false-positive notifications.
            if update_sheet_music and sheet_music_file:
                transaction.on_commit(
                    lambda: piece_material_updated_event.send(sender=cls.__class__, piece=piece)
                )

        logger.info(f"[ArchiveService] Updated repertoire piece: '{piece.title}'")
        return piece
    
    @classmethod
    def create_track(cls, validated_data: dict) -> Track:
        """
        Provisions a new rehearsal track.
        Future-proofed for launching async Celery tasks (e.g. MP3 compression/normalization).
        """
        with transaction.atomic():
            track = Track.objects.create(**validated_data)
            
            # FUTURE ENTERPRISE IMPLEMENTATION:
            # transaction.on_commit(lambda: process_audio_file_task.delay(track.id))
            
            logger.info(f"[ArchiveService] Track created for piece '{track.piece.title}' (Line: {track.voice_part})")
            return track

    @classmethod
    def delete_track(cls, track: Track) -> None:
        """
        Soft-deletes an audio track. 
        Maintains referential integrity and audit trails.
        """
        with transaction.atomic():
            track_name = str(track)
            track.delete()
            logger.info(f"[ArchiveService] Track removed: {track_name}")
