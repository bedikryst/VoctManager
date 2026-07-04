/**
 * @file ProvenanceChip.tsx
 * @description Per-field source attribution for the AI Review cockpit. Given a
 * field's {@link ProvenanceEntry}, renders one small colour-coded dot that tells
 * the conductor at a glance the field's TRUST TIER: verified by hand, verified
 * against a canonical source (MusicBrainz / Wikidata), or an unverified AI
 * extraction that needs a look. A single dot size is used everywhere (metadata,
 * movements, translations) so the review surface reads as one system rather than
 * a mix of loud pills and quiet dots.
 *
 * When the field is still an unverified AI extraction the dot doubles as a
 * one-click "this is already correct" control (`onVerify`): it stamps MANUAL
 * provenance server-side without changing the value, so a conductor can clear a
 * field they trust without having to re-type it. We deliberately do NOT show a
 * percentage: the model's self-rated confidence was a near-constant ~95%
 * regardless of correctness, so a number read as precision it never had. Trust
 * comes from the SOURCE (and corroboration by a canonical catalogue), not from
 * the model grading its own homework. A field with no provenance row renders
 * nothing (graceful for manually-entered pieces).
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ProvenanceChip
 */

import React from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Database, Loader2, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipProvider } from "@/shared/ui/primitives/Tooltip";
import type { Piece, ProvenanceEntry } from "@/shared/types";

type Tone = "verified" | "canonical" | "ai" | "external";

const TONE_CLASS: Record<Tone, string> = {
  verified: "border-ethereal-sage/45 bg-ethereal-sage/12 text-ethereal-sage",
  canonical: "border-ethereal-incense/40 bg-ethereal-parchment text-ethereal-graphite",
  ai: "border-ethereal-amethyst/40 bg-ethereal-amethyst/10 text-ethereal-amethyst",
  external: "border-ethereal-incense/30 bg-ethereal-parchment/60 text-ethereal-graphite",
};

const AI_SOURCES = new Set(["AIS", "AIH", "AIO"]);
const CANONICAL_SOURCES = new Set(["MBZ", "WKD", "IMS"]);

interface ChipMeta {
  tone: Tone;
  label: string;
  Icon: typeof Sparkles;
  title: string;
}

const provenanceMeta = (entry: ProvenanceEntry, t: TFunction): ChipMeta => {
  if (entry.source === "MAN") {
    return {
      tone: "verified",
      label: t("archive.provenance.verified", "Zweryfikowane"),
      Icon: ShieldCheck,
      title: t(
        "archive.provenance.verified_title",
        "Sprawdzone i poprawione ręcznie.",
      ),
    };
  }
  if (AI_SOURCES.has(entry.source)) {
    return {
      tone: "ai",
      label: t("archive.provenance.ai", "AI · do sprawdzenia"),
      Icon: Sparkles,
      title: t(
        "archive.provenance.ai_title",
        "Wyciągnięte przez AI ({{model}}), niezweryfikowane — sprawdź z PDF i popraw w razie potrzeby.",
        { model: entry.model_version || "AI" },
      ),
    };
  }
  if (CANONICAL_SOURCES.has(entry.source)) {
    return {
      tone: "canonical",
      label: t("archive.provenance.canonical", "{{source}} · potwierdzone", {
        source: entry.source_display,
      }),
      Icon: Database,
      title: t(
        "archive.provenance.canonical_title",
        "Potwierdzone przez kanoniczne źródło: {{source}}.",
        { source: entry.source_display },
      ),
    };
  }
  return {
    tone: "external",
    label: entry.source_display,
    Icon: Database,
    title: entry.source_display,
  };
};

interface ProvenanceChipProps {
  readonly entry?: ProvenanceEntry | null;
  readonly className?: string;
  /**
   * When set AND the field is still an unverified AI extraction, the dot becomes
   * an actionable "mark as correct" button: clicking it stamps MANUAL provenance
   * (no value change) so the chip flips to verified. Omitted — or a field that is
   * already verified / canonical — leaves the dot purely informational.
   */
  readonly onVerify?: () => void;
  /** Spinner in place of the icon while the verify request is in flight. */
  readonly isVerifying?: boolean;
}

export const ProvenanceChip = ({
  entry,
  className,
  onVerify,
  isVerifying = false,
}: ProvenanceChipProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (!entry) return null;
  const meta = provenanceMeta(entry, t);

  // A 16px colour dot is dead on touch when its meaning lives only in a hover
  // `title`, so the dot is always a real focusable button carrying an accessible
  // label + a keyboard/pointer tooltip. For an unverified AI field it is also the
  // "this is already correct" control; for anything else it is informational.
  const canVerify = AI_SOURCES.has(entry.source) && Boolean(onVerify);
  const tip = canVerify
    ? t("archive.provenance.verify_hint", "Kliknij, aby oznaczyć jako poprawne")
    : meta.title;
  const ariaLabel = canVerify
    ? t("archive.provenance.verify_aria", "Oznacz jako poprawne: {{label}}", {
        label: meta.label,
      })
    : `${meta.label} — ${meta.title}`;

  return (
    <TooltipProvider disableHoverableContent>
      <Tooltip content={tip} side="top">
        <button
          type="button"
          onClick={canVerify ? onVerify : undefined}
          disabled={isVerifying}
          aria-label={ariaLabel}
          className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 disabled:opacity-70",
            canVerify
              ? "cursor-pointer hover:ring-2 hover:ring-ethereal-sage/45"
              : "cursor-help",
            TONE_CLASS[meta.tone],
            className,
          )}
        >
          {isVerifying ? (
            <Loader2
              size={9}
              strokeWidth={2.25}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <meta.Icon size={9} strokeWidth={2.25} aria-hidden="true" />
          )}
        </button>
      </Tooltip>
    </TooltipProvider>
  );
};

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
 * Roll up per-field provenance into a review scoreboard for a set of fields.
 * Fields with no provenance row are ignored (manually-authored pieces), so the
 * meter never shows a denominator the AI pipeline never populated. A field is
 * "pending" only while its source is still AI — the moment it is hand-corrected
 * the server stamps MANUAL and it flips to "verified".
 */
export const pieceReviewProgress = (
  piece: Piece,
  fields: readonly string[],
): ReviewProgress => {
  let total = 0;
  let pending = 0;
  for (const field of fields) {
    const entry = pieceFieldProvenance(piece, field);
    if (!entry) continue;
    total += 1;
    if (AI_SOURCES.has(entry.source)) pending += 1;
  }
  return { total, verified: total - pending, pending };
};
