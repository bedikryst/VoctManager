# core/constants.py
# ==========================================
# Core System Constants
# ==========================================
from django.db import models
from django.utils.translation import gettext_lazy as _

class VoiceLine(models.TextChoices):
    """
    Standardized vocal lines and roles used across the entire VoctManager system.
    Using TextChoices provides enum-like behavior, code autocompletion, and translation support.
    """
    SOPRAN_1 = 'S1', _('Sopran 1')
    SOPRAN_2 = 'S2', _('Sopran 2')
    ALT_1 = 'A1', _('Alt 1')
    ALT_2 = 'A2', _('Alt 2')
    TENOR_1 = 'T1', _('Tenor 1')
    TENOR_2 = 'T2', _('Tenor 2')
    BAS_1 = 'B1', _('Bas 1')
    BAS_2 = 'B2', _('Bas 2')
    SOLO = 'SOLO', _('Solo')
    VOCAL_PERCUSSION = 'VP', _('Vocal Percussion / Beatbox')
    TUTTI = 'TUTTI', _('Tutti (Wszyscy)')
    ACCOMPANIMENT = 'ACC', _('Akompaniament')
    PRONUNCIATION = 'PRON', _('Wymowa (Dykcja/Język)')