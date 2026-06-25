/**
 * @file ProvenanceChip.tsx
 * @description Per-field source attribution for the AI Review cockpit. Given a
 * field's {@link ProvenanceEntry}, renders a small pill that tells the conductor
 * at a glance whether a value is canonical (MusicBrainz / Wikidata), an AI guess
 * (with the run's self-rated confidence), or already human-verified — the
 * "AI-suggested vs verified" signal the provenance log was built for. A field
 * with no provenance row renders nothing (graceful for manually-entered pieces).
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ProvenanceChip
 */

import React from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Database, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import type { Piece, ProvenanceEntry } from "@/shared/types";

type Tone = "verified" | "canonical" | "ai" | "aiLow" | "external";

const TONE_CLASS: Record<Tone, string> = {
  verified: "border-ethereal-sage/45 bg-ethereal-sage/12 text-ethereal-sage",
  canonical: "border-ethereal-incense/40 bg-ethereal-parchment text-ethereal-graphite",
  ai: "border-ethereal-amethyst/40 bg-ethereal-amethyst/10 text-ethereal-amethyst",
  aiLow: "border-ethereal-crimson/40 bg-ethereal-crimson/8 text-ethereal-crimson",
  external: "border-ethereal-incense/30 bg-ethereal-parchment/60 text-ethereal-graphite",
};

/** AI confidence at/above this reads as "trust but verify"; below is flagged. */
const LOW_CONFIDENCE = 0.7;

const AI_SOURCES = new Set(["AIS", "AIH", "AIO"]);
const CANONICAL_SOURCES = new Set(["MBZ", "WKD", "IMS"]);

interface ChipMeta {
  tone: Tone;
  label: string;
  Icon: typeof Sparkles;
  title: string;
}

const provenanceMeta = (entry: ProvenanceEntry, t: TFunction): ChipMeta => {
  const pct = Math.round((entry.confidence ?? 0) * 100);

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
    const low = (entry.confidence ?? 0) < LOW_CONFIDENCE;
    return {
      tone: low ? "aiLow" : "ai",
      label: t("archive.provenance.ai", "AI · {{pct}}%", { pct }),
      Icon: Sparkles,
      title: low
        ? t(
            "archive.provenance.ai_low_title",
            "AI niskiej pewności ({{pct}}%) — sprawdź dokładnie z PDF.",
            { pct },
          )
        : t(
            "archive.provenance.ai_title",
            "Wyciągnięte przez AI ({{model}}), pewność {{pct}}%.",
            { model: entry.model_version || "AI", pct },
          ),
    };
  }
  if (CANONICAL_SOURCES.has(entry.source)) {
    return {
      tone: "canonical",
      label: entry.source_display,
      Icon: Database,
      title: t(
        "archive.provenance.canonical_title",
        "Z kanonicznego źródła: {{source}}.",
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
}

export const ProvenanceChip = ({
  entry,
  className,
}: ProvenanceChipProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (!entry) return null;
  const meta = provenanceMeta(entry, t);
  return (
    <span
      title={meta.title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.06em]",
        TONE_CLASS[meta.tone],
        className,
      )}
    >
      <meta.Icon size={11} strokeWidth={2} aria-hidden="true" />
      {meta.label}
    </span>
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
