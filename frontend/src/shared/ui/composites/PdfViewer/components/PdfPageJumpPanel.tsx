/**
 * @file PdfPageJumpPanel.tsx
 * @description Straight to a page — "from page 25", said at rehearsal — instead
 * of turning there one page at a time. A section of the viewer's sheet: a
 * slider for the thumb, and the page number above it typable for a keyboard
 * and for a long book where one slider step is a couple of pixels. The slider
 * commits on release, not while it moves: every committed page is a render,
 * and a sweep across forty pages on the way to one would be forty renders
 * nobody reads.
 *
 * Where the document prints its own page numbers, the number in the field is
 * the printed one, because that is the number the conductor calls. The slider
 * still runs over every page, unnumbered ones included, and a page without a
 * number is named under the field instead.
 * @module shared/ui/composites/PdfViewer
 */

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Metric, Text } from "@/shared/ui/primitives/typography";

import { pageLabelText, type PageLabelling } from "../pageLabels";

interface PdfPageJumpPanelProps {
  currentPage: number;
  numPages: number;
  /** Printed page numbers, when the document has its own. */
  labelling: PageLabelling | null;
  /** A page chosen on the slider: the reader goes on looking at the sheet. */
  onJump: (page: number) => void;
  /** A number typed and confirmed: the reader is done here. */
  onConfirm: (page: number) => void;
}

const clamp = (value: number, max: number): number => Math.min(Math.max(value, 1), max);

export const PdfPageJumpPanel = ({
  currentPage,
  numPages,
  labelling,
  onJump,
  onConfirm,
}: PdfPageJumpPanelProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(currentPage);
  /** The field's text while it is being typed; `null` shows the draft. */
  const [typed, setTyped] = useState<string | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);

  // The page moves under the open sheet when the slider commits, so the draft
  // follows the page instead of holding a number the reader has already left.
  const [shownPage, setShownPage] = useState(currentPage);
  if (shownPage !== currentPage) {
    setShownPage(currentPage);
    setDraft(currentPage);
    setTyped(null);
  }

  // React's `onChange` on a range is the DOM `input` event, fired at every
  // step of a drag. The native `change` event is the release (and each
  // keyboard step) — the moment the reader has actually chosen.
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;
    const commit = (): void => onJump(Number(slider.value));
    slider.addEventListener("change", commit);
    return () => slider.removeEventListener("change", commit);
  }, [onJump]);

  // What the field counts in: printed numbers, or the file's pages.
  const highest = labelling ? labelling.lastFolio : numPages;
  const pageForNumber = (value: number): number | null =>
    labelling ? labelling.pageOf(value) : value;
  const draftNumber = labelling ? labelling.folioOf(draft) : draft;
  const draftText = labelling ? pageLabelText(t, labelling, draft) : `${draft} / ${numPages}`;

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, String(highest).length);
    setTyped(digits);
    const value = Number(digits);
    if (!digits || value < 1 || value > highest) return;
    const page = pageForNumber(value);
    if (page !== null) setDraft(page);
  };

  const handleFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const page = typed ? pageForNumber(clamp(Number(typed), highest)) : null;
    onConfirm(page ?? draft);
  };

  return (
    <div>
      <div className="flex items-baseline justify-center gap-2">
        {labelling && (
          <Metric size="xl" color="ink-on-inverse-muted">
            {t("pdf_viewer.folio_prefix", "s.")}
          </Metric>
        )}
        <input
          type="text"
          inputMode="numeric"
          enterKeyHint="go"
          autoComplete="off"
          value={typed ?? (draftNumber === null ? "" : String(draftNumber))}
          placeholder="–"
          onChange={handleFieldChange}
          onKeyDown={handleFieldKeyDown}
          onBlur={() => setTyped(null)}
          aria-label={t("pdf_viewer.page_number", "Numer strony")}
          className="w-20 rounded-control bg-ink-on-inverse/10 px-2 py-0.5 text-center font-serif text-3xl tabular-nums lining-nums tracking-tight text-ink-on-inverse placeholder:text-ink-on-inverse/40 focus:outline-none focus:ring-2 focus:ring-ethereal-gold/60"
        />
        <Metric size="xl" color="ink-on-inverse-muted" className="tabular-nums">
          / {highest}
        </Metric>
      </div>
      {/* A page with no printed number is named rather than left blank, so
          the reader knows where the slider has put them. */}
      {labelling && draftNumber === null && typed === null && (
        <Text size="sm" color="ink-on-inverse-muted" className="mt-1.5 block text-center">
          {draftText}
        </Text>
      )}
      <input
        ref={sliderRef}
        type="range"
        min={1}
        max={numPages}
        step={1}
        value={draft}
        onChange={(event) => {
          setDraft(Number(event.target.value));
          setTyped(null);
        }}
        aria-label={t("pdf_viewer.jump_to_page", "Przejdź do strony")}
        aria-valuetext={draftText}
        className="mt-3 w-full accent-ethereal-gold"
      />
    </div>
  );
};
