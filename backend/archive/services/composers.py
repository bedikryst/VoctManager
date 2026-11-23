"""
===============================================================================
Composer Catalogue Service
===============================================================================
Domain: Archive (Composers)
Description:
    Consolidates duplicate composer entries ("J.S. Bach" and "Johann Sebastian
    Bach", left behind when ingestion failed to dedupe). Merging carries
    everything the source holds onto the entry that stays:
      * its pieces;
      * every field the target has blank, together with the provenance that
        attributes the value (a filled target field is never overwritten);
      * its name and aliases, added to the target's aliases so a search by the
        old spelling still finds the composer.

    The target keeps its own names: choosing the entry that stays is choosing
    the spelling.

Standards: SaaS 2026, every claim attributable.
===============================================================================
"""
from __future__ import annotations

import logging
import unicodedata
from dataclasses import dataclass

from django.contrib.contenttypes.models import ContentType
from django.db import transaction

from archive.models import Composer, Piece, ProvenanceRecord

logger = logging.getLogger(__name__)


# Fields a merge copies onto a blank target, in groups that travel together:
# the first name of a group decides, and a portrait never arrives without its
# licence line.
_FILLED_GROUPS: tuple[tuple[str, ...], ...] = (
    ('birth_year',),
    ('death_year',),
    ('nationality',),
    ('period',),
    ('bio',),
    ('portrait_url', 'portrait_license'),
    ('mbid',),
    ('wikidata_qid',),
)


class MergeRefused(Exception):
    """The merge cannot run as asked (a composer into itself)."""


@dataclass(frozen=True)
class MergeOutcome:
    pieces_moved: int
    fields_filled: tuple[str, ...]
    aliases_added: tuple[str, ...]


@transaction.atomic
def merge_composers(*, source: Composer, target: Composer) -> MergeOutcome:
    """
    Merge `source` into `target` and soft-delete `source`, in one transaction.

    Both rows are re-read under a row lock, so the values compared are the
    committed ones. Raises `Composer.DoesNotExist` when either is gone.
    """
    if source.pk == target.pk:
        raise MergeRefused('Cannot merge a composer into itself.')

    source = Composer.objects.select_for_update().get(pk=source.pk)
    target = Composer.objects.select_for_update().get(pk=target.pk)

    pieces_moved = Piece.objects.filter(composer=source).update(composer=target)

    # The source goes first: its MBID is unique among active rows only, so the
    # target can take it in the same transaction.
    source.delete()

    filled: list[str] = []
    for group in _FILLED_GROUPS:
        if _is_blank(getattr(target, group[0])) and not _is_blank(getattr(source, group[0])):
            for name in group:
                setattr(target, name, getattr(source, name))
            filled.extend(group)

    added = _aliases_to_add(source=source, target=target)
    changed = list(filled)
    if added:
        target.aliases = [*(target.aliases or []), *added]
        changed.append('aliases')
    if changed:
        target.save(update_fields=[*changed, 'updated_at'])

    if filled:
        ProvenanceRecord.objects.filter(
            content_type=ContentType.objects.get_for_model(Composer),
            object_id=source.pk,
            field_name__in=filled,
        ).update(object_id=target.pk)

    logger.info(
        "composer.merged source=%s target=%s pieces_moved=%d filled=%s aliases_added=%d",
        source.pk, target.pk, pieces_moved, filled, len(added),
    )
    return MergeOutcome(
        pieces_moved=pieces_moved,
        fields_filled=tuple(filled),
        aliases_added=tuple(added),
    )


def _is_blank(value: object) -> bool:
    return value is None or value == ''


def _full_name(composer: Composer) -> str:
    return f"{composer.first_name} {composer.last_name}".strip()


def _fold(text: str) -> str:
    """Case-, accent- and spacing-insensitive form for comparing spellings."""
    decomposed = unicodedata.normalize('NFKD', text)
    bare = ''.join(ch for ch in decomposed if not unicodedata.combining(ch))
    return ' '.join(bare.casefold().split())


def _aliases_to_add(*, source: Composer, target: Composer) -> list[str]:
    """The source's spellings the target does not already answer to."""
    known = {_fold(_full_name(target))}
    known.update(_fold(alias) for alias in (target.aliases or []) if isinstance(alias, str))

    added: list[str] = []
    for candidate in (_full_name(source), *(source.aliases or [])):
        if not isinstance(candidate, str):
            continue
        spelling = ' '.join(candidate.split())
        key = _fold(spelling)
        if not key or key in known:
            continue
        known.add(key)
        added.append(spelling)
    return added
