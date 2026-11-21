/**
 * @file PieceLyrics.tsx
 * @description Reading pairs for aligned lyrics and IPA, with independent commit controls.
 */

import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useMediaQuery } from "@/shared/lib/dom/useMediaQuery";
import { cn } from "@/shared/lib/utils";
import type { Piece } from "@/shared/types";
import { Text } from "@/shared/ui/primitives/typography";
import { IpaRecomputeActions, useIpaRecompute } from "../components/LyricsIpaField";
import { getLatinPronunciationLabel } from "../constants/latinPronunciation";
import { pairLyrics } from "./pairLyrics";
import { RecordNote } from "./RecordNote";
import { recordContradictions } from "./recordContradictions";
import { usePieceFieldReview } from "./PieceFieldReview";
import { IPA_TEXT, READING_TEXT, RecordText, RecordTextLabel } from "./RecordText";
import type { PieceAutosave } from "./usePieceAutosave";

type Pairs = NonNullable<ReturnType<typeof pairLyrics>>;
type LyricsEditor = "original" | "ipa";

const PairedLyrics = ({ pairs, label, onEdit, onColumnsChange }: {
  pairs: Pairs;
  label: string;
  onEdit: (editor: LyricsEditor) => void;
  /** Whether lyric and IPA stand side by side, which their labels follow. */
  onColumnsChange: (inColumns: boolean) => void;
}) => {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const reader = useRef<HTMLButtonElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [inColumns, setInColumns] = useState(false);

  useEffect(() => {
    const surface = reader.current;
    const intrinsic = measure.current;
    if (!desktop || !surface || !intrinsic) return;
    const fit = () => {
      if (surface.clientWidth > 0) setInColumns(intrinsic.offsetWidth <= surface.clientWidth);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(surface);
    observer.observe(intrinsic);
    fit();
    return () => observer.disconnect();
  }, [desktop]);

  useEffect(() => {
    onColumnsChange(desktop && inColumns);
  }, [desktop, inColumns, onColumnsChange]);

  return (
    <div className="relative col-span-full group-has-[textarea:focus]/lyrics:hidden group-has-[[data-commit-draft]]/lyrics:hidden">
      {/* Equal intrinsic columns reserve twice the longer line, the gutter and
          the field insets. Measuring the real fonts includes late font loads. */}
      {desktop && (
        <div aria-hidden="true" className="invisible absolute h-0 w-0 overflow-hidden">
          <div ref={measure} className="grid w-max grid-cols-2 gap-x-8 whitespace-pre px-3">
            {pairs.map((line, index) => (
              <div key={index} className="contents">
                <Text size={null} className={READING_TEXT}>{line.lyric}</Text>
                <Text size={null} className={IPA_TEXT}>{line.ipa}</Text>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        ref={reader}
        type="button"
        tabIndex={-1}
        aria-label={label}
        onClick={({ target }) => onEdit(target instanceof Element && target.closest("[data-ipa-line]") ? "ipa" : "original")}
        className="-mx-2 block w-[calc(100%+1rem)] rounded-control px-2 py-1 text-start hover:bg-ethereal-parchment/45"
      >
        {pairs.map((line, index) => (
          <Text
            as="span"
            key={index}
            className={cn(
              "grid wrap-anywhere whitespace-pre-wrap",
              desktop && inColumns ? "grid-cols-2 items-baseline gap-x-8" : "gap-y-0.5 pb-1.5",
              !line.lyric && !line.ipa && "min-h-4",
            )}
          >
            <Text as="span" size={null} className={READING_TEXT}>{line.lyric}</Text>
            <Text as="span" size={null} color="graphite" className={IPA_TEXT} data-ipa-line>{line.ipa}</Text>
          </Text>
        ))}
      </button>
    </div>
  );
};

export const PieceLyrics = ({ piece, autosave, isReviewing }: {
  piece: Piece;
  autosave: PieceAutosave;
  isReviewing: boolean;
}) => {
  const { t } = useTranslation();
  const originalId = useId();
  const ipaId = useId();
  const originalEditor = useRef<HTMLDivElement>(null);
  const ipaEditor = useRef<HTMLDivElement>(null);
  const lyrics = piece.lyrics_original ?? "";
  const guide = piece.lyrics_ipa ?? "";
  const pairs = pairLyrics(lyrics, guide);
  const ipa = useIpaRecompute(piece, undefined, (dispatch) =>
    autosave.afterFieldsSaved(["lyrics_original", "lyrics_ipa", "language"], dispatch));
  const originalLabel = t("archive.piece_card.fields.lyrics_original");
  const ipaLabel = t("archive.piece_card.fields.lyrics_ipa");
  const pronunciation = getLatinPronunciationLabel(piece.lyrics_ipa_system, t);
  const originalReview = usePieceFieldReview({ piece, autosave, label: originalLabel, field: "lyrics_original", controlId: originalId });
  const ipaReview = usePieceFieldReview({ piece, autosave, label: ipaLabel, field: "lyrics_ipa", disabled: ipa.isRunning, controlId: ipaId });
  const lineCounts = recordContradictions(piece).lines;
  const [pairedInColumns, setPairedInColumns] = useState(false);
  const editorClass = pairs
    ? "sr-only group-has-[textarea:focus]/lyrics:not-sr-only group-has-[[data-commit-draft]]/lyrics:not-sr-only"
    : undefined;

  return (
    <div className="group/lyrics relative mt-4 space-y-2">
      <div className={cn(
        "grid gap-x-8 gap-y-2",
        // The labels stand side by side only over lines that do.
        pairs && pairedInColumns && "grid-cols-2 group-has-[textarea:focus]/lyrics:grid-cols-1 group-has-[[data-commit-draft]]/lyrics:grid-cols-1",
      )}>
        <div>
          <RecordTextLabel id={originalId} label={originalLabel} {...originalReview} />
          <div ref={originalEditor} className={editorClass}>
            <RecordText id={originalId} value={lyrics} draftField={autosave.track("lyrics_original", originalLabel)} onCommit={(next) => autosave.save("lyrics_original", next)} className={READING_TEXT} />
          </div>
        </div>
        <div>
          <RecordTextLabel id={ipaId} label={ipaLabel} {...ipaReview} />
          <div ref={ipaEditor} className={editorClass}>
            <RecordText id={ipaId} value={guide} draftField={autosave.track("lyrics_ipa", ipaLabel)} onCommit={(next) => autosave.save("lyrics_ipa", next)} className={IPA_TEXT} readOnly={ipa.isRunning} />
          </div>
        </div>
        {pairs && (
          <PairedLyrics
            pairs={pairs}
            label={t("archive.piece_card.edit_lyrics_pair")}
            onColumnsChange={setPairedInColumns}
            onEdit={(editor) => {
              const target = editor === "ipa" ? ipaEditor.current : originalEditor.current;
              target?.querySelector("textarea")?.focus();
            }}
          />
        )}
      </div>
      {lineCounts && (
        <div className="-mx-2">
          <RecordNote isReviewing={isReviewing}>
            {t("archive.piece_card.note.ipa_lines", { lyrics: lineCounts.lyrics, ipa: lineCounts.ipa })}
          </RecordNote>
        </div>
      )}
      {pronunciation && !piece.lyrics_ipa_recomputable && (
        <Text size="sm" color="muted">{pronunciation}</Text>
      )}
      <IpaRecomputeActions piece={piece} ipa={ipa} compact />
    </div>
  );
};
