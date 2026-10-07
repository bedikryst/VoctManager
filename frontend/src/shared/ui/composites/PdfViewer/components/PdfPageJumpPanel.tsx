/**
 * @file PdfPageJumpPanel.tsx
 * @description Straight to a page — "from page 25", said at rehearsal — instead
 * of turning there one page at a time. A slider for the thumb; the page number
 * above it is typable for a keyboard, and for a long book where one slider step
 * is a couple of pixels. The slider commits on release, not while it moves:
 * every committed page is a render, and a sweep across forty pages on the way
 * to one would be forty renders nobody reads.
 * @module shared/ui/composites/PdfViewer
 * @architecture Enterprise SaaS 2026
 */

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Eyebrow, Metric } from "@/shared/ui/primitives/typography";

interface PdfPageJumpPanelProps {
  currentPage: number;
  numPages: number;
  onJump: (page: number) => void;
  onClose: () => void;
}

const clampPage = (page: number, numPages: number): number =>
  Math.min(Math.max(page, 1), numPages);

export const PdfPageJumpPanel = ({
  currentPage,
  numPages,
  onJump,
  onClose,
}: PdfPageJumpPanelProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(currentPage);
  /** The field's text while it is being typed; `null` shows the draft. */
  const [typed, setTyped] = useState<string | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const fieldRef = useRef<HTMLInputElement | null>(null);

  // The page can move under the open panel — the pill's arrows stay live
  // beside it — so the draft follows the page instead of holding a number the
  // reader has already left.
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

  // A keyboard reader opened this to type a number. A touch reader came to
  // drag, and focusing the field there would raise a keyboard over the score.
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    fieldRef.current?.focus();
    fieldRef.current?.select();
  }, []);

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, String(numPages).length);
    setTyped(digits);
    const page = Number(digits);
    if (digits && page >= 1 && page <= numPages) setDraft(page);
  };

  const handleFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onJump(typed ? clampPage(Number(typed), numPages) : draft);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, transform: "translateY(6px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      exit={{ opacity: 0, transform: "translateY(6px)" }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="absolute bottom-full left-1/2 mb-3 w-72 -translate-x-1/2 overflow-hidden rounded-surface border border-line-on-inverse bg-surface-inverse/95 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
    >
      <div className="border-b border-line-on-inverse px-3 py-2">
        <Eyebrow color="ink-on-inverse-muted">
          {t("pdf_viewer.jump_to_page", "Przejdź do strony")}
        </Eyebrow>
      </div>
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-baseline justify-center gap-2">
          <input
            ref={fieldRef}
            type="text"
            inputMode="numeric"
            enterKeyHint="go"
            autoComplete="off"
            value={typed ?? String(draft)}
            onChange={handleFieldChange}
            onKeyDown={handleFieldKeyDown}
            onBlur={() => setTyped(null)}
            aria-label={t("pdf_viewer.page_number", "Numer strony")}
            className="w-20 rounded-control bg-ink-on-inverse/10 px-2 py-0.5 text-center font-serif text-3xl tabular-nums lining-nums tracking-tight text-ink-on-inverse focus:outline-none focus:ring-2 focus:ring-ethereal-gold/60"
          />
          <Metric size="xl" color="ink-on-inverse-muted" className="tabular-nums">
            / {numPages}
          </Metric>
        </div>
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
          aria-valuetext={`${draft} / ${numPages}`}
          className="mt-3 w-full accent-ethereal-gold"
        />
      </div>
    </motion.div>
  );
};
