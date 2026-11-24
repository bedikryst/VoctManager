/**
 * @file PieceRow.tsx
 * @description One piece in the library, as a `RecordRow`: the row opens the
 * piece card, and every edit happens there. The title is set in the work
 * voice; under it, the composer and the year as a catalogue byline ("Arvo
 * Pärt, 1990"); to the right, the voicing, the length and the practice tracks
 * in the columns the library declares (`PIECE_COLUMNS`). The epoch is not on
 * the row: the year carries it, and the list filters by it. On a phone the
 * voicing and the length stand in the right column and the track count goes.
 *
 * Flags speak only for a piece that needs a person: no score yet, the AI still
 * reading one, a reading waiting for review, a reading that failed. A healthy
 * piece carries none, which is what makes the few that do findable in a list
 * of two hundred. A composition year that cannot be right for the composer's
 * life is marked on the year itself, with the reason in its accessible text.
 *
 * In selection mode the row is one toggle (`RecordRow`'s `row` scope) and the
 * menu steps aside.
 * @module features/archive/components/PieceRow
 */

import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Trash2 } from "lucide-react";

import { INGESTION_STATUS, type IngestionStatusCode } from "@/shared/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { RecordRow, recordActionClass, type RecordColumn } from "@/shared/ui/composites/RecordList";
import { Badge, type BadgeVariant } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

import { hasPdf } from "../constants/piecePdfs";
import type { EnrichedPiece } from "../types/archive.dto";

interface PieceRowProps {
  readonly piece: EnrichedPiece;
  /** The piece card, carrying the list the row stands in. */
  readonly cardPath: string;
  readonly onDelete: (piece: EnrichedPiece) => void;
  /** The list is in selection mode: a tap toggles the piece instead of opening it. */
  readonly selectionMode?: boolean;
  readonly selected?: boolean;
  readonly onToggleSelect?: (id: string) => void;
}

/**
 * The library list's figure columns, in `PieceRow`'s `meta` order: the voicing
 * ("SSATB SATB" fits), the length, the practice tracks.
 */
export const PIECE_COLUMNS: readonly RecordColumn[] = [
  { width: "lg", align: "start", compact: "stack" },
  { width: "xs", compact: "stack" },
  { width: "md" },
];

/** The row's DOM id, which the library scrolls to on the way back from a card. */
export const pieceRowId = (pieceId: string | number): string => `piece-row-${pieceId}`;

/** First name and surname, as a row's first fact; null for a piece with no composer. */
export const pieceComposerName = (piece: EnrichedPiece): string | null => {
  const composer = piece.composer;
  return composer ? `${composer.first_name ?? ""} ${composer.last_name}`.trim() : null;
};

const formatDuration = (seconds: number | null | undefined): string | null => {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};

type PipelineFlag = "running" | "failed" | "awaiting";

/**
 * The one pipeline state the row names, across all of a piece's editions. A
 * run in flight comes first, since whatever else is true may change when it
 * lands; then a failure, then a reading waiting for review. Ready says nothing.
 */
const pipelineFlag = (piece: EnrichedPiece): PipelineFlag | null => {
  const present = new Set<IngestionStatusCode>(
    (piece.editions ?? []).map((edition) => edition.ingestion_status),
  );
  const running: readonly IngestionStatusCode[] = [
    INGESTION_STATUS.PENDING,
    INGESTION_STATUS.EXTRACTING,
    INGESTION_STATUS.ENRICHING,
    INGESTION_STATUS.GENERATING,
  ];
  if (running.some((status) => present.has(status))) return "running";
  if (present.has(INGESTION_STATUS.FAILED)) return "failed";
  if (present.has(INGESTION_STATUS.AWAITING)) return "awaiting";
  return null;
};

const FLAG_TONE: Readonly<Record<PipelineFlag, BadgeVariant>> = {
  running: "amethyst",
  awaiting: "amethyst",
  failed: "danger",
};

const parseYear = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = /\d{3,4}/.exec(String(value));
  return match ? parseInt(match[0], 10) : null;
};

/** A year before the composer's birth, or more than fifty years after the death. */
const hasYearAnomaly = (piece: EnrichedPiece): boolean => {
  if (!piece.composition_year || !piece.composer) return false;
  const birth = parseYear(piece.composer.birth_year);
  const death = parseYear(piece.composer.death_year);
  if (birth !== null && piece.composition_year < birth) return true;
  if (death !== null && piece.composition_year > death + 50) return true;
  return false;
};

export const PieceRow = ({
  piece,
  cardPath,
  onDelete,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: PieceRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const deleteChosen = useRef(false);

  const pipeline = pipelineFlag(piece);
  const withoutPdf = !hasPdf(piece);
  const flagLabel: Readonly<Record<PipelineFlag, string>> = {
    running: t("archive.row.flag_running", "AI w toku"),
    awaiting: t("archive.row.flag_awaiting", "Czeka na przegląd"),
    failed: t("archive.row.flag_failed", "Błąd AI"),
  };
  const flags =
    withoutPdf || pipeline ? (
      <>
        {withoutPdf && (
          <Badge variant="warning" casing="natural">
            {t("archive.row.flag_no_pdf", "Bez PDF")}
          </Badge>
        )}
        {pipeline && (
          <Badge variant={FLAG_TONE[pipeline]} casing="natural">
            {flagLabel[pipeline]}
          </Badge>
        )}
      </>
    ) : null;

  const yearAnomaly = t(
    "archive.row.year_anomaly",
    "AI mógł się pomylić: rok nie pasuje do dat życia kompozytora",
  );
  const year = piece.composition_year
    ? hasYearAnomaly(piece)
      ? (
          <Text as="span" size="sm" color="crimson" title={yearAnomaly}>
            {piece.composition_year}
            <span className="sr-only"> ({yearAnomaly})</span>
          </Text>
        )
      : String(piece.composition_year)
    : null;

  const trackCount = piece.tracks?.length ?? 0;

  return (
    <RecordRow
      id={pieceRowId(piece.id)}
      open={{ to: cardPath }}
      title={piece.title}
      voice="work"
      flags={flags}
      facts={[pieceComposerName(piece), year]}
      meta={[
        piece.voicing || null,
        formatDuration(piece.estimated_duration),
        trackCount > 0
          ? t("archive.row.tracks", "{{count}} ścieżek", { count: trackCount })
          : null,
      ]}
      select={
        selectionMode
          ? {
              scope: "row",
              checked: selected,
              label: t("archive.bulk.select_aria", "Zaznacz: {{title}}", { title: piece.title }),
              onChange: () => onToggleSelect?.(String(piece.id)),
            }
          : undefined
      }
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="icon"
              size="icon"
              className={recordActionClass}
              aria-label={t("archive.row.menu_aria", "Więcej: {{title}}", { title: piece.title })}
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          {/* The confirmation opens once the menu has handed focus back to its
              trigger, so the dialog returns focus there when it closes. */}
          <DropdownMenuContent
            onCloseAutoFocus={() => {
              if (!deleteChosen.current) return;
              deleteChosen.current = false;
              onDelete(piece);
            }}
          >
            <DropdownMenuItem
              destructive
              icon={<Trash2 size={16} />}
              onSelect={() => {
                deleteChosen.current = true;
              }}
            >
              {t("archive.row.delete", "Usuń utwór")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
};
