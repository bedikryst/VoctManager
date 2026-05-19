/**
 * @file EditionStatusBadge.tsx
 * @description Compact badge that visualises a ScoreEdition ingestion phase
 * using Ethereal accent tokens. Includes a kinetic pulse for in-progress
 * phases so the conductor sees the pipeline is still working.
 * @architecture Enterprise SaaS 2026
 * @module features/score-compiler/components/EditionStatusBadge
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Hourglass,
  Loader2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import {
  INGESTION_STATUS_LABELS,
  INGESTION_STATUS_TONES,
  type IngestionStatus,
  type StatusTone,
} from "../types/score-compiler.dto";

// Each canonical status maps to one i18n key; defaults stay in Polish to
// match the rest of the score-compiler UI. The keys are flat so a translator
// can swap them without touching code.
const STATUS_I18N_KEY: Record<IngestionStatus, string> = {
  PEND: "score_compiler.status.pending",
  EXTR: "score_compiler.status.extracting",
  ENRI: "score_compiler.status.enriching",
  GENR: "score_compiler.status.generating",
  AWAI: "score_compiler.status.awaiting",
  "RDY ": "score_compiler.status.ready",
  FAIL: "score_compiler.status.failed",
};

const STATUS_DEFAULT_PL: Record<IngestionStatus, string> = {
  PEND: "Oczekuje",
  EXTR: "Ekstrakcja metadanych",
  ENRI: "Wyszukiwanie źródeł",
  GENR: "Notka i tłumaczenia",
  AWAI: "Czeka na przegląd",
  "RDY ": "Zatwierdzone",
  FAIL: "Błąd",
};

const toneVariants = cva(
  "inline-flex items-center gap-2 rounded-full border px-3 py-1 backdrop-blur-sm transition-colors",
  {
    variants: {
      tone: {
        neutral:
          "bg-ethereal-marble/60 border-ethereal-incense/25 text-ethereal-graphite",
        progress:
          "bg-ethereal-amethyst/10 border-ethereal-amethyst/30 text-ethereal-amethyst",
        awaiting:
          "bg-ethereal-gold/10 border-ethereal-gold/40 text-ethereal-gold",
        ready:
          "bg-ethereal-sage/15 border-ethereal-sage/40 text-ethereal-sage",
        failed:
          "bg-ethereal-crimson/10 border-ethereal-crimson/40 text-ethereal-crimson",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const TONE_ICON: Record<StatusTone, LucideIcon> = {
  neutral: Hourglass,
  progress: Loader2,
  awaiting: Sparkles,
  ready: CheckCircle2,
  failed: CircleAlert,
};

export interface EditionStatusBadgeProps
  extends VariantProps<typeof toneVariants> {
  status: IngestionStatus;
  /** Optional override of the display label (otherwise uses the canonical label). */
  label?: string;
  className?: string;
}

export const EditionStatusBadge = ({
  status,
  label,
  className,
}: EditionStatusBadgeProps): React.JSX.Element => {
  const { t } = useTranslation();
  const tone: StatusTone = INGESTION_STATUS_TONES[status] ?? "neutral";
  const Icon = TONE_ICON[tone] ?? CircleDashed;
  const text =
    label ??
    t(
      STATUS_I18N_KEY[status] ?? "score_compiler.status.unknown",
      STATUS_DEFAULT_PL[status] ?? INGESTION_STATUS_LABELS[status] ?? status,
    );
  const isProgress = tone === "progress";

  return (
    <span className={cn(toneVariants({ tone }), className)}>
      {isProgress ? (
        <motion.span
          aria-hidden="true"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
          className="flex"
        >
          <Icon size={14} strokeWidth={2} />
        </motion.span>
      ) : (
        <Icon size={14} strokeWidth={2} aria-hidden="true" />
      )}
      <Eyebrow color="inherit" size="caption" className="tracking-[0.18em]">
        {text}
      </Eyebrow>
    </span>
  );
};
