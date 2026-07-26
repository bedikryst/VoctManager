/**
 * @file EditionStatusBadge.tsx
 * @description A ScoreEdition's ingestion phase as a `Badge` — this file owns
 * the phase→tone→sentence mapping, never the chip's own surface. The icon spins
 * while the pipeline is working, so the conductor can tell it has not stalled.
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

import { Badge, type BadgeVariant } from "@/shared/ui/primitives/Badge";
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

/**
 * The pipeline phase is a status the system wrote, so it wears the panel's one
 * chip. This composite only maps a phase to a tone, an icon and a sentence.
 */
const TONE_VARIANT: Record<Tone, BadgeVariant> = {
  neutral: "neutral",
  progress: "amethyst",
  awaiting: "warning",
  ready: "success",
  failed: "danger",
};

export interface EditionStatusBadgeProps {
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
    <Badge
      variant={TONE_VARIANT[tone]}
      className={className}
      icon={
        isProgress ? (
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
        )
      }
    >
      {text}
    </Badge>
  );
};
