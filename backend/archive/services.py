# archive/services.py
# ==========================================
# Archive Business Logic (Service Layer)
# ==========================================
"""
Domain-driven service layer for the Archive application.
@architecture Enterprise SaaS 2026

Encapsulates database transactions and core domain rules for the musical repertoire.
"""
from typing import List, Optional
from django.db import transaction
from notifications.tasks import send_bulk_notifications_task
from notifications.models import NotificationType, NotificationLevel
from roster.models import Participation

from .models import Piece, PieceVoiceRequirement, Composer
from .dtos import PieceWriteDTO, VoiceRequirementDTO
from .exceptions import PieceValidationException

def _sync_piece_voice_requirements(piece: Piece, requirements: List[VoiceRequirementDTO]) -> None:
    """Internal domain logic to atomically replace voice requirements for a piece."""
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


def create_piece(dto: PieceWriteDTO, sheet_music_file=None) -> Piece:
    """Orchestrates the creation of a piece and its related vocal requirements."""
    try:
        composer = Composer.objects.get(id=dto.composer_id) if dto.composer_id else None
    except Composer.DoesNotExist:
        raise PieceValidationException(f"Composer with ID {dto.composer_id} does not exist.")

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
            _sync_piece_voice_requirements(piece, dto.voice_requirements)
            
    return piece


def update_piece(piece: Piece, dto: PieceWriteDTO, sheet_music_file=None, update_sheet_music: bool = False) -> Piece:
    """Orchestrates the update of a piece and synchronizes its vocal requirements."""
    try:
        composer = Composer.objects.get(id=dto.composer_id) if dto.composer_id else None
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
            _sync_piece_voice_requirements(piece, dto.voice_requirements)

        if update_sheet_music and sheet_music_file:
            transaction.on_commit(lambda: _notify_cast_about_new_material(piece))

    return piece

def _notify_cast_about_new_material(piece: Piece) -> None:
    """
    Internal domain helper. Finds all active artists currently assigned to projects 
    that include this piece in their program, and notifies them.
    """
    user_ids = Participation.objects.filter(
        project__program_items__piece=piece,
        is_deleted=False
    ).values_list('artist__user_id', flat=True).distinct()
    
    recipient_ids = [str(uid) for uid in user_ids if uid]
    
    if recipient_ids:
        send_bulk_notifications_task.delay(
            recipient_ids=recipient_ids,
            notification_type=NotificationType.MATERIAL_UPLOADED,
            level=NotificationLevel.INFO,
            metadata={
                "piece_id": str(piece.id),
                "piece_title": piece.title,
                "message": "Sheet music has been updated."
            }
        )