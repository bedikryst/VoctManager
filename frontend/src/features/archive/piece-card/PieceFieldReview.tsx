/**
 * @file PieceFieldReview.tsx
 * @description Confirmation controls for the piece's unchecked AI fields.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ui/primitives/Button";
import type { Piece } from "@/shared/types";
import { isAiProvenance, pieceFieldProvenance } from "../components/ProvenanceChip";
import type { PieceAutosave } from "./usePieceAutosave";

interface ReviewProps {
  readonly piece?: Piece;
  readonly field: Parameters<PieceAutosave["confirm"]>[0];
  readonly label: string;
  readonly autosave: PieceAutosave;
}

const ReviewMarker = ({ pending }: { pending: boolean }) => {
  const reducedMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {pending && (
        <motion.span
          key="provenance"
          aria-hidden="true"
          className="relative flex size-3.5 shrink-0 items-center justify-center"
          animate="pending"
          exit="exit"
          transition={{ duration: reducedMotion ? 0 : 1.1 }}
          variants={{ pending: { opacity: 1 }, exit: { opacity: reducedMotion ? 0 : [1, 1, 0] } }}
        >
          <motion.span
            className="size-1.5 rounded-full bg-ethereal-amethyst"
            variants={{ pending: { opacity: 1 }, exit: { opacity: 0 } }}
            transition={{ duration: 0.15 }}
          />
          <motion.span
            className="absolute inset-0 text-ethereal-sage"
            variants={{ pending: { opacity: 0 }, exit: { opacity: 1 } }}
            transition={{ duration: 0.2 }}
          >
            <Check size={14} strokeWidth={2.5} />
          </motion.span>
        </motion.span>
      )}
    </AnimatePresence>
  );
};

export const usePieceFieldReview = ({ piece, field, label, autosave }: ReviewProps) => {
  const { t } = useTranslation();
  const pending = Boolean(piece && isAiProvenance(pieceFieldProvenance(piece, field)));

  return {
    marker: <ReviewMarker pending={pending} />,
    action: pending ? (
      <Button
        type="button"
        variant="outline"
        casing="sentence"
        size="sm"
        aria-label={t("archive.provenance.verify_aria", { label })}
        aria-disabled={autosave.isConfirming(field)}
        leftIcon={<Check size={14} aria-hidden="true" />}
        className="h-8 min-h-8 px-2 text-sm"
        onClick={() => autosave.confirm(field)}
      >
        {t("archive.piece_card.confirm_field")}
      </Button>
    ) : null,
  };
};
