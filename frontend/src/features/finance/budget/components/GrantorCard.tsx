/**
 * @file GrantorCard.tsx
 * @description What a grant's settlement is typed and written from: the
 * kosztorys as a CSV in the public-benefit layout, planned or as it came out,
 * and the notes for the back of every accounting document charged to a
 * source. One choice of source serves both: it is the "z dotacji" column of
 * the kosztorys and the source whose documents get a note. Left empty, the
 * column gathers every public grant and the notes cover every funder but the
 * foundation's own money. Each download is offered once there is something
 * in it; before that the card says what brings it.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/GrantorCard
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileDown, FileSpreadsheet, Landmark } from "lucide-react";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { FinanceService } from "../../api/finance.service";
import { toastFinanceError } from "../../lib/financeErrors";
import { isPositiveAmount } from "../../lib/money";
import type { AllocationDTO, KosztorysVariant, ProjectBudgetDTO } from "../../types/finance.dto";

type Download = KosztorysVariant | "notes";

interface GrantorCardProps {
  readonly projectId: string;
  readonly budget: ProjectBudgetDTO;
}

export function GrantorCard({ projectId, budget }: GrantorCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const [sourceId, setSourceId] = useState("");
  const [downloading, setDownloading] = useState<Download | null>(null);

  const moneySources = budget.fundings.filter((funding) => funding.brings_money);
  // The fundings whose documents get a note: the chosen source's, or every
  // funder's but the foundation's own.
  const noted = new Set(
    moneySources
      .filter((funding) =>
        sourceId ? funding.source.id === sourceId : funding.source.kind !== "OWN_FUNDS",
      )
      .map((funding) => funding.id),
  );
  const isNoted = (allocations: readonly AllocationDTO[]): boolean =>
    allocations.some((allocation) => noted.has(allocation.funding_id) && isPositiveAmount(allocation.amount));
  const hasNotes =
    budget.ledger.some((row) => row.counted && row.form !== "VOLUNTEER" && isNoted(row.allocations)) ||
    budget.expenses.some((expense) => isNoted(expense.allocations));
  const hasPlan = budget.lines.length > 0;

  const run = async (kind: Download, fetch: () => Promise<void>): Promise<void> => {
    setDownloading(kind);
    try {
      await fetch();
    } catch (error) {
      toastFinanceError(error, t, t("finance.download.error", "Nie udało się pobrać dokumentu."));
    } finally {
      setDownloading(null);
    }
  };

  const source = sourceId || undefined;

  return (
    <SectionCard
      as="h2"
      icon={<Landmark size={15} aria-hidden="true" />}
      title={t("finance.grantor.title", "Dla grantodawcy")}
      bodyClassName="gap-5"
    >
      {moneySources.length > 0 && (
        <div className="flex flex-col gap-2">
          <Select
            label={t("finance.grantor.source_label", "Źródło")}
            value={sourceId}
            onValueChange={setSourceId}
            placeholder={t("finance.grantor.source_all", "Wszystkie źródła")}
            clearLabel={t("finance.grantor.source_all", "Wszystkie źródła")}
            options={moneySources.map((funding) => ({
              value: funding.source.id,
              label: funding.source.name,
            }))}
          />
          <Caption color="muted">
            {sourceId
              ? t(
                  "finance.grantor.source_hint_one",
                  "Kolumna „z dotacji” i opisy dokumentów dotyczą tylko tego źródła.",
                )
              : t(
                  "finance.grantor.source_hint_all",
                  "Kolumna „z dotacji” zbiera dotacje publiczne, a opisy obejmują każde źródło poza środkami własnymi.",
                )}
          </Caption>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Text size="sm" color="graphite">
          {t(
            "finance.grantor.kosztorys_hint",
            "Kosztorys w układzie wniosku o dotację: pozycje, jednostki, wartość i jej podział — z dotacji, z innych środków, z wkładu osobowego i rzeczowego. Z niego przepiszesz dane do generatora wniosków.",
          )}
        </Text>
        {hasPlan ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Button
              variant="secondary"
              onClick={() =>
                void run("plan", () => FinanceService.downloadKosztorys(projectId, "plan", source))
              }
              isLoading={downloading === "plan"}
              leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />}
            >
              {t("finance.grantor.kosztorys_plan", "Kosztorys — plan (CSV)")}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void run("actual", () => FinanceService.downloadKosztorys(projectId, "actual", source))
              }
              isLoading={downloading === "actual"}
              leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />}
            >
              {t("finance.grantor.kosztorys_actual", "Kosztorys — wykonanie (CSV)")}
            </Button>
          </div>
        ) : (
          <Caption color="muted">
            {t(
              "finance.grantor.kosztorys_empty",
              "Kosztorys do wniosku pojawi się, gdy dodasz pozycje w zakładce Kosztorys.",
            )}
          </Caption>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline pt-4">
        <Text size="sm" color="graphite">
          {t(
            "finance.grantor.notes_hint",
            "Opis na odwrocie każdego dokumentu obciążonego źródłem, według formuły z ustawień źródła — do przepisania albo wycięcia i naklejenia.",
          )}
        </Text>
        {hasNotes ? (
          <Button
            variant="secondary"
            onClick={() => void run("notes", () => FinanceService.downloadDocumentNotes(projectId, source))}
            isLoading={downloading === "notes"}
            leftIcon={<FileDown size={14} aria-hidden="true" />}
          >
            {t("finance.grantor.notes_action", "Opisy dokumentów (PDF)")}
          </Button>
        ) : (
          <Caption color="muted">
            {t(
              "finance.grantor.notes_empty",
              "Opisy pojawią się, gdy obciążysz koszty źródłem w zakładce Finansowanie.",
            )}
          </Caption>
        )}
      </div>
    </SectionCard>
  );
}
