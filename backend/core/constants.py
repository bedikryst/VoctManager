# core/constants.py
# ==========================================
# Core System Constants
# ==========================================
from django.db import models
from django.utils.translation import gettext_lazy as _


class VoiceLine(models.TextChoices):
    """Standardized vocal lines and roles used across the entire VoctManager system.

    Three kinds of value live here, and they behave differently downstream:
      * the four choral families with a divisi index (S1…B3),
      * the untyped entries V1…V4 — a canon or a round divides singers into
        equal parts with no tessitura attached, and calling those parts
        "Soprano 1" would invent a voicing the score never wrote,
      * standalone roles (SOLO, TUTTI, VP, BACK, ACC, PRON) that carry no index.
    Only the first two collapse to a plain family name when undivided — see
    [core.voice_labels].
    """
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
    VOICE_1 = 'V1', _('Voice 1')
    VOICE_2 = 'V2', _('Voice 2')
    VOICE_3 = 'V3', _('Voice 3')
    VOICE_4 = 'V4', _('Voice 4')
    SOLO = 'SOLO', _('Solo')
    VOCAL_PERCUSSION = 'VP', _('Vocal Percussion / Beatbox')
    TUTTI = 'TUTTI', _('Tutti (All)')
    BACKGROUND = 'BACK', _('Backing Vocals')
    ACCOMPANIMENT = 'ACC', _('Accompaniment')
    PRONUNCIATION = 'PRON', _('Pronunciation / Diction')

class ClothingSizeChoices(models.TextChoices):
    XS = 'xs', 'XS'
    S = 's', 'S'
    M = 'm', 'M'
    L = 'l', 'L'
    XL = 'xl', 'XL'
    XXL = 'xxl', 'XXL'


class AppRole(models.TextChoices):
    MANAGER = 'MANAGER', _('Manager / Conductor')
    ARTIST = 'ARTIST', _('Artist / Singer')
    CREW = 'CREW', _('Crew / Collaborator')