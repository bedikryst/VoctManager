/**
 * @file ArchiveStatStrip.tsx
 * @description One-line library summary that lives in the page header.
 * Replaces the previous HeroPanel + MetricsGrid stack — same data, 1/8th
 * the vertical real estate. The "X do przeglądu" segment is a clickable
 * shortcut that surfaces the first awaiting piece.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ArchiveStatStrip
 */

import React from "react";
import { useTranslation } from "react-i18next";

import { Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

interface ArchiveStatStripProps {
  readonly totalPieces: number;
  readonly pdfCoverage: number;
  readonly awaitingCount: number;
  readonly onJumpToAwaiting?: () => void;
}

export const ArchiveStatStrip = ({
  totalPieces,
  pdfCoverage,
  awaitingCount,
  onJumpToAwaiting,
}: ArchiveStatStripProps): React.JSX.Element => {
  const { t } = useTranslation();

  const segments: React.ReactNode[] = [
    <span key="pieces">
      <strong className="text-ethereal-ink">{totalPieces}</strong>{" "}
      {t("archive.stat_strip.pieces", "utworów")}
    </span>,
    <span key="pdf">
      <strong className="text-ethereal-ink">{pdfCoverage}%</strong>{" "}
      {t("archive.stat_strip.with_pdf", "z PDF")}
    </span>,
  ];

  if (awaitingCount > 0) {
    segments.push(
      <button
        key="awaiting"
        type="button"
        onClick={onJumpToAwaiting}
        className={cn(
          "rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5",
          "text-ethereal-gold hover:bg-ethereal-gold/10 transition-colors",
          "underline decoration-ethereal-gold/40 underline-offset-2",
        )}
      >
        <strong>{awaitingCount}</strong>{" "}
        {awaitingCount === 1
          ? t("archive.stat_strip.awaiting_one", "do przeglądu")
          : t("archive.stat_strip.awaiting_many", "do przeglądu")}
      </button>,
    );
  }

  return (
    <Text size="sm" color="graphite" className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span aria-hidden="true" className="text-ethereal-incense/40">
              ·
            </span>
          )}
          {segment}
        </React.Fragment>
      ))}
    </Text>
  );
};
