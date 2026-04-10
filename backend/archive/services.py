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

from .models import Piece, PieceVoiceRequirement, Composer
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
                arranger=dto.arranger,
                language=dto.language,
                estimated_duration=dto.estimated_duration,
                voicing=dto.voicing,
                description=dto.description,
                lyrics_original=dto.lyrics_original,
                lyrics_translation=dto.lyrics_translation,
                reference_recording_youtube=dto.reference_recording_youtube,
                reference_recording_spotify=dto.reference_recording_spotify,
                composition_year=dto.composition_year,
                epoch=dto.epoch,
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
            piece.arranger = dto.arranger
            piece.language = dto.language
            piece.estimated_duration = dto.estimated_duration
            piece.voicing = dto.voicing
            piece.description = dto.description
            piece.lyrics_original = dto.lyrics_original
            piece.lyrics_translation = dto.lyrics_translation
            piece.reference_recording_youtube = dto.reference_recording_youtube
            piece.reference_recording_spotify = dto.reference_recording_spotify
            piece.composition_year = dto.composition_year
            piece.epoch = dto.epoch
            
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