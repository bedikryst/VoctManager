/**
 * @file PieceFieldReview.tsx
 * @description Confirmation controls for the piece's unchecked AI fields.
 *
 * The marker is an amethyst edge down the left of the field's block, which
 * turns sage and fades once the field is confirmed. It positions itself against
 * the nearest positioned ancestor, so the caller renders it as a direct child
 * of the `relative` element the edge should run along (a property row, a text
 * block, a movement row).
 *
 * The action is a check button on the value's line. Its word ("Potwierdź")
 * shows beside it on hover and on keyboard focus; the accessible name always
 * names the field. The button is a stop of the keyboard review
 * (`reviewFocus.ts`): it names its field's control for `E`, and a confirmation
 * made from the keyboard moves focus on to the next unchecked field.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";
import type { Piece } from "@/shared/types";
import { childFieldProvenance, isAiProvenance, pieceFieldProvenance } from "../components/ProvenanceChip";
import { advanceReviewFocus } from "./reviewFocus";
import type { PieceAutosave } from "./usePieceAutosave";

interface ReviewProps {
  readonly piece?: Piece;
  readonly field: Parameters<PieceAutosave["confirm"]>[0];
  readonly label: string;
  readonly autosave: PieceAutosave;
  readonly objectId?: string;
  readonly disabled?: boolean;
  /** The id of the field's control, which `E` focuses from the button. */
  readonly controlId?: string;
}

/** Inset from the block's edges, so the edges of adjacent unchecked rows stay apart. */
const ReviewEdge = ({ pending }: { pending: boolean }) => {
  const reducedMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {pending && (
        <motion.span
          key="provenance"
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 -left-2.5 w-0.5 lg:-left-5"
          animate="pending"
          exit="exit"
          transition={{ duration: reducedMotion ? 0 : 1.1 }}
          variants={{ pending: { opacity: 1 }, exit: { opacity: reducedMotion ? 0 : [1, 1, 0] } }}
        >
          <span className="absolute inset-0 rounded-full bg-ethereal-amethyst" />
          <motion.span
            className="absolute inset-0 rounded-full bg-ethereal-sage"
            variants={{ pending: { opacity: 0 }, exit: { opacity: 1 } }}
            transition={{ duration: 0.2 }}
          />
        </motion.span>
      )}
    </AnimatePresence>
  );
};

export const usePieceFieldReview = ({ piece, field, label, autosave, objectId, disabled, controlId }: ReviewProps) => {
  const { t } = useTranslation();
  const entry = piece && (objectId
    ? childFieldProvenance(piece, objectId, field)
    : pieceFieldProvenance(piece, field));
  const pending = isAiProvenance(entry);
  const isConfirming = autosave.isConfirming(field, objectId);

  return {
    marker: <ReviewEdge pending={pending} />,
    action: pending ? (
      <button
        type="button"
        aria-label={t("archive.provenance.verify_aria", { label })}
        disabled={disabled}
        aria-disabled={disabled || isConfirming}
        className={cn(
          "group/confirm relative flex size-11 shrink-0 items-center justify-center rounded-control text-ethereal-graphite transition-colors fine-pointer:size-9",
          "hover:bg-ethereal-ink/6 hover:text-ethereal-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
          "disabled:opacity-40 aria-disabled:cursor-default",
        )}
        data-review-confirm=""
        data-review-control={controlId}
        onClick={(event) => {
          if (isConfirming) return;
          // A click from Enter or Space has no pointer detail.
          if (event.detail === 0) advanceReviewFocus(event.currentTarget);
          autosave.confirm(field, objectId);
        }}
      >
        <Check size={18} strokeWidth={2.25} aria-hidden="true" />
        <Text
          as="span"
          size="sm"
          weight="medium"
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-full top-1/2 mr-1 -translate-y-1/2 whitespace-nowrap rounded-control border border-hairline bg-ethereal-marble px-2 py-1 opacity-0 shadow-glass-solid transition-opacity duration-150",
            "group-hover/confirm:opacity-100 group-focus-visible/confirm:opacity-100",
          )}
        >
          {t("archive.piece_card.confirm_field")}
        </Text>
      </button>
    ) : null,
  };
};
