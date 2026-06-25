/**
 * @file PieceRow.tsx
 * @description Compact, click-to-expand piece row with inline pencil edits
 * on 1-line fields. Replaces the heavy slide-over panel pattern: ~80% of
 * conductor interactions land here without ever leaving the list.
 *
 * Three layers of interaction:
 *   1. Glance — row collapsed, all key chips visible.
 *   2. Quick fix — pencil-click any inline-editable field, type, Enter.
 *      Optimistic PATCH; no panel, no animation.
 *   3. Expand — click row body → accordion opens below with composer card,
 *      editions list (per-edition approve/reingest/delete), MP3 tracks
 *      mini-player + upload, audio list, AI status summary, and a CTA to
 *      `/panel/archive-management/:id/review` for deep AI verification
 *      with PDF preview.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceRow
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Headphones,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";

import type { EnrichedPiece } from "../types/archive.dto";
import { INGESTION_STATUS, type IngestionStatusCode } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import { hasPdf } from "../constants/piecePdfs";
import { getArchiveEpochOptions } from "../constants/archiveEpochs";
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

const aggregateIngestionStatus = (
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
    INGESTION_STATUS.READY,
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
// Status chip — read-only visual indicator of edition ingestion status.
// ---------------------------------------------------------------------------

const StatusChip = ({
  status,
}: {
  status: IngestionStatusCode;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest";

  switch (status) {
    case INGESTION_STATUS.READY:
      return (
        <span
          className={cn(base, "border-ethereal-sage/40 bg-ethereal-sage/10 text-ethereal-sage")}
          title={t("archive.row.status_ready", "Zatwierdzone przez Ciebie")}
        >
          <CheckCircle2 size={10} aria-hidden="true" />
          AI
        </span>
      );
    case INGESTION_STATUS.AWAITING:
      return (
        <span
          className={cn(base, "border-ethereal-gold/45 bg-ethereal-gold/10 text-ethereal-gold")}
          title={t("archive.row.status_awaiting", "AI zakończyło — czeka na weryfikację")}
        >
          <Sparkles size={10} aria-hidden="true" />
          {t("archive.row.badge_awaiting", "AI · do przeglądu")}
        </span>
      );
    case INGESTION_STATUS.FAILED:
      return (
        <span
          className={cn(base, "border-ethereal-crimson/40 bg-ethereal-crimson/10 text-ethereal-crimson")}
          title={t("archive.row.status_failed", "Pipeline AI się nie powiódł")}
        >
          <AlertTriangle size={10} aria-hidden="true" />
          {t("archive.row.badge_failed", "AI · błąd")}
        </span>
      );
    case INGESTION_STATUS.EXTRACTING:
    case INGESTION_STATUS.ENRICHING:
    case INGESTION_STATUS.GENERATING:
    case INGESTION_STATUS.PENDING:
      return (
        <span
          className={cn(base, "border-ethereal-amethyst/40 bg-ethereal-amethyst/10 text-ethereal-amethyst")}
          title={t("archive.row.status_progress", "AI pracuje…")}
        >
          <Loader2 size={10} aria-hidden="true" className="animate-spin" />
          {t("archive.row.badge_progress", "AI · w toku")}
        </span>
      );
    default:
      return <></>;
  }
};

// ---------------------------------------------------------------------------
// State badges — PDF / audio-count / AI status. Shared between the desktop
// right rail and the mobile meta line so the markup lives in one place.
// ---------------------------------------------------------------------------

interface StateBadgesProps {
  readonly hasPdfAttached: boolean;
  readonly audioCount: number;
  readonly aiStatus: IngestionStatusCode | null;
}

const StateBadges = ({
  hasPdfAttached,
  audioCount,
  aiStatus,
}: StateBadgesProps): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <>
      {hasPdfAttached && (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-ethereal-amethyst/30 bg-ethereal-amethyst/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ethereal-amethyst"
          title={t("archive.row.pdf_attached", "PDF dostępne")}
        >
          <FileText size={10} aria-hidden="true" />
          PDF
        </span>
      )}
      {audioCount > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded-md border border-ethereal-sage/35 bg-ethereal-sage/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ethereal-sage"
          title={t("archive.row.audio_count_tooltip", "{{count}} ścieżek audio", {
            count: audioCount,
          })}
        >
          <Headphones size={10} aria-hidden="true" />
          {audioCount}
        </span>
      )}
      {aiStatus && <StatusChip status={aiStatus} />}
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
  const aiStatus = aggregateIngestionStatus(piece);
  const audioCount = piece.tracks?.length ?? 0;
  const hasPdfAttached = hasPdf(piece);
  const yearAnomaly = hasYearAnomaly(piece);

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
        "overflow-hidden rounded-2xl border bg-ethereal-alabaster/60 transition-all",
        isExpanded
          ? "border-ethereal-gold/30 shadow-glass-ethereal"
          : "border-ethereal-incense/20 hover:border-ethereal-gold/25 hover:bg-ethereal-parchment/30",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsExpanded((v) => !v);
          }
        }}
        className={cn(
          "group flex w-full cursor-pointer items-start gap-3 px-4 py-3 md:items-center",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 focus-visible:ring-inset",
        )}
        aria-expanded={isExpanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <div onClick={(event) => event.stopPropagation()}>
              <InlineEditable
                value={piece.title}
                onSave={(next) => patch("title", next)}
                ariaLabel={t("archive.row.edit_title", "Tytuł")}
                variant="title"
                placeholder={t("archive.row.title_placeholder", "Tytuł utworu")}
              />
            </div>
            {epochLabel && (
              <Eyebrow
                color="muted"
                size="caption"
                className="hidden shrink-0 md:inline"
              >
                {epochLabel}
              </Eyebrow>
            )}
          </div>
          <div
            className="mt-0.5 flex items-baseline gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
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
          {(piece.voicing ||
            duration ||
            hasPdfAttached ||
            audioCount > 0 ||
            aiStatus) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
              {piece.voicing && (
                <Caption color="muted" className="font-semibold uppercase tracking-wide">
                  {piece.voicing}
                </Caption>
              )}
              {duration && (
                <Caption color="muted" className="inline-flex items-center gap-1 tabular-nums">
                  <Clock size={10} aria-hidden="true" />
                  {duration}
                </Caption>
              )}
              <StateBadges
                hasPdfAttached={hasPdfAttached}
                audioCount={audioCount}
                aiStatus={aiStatus}
              />
            </div>
          )}
        </div>

        {/* Intrinsic facts — voicing + duration, plain typography no chip chrome */}
        <div className="hidden shrink-0 items-baseline gap-3 md:flex">
          {piece.voicing && (
            <span onClick={(event) => event.stopPropagation()}>
              <InlineEditable
                value={piece.voicing}
                onSave={(next) => patch("voicing", next)}
                ariaLabel={t("archive.row.edit_voicing", "Obsada")}
                variant="subtle"
                placeholder="SATB"
              />
            </span>
          )}
          {duration && (
            <Caption color="muted" className="inline-flex items-center gap-1 tabular-nums">
              <Clock size={10} aria-hidden="true" />
              {duration}
            </Caption>
          )}
        </div>

        {/* State badges — desktop right rail; on mobile these render in the
            meta line under the title instead (see above). */}
        <div className="hidden shrink-0 items-center gap-1.5 md:flex">
          <StateBadges
            hasPdfAttached={hasPdfAttached}
            audioCount={audioCount}
            aiStatus={aiStatus}
          />
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
            className="overflow-hidden border-t border-ethereal-incense/15"
          >
            <PieceRowExpanded piece={piece} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
