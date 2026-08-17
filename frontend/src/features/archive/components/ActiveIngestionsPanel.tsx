/**
 * @file ActiveIngestionsPanel.tsx
 * @description Persistent, refresh-proof "AI w toku" panel. Lists every
 * in-flight ingestion (from `GET /api/archive/editions/active/`) with the live
 * step, elapsed time and running cost — so the conductor always sees what the
 * AI is doing, even right after upload (before the piece resolves) and even
 * after a page reload. This is the durable counterpart to the in-session live
 * row inside the upload zone.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/ActiveIngestionsPanel
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Ban, Loader2, Sparkles } from "lucide-react";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

import { useActiveIngestions, useCancelEdition } from "../api/archive.queries";
import type { ActiveIngestion } from "../api/archive.service";
import { formatIngestionCost } from "../constants/ingestionCost";
import {
  isOverloadWait,
  liveAnalysisDetail,
  liveIngestionLabel,
} from "../constants/ingestionProgress";
import { InlineConfirmAction } from "./InlineConfirmAction";

const fmtElapsed = (seconds: number): string => {
  const s = Math.max(0, seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

export const ActiveIngestionsPanel = (): React.JSX.Element | null => {
  const { t } = useTranslation();
  const { data } = useActiveIngestions();
  const active = data ?? [];
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick once a second so the elapsed timer feels alive between 2s polls.
  useEffect(() => {
    if (active.length === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active.length]);

  if (active.length === 0) return null;

  return (
    // The card header is a label slot, not a sentence: the count rides in the
    // action chip, and the sentence stays where it does real work — the region's
    // accessible name.
    <SectionCard
      as="h2"
      title={t("archive.active.section", "Analiza AI")}
      icon={<Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />}
      action={
        <Badge variant="amethyst" className="py-0 tabular-nums">
          {active.length}
        </Badge>
      }
      ariaLabel={t("archive.active.aria", "Przetwarzanie AI w toku")}
      bodyClassName="gap-2"
    >
      <ul role="list" aria-live="polite" className="flex flex-col gap-2">
        {active.map((item) => (
          <ActiveRow key={item.id} item={item} now={now} />
        ))}
      </ul>
    </SectionCard>
  );
};

interface ActiveRowProps {
  readonly item: ActiveIngestion;
  readonly now: number;
}

const ActiveRow = ({ item, now }: ActiveRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const overloaded = isOverloadWait(item.ingestion_progress);
  // Elapsed counts from THIS run's dispatch. created_at is only the fallback
  // (pre-migration rows): on a re-ingest it is the original upload date and
  // would show an absurd multi-day timer.
  const startedAt = item.ingestion_run_started_at ?? item.created_at;
  const elapsed = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  // The streamed preview knows the work's real title seconds into the analysis
  // — long before the resolver attaches a Piece (which is where piece_title
  // comes from). Filename is the last resort.
  const title =
    item.piece_title?.trim() ||
    item.live_preview?.title ||
    item.original_filename;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-nested border bg-ethereal-alabaster/70 px-4 py-3",
        overloaded ? "border-ethereal-gold/40" : "border-hairline",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-control border",
          overloaded
            ? "border-ethereal-gold/50 bg-ethereal-gold/10 text-ethereal-gold"
            : "border-ethereal-amethyst/40 bg-ethereal-amethyst/10 text-ethereal-amethyst",
        )}
        aria-hidden="true"
      >
        <Loader2 size={16} strokeWidth={2} className="animate-spin" />
      </span>
      <div className="min-w-0 flex-1">
        <Text size="sm" weight="semibold" truncate className="block">
          {title}
        </Text>
        <Caption color={overloaded ? "gold" : "muted"} className="mt-0.5 block">
          {(!overloaded && liveAnalysisDetail(t, item.live_preview)) ||
            liveIngestionLabel(t, item.ingestion_status, item.ingestion_progress)}
        </Caption>
        <Caption color="muted" className="mt-0.5 block">
          {[
            fmtElapsed(elapsed),
            formatIngestionCost(item.ingestion_cost_cents_lifetime),
            item.page_count
              ? `${item.page_count} ${t("archive.active.pages", "str.")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Caption>
      </div>
      <CancelControl editionId={item.id} />
    </li>
  );
};

/** Two-click "przerwij" — cancelling an ingestion mid-flight is deliberate
 *  (wrong PDF), so guard it against an accidental single tap. */
const CancelControl = ({
  editionId,
}: {
  readonly editionId: string;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const cancel = useCancelEdition();

  return (
    <InlineConfirmAction
      icon={Ban}
      label={t("archive.active.cancel", "Przerwij przetwarzanie")}
      confirmLabel={t("archive.active.cancel_short", "Przerwij")}
      isPending={cancel.isPending}
      onConfirm={() =>
        cancel.mutate(editionId, {
          onSuccess: () =>
            toast.success(
              t("archive.active.cancelled", "Przerwano przetwarzanie."),
            ),
          onError: () =>
            toast.error(
              t("archive.active.cancel_failed", "Nie udało się przerwać."),
            ),
        })
      }
    />
  );
};
