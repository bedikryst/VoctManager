# archive/services.py
"""
Business Logic Layer for the Archive application.
@architecture Enterprise SaaS 2026
"""
import json
from typing import Any, Dict, List, Optional, Union
from django.db import transaction
from .models import Piece, PieceVoiceRequirement

def sync_piece_voice_requirements(*, piece: Piece, requirements_raw: Union[str, List[Dict[str, Any]], None]) -> None:
    """
    Securely parses and synchronizes vocal requirements for a piece.
    Executes within an atomic transaction to guarantee data integrity.
    """
    if requirements_raw is None:
        return
        
    if isinstance(requirements_raw, str):
        try:
            requirements = json.loads(requirements_raw)
        except json.JSONDecodeError:
            requirements = []
    else:
        requirements = requirements_raw

    with transaction.atomic():
        piece.voice_requirements.all().delete()
        
        new_requirements = [
            PieceVoiceRequirement(
                piece=piece,
                voice_line=req.get('voice_line'),
                quantity=req.get('quantity', 1)
            )
            for req in requirements if req.get('voice_line')
        ]
        PieceVoiceRequirement.objects.bulk_create(new_requirements)