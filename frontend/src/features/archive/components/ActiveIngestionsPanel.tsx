/**
 * @file ActiveIngestionsPanel.tsx
 * @description The library's "Analiza AI" section: every ingestion in flight
 * (from `GET /api/archive/editions/active/`), with the live step, the elapsed
 * time, the running cost and the page count. It is refresh-proof, so the
 * manager sees what the AI is doing right after an upload, before the piece
 * resolves, and after a reload; the upload drawer's live row is its in-session
 * counterpart.
 *
 * The rows are the list's own `RecordRow`s. Once the resolver has attached a
 * piece, the row opens its card; before that it is an upload, not a record,
 * and opens nothing.
 * @module features/archive/components/ActiveIngestionsPanel
 */

import React, { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Ban, Loader2 } from "lucide-react";

import { RecordList, RecordRow } from "@/shared/ui/composites/RecordList";
import { Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

import { useActiveIngestions, useCancelEdition } from "../api/archive.queries";
import type { ActiveIngestion } from "../api/archive.service";
import { formatIngestionCost } from "../constants/ingestionCost";
import {
  isOverloadWait,
  liveAnalysisDetail,
  liveIngestionLabel,
} from "../constants/ingestionProgress";
import { pieceCardPath } from "../constants/libraryScope";
import { InlineConfirmAction } from "./InlineConfirmAction";

export const ActiveIngestionsPanel = (): React.JSX.Element | null => {
  const { t } = useTranslation();
  const headingId = useId();
  const { data } = useActiveIngestions();
  const active = data ?? [];
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick once a second so the elapsed timer moves between the 2 s polls.
  useEffect(() => {
    if (active.length === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active.length]);

  if (active.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <Text as="h2" id={headingId} size="lg" weight="semibold" className="mb-2">
        {t("archive.active.section", "Analiza AI")}
      </Text>
      <RecordList label={t("archive.active.aria", "Przetwarzanie AI w toku")}>
        {active.map((item) => (
          <ActiveRow key={item.id} item={item} now={now} />
        ))}
      </RecordList>
    </section>
  );
};

interface ActiveRowProps {
  readonly item: ActiveIngestion;
  readonly now: number;
}

const ActiveRow = ({ item, now }: ActiveRowProps): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const overloaded = isOverloadWait(item.ingestion_progress);
  // Elapsed counts from THIS run's dispatch. created_at is only the fallback
  // (pre-migration rows): on a re-ingest it is the original upload date and
  // would show an absurd multi-day timer.
  const startedAt = item.ingestion_run_started_at ?? item.created_at;
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const elapsedText =
    elapsed < 60
      ? t("archive.active.elapsed_seconds", "{{s}} s", { s: elapsed })
      : t("archive.active.elapsed_minutes", "{{m}} min {{s}} s", {
          m: Math.floor(elapsed / 60),
          s: elapsed % 60,
        });
  // The streamed preview knows the work's real title seconds into the analysis,
  // long before the resolver attaches a Piece (which is where piece_title comes
  // from). The file name is the last resort, and is not a work's title.
  const workTitle = item.piece_title?.trim() || item.live_preview?.title || null;
  const step =
    (!overloaded && liveAnalysisDetail(t, item.live_preview)) ||
    liveIngestionLabel(t, item.ingestion_status, item.ingestion_progress);

  return (
    <RecordRow
      open={item.piece ? { to: pieceCardPath(item.piece, null) } : undefined}
      title={workTitle ?? item.original_filename}
      voice={workTitle ? "work" : "name"}
      leading={
        <Loader2
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className={cn(
            "animate-spin",
            overloaded ? "text-ethereal-gold" : "text-ethereal-amethyst",
          )}
        />
      }
      facts={[
        overloaded ? (
          <Text as="span" size="sm" color="gold">
            {step}
          </Text>
        ) : (
          step
        ),
      ]}
      meta={[
        elapsedText,
        formatIngestionCost(item.ingestion_cost_cents_lifetime, i18n.language),
        item.page_count
          ? `${item.page_count} ${t("archive.active.pages", "str.")}`
          : null,
      ]}
      actions={<CancelControl editionId={item.id} />}
    />
  );
};

/** Two-step "Przerwij": cancelling an ingestion mid-flight is deliberate
 *  (a wrong PDF), so it is guarded against a single accidental tap. */
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
