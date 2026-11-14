/**
 * @file ScoreBookDownload.tsx
 * @description "Pobierz PDF" in the stand's sheet: a reader's copy of the
 * concert book as a file. The book on screen is clean, with every mark drawn
 * live over it, so the file is a different thing — a copy the server composes
 * with the layers the reader picks (`useBookCopy`) and stamps for them.
 *
 * Two steps, prepare and then save or share, because composing takes seconds
 * and iOS lets a page share a file or open it only inside the tap that asked:
 * a download started after an await would lose that tap. A changed selection
 * is a different file, so it asks to be prepared again.
 *
 * Mounted only while the sheet is open, so the layer census is asked for only
 * by a reader who came here to download.
 * @module features/projects/components
 */

import React, { useState } from "react";
import { Download, FileDown, Loader2, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import {
  createDownloadAnchor,
  PdfSheetSection,
  sheetButton,
} from "@/shared/ui/composites/PdfViewer";
import { Text } from "@/shared/ui/primitives/typography";

import { bookCopyFileName, useBookCopy } from "../api/project.score-marks";
import { ScoreCopyLayers } from "./ScoreCopyLayers";

interface ScoreBookDownloadProps {
  readonly projectId: string;
  /** The file name without its extension; the copy's layers may add a suffix. */
  readonly fileStem: string;
}

type Preparation =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "failed" }
  | { status: "ready"; blob: Blob; copyKey: string };

const canShareFile = (file: File): boolean => {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    return typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
};

export const ScoreBookDownload = ({
  projectId,
  fileStem,
}: ScoreBookDownloadProps): React.JSX.Element => {
  const { t } = useTranslation();
  const copy = useBookCopy(projectId);
  const [preparation, setPreparation] = useState<Preparation>({ status: "idle" });

  const copyKey = copy.docKeySuffix;
  const fileName = bookCopyFileName(fileStem, copy.layers, t);
  const prepared =
    preparation.status === "ready" && preparation.copyKey === copyKey ? preparation.blob : null;
  const preparedFile = prepared
    ? new File([prepared], fileName, { type: prepared.type || "application/pdf" })
    : null;
  const isPreparing = preparation.status === "preparing";

  const prepare = async (): Promise<void> => {
    setPreparation({ status: "preparing" });
    try {
      const blob = await copy.fetchBlob();
      setPreparation({ status: "ready", blob, copyKey });
    } catch {
      setPreparation({ status: "failed" });
    }
  };

  const share = async (file: File): Promise<void> => {
    try {
      await navigator.share({ files: [file], title: fileStem });
    } catch (error) {
      // A reader who closes the share sheet has decided, not failed.
      if (error instanceof DOMException && error.name === "AbortError") return;
      createDownloadAnchor(file, file.name);
    }
  };

  return (
    <PdfSheetSection title={t("pdf_viewer.download_pdf", "Pobierz PDF")}>
      <div className="flex flex-col gap-3">
        <Text as="p" size="base" color="ink-on-inverse-muted">
          {t(
            "score_book.download_hint",
            "Plik z oznaczeniami, które wybierzesz. Przygotowanie trwa chwilę.",
          )}
        </Text>

        <ScoreCopyLayers
          options={copy.options}
          selected={copy.layers}
          onToggle={copy.toggle}
          busy={isPreparing}
        />

        {preparedFile ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => createDownloadAnchor(preparedFile, preparedFile.name)}
              className={cn(sheetButton, "px-4")}
            >
              <Download size={18} aria-hidden="true" />
              <Text as="span" size="base" weight="medium" color="inherit">
                {t("score_book.download_save", "Zapisz")}
              </Text>
            </button>
            {canShareFile(preparedFile) && (
              <button
                type="button"
                onClick={() => void share(preparedFile)}
                className={cn(sheetButton, "px-4")}
              >
                <Share2 size={18} aria-hidden="true" />
                <Text as="span" size="base" weight="medium" color="inherit">
                  {t("pdf_viewer.share", "Udostępnij")}
                </Text>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={() => void prepare()}
              disabled={isPreparing || !copy.ready}
              aria-busy={isPreparing || undefined}
              className={cn(sheetButton, "px-4")}
            >
              {isPreparing ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <FileDown size={18} aria-hidden="true" />
              )}
              <Text as="span" size="base" weight="medium" color="inherit">
                {isPreparing
                  ? t("score_book.download_preparing", "Przygotowuję plik…")
                  : preparation.status === "failed"
                    ? t("common.actions.retry", "Spróbuj ponownie")
                    : t("score_book.download_prepare", "Przygotuj plik")}
              </Text>
            </button>
            {preparation.status === "failed" && (
              <Text as="p" size="base" color="crimson-light" role="alert">
                {t("score_book.download_failed", "Nie udało się przygotować pliku.")}
              </Text>
            )}
          </div>
        )}
      </div>
    </PdfSheetSection>
  );
};
