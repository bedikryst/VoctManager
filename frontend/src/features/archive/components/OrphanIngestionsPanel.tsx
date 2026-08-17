/**
 * @file OrphanIngestionsPanel.tsx
 * @description The archive's dead-letter queue: uploads whose pipeline ended
 * before the resolver could attach a Piece. They are terminal, so the "AI w
 * toku" panel has already dropped them, and they belong to no piece, so no
 * piece card shows them either — the in-session upload row was their only trace
 * and a reload erased it. The PDF, the reason it failed and the AI spend simply
 * vanished, with nothing left to retry or discard them with. This panel is
 * where they surface, with those two actions.
 *
 * Renders nothing in the healthy case, which is nearly always — it must cost
 * the daily library view no space at all.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/OrphanIngestionsPanel
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { CircleAlert, RefreshCcw, Trash2 } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { getDateFnsLocale } from "@/shared/lib/time/dateFnsLocale";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";

import {
  useDeleteEdition,
  useOrphanIngestions,
  useReingestEdition,
} from "../api/archive.queries";
import type { ActiveIngestion } from "../api/archive.service";
import { formatIngestionCost } from "../constants/ingestionCost";
import { InlineConfirmAction } from "./InlineConfirmAction";

const fmtWhen = (iso: string | undefined, language?: string): string => {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), {
      addSuffix: true,
      locale: getDateFnsLocale(language),
    });
  } catch {
    return iso;
  }
};

export const OrphanIngestionsPanel = (): React.JSX.Element | null => {
  const { t } = useTranslation();
  const { data } = useOrphanIngestions();
  const orphans = data ?? [];

  if (orphans.length === 0) return null;

  return (
    <SectionCard
      as="h2"
      title={t("archive.orphans.section", "Nieukończone analizy")}
      icon={<CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" />}
      action={
        <Badge variant="danger" className="py-0 tabular-nums">
          {orphans.length}
        </Badge>
      }
      ariaLabel={t(
        "archive.orphans.aria",
        "Wgrane pliki, których AI nie zdołał przetworzyć",
      )}
      bodyClassName="gap-2"
    >
      <Text size="xs" color="graphite" className="block">
        {t(
          "archive.orphans.hint",
          "AI nie zdążył rozpoznać utworu, więc te pliki nie trafiły do żadnej karty. Ponów analizę albo usuń plik.",
        )}
      </Text>
      <ul role="list" className="flex flex-col gap-2">
        {orphans.map((item) => (
          <OrphanRow key={item.id} item={item} />
        ))}
      </ul>
    </SectionCard>
  );
};

const OrphanRow = ({
  item,
}: {
  readonly item: ActiveIngestion;
}): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const reingest = useReingestEdition();
  const remove = useDeleteEdition();

  const spent = formatIngestionCost(item.ingestion_cost_cents_lifetime);
  const meta = [fmtWhen(item.updated_at, i18n.language), spent]
    .filter(Boolean)
    .join(" · ");

  const handleRetry = (): void => {
    reingest.mutate(
      { id: item.id, force: false },
      {
        onSuccess: () =>
          toast.success(
            t("archive.orphans.retry_started", "Analiza uruchomiona ponownie."),
          ),
        onError: (err) =>
          toastApiError(err, t, {
            fallbackDescription: t(
              "archive.orphans.retry_failed",
              "Nie udało się ponowić analizy.",
            ),
          }),
      },
    );
  };

  return (
    <li className="flex items-start gap-3 rounded-nested border border-ethereal-crimson/25 bg-ethereal-crimson/5 px-4 py-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-ethereal-crimson/40 bg-ethereal-crimson/10 text-ethereal-crimson"
        aria-hidden="true"
      >
        <CircleAlert size={16} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <Text size="sm" weight="semibold" truncate className="block">
          {item.original_filename ||
            t("archive.orphans.untitled", "Bez nazwy")}
        </Text>
        {/* The server's reason, verbatim — it is the only clue why this PDF
            never became a piece, and it distinguishes a real failure from the
            manager's own "Przerwij". */}
        {item.ingestion_error ? (
          <Text
            size="xs"
            color="crimson"
            className="mt-0.5 line-clamp-2"
            title={item.ingestion_error}
          >
            {item.ingestion_error}
          </Text>
        ) : null}
        {meta ? (
          <Caption color="muted" className="mt-0.5 block">
            {meta}
          </Caption>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCcw size={13} aria-hidden="true" />}
          onClick={handleRetry}
          disabled={reingest.isPending}
          isLoading={reingest.isPending}
        >
          {t("archive.orphans.retry", "Ponów")}
        </Button>
        <InlineConfirmAction
          icon={Trash2}
          label={t("archive.orphans.delete", "Usuń wgrany plik")}
          confirmLabel={t("archive.orphans.delete_short", "Usuń")}
          isPending={remove.isPending}
          onConfirm={() =>
            remove.mutate(item.id, {
              onSuccess: () =>
                toast.success(
                  t("archive.orphans.deleted", "Usunięto wgrany plik."),
                ),
              onError: (err) =>
                toastApiError(err, t, {
                  fallbackDescription: t(
                    "archive.orphans.delete_failed",
                    "Nie udało się usunąć pliku.",
                  ),
                }),
            })
          }
        />
      </div>
    </li>
  );
};
