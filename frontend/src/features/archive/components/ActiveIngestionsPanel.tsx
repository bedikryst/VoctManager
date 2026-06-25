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
import { Ban, Check, Loader2, Sparkles, X } from "lucide-react";

import { Caption, Heading, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

import { useActiveIngestions, useCancelEdition } from "../api/archive.queries";
import type { ActiveIngestion } from "../api/archive.service";
import { isOverloadWait, liveIngestionLabel } from "../constants/ingestionProgress";

const fmtCents = (cents?: number): string =>
  cents && cents > 0 ? `$${(cents / 100).toFixed(2)}` : "$0.00";

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
    <section
      role="region"
      aria-live="polite"
      aria-label={t("archive.active.aria", "Przetwarzanie AI w toku")}
      className="relative overflow-hidden rounded-3xl border border-ethereal-amethyst/30 bg-gradient-to-r from-ethereal-amethyst/10 via-ethereal-parchment/40 to-transparent p-5 md:p-6"
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-ethereal-amethyst/40 bg-ethereal-amethyst/10 text-ethereal-amethyst"
          aria-hidden="true"
        >
          <Sparkles size={18} strokeWidth={1.6} />
        </span>
        <Heading as="h2" size="lg" weight="medium">
          {t("archive.active.title", "AI pracuje nad {{count}} partyturą", {
            count: active.length,
          })}
        </Heading>
      </div>

      <ul role="list" className="flex flex-col gap-2">
        {active.map((item) => (
          <ActiveRow key={item.id} item={item} now={now} />
        ))}
      </ul>
    </section>
  );
};

interface ActiveRowProps {
  readonly item: ActiveIngestion;
  readonly now: number;
}

const ActiveRow = ({ item, now }: ActiveRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const overloaded = isOverloadWait(item.ingestion_progress);
  const elapsed = Math.floor((now - new Date(item.created_at).getTime()) / 1000);
  const title = item.piece_title?.trim() || item.original_filename;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-ethereal-alabaster/70 px-4 py-3",
        overloaded ? "border-ethereal-gold/40" : "border-ethereal-incense/20",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
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
          {liveIngestionLabel(t, item.ingestion_status, item.ingestion_progress)}
        </Caption>
        <Caption color="muted" className="mt-0.5 block">
          {fmtElapsed(elapsed)} · {fmtCents(item.ingestion_cost_cents_lifetime)}
          {item.page_count
            ? ` · ${item.page_count} ${t("archive.active.pages", "str.")}`
            : ""}
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
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={t("archive.active.cancel", "Przerwij przetwarzanie")}
        title={t("archive.active.cancel", "Przerwij przetwarzanie")}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-ethereal-incense/25 text-ethereal-graphite/55 transition-colors hover:border-ethereal-crimson/40 hover:text-ethereal-crimson"
      >
        <Ban size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={cancel.isPending}
        onClick={() =>
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
        aria-label={t("archive.active.cancel_confirm", "Potwierdź przerwanie")}
        className="flex h-8 items-center gap-1 rounded-xl border border-ethereal-crimson/40 bg-ethereal-crimson/10 px-2 text-[11px] font-semibold text-ethereal-crimson"
      >
        {cancel.isPending ? (
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        ) : (
          <Check size={12} strokeWidth={2.2} aria-hidden="true" />
        )}
        {t("archive.active.cancel_short", "Przerwij")}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        aria-label={t("archive.review.cancel", "Anuluj")}
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-ethereal-incense/25 text-ethereal-graphite/55"
      >
        <X size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  );
};
