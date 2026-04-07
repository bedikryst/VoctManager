# core/constants.py
# ==========================================
# Core System Constants
# ==========================================
from django.db import models
from django.utils.translation import gettext_lazy as _

class VoiceLine(models.TextChoices):
    """Standardized vocal lines and roles used across the entire VoctManager system."""
    SOPRANO_1 = 'S1', _('Soprano 1')
    SOPRANO_2 = 'S2', _('Soprano 2')
    SOPRANO_3 = 'S3', _('Soprano 3')
    ALTO_1 = 'A1', _('Alto 1')
    ALTO_2 = 'A2', _('Alto 2')
    ALTO_3 = 'A3', _('Alto 3')
    TENOR_1 = 'T1', _('Tenor 1')
    TENOR_2 = 'T2', _('Tenor 2')
    TENOR_3 = 'T3', _('Tenor 3')
    BASS_1 = 'B1', _('Bass 1')
    BASS_2 = 'B2', _('Bass 2')
    BASS_3 = 'B3', _('Bass 3')
    SOLO = 'SOLO', _('Solo')
    VOCAL_PERCUSSION = 'VP', _('Vocal Percussion / Beatbox')
    TUTTI = 'TUTTI', _('Tutti (All)')
    BACKGROUND = 'BACK', _('Backing Vocals')
    ACCOMPANIMENT = 'ACC', _('Accompaniment')
    PRONUNCIATION = 'PRON', _('Pronunciation / Diction')