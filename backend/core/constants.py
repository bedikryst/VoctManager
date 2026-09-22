# core/constants.py
# ==========================================
# Core System Constants
# ==========================================
from django.db import models
from django.utils.translation import gettext_lazy as _


class VoiceLine(models.TextChoices):
    """Standardized vocal lines and roles used across the entire VoctManager system.

    Four kinds of value live here, and they behave differently downstream:
      * the four choral families with a divisi index (S1…B3),
      * the intermediate parts MS, CT, BAR — a treble-choir "S/Ms/A" or a
        men's "T/Bar/B" score writes them as one line each, so they carry no
        index and never divide; a mezzo-soprano or baritone SINGER in an
        SATB piece still sits on S2/A1 or T2/B1, which is why these lines are
        declared by the arrangement and never implied by a voice type,
      * the untyped entries V1…V4 — a canon or a round divides singers into
        equal parts with no tessitura attached, and calling those parts
        "Soprano 1" would invent a voicing the score never wrote,
      * standalone roles (SOLO, TUTTI, VP, BACK, INSTR, ACC, PRON) that carry
        no index. ACC is a seat — the organist is cast on it, see
        `features/projects/lib/autoCast` — while INSTR is only ever a recording:
        the piece without its voices, for singing along to. Nothing is cast on
        INSTR, so it stays out of the divisi vocabulary.
    Only the indexed kinds collapse to a plain family name when undivided —
    see [core.voice_labels]; the rest print their own label everywhere.

    Declaration order is score order, top staff down: `roster.cast_order`
    sorts by it, so a new line goes where its staff sits, not at the end.
    The three intermediate labels reuse the msgids `roster.VoiceType` ships,
    so the catalogues already translate them.
    """
    SOPRANO_1 = 'S1', _('Soprano 1')
    SOPRANO_2 = 'S2', _('Soprano 2')
    SOPRANO_3 = 'S3', _('Soprano 3')
    MEZZO = 'MS', _('Mezzo-Soprano')
    ALTO_1 = 'A1', _('Alto 1')
    ALTO_2 = 'A2', _('Alto 2')
    ALTO_3 = 'A3', _('Alto 3')
    COUNTERTENOR = 'CT', _('Countertenor')
    TENOR_1 = 'T1', _('Tenor 1')
    TENOR_2 = 'T2', _('Tenor 2')
    TENOR_3 = 'T3', _('Tenor 3')
    BARITONE = 'BAR', _('Baritone')
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
    INSTRUMENTAL = 'INSTR', _('Instrumental')
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