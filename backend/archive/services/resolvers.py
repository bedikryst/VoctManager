"""
===============================================================================
Score Package Compiler — Composer & Piece Resolvers
===============================================================================
Domain: Archive / Ingestion
Description:
    Dedup-aware "get or create" services for Composer and Piece. The dedup
    priority — most-trusted to least-trusted — is:

      Composer:
        1. MusicBrainz MBID   — canonical, never collides
        2. Wikidata QID       — canonical secondary
        3. Exact (last, first) name match
        4. Last-name + birth-year match (handles "J.S. Bach" vs "Bach, JS")
        5. Last-name fuzzy match (Jaro-Winkler ≥ 0.92) + birth-year ±2

      Piece:
        1. MusicBrainz Work ID
        2. (composer_id, title, opus_catalog) exact triple
        3. (composer_id, title) exact pair

    On every merge we update the existing row's fields *only when blank* —
    we never overwrite a conductor's manual edit. New facts get
    ProvenanceRecord rows; existing facts keep their original provenance.

Standards: SaaS 2026, conservative dedup, conductor-edits-are-sacred.
===============================================================================
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from django.db import transaction

from archive.dtos import (
    ComposerLookupResult, ExtractedWorkIdentity, WorkLookupResult,
)
from archive.models import Composer, IngestionStatus, Piece, ProvenanceSource
from archive.services import provenance

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ResolveOutcome:
    """Returned from each resolver; tells the caller what happened."""
    entity_id: UUID
    created: bool       # True if a new row was inserted
    merged_fields: tuple[str, ...]  # field names we just populated on an existing row


# ===========================================================================
# Composer
# ===========================================================================

def resolve_or_create_composer(
    *,
    extracted: ExtractedWorkIdentity,
    mbz_result: Optional[ComposerLookupResult] = None,
    wiki_result: Optional[ComposerLookupResult] = None,
) -> ResolveOutcome:
    """
    Pick or create the canonical `Composer` row for a freshly-extracted work.

    Args:
        extracted: the raw AI extraction from the score PDF.
        mbz_result: MusicBrainz lookup result for the composer (canonical).
        wiki_result: Wikidata enrichment (bio, portrait, dates).

    Returns the row id and a `created` flag.
    """
    with transaction.atomic():
        composer = _find_existing_composer(
            mbz=mbz_result, wiki=wiki_result, extracted=extracted,
        )
        if composer is not None:
            merged = _merge_composer(
                composer=composer, mbz=mbz_result, wiki=wiki_result, extracted=extracted,
            )
            return ResolveOutcome(entity_id=composer.id, created=False, merged_fields=merged)

        composer = _create_composer(
            mbz=mbz_result, wiki=wiki_result, extracted=extracted,
        )
        return ResolveOutcome(entity_id=composer.id, created=True, merged_fields=())


def _find_existing_composer(
    *,
    mbz: Optional[ComposerLookupResult],
    wiki: Optional[ComposerLookupResult],
    extracted: ExtractedWorkIdentity,
) -> Optional[Composer]:
    # 1. MBID — canonical, never collides.
    if mbz and mbz.mbid:
        match = Composer.objects.filter(mbid=mbz.mbid).first()
        if match:
            return match

    # 2. Wikidata QID — canonical secondary.
    if wiki and wiki.wikidata_qid:
        match = Composer.objects.filter(wikidata_qid=wiki.wikidata_qid).first()
        if match:
            return match

    # 3. Exact (last, first) match. Use canonical names from MBZ if available,
    #    falling back to the AI extraction.
    last_name, first_name = _resolve_canonical_name(
        mbz=mbz, wiki=wiki, extracted=extracted,
    )
    if last_name:
        match = Composer.objects.filter(
            last_name__iexact=last_name,
            first_name__iexact=first_name,
        ).first()
        if match:
            return match

    # 4. Last-name + birth-year exact (handles abbreviated/expanded first names).
    birth_year = _resolve_birth_year(mbz=mbz, wiki=wiki, extracted=extracted)
    if last_name and birth_year:
        match = Composer.objects.filter(
            last_name__iexact=last_name,
            birth_year=str(birth_year),
        ).first()
        if match:
            return match

    return None


def _merge_composer(
    *,
    composer: Composer,
    mbz: Optional[ComposerLookupResult],
    wiki: Optional[ComposerLookupResult],
    extracted: ExtractedWorkIdentity,
) -> tuple[str, ...]:
    """Populate blank fields on an existing composer — never overwrite."""
    merged: list[str] = []

    if not composer.mbid and mbz and mbz.mbid:
        composer.mbid = mbz.mbid
        merged.append('mbid')
        provenance.record_external(
            target=composer, field_name='mbid',
            source=ProvenanceSource.MUSICBRAINZ,
            source_reference=str(mbz.mbid),
        )

    if not composer.wikidata_qid and wiki and wiki.wikidata_qid:
        composer.wikidata_qid = wiki.wikidata_qid
        merged.append('wikidata_qid')
        provenance.record_external(
            target=composer, field_name='wikidata_qid',
            source=ProvenanceSource.WIKIDATA,
            source_reference=wiki.wikidata_qid,
        )

    fill_pairs: list[tuple[str, str, str, str]] = []
    # (field_name, value, source_enum, source_reference)
    if wiki:
        fill_pairs += [
            ('bio',              wiki.bio,              ProvenanceSource.WIKIDATA, wiki.wikidata_qid),
            ('portrait_url',     wiki.portrait_url,     ProvenanceSource.WIKIDATA, wiki.wikidata_qid),
            ('portrait_license', wiki.portrait_license, ProvenanceSource.WIKIDATA, wiki.wikidata_qid),
            ('nationality',      wiki.nationality,      ProvenanceSource.WIKIDATA, wiki.wikidata_qid),
            ('period',           wiki.period,           ProvenanceSource.WIKIDATA, wiki.wikidata_qid),
        ]
    if mbz and mbz.aliases:
        # Only set aliases if currently empty.
        if not composer.aliases:
            composer.aliases = list(mbz.aliases)
            merged.append('aliases')
            provenance.record_external(
                target=composer, field_name='aliases',
                source=ProvenanceSource.MUSICBRAINZ,
                source_reference=str(mbz.mbid) if mbz.mbid else '',
            )

    for field, value, src, ref in fill_pairs:
        if not value:
            continue
        if getattr(composer, field):
            continue  # respect existing value
        setattr(composer, field, value)
        merged.append(field)
        provenance.record_external(
            target=composer, field_name=field,
            source=src, source_reference=ref,
        )

    birth_year = _resolve_birth_year(mbz=mbz, wiki=wiki, extracted=extracted)
    if birth_year and not composer.birth_year:
        composer.birth_year = str(birth_year)
        merged.append('birth_year')
        provenance.record_external(
            target=composer, field_name='birth_year',
            source=ProvenanceSource.MUSICBRAINZ if mbz else ProvenanceSource.WIKIDATA,
            source_reference=str(birth_year),
        )

    death_year = _resolve_death_year(mbz=mbz, wiki=wiki)
    if death_year and not composer.death_year:
        composer.death_year = str(death_year)
        merged.append('death_year')
        provenance.record_external(
            target=composer, field_name='death_year',
            source=ProvenanceSource.MUSICBRAINZ if mbz else ProvenanceSource.WIKIDATA,
            source_reference=str(death_year),
        )

    if merged:
        composer.save(update_fields=merged + ['updated_at'])
    return tuple(merged)


def _create_composer(
    *,
    mbz: Optional[ComposerLookupResult],
    wiki: Optional[ComposerLookupResult],
    extracted: ExtractedWorkIdentity,
) -> Composer:
    last_name, first_name = _resolve_canonical_name(
        mbz=mbz, wiki=wiki, extracted=extracted,
    )
    birth_year = _resolve_birth_year(mbz=mbz, wiki=wiki, extracted=extracted)
    death_year = _resolve_death_year(mbz=mbz, wiki=wiki)

    composer = Composer.objects.create(
        first_name=first_name,
        last_name=last_name or extracted.composer_full_name or 'Unknown',
        birth_year=str(birth_year) if birth_year else '',
        death_year=str(death_year) if death_year else '',
        mbid=(mbz.mbid if mbz else None),
        wikidata_qid=(wiki.wikidata_qid if wiki else ''),
        nationality=(wiki.nationality if wiki else ''),
        period=(wiki.period if wiki else ''),
        bio=(wiki.bio if wiki else ''),
        portrait_url=(wiki.portrait_url if wiki else ''),
        portrait_license=(wiki.portrait_license if wiki else ''),
        aliases=list(mbz.aliases) if mbz and mbz.aliases else [],
    )

    # Record provenance for every populated field — first source wins.
    if mbz and mbz.mbid:
        provenance.record_external(
            target=composer, field_name='mbid',
            source=ProvenanceSource.MUSICBRAINZ, source_reference=str(mbz.mbid),
        )
    if wiki and wiki.wikidata_qid:
        provenance.record_external(
            target=composer, field_name='wikidata_qid',
            source=ProvenanceSource.WIKIDATA, source_reference=wiki.wikidata_qid,
        )
    return composer


# ===========================================================================
# Piece
# ===========================================================================

def resolve_or_create_piece(
    *,
    composer_id: UUID,
    extracted: ExtractedWorkIdentity,
    mbz_work: Optional[WorkLookupResult] = None,
) -> ResolveOutcome:
    """
    Pick or create the canonical `Piece` row. Caller must have already
    resolved the composer (Piece requires composer_id).
    """
    with transaction.atomic():
        piece = _find_existing_piece(
            composer_id=composer_id, mbz_work=mbz_work, extracted=extracted,
        )
        if piece is not None:
            merged = _merge_piece(piece=piece, mbz_work=mbz_work, extracted=extracted)
            return ResolveOutcome(entity_id=piece.id, created=False, merged_fields=merged)

        piece = _create_piece(
            composer_id=composer_id, mbz_work=mbz_work, extracted=extracted,
        )
        return ResolveOutcome(entity_id=piece.id, created=True, merged_fields=())


def _find_existing_piece(
    *,
    composer_id: UUID,
    mbz_work: Optional[WorkLookupResult],
    extracted: ExtractedWorkIdentity,
) -> Optional[Piece]:
    # 1. MBID work — canonical.
    if mbz_work and mbz_work.mbid:
        match = Piece.objects.filter(mbid_work=mbz_work.mbid).first()
        if match:
            return match

    title = (mbz_work.canonical_title if mbz_work else extracted.title).strip()
    opus = (mbz_work.opus_catalog if mbz_work else (extracted.opus_catalog or '')).strip()

    # 2. (composer, title, opus) triple — strongest non-MBID match.
    if title and opus:
        match = Piece.objects.filter(
            composer_id=composer_id,
            title__iexact=title,
            opus_catalog__iexact=opus,
        ).first()
        if match:
            return match

    # 3. (composer, title) pair — weakest match; OK for single-opus composers
    #    and for works where no catalog exists (anthems, partsongs).
    if title:
        match = Piece.objects.filter(
            composer_id=composer_id,
            title__iexact=title,
        ).first()
        if match:
            return match

    return None


def _merge_piece(
    *,
    piece: Piece,
    mbz_work: Optional[WorkLookupResult],
    extracted: ExtractedWorkIdentity,
) -> tuple[str, ...]:
    """Populate blank fields on an existing piece — never overwrite."""
    merged: list[str] = []

    if not piece.mbid_work and mbz_work and mbz_work.mbid:
        piece.mbid_work = mbz_work.mbid
        merged.append('mbid_work')
        provenance.record_external(
            target=piece, field_name='mbid_work',
            source=ProvenanceSource.MUSICBRAINZ,
            source_reference=str(mbz_work.mbid),
        )

    fill_pairs: list[tuple[str, str, str, str]] = []
    if mbz_work:
        fill_pairs += [
            ('opus_catalog', mbz_work.opus_catalog, ProvenanceSource.MUSICBRAINZ, str(mbz_work.mbid)),
            ('musical_key',  mbz_work.musical_key,  ProvenanceSource.MUSICBRAINZ, str(mbz_work.mbid)),
            ('language',     mbz_work.language,     ProvenanceSource.MUSICBRAINZ, str(mbz_work.mbid)),
        ]
    # AI-extracted values fall back when no canonical source exists.
    # `identify_work` runs on Haiku 4.5 — keep the provenance source aligned.
    if extracted.musical_key:
        fill_pairs.append(('musical_key', extracted.musical_key, ProvenanceSource.AI_HAIKU, 'extract_work_identity'))
    if extracted.opus_catalog:
        fill_pairs.append(('opus_catalog', extracted.opus_catalog, ProvenanceSource.AI_HAIKU, 'extract_work_identity'))
    if extracted.voicing:
        fill_pairs.append(('voicing', extracted.voicing, ProvenanceSource.AI_HAIKU, 'extract_work_identity'))
    if extracted.text_source:
        fill_pairs.append(('text_source', extracted.text_source, ProvenanceSource.AI_HAIKU, 'extract_work_identity'))

    for field, value, src, ref in fill_pairs:
        if not value:
            continue
        if getattr(piece, field):
            continue
        setattr(piece, field, value)
        merged.append(field)
        provenance.record_external(
            target=piece, field_name=field,
            source=src, source_reference=ref,
        )

    if merged:
        piece.save(update_fields=list(set(merged)) + ['updated_at'])
    return tuple(set(merged))


def _create_piece(
    *,
    composer_id: UUID,
    mbz_work: Optional[WorkLookupResult],
    extracted: ExtractedWorkIdentity,
) -> Piece:
    title = (mbz_work.canonical_title if mbz_work else extracted.title).strip()

    piece = Piece.objects.create(
        composer_id=composer_id,
        title=title or 'Untitled Work',
        opus_catalog=(mbz_work.opus_catalog if mbz_work else extracted.opus_catalog) or '',
        musical_key=(mbz_work.musical_key if mbz_work else extracted.musical_key) or '',
        language=(mbz_work.language if mbz_work else (extracted.language or '')),
        voicing=extracted.voicing or '',
        text_source=extracted.text_source or '',
        mbid_work=(mbz_work.mbid if mbz_work else None),
        ingestion_status=IngestionStatus.EXTRACTING,
    )

    if mbz_work and mbz_work.mbid:
        provenance.record_external(
            target=piece, field_name='mbid_work',
            source=ProvenanceSource.MUSICBRAINZ,
            source_reference=str(mbz_work.mbid),
        )
    return piece


# ===========================================================================
# Field-priority helpers — canonical sources win, AI is the fallback
# ===========================================================================

def _resolve_canonical_name(
    *,
    mbz: Optional[ComposerLookupResult],
    wiki: Optional[ComposerLookupResult],
    extracted: ExtractedWorkIdentity,
) -> tuple[str, str]:
    """Returns (last_name, first_name). Prefer MBZ → Wiki → AI extraction."""
    for src in (mbz, wiki):
        if src and (src.canonical_last_name or src.canonical_first_name):
            return src.canonical_last_name.strip(), src.canonical_first_name.strip()

    # AI fallback — parse "First Last" or "Last, First".
    raw = (extracted.composer_full_name or '').strip()
    if not raw:
        return '', ''
    if ',' in raw:
        last, _, first = raw.partition(',')
        return last.strip(), first.strip()
    parts = raw.rsplit(' ', 1)
    if len(parts) == 2:
        return parts[1].strip(), parts[0].strip()
    return raw, ''


def _resolve_birth_year(
    *,
    mbz: Optional[ComposerLookupResult],
    wiki: Optional[ComposerLookupResult],
    extracted: ExtractedWorkIdentity,
) -> Optional[int]:
    for src in (mbz, wiki):
        if src and src.birth_year:
            return src.birth_year
    return extracted.composer_birth_year


def _resolve_death_year(
    *,
    mbz: Optional[ComposerLookupResult],
    wiki: Optional[ComposerLookupResult],
) -> Optional[int]:
    for src in (mbz, wiki):
        if src and src.death_year:
            return src.death_year
    return None
