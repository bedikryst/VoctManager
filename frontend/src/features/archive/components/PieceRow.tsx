/**
 * @file PieceRow.tsx
 * @description Compact, click-to-expand piece row with inline pencil edits
 * on 1-line fields. Replaces the heavy slide-over panel pattern: ~80% of
 * conductor interactions land here without ever leaving the list.
 *
 * Three layers of interaction:
 *   1. Glance — row collapsed; intrinsic facts read as plain type, and the
 *      only chips are exceptions (no score, pipeline unsettled).
 *   2. Quick fix — pencil-click any inline-editable field, type, Enter.
 *      Optimistic PATCH; no panel, no animation.
 *   3. Expand — click row body → accordion opens below with composer card,
 *      editions list (per-edition approve/reingest/delete), MP3 tracks
 *      mini-player + upload, audio list, AI status summary, and a CTA to
 *      `/panel/archive-management/:id` — the Piece Card — for the full
 *      edit + AI verification cockpit.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceRow
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  FileWarning,
  Headphones,
  Trash2,
} from "lucide-react";

import type { EnrichedPiece } from "../types/archive.dto";
import { INGESTION_STATUS, type IngestionStatusCode } from "@/shared/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { EditionStatusBadge } from "@/shared/ui/composites/repertoire";
import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import { hasPdf } from "../constants/piecePdfs";
import { getArchiveEpochOptions } from "../constants/archiveEpochs";
import { onActivate } from "@/shared/lib/dom/a11y";
import { cn } from "@/shared/lib/utils";

import { useUpdatePiece } from "../api/archive.queries";
import { PieceRowExpanded } from "./PieceRowExpanded";

interface PieceRowProps {
  readonly piece: EnrichedPiece;
  readonly onDelete: (piece: EnrichedPiece) => void;
  readonly defaultExpanded?: boolean;
}

const composerLabel = (piece: EnrichedPiece, fallback: string): string => {
  const c = piece.composer;
  if (!c) return fallback;
  return `${c.first_name ?? ""} ${c.last_name}`.trim();
};

const formatDuration = (seconds: number | null | undefined): string | null => {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/**
 * The one ingestion phase worth printing on a collapsed row — and only when it
 * is not READY. Approved is the resting state of every piece in a healthy
 * archive, so a chip announcing it on all two hundred rows is exactly what
 * buries the three that need a human.
 */
const unsettledIngestionStatus = (
  piece: EnrichedPiece,
): IngestionStatusCode | null => {
  if (!piece.editions || piece.editions.length === 0) return null;
  const priority: IngestionStatusCode[] = [
    INGESTION_STATUS.EXTRACTING,
    INGESTION_STATUS.ENRICHING,
    INGESTION_STATUS.GENERATING,
    INGESTION_STATUS.PENDING,
    INGESTION_STATUS.FAILED,
    INGESTION_STATUS.AWAITING,
  ];
  const present = new Set(piece.editions.map((e) => e.ingestion_status));
  return priority.find((s) => present.has(s)) ?? null;
};

const parseYear = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = /\d{3,4}/.exec(String(value));
  return match ? parseInt(match[0], 10) : null;
};

const hasYearAnomaly = (piece: EnrichedPiece): boolean => {
  if (!piece.composition_year || !piece.composer) return false;
  const birth = parseYear(piece.composer.birth_year);
  const death = parseYear(piece.composer.death_year);
  if (birth !== null && piece.composition_year < birth) return true;
  if (death !== null && piece.composition_year > death + 50) return true;
  return false;
};

// ---------------------------------------------------------------------------
// Exceptions only. A chip on this row means "look at me": the score that never
// arrived, and a pipeline phase that has not settled. Everything a healthy
// piece has — an approved edition, an attached PDF — says nothing, which is
// what makes the two that speak findable in a list of two hundred.
// ---------------------------------------------------------------------------

interface StateBadgesProps {
  readonly hasPdfAttached: boolean;
  readonly aiStatus: IngestionStatusCode | null;
}

const StateBadges = ({
  hasPdfAttached,
  aiStatus,
}: StateBadgesProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  if (hasPdfAttached && !aiStatus) return null;
  return (
    <>
      {!hasPdfAttached && (
        <Badge
          variant="warning"
          icon={<FileWarning size={11} aria-hidden="true" />}
          title={t(
            "archive.row.no_pdf_tooltip",
            "Utwór bez partytury — wgraj PDF, żeby AI uzupełnił metadane",
          )}
        >
          {t("archive.row.no_pdf", "bez nut")}
        </Badge>
      )}
      {aiStatus && <EditionStatusBadge status={aiStatus} />}
    </>
  );
};

// ---------------------------------------------------------------------------

export const PieceRow = ({
  piece,
  onDelete,
  defaultExpanded = false,
}: PieceRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const updatePiece = useUpdatePiece();

  const epochOptions = getArchiveEpochOptions(t);
  const epochLabel = piece.epoch
    ? epochOptions.find((e) => e.value === piece.epoch)?.label
    : null;
  const composer = composerLabel(piece, t("archive.row.traditional", "Tradycyjny"));
  const duration = formatDuration(piece.estimated_duration);
  const aiStatus = unsettledIngestionStatus(piece);
  const audioCount = piece.tracks?.length ?? 0;
  const hasPdfAttached = hasPdf(piece);
  const yearAnomaly = hasYearAnomaly(piece);

  /** Intrinsic facts — a count and a length, not statuses. No chip chrome. */
  const trackCount = audioCount > 0 && (
    <Caption
      color="muted"
      className="inline-flex items-center gap-1 tabular-nums"
      title={t("archive.row.audio_count_tooltip", "{{count}} ścieżek audio", {
        count: audioCount,
      })}
    >
      <Headphones size={10} aria-hidden="true" />
      {audioCount}
    </Caption>
  );

  const patch = (field: string, valueRaw: string) => {
    const value: string | number | null = (() => {
      if (field === "composition_year") {
        const trimmed = valueRaw.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return valueRaw;
    })();
    return updatePiece.mutateAsync({
      id: String(piece.id),
      data: { [field]: value },
    });
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-nested border bg-ethereal-alabaster/60 transition-all",
        isExpanded
          ? "border-ethereal-gold/30 shadow-glass-ethereal"
          : "border-hairline hover:border-ethereal-gold/25 hover:bg-ethereal-parchment/30",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((v) => !v)}
        onKeyDown={onActivate(() => setIsExpanded((v) => !v))}
        className={cn(
          "group flex w-full cursor-pointer items-start gap-3 px-4 py-3 md:items-center",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 focus-visible:ring-inset",
        )}
        aria-expanded={isExpanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {/* No stopPropagation wrapper anywhere in this row: `InlineEditable`
                already swallows the click on its own control, and a wrapper
                around it swallowed the whole LINE — the empty space beside a
                title is the largest target the row offers for expanding it. */}
            <InlineEditable
              value={piece.title}
              onSave={(next) => patch("title", next)}
              ariaLabel={t("archive.row.edit_title", "Tytuł")}
              variant="display"
              placeholder={t("archive.row.title_placeholder", "Tytuł utworu")}
            />
            {epochLabel && (
              <Eyebrow
                color="muted"
                className="hidden shrink-0 md:inline"
              >
                {epochLabel}
              </Eyebrow>
            )}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <Text size="xs" color="graphite" className="truncate">
              {composer}
            </Text>
            {(piece.composition_year || piece.composer) && (
              <>
                <Text size="xs" color="graphite" aria-hidden="true">
                  ·
                </Text>
                <InlineEditable
                  value={piece.composition_year ?? null}
                  onSave={(next) => patch("composition_year", next)}
                  type="number"
                  ariaLabel={t("archive.row.edit_year", "Rok kompozycji")}
                  variant="subtle"
                  emptyDisplay={t("archive.row.year_placeholder", "rok?")}
                />
                {yearAnomaly && (
                  <span
                    title={t(
                      "archive.row.year_anomaly_tooltip",
                      "AI mógł się pomylić — rok nie pasuje do dat życia kompozytora",
                    )}
                    className="inline-flex items-center text-ethereal-crimson"
                    aria-label={t(
                      "archive.row.year_anomaly_aria",
                      "Ostrzeżenie: rok kompozycji jest podejrzany",
                    )}
                  >
                    <AlertTriangle size={11} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                )}
              </>
            )}
          </div>

          {/* Mobile meta — voicing / duration / badges live on their own line
              below the title so nothing crowds it. Desktop shows these on the
              right rail instead (the two clusters below, md:flex). */}
          {(piece.voicing || duration || audioCount > 0 || !hasPdfAttached || aiStatus) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
              {/* A voicing is notation the score itself carries (SATB, SSAATTBB)
                  — it owns its casing and is not an overline. */}
              {piece.voicing && (
                <Caption color="muted" className="font-semibold">
                  {piece.voicing}
                </Caption>
              )}
              {duration && (
                <Caption color="muted" className="inline-flex items-center gap-1 tabular-nums">
                  <Clock size={10} aria-hidden="true" />
                  {duration}
                </Caption>
              )}
              {trackCount}
              <StateBadges hasPdfAttached={hasPdfAttached} aiStatus={aiStatus} />
            </div>
          )}
        </div>

        {/* Intrinsic facts — voicing, duration, tracks: plain typography, no chip chrome */}
        <div className="hidden shrink-0 items-baseline gap-3 md:flex">
          {piece.voicing && (
            <InlineEditable
              value={piece.voicing}
              onSave={(next) => patch("voicing", next)}
              ariaLabel={t("archive.row.edit_voicing", "Obsada")}
              variant="subtle"
              placeholder="SATB"
            />
          )}
          {duration && (
            <Caption color="muted" className="inline-flex items-center gap-1 tabular-nums">
              <Clock size={10} aria-hidden="true" />
              {duration}
            </Caption>
          )}
          {trackCount}
        </div>

        {/* Exceptions — desktop right rail; on mobile these render in the
            meta line under the title instead (see above). */}
        <div className="hidden shrink-0 items-center gap-1.5 md:flex">
          <StateBadges hasPdfAttached={hasPdfAttached} aiStatus={aiStatus} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="icon"
            size="icon"
            aria-label={t("archive.row.delete_aria", "Usuń utwór {{title}}", {
              title: piece.title,
            })}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(piece);
            }}
            className="h-8 w-8 text-ethereal-graphite transition-opacity hover:text-ethereal-crimson focus-visible:opacity-100 fine-pointer:opacity-0 fine-pointer:group-hover:opacity-100"
          >
            <Trash2 size={13} aria-hidden="true" />
          </Button>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn(
              "shrink-0 text-ethereal-graphite/70 transition-transform",
              isExpanded && "rotate-180 text-ethereal-gold",
            )}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-hairline"
          >
            <PieceRowExpanded piece={piece} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
