/**
 * @file ScorePane.tsx
 * @description The piece card's score, laid on the desk (`PdfViewer
 * ground="desk"`) with the conductor's annotation tools. The card adds no bar
 * of its own: the edition's name, its page count and the wider view live in
 * the viewer's sheet. Without a PDF the desk asks for one.
 * @module features/archive/piece-card/ScorePane
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronsLeft, ChevronsRight, FileText } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import {
  PdfSheetSection,
  PdfViewer,
  sheetButton,
} from "@/shared/ui/composites/PdfViewer";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Text } from "@/shared/ui/primitives/typography";
import type { ScoreAnnotatorBindings } from "@/features/annotations";
import { MaterialsService } from "@/features/materials/api/materials.service";

import { EditionUploadZone } from "../components/EditionUploadZone";
import type { PiecePdfLink } from "../constants/piecePdfs";

interface ScorePaneProps {
  readonly pieceId: string;
  readonly pieceTitle: string;
  readonly scorePdf: PiecePdfLink | null;
  readonly annotator: ScoreAnnotatorBindings;
  readonly isWide: boolean;
  readonly onToggleWide: () => void;
  readonly onPageAspectChange: (aspect: number) => void;
}

export const ScorePane = ({
  pieceId,
  pieceTitle,
  scorePdf,
  annotator,
  isWide,
  onToggleWide,
  onPageAspectChange,
}: ScorePaneProps): React.JSX.Element => {
  const { t } = useTranslation();

  if (!scorePdf) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <StatePanel
          variant="inline"
          icon={<FileText size={32} aria-hidden="true" />}
          title={t("archive.piece_card.no_pdf", "Brak PDF dla tego utworu")}
          description={t(
            "archive.piece_card.no_pdf_hint",
            "Wgraj partyturę poniżej — AI uzupełni metadane, IPA i tłumaczenia.",
          )}
        />
        <div className="w-full max-w-md">
          <EditionUploadZone pieceId={pieceId} compact />
        </div>
      </div>
    );
  }

  const widthLabel = isWide
    ? t("archive.piece_card.score_narrow", "Zwęź podgląd partytury")
    : t("archive.piece_card.score_widen", "Poszerz podgląd partytury");

  // In the sheet, which is the inverse island on any ground.
  const editionSection = (
    <PdfSheetSection title={t("archive.piece_card.score_sheet_title", "Wydanie")}>
      <Text as="p" size="base" weight="medium" color="ink-on-inverse" className="break-words">
        {scorePdf.label}
      </Text>
      {scorePdf.page_count ? (
        <Text as="p" size="sm" color="ink-on-inverse-muted" className="mt-0.5">
          {t("archive.piece_card.page_count", { count: scorePdf.page_count })}
        </Text>
      ) : null}
      <button
        type="button"
        onClick={onToggleWide}
        aria-pressed={isWide}
        className={cn(sheetButton, "mt-3 px-4")}
      >
        {isWide ? (
          <ChevronsLeft size={18} aria-hidden="true" />
        ) : (
          <ChevronsRight size={18} aria-hidden="true" />
        )}
        <Text as="span" size="base" weight="medium" color="inherit">
          {widthLabel}
        </Text>
      </button>
    </PdfSheetSection>
  );

  return (
    <PdfViewer
      ground="desk"
      fetchBlob={() => MaterialsService.fetchScoreEditionBlob(scorePdf.id)}
      docKey={scorePdf.id}
      title={pieceTitle}
      subtitle={scorePdf.label}
      fileName={scorePdf.label}
      canExport={scorePdf.canExport}
      toolbarSlot={annotator.toolbarSlot}
      renderPageOverlay={annotator.renderPageOverlay}
      overlaySlot={annotator.overlaySlot}
      modalSlot={annotator.modalSlot}
      sheetTabs={annotator.sheetTabs}
      sheetSection={editionSection}
      mainTabLabel={t("annotations.score_tab", "Nuty")}
      onPageApiChange={annotator.onPageApiChange}
      onPageAspectChange={onPageAspectChange}
      claimKey={annotator.claimKey}
      // A pane beside the record: its keys belong to the record unless focus
      // is on the score, and the fit a manager picks here is this pane's own
      // habit, not the stand's or a call sheet's.
      keyScope="viewer"
      fitScope="piece-card"
      preferredFit={scorePdf.wholePage ? "page" : undefined}
    />
  );
};
