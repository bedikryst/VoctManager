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
import { Loader2, Sparkles } from "lucide-react";

import { Caption, Heading, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

import { useActiveIngestions } from "../api/archive.queries";
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
          {active.length === 1
            ? t("archive.active.title_one", "AI pracuje nad 1 partyturą")
            : t("archive.active.title_many", "AI pracuje nad {{count}} partyturami", {
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
    </li>
  );
};
