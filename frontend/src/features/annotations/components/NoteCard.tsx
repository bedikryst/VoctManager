/**
 * @file NoteCard.tsx
 * @description Writing a text marking, and deciding who reads it.
 *
 * The words are TYPED where they will be read — as the mark itself on the stave,
 * or in the bubble a pin opens — so the card beside the anchor carries only
 * controls: the phrases this writer repeats all evening, pin vs on-score, size,
 * reach, delete, save. That card takes whichever side of the anchor leaves the
 * writing visible: a card sitting on the bar it annotates is a card written
 * blind.
 * @module features/annotations/components
 */

import React, { useLayoutEffect, useRef, useState } from "react";
import { Pin, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { FIELD_TEXT_SCALE } from "@/shared/ui/primitives/fieldShell";

import { MarkAudiencePicker } from "./MarkAudiencePicker";
import { placeNoteCard } from "../lib/noteCardPlacement";
import { appendPhrase } from "../lib/quickPhrases";
import { useMeasuredHeight } from "../lib/useMeasuredHeight";
import {
  clampMarkScale,
  MARK_SCALE_MAX,
  MARK_SCALE_MIN,
  MARK_SCALE_STEP,
} from "../lib/useAnnotationTools";
import type { WriteLayer } from "../lib/layers";
import type { AnnotationLayer, NoteDisplay } from "../types/annotations.dto";

/** Base font size of an on-score word, before the note's own scale multiplier. */
export const inlineFontSize = (pageWidth: number): number =>
  Math.min(22, Math.max(11, pageWidth * 0.026));

/**
 * Moving an EXISTING note to another audience. Absent for a note that does not
 * exist yet — the toolbar's write pill already chose the reach for the next mark,
 * and asking twice in one gesture is asking the writer to answer a question they
 * have answered.
 */
export interface NoteAudience {
  current: AnnotationLayer;
  options: readonly WriteLayer[];
  /** Commits immediately, like every other control on this card. */
  onChange: (next: WriteLayer) => void;
}

interface NoteCardProps {
  width: number;
  height: number;
  anchor: { x: number; y: number };
  /** Ink the note will carry — the mark being written is drawn in it. */
  color: string;
  /** One-tap words, recent-first; each appends to what is already written. */
  phrases: readonly string[];
  initialText: string;
  initialDisplay: NoteDisplay;
  /** Starting font-size multiplier (1 = medium). */
  initialScale: number;
  showDelete: boolean;
  audience: NoteAudience | null;
  onSubmit: (text: string, display: NoteDisplay, scale: number) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

/** Card box, in page-box pixels. Width is fixed so the placement maths and the
 *  rendered element cannot disagree; height is measured, never assumed. */
const NOTE_CARD_WIDTH = 240;
/** Only until the first measurement lands — one layout pass, before paint. */
const NOTE_CARD_ESTIMATED_HEIGHT = 170;
/** Half the pin marker (h-7), i.e. how far a pin's own ink reaches upward. */
const PIN_RADIUS = 14;
/** Air between the mark being written and the controls card. */
const CARD_CLEARANCE = 10;
/** Width of a pin's editable bubble, held between these bounds. */
const PIN_BUBBLE_MIN = 140;
const PIN_BUBBLE_MAX = 210;

/** Take focus and put the caret after the last character. */
const focusAtEnd = (element: HTMLElement): void => {
  element.focus();
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

interface AnchoredEditorProps {
  elementRef: React.RefObject<HTMLDivElement | null>;
  /** Read ONCE, when this editor mounts — see the seeding note below. */
  seedText: string;
  label: string;
  onInput: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The words themselves, edited where they will be read — as the mark on the
 * stave, or in the bubble a pin opens. There is no text field in the card,
 * because a field in a card asks the writer to imagine the result; this shows
 * it, in the ink and at the size it will have on the page.
 *
 * Uncontrolled by design: React must never re-render the node a caret is
 * sitting in. It is seeded once on mount and reports upward on every input;
 * the card writes back into it only when a phrase chip is tapped.
 *
 * The seed is captured at mount and never re-read, which is what makes
 * switching display mode safe: that swaps one editor for another, and re-
 * seeding from the note's ORIGINAL text would silently discard everything
 * written since the composer opened.
 */
const AnchoredEditor = ({
  elementRef,
  seedText,
  label,
  onInput,
  onSubmit,
  onCancel,
  className,
  style,
}: AnchoredEditorProps): React.JSX.Element => {
  const seed = useRef(seedText);
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    element.innerText = seed.current;
    focusAtEnd(element);
  }, [elementRef]);

  return (
    <div
      ref={elementRef}
      contentEditable
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      spellCheck={false}
      // A mark is a word, not a sentence: a keyboard capitalising "razem" would
      // make typed notes disagree with the phrase chips beside them.
      autoCapitalize="none"
      className={className}
      style={style}
      onInput={(event) => onInput(event.currentTarget.innerText)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onSubmit();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      onPaste={(event) => {
        // A marking is plain text; pasted markup would drag foreign type onto
        // the score. `insertText` keeps the browser's own undo stack intact.
        event.preventDefault();
        document.execCommand(
          "insertText",
          false,
          event.clipboardData.getData("text/plain"),
        );
      }}
      // The surface below reads a tap as "close the composer" — writing into
      // the mark is not that.
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
};

export const NoteCard = ({
  width,
  height,
  anchor,
  color,
  phrases,
  initialText,
  initialDisplay,
  initialScale,
  showDelete,
  audience,
  onSubmit,
  onCancel,
  onDelete,
}: NoteCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const [display, setDisplay] = useState<NoteDisplay>(initialDisplay);
  const [scale, setScale] = useState<number>(() => clampMarkScale(initialScale));

  const cardRef = useRef<HTMLDivElement | null>(null);
  const markRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const inline = display === "inline";
  const markFontSize = inlineFontSize(width) * scale;

  const cardHeight = useMeasuredHeight(cardRef, NOTE_CARD_ESTIMATED_HEIGHT);
  const markHeight = useMeasuredHeight(markRef, inline ? markFontSize * 1.7 : 96);

  const submit = () => {
    const trimmed = text.trim();
    if (trimmed) onSubmit(trimmed, display, scale);
  };

  // How far the mark being written reaches from its anchor. An inline note is
  // centred on it; a pin sits ON it and hangs its bubble underneath, so the
  // card may come close from above and must stand clear from below.
  const gapAbove =
    (inline ? markHeight / 2 : PIN_RADIUS) + CARD_CLEARANCE;
  const gapBelow =
    (inline ? markHeight / 2 : markHeight - PIN_RADIUS) + CARD_CLEARANCE;
  const placement = placeNoteCard({
    anchor,
    pageWidth: width,
    pageHeight: height,
    cardWidth: NOTE_CARD_WIDTH,
    cardHeight,
    gapAbove,
    gapBelow,
  });

  const label = t("annotations.note.text_label", "Treść notatki");
  /** Write a phrase into the mark and hand the caret back after it. */
  const takePhrase = (phrase: string): void => {
    const next = appendPhrase(text, phrase);
    setText(next);
    const element = editorRef.current;
    if (!element) return;
    element.innerText = next;
    focusAtEnd(element);
  };

  return (
    <>
      {/* The mark itself, live at its anchor. */}
      <div
        ref={markRef}
        className="absolute z-20"
        style={{
          left: anchor.x * width,
          top: inline ? anchor.y * height : anchor.y * height - PIN_RADIUS,
          transform: inline ? "translate(-50%, -50%)" : "translateX(-50%)",
          width: inline
            ? undefined
            : Math.min(PIN_BUBBLE_MAX, Math.max(PIN_BUBBLE_MIN, width * 0.4)),
          maxWidth: inline ? width * 0.5 : undefined,
          pointerEvents: "auto",
        }}
      >
        {inline ? (
          <AnchoredEditor
            elementRef={editorRef}
            seedText={text}
            label={label}
            onInput={setText}
            onSubmit={submit}
            onCancel={onCancel}
            className="min-w-14 rounded-md px-1.5 py-0.5 text-center font-semibold leading-snug shadow-sm outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-ethereal-gold"
            style={{
              color,
              backgroundColor: "rgba(255,255,255,0.92)",
              // The mark's TRUE size — that is the whole point of writing here.
              // Below ~16px iOS magnifies the page on focus and a standalone
              // app does not zoom back out; the trade is deliberate.
              fontSize: markFontSize,
            }}
          />
        ) : (
          <div className="flex flex-col items-center">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white/80"
              style={{ backgroundColor: color }}
            >
              <Pin size={14} aria-hidden="true" />
            </span>
            {/* A pin shows nothing on the page, so its words are written where
                a reader will open them: in the bubble under the pin. */}
            <AnchoredEditor
              elementRef={editorRef}
              seedText={text}
              label={label}
              onInput={setText}
              onSubmit={submit}
              onCancel={onCancel}
              className={cn(
                "mt-1.5 w-full rounded-nested border border-hairline-strong bg-ethereal-marble px-2.5 py-2 leading-relaxed text-ethereal-ink shadow-glass-ethereal outline-none focus:border-ethereal-gold",
                FIELD_TEXT_SCALE.xs,
              )}
            />
          </div>
        )}
      </div>

      <div
        ref={cardRef}
        // The card is CONTROLS, not the mark: it rides the ladder like the rest
        // of the chrome, so on a dark theme it reads as a panel over the page
        // rather than a second sheet of paper. Only the mark itself — drawn in
        // the note's own ink, on the white page — stays paper-side.
        className="absolute z-20 -translate-x-1/2 rounded-nested border border-hairline-strong bg-ethereal-marble p-2.5 shadow-glass-ethereal"
        style={{
          width: NOTE_CARD_WIDTH,
          left: placement.left,
          top: placement.top,
          pointerEvents: "auto",
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {/* The words this writer repeats all evening. On a tablet the keyboard
            is the real cost of a note — it covers the music while it is open —
            so every chip here is a tap instead of a word. Two rows, flowing
            sideways: the strip is longer than the card, and the fade at its
            edge is the only sign a reader gets that it goes on. */}
        {phrases.length > 0 && (
          <div className="relative">
            <div
              className="no-scrollbar grid auto-cols-max grid-flow-col grid-rows-2 gap-1 overflow-x-auto"
              role="group"
              aria-label={t("annotations.quick_phrases", "Szybkie frazy")}
            >
              {phrases.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => takePhrase(phrase)}
                  className="rounded-full bg-ethereal-parchment/60 px-2 py-1 text-[11px] font-medium text-ethereal-graphite transition-colors hover:bg-ethereal-parchment"
                >
                  {phrase}
                </button>
              ))}
            </div>
            {/* Over a strip that fits, this paints the card on the card and
                vanishes — so it has to be the card's own fill, not white. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-linear-to-l from-ethereal-marble to-transparent"
            />
          </div>
        )}

        {/* Inline vs pin display picker. */}
        <div className="mt-2 flex items-center gap-1">
          {(["inline", "pin"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDisplay(mode)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                display === mode
                  ? "bg-ethereal-ink text-ethereal-marble"
                  : "bg-ethereal-parchment/60 text-ethereal-graphite hover:bg-ethereal-parchment",
              )}
            >
              {mode === "inline"
                ? t("annotations.note.inline", "Na nucie")
                : t("annotations.note.pin", "Pinezka")}
            </button>
          ))}
        </div>

        {/* Text size — only meaningful for on-score (inline) text; what it
            drives is the mark itself, up on the page. */}
        {inline && (
          <input
            type="range"
            min={MARK_SCALE_MIN}
            max={MARK_SCALE_MAX}
            step={MARK_SCALE_STEP}
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
            aria-label={t("annotations.scale.text", "Rozmiar tekstu")}
            className="mt-2 w-full accent-ethereal-ink"
          />
        )}

        {/* Who reads it. Commits on tap rather than waiting for OK, so a writer
            who moves the reach and then dismisses the card has still moved it —
            the alternative is a control that silently did nothing. */}
        {audience && (
          <div className="mt-2.5">
            <MarkAudiencePicker
              current={audience.current}
              options={audience.options}
              onChange={audience.onChange}
            />
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          {showDelete && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-1 text-ethereal-graphite hover:text-ethereal-crimson"
              aria-label={t("annotations.note.delete", "Usuń notatkę")}
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md p-1 text-ethereal-ink/50 hover:text-ethereal-ink"
              aria-label={t("common.actions.cancel", "Anuluj")}
            >
              <X size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim()}
              className="rounded-md bg-ethereal-ink px-3 py-1 text-xs font-medium text-ethereal-marble disabled:opacity-40"
            >
              {t("common.ok", "OK")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
