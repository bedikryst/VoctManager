/**
 * @file PieceRow.tsx
 * @description Compact single-line representation of one Piece in the
 * archive list. Replaces the heavy expandable PieceCard — same info,
 * 1/10th the vertical real estate. Click the row to open the editor panel
 * directly (no inline expand).
 *
 * Layout: icon | title + composer | chips (epoch, voicing, duration) | AI/PDF/Audio badges | actions
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/PieceRow
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Headphones,
  Loader2,
  Music,
  Sparkles,
  Trash2,
} from "lucide-react";

import type { EnrichedPiece } from "../types/archive.dto";
import { INGESTION_STATUS, type IngestionStatusCode } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { hasPdf } from "../constants/piecePdfs";
import { getArchiveEpochOptions } from "../constants/archiveEpochs";
import { cn } from "@/shared/lib/utils";

interface PieceRowProps {
  readonly piece: EnrichedPiece;
  readonly onOpen: (piece: EnrichedPiece) => void;
  readonly onDelete: (piece: EnrichedPiece) => void;
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

const StatusChip = ({
  status,
}: {
  status: IngestionStatusCode;
}): React.JSX.Element => {
  const { t } = useTranslation();
  switch (status) {
    case INGESTION_STATUS.READY:
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-ethereal-sage/40 bg-ethereal-sage/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ethereal-sage"
          title={t("archive.row.status_ready", "Zatwierdzone przez Ciebie")}
        >
          <CheckCircle2 size={10} aria-hidden="true" />
          AI
        </span>
      );
    case INGESTION_STATUS.AWAITING:
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-ethereal-gold/45 bg-ethereal-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ethereal-gold"
          title={t("archive.row.status_awaiting", "AI zakończyło — czeka na weryfikację")}
        >
          <Sparkles size={10} aria-hidden="true" />
          AI · do przeglądu
        </span>
      );
    case INGESTION_STATUS.FAILED:
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-ethereal-crimson/40 bg-ethereal-crimson/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ethereal-crimson"
          title={t("archive.row.status_failed", "Pipeline AI się nie powiódł")}
        >
          <AlertTriangle size={10} aria-hidden="true" />
          AI · błąd
        </span>
      );
    case INGESTION_STATUS.EXTRACTING:
    case INGESTION_STATUS.ENRICHING:
    case INGESTION_STATUS.GENERATING:
    case INGESTION_STATUS.PENDING:
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-ethereal-amethyst/40 bg-ethereal-amethyst/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ethereal-amethyst"
          title={t("archive.row.status_progress", "AI pracuje…")}
        >
          <Loader2 size={10} aria-hidden="true" className="animate-spin" />
          AI · w toku
        </span>
      );
    default:
      return <></>;
  }
};

export const PieceRow = ({
  piece,
  onOpen,
  onDelete,
}: PieceRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const epochOptions = getArchiveEpochOptions(t);
  const epochLabel = piece.epoch
    ? epochOptions.find((e) => e.value === piece.epoch)?.label
    : null;
  const composer = composerLabel(piece, t("archive.row.traditional", "Tradycyjny"));
  const duration = formatDuration(piece.estimated_duration);
  const aiStatus = aggregateIngestionStatus(piece);
  const audioCount = piece.tracks?.length ?? 0;
  const hasPdfAttached = hasPdf(piece);

  return (
    <div
      onClick={() => onOpen(piece)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(piece);
        }
      }}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/60 px-4 py-3 transition-all",
        "hover:-translate-y-px hover:border-ethereal-gold/30 hover:bg-ethereal-parchment/30 hover:shadow-glass-ethereal-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
      )}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ethereal-incense/20 bg-ethereal-alabaster text-ethereal-gold shadow-sm"
        aria-hidden="true"
      >
        <Music size={16} strokeWidth={1.6} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Text size="sm" weight="semibold" className="truncate">
            {piece.title}
          </Text>
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
        <div className="mt-0.5 flex items-baseline gap-2">
          <Text size="xs" color="graphite" className="truncate">
            {composer}
            {piece.composition_year ? ` · ${piece.composition_year}` : ""}
          </Text>
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-2 md:flex">
        {piece.voicing && (
          <Eyebrow
            color="muted"
            size="caption"
            className="rounded-md border border-ethereal-incense/20 bg-ethereal-alabaster/80 px-2 py-0.5"
          >
            {piece.voicing}
          </Eyebrow>
        )}
        {duration && (
          <Eyebrow
            color="muted"
            size="caption"
            className="inline-flex items-center gap-1 rounded-md border border-ethereal-incense/20 bg-ethereal-alabaster/80 px-2 py-0.5"
          >
            <Clock size={10} aria-hidden="true" />
            {duration}
          </Eyebrow>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
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
      </div>

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
        className="ml-1 h-8 w-8 text-ethereal-graphite opacity-0 transition-opacity hover:text-ethereal-crimson group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 size={13} aria-hidden="true" />
      </Button>
    </div>
  );
};
