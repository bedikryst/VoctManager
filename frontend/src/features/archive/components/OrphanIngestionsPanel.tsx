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
 * the daily library view no space at all. When it does render, it is a section
 * above the list in the list's own rows; an orphan is an upload, not a record,
 * so its row opens nothing and its two actions are its only controls.
 * @module features/archive/components/OrphanIngestionsPanel
 */

import React, { useId } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { RefreshCcw, Trash2 } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { getDateFnsLocale } from "@/shared/lib/time/dateFnsLocale";
import {
  RecordList,
  RecordRow,
  recordActionClass,
} from "@/shared/ui/composites/RecordList";
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
  const headingId = useId();
  const { data } = useOrphanIngestions();
  const orphans = data ?? [];

  if (orphans.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <Text as="h2" id={headingId} size="lg" weight="semibold">
        {t("archive.orphans.section", "Nieukończone analizy")}
      </Text>
      <Text size="sm" color="graphite" className="mb-2 mt-1 block">
        {t(
          "archive.orphans.hint",
          "AI nie zdążył rozpoznać utworu, więc te pliki nie trafiły do żadnej karty. Ponów analizę albo usuń plik.",
        )}
      </Text>
      <RecordList
        label={t(
          "archive.orphans.aria",
          "Wgrane pliki, których AI nie zdołał przetworzyć",
        )}
      >
        {orphans.map((item) => (
          <OrphanRow key={item.id} item={item} />
        ))}
      </RecordList>
    </section>
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

  const retryLabel = t("archive.orphans.retry", "Ponów analizę");

  return (
    <RecordRow
      title={item.original_filename || t("archive.orphans.untitled", "Bez nazwy")}
      voice="name"
      // The server's reason, verbatim: it is the only clue why this PDF never
      // became a piece, and it tells a real failure from the manager's own
      // "Przerwij".
      flags={
        item.ingestion_error ? (
          <Caption color="crimson" className="line-clamp-2" title={item.ingestion_error}>
            {item.ingestion_error}
          </Caption>
        ) : null
      }
      facts={[
        fmtWhen(item.updated_at, i18n.language),
        formatIngestionCost(item.ingestion_cost_cents_lifetime),
      ]}
      actions={
        <>
          <Button
            variant="icon"
            size="icon"
            className={recordActionClass}
            aria-label={retryLabel}
            title={retryLabel}
            onClick={handleRetry}
            disabled={reingest.isPending}
          >
            <RefreshCcw
              size={16}
              aria-hidden="true"
              className={reingest.isPending ? "animate-spin" : undefined}
            />
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
        </>
      }
    />
  );
};
