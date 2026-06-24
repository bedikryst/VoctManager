"""
===============================================================================
Score Package Compiler — Composer Enrichment Service
===============================================================================
Domain: Archive / Enrichment
Description:
    On-demand re-pull of canonical composer metadata from MusicBrainz +
    Wikidata, powering the "Odśwież z MusicBrainz" button. This is the
    single source of truth for that flow; the view is a thin wrapper.

    Two modes:
      * fill  (default) — populate ONLY blank fields. Prior data and conductor
        edits are never touched.
      * force           — also overwrite canonical fields with fresh external
        values, EXCEPT any field a human edited by hand. A `MANUAL`
        ProvenanceRecord makes a field sacred even under force.

    Improvements over the old inline view logic:
      * Re-queries MusicBrainz by mbid (exact) when the composer already has
        one — the old code skipped MB entirely in that case, so aliases and
        dates never refreshed.
      * Falls back to a Wikidata name search when the mbid has no P434 backlink
        — a large share of valid composer entities lack it, which is why
        portraits "stopped downloading" for some composers.
      * Records a ProvenanceRecord for every value written (the old path wrote
        none), so the data stays attributable.
      * Returns a RefreshReport the API surfaces, so a no-op is explained
        ("matched, already complete") instead of looking like a silent failure.

Standards: SaaS 2026, conductor-edits-are-sacred, every claim attributable.
===============================================================================
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from django.contrib.contenttypes.models import ContentType

from archive.dtos import ComposerLookupResult
from archive.infrastructure.musicbrainz_client import MusicBrainzClient
from archive.infrastructure.wikidata_client import WikidataClient
from archive.models import Composer, ProvenanceRecord, ProvenanceSource
from archive.services import provenance

logger = logging.getLogger(__name__)


# Outcome codes — small, stable vocabulary the frontend maps to a message.
STATUS_UPDATED = 'updated'                  # at least one field changed
STATUS_MATCHED_NO_CHANGES = 'matched_no_changes'  # found, but nothing to fill
STATUS_NO_MATCH = 'no_match'                # neither source returned an entity
STATUS_NO_NAME = 'no_name'                  # composer has no name to resolve


@dataclass
class RefreshReport:
    """What `refresh_composer` did — surfaced verbatim by the API."""
    status: str
    fields_filled: list[str] = field(default_factory=list)
    fields_overwritten: list[str] = field(default_factory=list)
    fields_skipped_existing: list[str] = field(default_factory=list)
    mbid: str = ''
    wikidata_qid: str = ''
    mbz_responded: bool = False
    wiki_responded: bool = False

    @property
    def changed(self) -> list[str]:
        return [*self.fields_filled, *self.fields_overwritten]


def refresh_composer(composer: Composer, *, force: bool = False) -> RefreshReport:
    """Re-pull MusicBrainz + Wikidata data for one composer. See module docstring."""
    full_name = f"{composer.first_name} {composer.last_name}".strip()
    if not full_name:
        return RefreshReport(status=STATUS_NO_NAME)

    mbz = _resolve_musicbrainz(composer, full_name, force=force)
    wiki = _resolve_wikidata(composer, mbz, full_name, force=force)

    report = RefreshReport(
        status=STATUS_NO_MATCH,
        mbid=str(composer.mbid or (mbz.mbid if mbz else '') or ''),
        wikidata_qid=composer.wikidata_qid or (wiki.wikidata_qid if wiki else ''),
        mbz_responded=mbz is not None,
        wiki_responded=wiki is not None,
    )

    _apply(composer, mbz=mbz, wiki=wiki, force=force, report=report)

    if report.changed:
        composer.save(update_fields=[*dict.fromkeys(report.changed), 'updated_at'])
        report.status = STATUS_UPDATED
    elif mbz is not None or wiki is not None:
        report.status = STATUS_MATCHED_NO_CHANGES

    logger.info(
        "composer.refresh id=%s force=%s status=%s filled=%s overwritten=%s "
        "skipped=%s mbz=%s wiki=%s",
        composer.id, force, report.status, report.fields_filled,
        report.fields_overwritten, report.fields_skipped_existing,
        report.mbz_responded, report.wiki_responded,
    )
    return report


# ---------------------------------------------------------------------------
# Source resolution
# ---------------------------------------------------------------------------

def _resolve_musicbrainz(
    composer: Composer, full_name: str, *, force: bool,
) -> ComposerLookupResult | None:
    """Exact mbid lookup when we have one (refreshes aliases/dates); otherwise a
    name search to discover the mbid for the first time."""
    if composer.mbid:
        result = MusicBrainzClient.get_artist(composer.mbid, force=force)
        if result is not None:
            return result
    return MusicBrainzClient.search_composer(name=full_name, force=force)


def _resolve_wikidata(
    composer: Composer,
    mbz: ComposerLookupResult | None,
    full_name: str,
    *,
    force: bool,
) -> ComposerLookupResult | None:
    """Prefer the mbid→QID path (precise); fall back to a name search when no
    Wikidata entity carries the P434 backlink (common, and the reason portraits
    silently went missing for many composers)."""
    effective_mbid = composer.mbid or (mbz.mbid if mbz else None)
    if effective_mbid:
        result = WikidataClient.enrich_composer_by_mbid(effective_mbid, force=force)
        if result is not None:
            return result
    return WikidataClient.enrich_composer_by_name(full_name, force=force)


# ---------------------------------------------------------------------------
# Field application
# ---------------------------------------------------------------------------

def _manual_fields(composer: Composer) -> set[str]:
    """Field names a human edited by hand — never overwritten, even under force."""
    ct = ContentType.objects.get_for_model(Composer)
    return set(
        ProvenanceRecord.objects.filter(
            content_type=ct,
            object_id=composer.pk,
            source=ProvenanceSource.MANUAL,
        ).values_list('field_name', flat=True)
    )


def _apply(
    composer: Composer,
    *,
    mbz: ComposerLookupResult | None,
    wiki: ComposerLookupResult | None,
    force: bool,
    report: RefreshReport,
) -> None:
    protected = _manual_fields(composer)
    mbz_ref = str(mbz.mbid) if (mbz and mbz.mbid) else ''
    wiki_ref = wiki.wikidata_qid if (wiki and wiki.wikidata_qid) else ''

    def put(field_name: str, value, source: str, ref: str) -> None:
        if value in (None, '', [], ()):
            return
        current = getattr(composer, field_name)
        if current and _equal(current, value):
            return
        if current:  # would overwrite an existing value
            if not force or field_name in protected:
                report.fields_skipped_existing.append(field_name)
                return
            setattr(composer, field_name, value)
            report.fields_overwritten.append(field_name)
        else:
            setattr(composer, field_name, value)
            report.fields_filled.append(field_name)
        provenance.record_external(
            target=composer, field_name=field_name, source=source, source_reference=ref,
        )

    # Canonical identity ids.
    if mbz and mbz.mbid:
        put('mbid', mbz.mbid, ProvenanceSource.MUSICBRAINZ, mbz_ref)
    if wiki and wiki.wikidata_qid:
        put('wikidata_qid', wiki.wikidata_qid, ProvenanceSource.WIKIDATA, wiki_ref)

    # Aliases (MusicBrainz) — stored as a JSON list.
    if mbz and mbz.aliases:
        put('aliases', list(mbz.aliases), ProvenanceSource.MUSICBRAINZ, mbz_ref)

    # Biographical / portrait fields (Wikidata).
    if wiki:
        put('bio', wiki.bio, ProvenanceSource.WIKIDATA, wiki_ref)
        put('portrait_url', wiki.portrait_url, ProvenanceSource.WIKIDATA, wiki_ref)
        put('portrait_license', wiki.portrait_license, ProvenanceSource.WIKIDATA, wiki_ref)
        put('nationality', wiki.nationality, ProvenanceSource.WIKIDATA, wiki_ref)
        put('period', wiki.period, ProvenanceSource.WIKIDATA, wiki_ref)

    # Life-span years — MusicBrainz first (it's the identity authority), Wikidata
    # as the fallback. Stored as strings on the model.
    birth_src, birth_year = _prefer_year(mbz, wiki, 'birth_year')
    if birth_year:
        put('birth_year', str(birth_year), birth_src, str(birth_year))
    death_src, death_year = _prefer_year(mbz, wiki, 'death_year')
    if death_year:
        put('death_year', str(death_year), death_src, str(death_year))


def _prefer_year(
    mbz: ComposerLookupResult | None,
    wiki: ComposerLookupResult | None,
    attr: str,
) -> tuple[str, int | None]:
    if mbz and getattr(mbz, attr):
        return ProvenanceSource.MUSICBRAINZ, getattr(mbz, attr)
    if wiki and getattr(wiki, attr):
        return ProvenanceSource.WIKIDATA, getattr(wiki, attr)
    return ProvenanceSource.WIKIDATA, None


def _equal(current, value) -> bool:
    """Value-equality across the model's storage types (UUID/str/list)."""
    if isinstance(value, list):
        return list(current or []) == value
    return str(current) == str(value)
