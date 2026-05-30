/**
 * @file EditionStatusBadge.tsx
 * @description Compact badge that visualises a ScoreEdition ingestion phase
 * using Ethereal accent tokens. Spinning pulse for in-progress phases so the
 * conductor can tell the pipeline is still working.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/repertoire/EditionStatusBadge
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  CircleAlert,
  Hourglass,
  Loader2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import { INGESTION_STATUS, type IngestionStatusCode } from "@/shared/types";

type Tone = "neutral" | "progress" | "awaiting" | "ready" | "failed";

const STATUS_TONE: Record<IngestionStatusCode, Tone> = {
  [INGESTION_STATUS.PENDING]: "neutral",
  [INGESTION_STATUS.EXTRACTING]: "progress",
  [INGESTION_STATUS.ENRICHING]: "progress",
  [INGESTION_STATUS.GENERATING]: "progress",
  [INGESTION_STATUS.AWAITING]: "awaiting",
  [INGESTION_STATUS.READY]: "ready",
  [INGESTION_STATUS.FAILED]: "failed",
};

const STATUS_I18N_KEY: Record<IngestionStatusCode, string> = {
  [INGESTION_STATUS.PENDING]: "repertoire.status.pending",
  [INGESTION_STATUS.EXTRACTING]: "repertoire.status.extracting",
  [INGESTION_STATUS.ENRICHING]: "repertoire.status.enriching",
  [INGESTION_STATUS.GENERATING]: "repertoire.status.generating",
  [INGESTION_STATUS.AWAITING]: "repertoire.status.awaiting",
  [INGESTION_STATUS.READY]: "repertoire.status.ready",
  [INGESTION_STATUS.FAILED]: "repertoire.status.failed",
};

const STATUS_DEFAULT_PL: Record<IngestionStatusCode, string> = {
  [INGESTION_STATUS.PENDING]: "Oczekuje",
  [INGESTION_STATUS.EXTRACTING]: "Ekstrakcja metadanych",
  [INGESTION_STATUS.ENRICHING]: "Wyszukiwanie źródeł",
  [INGESTION_STATUS.GENERATING]: "Notka i tłumaczenia",
  [INGESTION_STATUS.AWAITING]: "Czeka na przegląd",
  [INGESTION_STATUS.READY]: "Zatwierdzone",
  [INGESTION_STATUS.FAILED]: "Błąd",
};

const TONE_ICON: Record<Tone, LucideIcon> = {
  neutral: Hourglass,
  progress: Loader2,
  awaiting: Sparkles,
  ready: CheckCircle2,
  failed: CircleAlert,
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

export interface EditionStatusBadgeProps extends VariantProps<typeof toneVariants> {
  readonly status: IngestionStatusCode;
  readonly label?: string;
  readonly className?: string;
}

export const EditionStatusBadge = ({
  status,
  label,
  className,
}: EditionStatusBadgeProps): React.JSX.Element => {
  const { t } = useTranslation();
  const tone = STATUS_TONE[status] ?? "neutral";
  const Icon = TONE_ICON[tone];
  const text = label ?? t(STATUS_I18N_KEY[status], STATUS_DEFAULT_PL[status]);
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
