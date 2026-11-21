/**
 * @file pieceProvenance.ts
 * @description Where each of a piece's fields came from, and the one rule that
 * counts what is left to check. A field is unchecked while its latest
 * provenance is an AI extraction; a hand edit or a confirmation stamps it
 * MANUAL on the server. The piece card's header, section index and publication
 * dialog, and the library's expanded row, count with `pieceReviewBreakdown`;
 * the card's check buttons, and so its review keys, use the same
 * `isAiProvenance` test, so no two surfaces disagree. Model confidence is not
 * read: it was a near-constant ~95% whatever the extraction's quality.
 * @module features/archive/constants/pieceProvenance
 */

import type { Piece, ProvenanceEntry } from "@/shared/types";

const AI_SOURCES = new Set(["AIS", "AIH", "AIO"]);
export const isAiProvenance = (entry: ProvenanceEntry | undefined): boolean =>
  entry !== undefined && AI_SOURCES.has(entry.source);

/** Lookup the latest provenance entry for one of a piece's own fields. */
export const pieceFieldProvenance = (
  piece: Piece,
  field: string,
): ProvenanceEntry | undefined => piece.provenance?.[`${piece.id}:${field}`];

/** Lookup provenance for a child object (movement / translation) by its id. */
export const childFieldProvenance = (
  piece: Piece,
  objectId: string,
  field: string,
): ProvenanceEntry | undefined => piece.provenance?.[`${objectId}:${field}`];

export interface ReviewProgress {
  /** Fields (of the queried set) that carry any provenance row at all. */
  readonly total: number;
  /** Trusted: hand-verified (MAN) or corroborated by a canonical catalogue. */
  readonly verified: number;
  /** Still an unverified AI extraction — the ones a human should eyeball. */
  readonly pending: number;
}

/**
 * The piece's own fields a reviewer can check, and so the exact denominator of
 * the review progress. Kept here rather than in the page so every surface that
 * counts "pól do sprawdzenia" counts the same set.
 */
export const METADATA_PROVENANCE_FIELDS = [
  "title", "arranger", "opus_catalog", "musical_key", "language",
  "voicing", "epoch", "composition_year", "text_source",
  "lyrics_original", "lyrics_ipa",
] as const;

type MetadataProvenanceField = (typeof METADATA_PROVENANCE_FIELDS)[number];

/**
 * Where the piece card shows each metadata field: the title heads the page,
 * and every other field sits in one record section. Together they are exactly
 * `METADATA_PROVENANCE_FIELDS`, so the sections' counts add up to the header's.
 */
const RECORD_SECTION_FIELDS = {
  header: ["title"],
  properties: ["arranger", "opus_catalog", "musical_key", "language", "epoch", "composition_year"],
  voices: ["voicing"],
  text: ["text_source", "lyrics_original", "lyrics_ipa"],
} as const satisfies Record<string, readonly MetadataProvenanceField[]>;

/** The one checkable field on each AI-generated child. Mirrors the server's
 *  verify allow-list (`_resolve_child_provenance_target`): anything outside it
 *  cannot be verified, so counting it would print a target that never reaches
 *  zero. Recordings carry provenance but no verify affordance — hence absent. */
const MOVEMENT_REVIEW_FIELD = "title";
const TRANSLATION_REVIEW_FIELD = "text";

const rollup = (
  entries: readonly (ProvenanceEntry | undefined)[],
): ReviewProgress => {
  let total = 0;
  let pending = 0;
  for (const entry of entries) {
    if (!entry) continue;
    total += 1;
    if (isAiProvenance(entry)) pending += 1;
  }
  return { total, verified: total - pending, pending };
};

const sumProgress = (...parts: readonly ReviewProgress[]): ReviewProgress =>
  parts.reduce(
    (acc, part) => ({
      total: acc.total + part.total,
      verified: acc.verified + part.verified,
      pending: acc.pending + part.pending,
    }),
    { total: 0, verified: 0, pending: 0 },
  );

/** The piece card's record sections that hold checkable fields, plus its header. */
export type ReviewSection = keyof typeof RECORD_SECTION_FIELDS | "translations" | "movements";

export interface PieceReviewBreakdown {
  readonly metadata: ReviewProgress;
  readonly movements: ReviewProgress;
  readonly translations: ReviewProgress;
  /** The same fields split by the piece card section that shows them. */
  readonly sections: Readonly<Record<ReviewSection, ReviewProgress>>;
  /** Everything a conductor can actually verify on this piece. */
  readonly all: ReviewProgress;
}

/**
 * Roll up per-field provenance into the review progress, split by the section
 * that owns each field so the section index can count its own backlog.
 * Fields with no provenance row are ignored (manually-authored pieces), so the
 * progress never shows a denominator the AI pipeline never populated. A field is
 * "pending" only while its source is still AI — the moment it is hand-corrected
 * (or click-verified) the server stamps MANUAL and it flips to "verified".
 */
export const pieceReviewBreakdown = (piece: Piece): PieceReviewBreakdown => {
  const metadata = rollup(
    METADATA_PROVENANCE_FIELDS.map((field) =>
      pieceFieldProvenance(piece, field),
    ),
  );
  const movements = rollup(
    (piece.movements ?? []).map((movement) =>
      childFieldProvenance(piece, movement.id, MOVEMENT_REVIEW_FIELD),
    ),
  );
  const translations = rollup(
    (piece.translations ?? []).map((translation) =>
      childFieldProvenance(piece, translation.id, TRANSLATION_REVIEW_FIELD),
    ),
  );
  const fieldsOf = (fields: readonly MetadataProvenanceField[]): ReviewProgress =>
    rollup(fields.map((field) => pieceFieldProvenance(piece, field)));
  return {
    metadata,
    movements,
    translations,
    sections: {
      header: fieldsOf(RECORD_SECTION_FIELDS.header),
      properties: fieldsOf(RECORD_SECTION_FIELDS.properties),
      voices: fieldsOf(RECORD_SECTION_FIELDS.voices),
      text: fieldsOf(RECORD_SECTION_FIELDS.text),
      translations,
      movements,
    },
    all: sumProgress(metadata, movements, translations),
  };
};
