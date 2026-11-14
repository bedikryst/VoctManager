/**
 * @file PdfReadingPanel.tsx
 * @description The viewer's own tab in the sheet, in the order a reader asks:
 * where the parts of the document are (the host's contents, or the PDF's
 * bookmarks), a page to go to by its printed number, the host's own section
 * (the piece's pitches, a copy of the book), the file, and last how the page
 * is fitted to the screen — the question asked once, not at every turn.
 * @module shared/ui/composites/PdfViewer
 */

import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  Download,
  Globe,
  Loader2,
  Rows2,
  Scan,
  Share2,
  Sparkles,
  StretchHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

import { sheetButton } from "../bandChrome";
import type { FitMode, PdfContentsEntry, ResolvedFitMode } from "../types";
import type { PageLabelling } from "../pageLabels";
import { PdfPageJumpPanel } from "./PdfPageJumpPanel";
import { PdfSheetSection } from "./PdfSheet";

const FIT_OPTIONS: {
  mode: FitMode;
  icon: typeof Scan;
  labelKey: string;
  fallback: string;
}[] = [
  { mode: "auto", icon: Sparkles, labelKey: "pdf_viewer.fit_auto", fallback: "Auto" },
  { mode: "page", icon: Scan, labelKey: "pdf_viewer.fit_page", fallback: "Cała strona" },
  { mode: "two-thirds", icon: Rows2, labelKey: "pdf_viewer.fit_two_thirds", fallback: "⅔ strony" },
  {
    mode: "width",
    icon: StretchHorizontal,
    labelKey: "pdf_viewer.fit_screen_width",
    fallback: "Szerokość ekranu",
  },
];

export interface PdfFileActions {
  canOpenInBrowser: boolean;
  supportsNativeShare: boolean;
  isSharing: boolean;
  isDownloading: boolean;
  onDownload: () => void;
  onShare: () => void;
  onOpenInBrowser: () => void;
}

interface PdfReadingPanelProps {
  contents: readonly PdfContentsEntry[];
  contentsTitle: string;
  currentPage: number;
  numPages: number;
  labelling: PageLabelling | null;
  /** Go to a page and keep the sheet open (the slider). */
  onGoTo: (page: number) => void;
  /** Go to a page and put the sheet away (a contents line, a typed number). */
  onGoToAndClose: (page: number) => void;
  fitMode: FitMode;
  resolvedFit: ResolvedFitMode;
  onFitModeChange: (mode: FitMode) => void;
  hostSection?: ReactNode;
  /** Null when the document may not leave the app. */
  file: PdfFileActions | null;
}

export const PdfReadingPanel = ({
  contents,
  contentsTitle,
  currentPage,
  numPages,
  labelling,
  onGoTo,
  onGoToAndClose,
  fitMode,
  resolvedFit,
  onFitModeChange,
  hostSection,
  file,
}: PdfReadingPanelProps) => {
  const { t } = useTranslation();

  // An entry that knows its last page is current while the reader is inside
  // it; bookmarks know only where they start, so the last one begun is.
  const activeKey = useMemo(() => {
    const spanned = contents.find(
      (entry) =>
        entry.page !== null &&
        entry.lastPage !== undefined &&
        currentPage >= entry.page &&
        currentPage <= entry.lastPage,
    );
    if (spanned) return spanned.key;
    let begun: string | null = null;
    for (const entry of contents) {
      if (entry.lastPage === undefined && entry.page !== null && entry.page <= currentPage) {
        begun = entry.key;
      }
    }
    return begun;
  }, [contents, currentPage]);

  const resolvedFitLabel = FIT_OPTIONS.find((option) => option.mode === resolvedFit);

  return (
    <>
      {contents.length > 0 && (
        <PdfSheetSection title={contentsTitle}>
          <ul className="-mx-2 flex flex-col">
            {contents.map((entry) => {
              const isActive = entry.key === activeKey;
              const body = (
                <>
                  {entry.number !== undefined && (
                    <Text
                      as="span"
                      size="base"
                      weight="medium"
                      color="inherit"
                      className="w-6 shrink-0 text-right tabular-nums"
                    >
                      {entry.number}
                    </Text>
                  )}
                  <span className="min-w-0 flex-1">
                    <Text as="span" size="base" color="inherit" className="block truncate">
                      {entry.title}
                    </Text>
                    {entry.detail && (
                      <Text as="span" size="sm" color="ink-on-inverse-muted" className="block truncate">
                        {entry.detail}
                      </Text>
                    )}
                  </span>
                  {entry.note && (
                    <Text
                      as="span"
                      size="sm"
                      color="ink-on-inverse-muted"
                      className="shrink-0 whitespace-nowrap tabular-nums"
                    >
                      {entry.note}
                    </Text>
                  )}
                </>
              );
              const rowClass = cn(
                "flex w-full items-start gap-3 rounded-chip px-2 py-2 text-left",
                (entry.depth ?? 0) > 0 && "pl-6",
              );
              const page = entry.page;
              return (
                <li key={entry.key}>
                  {page === null ? (
                    <div className={cn(rowClass, "text-ink-on-inverse/50")}>{body}</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onGoToAndClose(page)}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        rowClass,
                        "transition-colors",
                        isActive
                          ? "bg-ethereal-gold/15 text-ethereal-gold"
                          : "text-ink-on-inverse hover:bg-ink-on-inverse/10",
                      )}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </PdfSheetSection>
      )}

      {numPages > 1 && (
        <PdfSheetSection title={t("pdf_viewer.jump_to_page", "Przejdź do strony")}>
          <PdfPageJumpPanel
            currentPage={currentPage}
            numPages={numPages}
            labelling={labelling}
            onJump={onGoTo}
            onConfirm={onGoToAndClose}
          />
        </PdfSheetSection>
      )}

      {hostSection}

      {file && (
        <PdfSheetSection title={t("pdf_viewer.file_section", "Plik")}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={file.onDownload}
              disabled={file.isDownloading}
              className={cn(sheetButton, "px-4")}
            >
              {file.isDownloading ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <Download size={18} aria-hidden="true" />
              )}
              <Text as="span" size="base" weight="medium" color="inherit">
                {t("pdf_viewer.download_pdf", "Pobierz PDF")}
              </Text>
            </button>
            {file.supportsNativeShare && (
              <button
                type="button"
                onClick={file.onShare}
                disabled={file.isSharing}
                className={cn(sheetButton, "px-4")}
              >
                {file.isSharing ? (
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Share2 size={18} aria-hidden="true" />
                )}
                <Text as="span" size="base" weight="medium" color="inherit">
                  {t("pdf_viewer.share", "Udostępnij")}
                </Text>
              </button>
            )}
            {file.canOpenInBrowser && (
              <button
                type="button"
                onClick={file.onOpenInBrowser}
                className={cn(sheetButton, "px-4")}
              >
                <Globe size={18} aria-hidden="true" />
                <Text as="span" size="base" weight="medium" color="inherit">
                  {t("pdf_viewer.open_in_browser", "Otwórz w przeglądarce")}
                </Text>
              </button>
            )}
          </div>
        </PdfSheetSection>
      )}

      <PdfSheetSection
        title={t("pdf_viewer.fit_label", "Dopasowanie strony")}
        action={
          fitMode === "auto" && resolvedFitLabel ? (
            <Text as="span" size="sm" color="ink-on-inverse-muted">
              {t(resolvedFitLabel.labelKey, resolvedFitLabel.fallback)}
            </Text>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 gap-1.5">
          {FIT_OPTIONS.map(({ mode, icon: Icon, labelKey, fallback }) => {
            const isActive = fitMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onFitModeChange(mode)}
                aria-pressed={isActive}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-chip px-3 text-left transition-colors",
                  isActive
                    ? "bg-ethereal-gold/15 text-ethereal-gold"
                    : "bg-ink-on-inverse/5 text-ink-on-inverse hover:bg-ink-on-inverse/10",
                )}
              >
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                <Text as="span" size="base" color="inherit" className="truncate">
                  {t(labelKey, fallback)}
                </Text>
              </button>
            );
          })}
        </div>
      </PdfSheetSection>
    </>
  );
};
