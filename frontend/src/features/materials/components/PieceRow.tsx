/**
 * @file PieceRow.tsx
 * @description Slim, tap-first list row for one piece in the Songbook.
 * The two most frequent actions (open score, play my voice track) are always
 * visible — never hidden behind an accordion. The whole row navigates to the
 * piece page for everything else.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, FileText, Lock, Play, Square } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { getPiecePdfLinks } from "@/features/archive/constants/piecePdfs";
import { cn } from "@/shared/lib/utils";
import {
  buildPracticeSources,
  usePracticePlayer,
} from "../player/PracticePlayerProvider";
import { ReadinessDot } from "./ReadinessControl";
import type { MaterialsPiece } from "../types/materials.dto";

interface PieceRowProps {
  piece: MaterialsPiece;
  projectId: string;
  order: number;
  isEncored: boolean;
  isArchived: boolean;
}

export const PieceRow = ({
  piece,
  projectId,
  order,
  isEncored,
  isArchived,
}: PieceRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { engine, snapshot } = usePracticePlayer();

  const pdfLinks = getPiecePdfLinks({ editions: piece.editions });
  const primaryPdf = pdfLinks[0] ?? null;
  const hasTracks = piece.tracks.length > 0;

  const isThisPieceLoaded = snapshot.piece?.pieceId === piece.id;
  const isThisPiecePlaying = isThisPieceLoaded && snapshot.isPlaying;

  const composerName = piece.composer
    ? `${piece.composer.first_name || ""} ${piece.composer.last_name}`.trim()
    : t("materials.piece.traditional", "Tradycyjny / Nieznany");

  const piecePath = `/panel/materials/${projectId}/${piece.id}`;

  const handlePlayToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isThisPieceLoaded) {
      engine.toggle();
      return;
    }
    const { source, tracks } = buildPracticeSources(piece, projectId);
    engine.load(source, tracks, { autoplay: true });
  };

  return (
    <GlassCard
      variant={isArchived ? "dark" : "ethereal"}
      padding="none"
      isHoverable={false}
      onClick={() => navigate(piecePath)}
      role="link"
      aria-label={piece.title}
      className={cn(
        "cursor-pointer overflow-hidden transition-all duration-300",
        isArchived
          ? "opacity-75"
          : "hover:border-ethereal-gold/40 hover:shadow-glass-ethereal-hover active:scale-[0.995]",
        isThisPieceLoaded && !isArchived && "border-ethereal-sage/40",
      )}
    >
      <div className="flex items-center gap-3 p-3.5 sm:p-4">
        {/* order */}
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-glass-solid",
            isArchived
              ? "border-ethereal-incense/30 bg-ethereal-incense/10 text-ethereal-parchment"
              : "border-ethereal-marble bg-ethereal-alabaster text-ethereal-ink",
          )}
          aria-hidden="true"
        >
          <Heading size="lg" weight="medium" color={isArchived ? "white" : "default"}>
            {String(order)}
          </Heading>
        </div>

        {/* title + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Heading
              size="lg"
              weight="medium"
              color={isArchived ? "white" : "default"}
              truncate
              className="leading-snug"
            >
              {piece.title}
            </Heading>
            {isEncored && (
              <Eyebrow
                as="span"
                color="incense"
                className="shrink-0 rounded border border-ethereal-incense/25 bg-ethereal-incense/10 px-1.5 py-0.5"
              >
                {t("materials.piece.encore_badge", "Bis")}
              </Eyebrow>
            )}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <Eyebrow
              color={isArchived ? "parchment" : "muted"}
              className="block truncate"
            >
              {composerName}
            </Eyebrow>
            {piece.my_casting && (
              <Eyebrow
                as="span"
                color="incense"
                className="shrink-0 rounded border border-ethereal-sage/20 bg-ethereal-sage/10 px-1.5 py-0.5"
              >
                {piece.my_casting.voice_line_display || piece.my_casting.voice_line}
              </Eyebrow>
            )}
          </div>
        </div>

        {/* readiness + chevron */}
        {!isArchived && <ReadinessDot value={piece.my_readiness} />}
        {isArchived ? (
          <Lock
            size={15}
            className="shrink-0 text-ethereal-parchment/50"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            size={17}
            className="shrink-0 text-ethereal-graphite/35"
            aria-hidden="true"
          />
        )}
      </div>

      {/* quick actions — always visible, never hover-gated (touch first) */}
      {!isArchived && (primaryPdf || hasTracks) && (
        <div className="flex gap-2 border-t border-ethereal-marble/60 bg-ethereal-parchment/25 px-3.5 py-2.5 sm:px-4">
          {primaryPdf && (
            <a
              href={primaryPdf.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-ethereal-marble bg-ethereal-alabaster px-3 py-2 shadow-glass-solid transition-all hover:bg-ethereal-marble/50 active:scale-95"
            >
              <FileText size={13} className="text-ethereal-sage" aria-hidden="true" />
              <Eyebrow color="default">
                {t("materials.row.score", "Nuty")}
              </Eyebrow>
            </a>
          )}
          {hasTracks && (
            <button
              type="button"
              onClick={handlePlayToggle}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 shadow-glass-solid transition-all active:scale-95",
                isThisPiecePlaying
                  ? "border-ethereal-sage/80 bg-ethereal-sage text-white"
                  : "border-ethereal-marble bg-ethereal-alabaster hover:bg-ethereal-marble/50",
              )}
            >
              {isThisPiecePlaying ? (
                <Square size={13} aria-hidden="true" />
              ) : (
                <Play size={13} className="text-ethereal-sage" aria-hidden="true" />
              )}
              <Eyebrow color={isThisPiecePlaying ? "white" : "default"}>
                {isThisPiecePlaying
                  ? t("materials.row.pause", "Pauza")
                  : t("materials.row.listen", "Odtwórz")}
              </Eyebrow>
            </button>
          )}
          <Text as="span" className="sr-only">
            {t("materials.row.open_details", "Otwórz szczegóły utworu")}
          </Text>
        </div>
      )}
    </GlassCard>
  );
};
