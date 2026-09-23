/**
 * @file ReportsCard.tsx
 * @description The project's two printed reports. The board's is the whole
 * budget with names. The patron's says what the concert cost, what the money
 * paid for and where it came from — never a person or a single fee: the
 * server merges any figure that would sum fewer than three people's fees. It
 * opens with a few sentences the manager writes here, and may single out one
 * source to show what that patron's money covered. Until the budget is closed
 * the paper is marked as a draft, and the card says so before the download.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/ReportsCard
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileDown, FileText } from "lucide-react";

import { useIsOnline } from "@/shared/lib/dom/useIsOnline";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { useSavePatronSummary } from "../../api/finance.queries";
import { FinanceService } from "../../api/finance.service";
import { toastFinanceError } from "../../lib/financeErrors";
import type { ProjectBudgetDTO, ReportAudience } from "../../types/finance.dto";

/** The server's limit on the patron report's opening sentences. */
const SUMMARY_MAX_LENGTH = 1500;

interface ReportsCardProps {
  readonly projectId: string;
  readonly budget: ProjectBudgetDTO;
}

export function ReportsCard({ projectId, budget }: ReportsCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const isOnline = useIsOnline();
  const saveSummary = useSavePatronSummary(projectId);
  const saved = budget.budget?.patron_summary ?? "";
  const [summary, setSummary] = useState(saved);
  const [highlight, setHighlight] = useState("");
  const [downloading, setDownloading] = useState<ReportAudience | null>(null);

  const moneySources = budget.fundings.filter((funding) => funding.brings_money);
  const isClosed = budget.budget?.status === "CLOSED";
  const isDirty = summary.trim() !== saved.trim();

  const download = async (audience: ReportAudience): Promise<void> => {
    setDownloading(audience);
    try {
      await FinanceService.downloadReport(
        projectId,
        audience,
        audience === "patron" && highlight ? highlight : undefined,
      );
    } catch (error) {
      toastFinanceError(error, t, t("finance.download.error", "Nie udało się pobrać dokumentu."));
    } finally {
      setDownloading(null);
    }
  };

  const save = (): void => {
    saveSummary.mutate(summary.trim(), {
      onSuccess: () => toast.success(t("finance.reports.summary_saved", "Zapisano opis dla mecenasa.")),
      onError: (error) =>
        toastFinanceError(error, t, t("finance.reports.summary_error", "Nie udało się zapisać opisu.")),
    });
  };

  return (
    <SectionCard
      as="h2"
      icon={<FileText size={15} aria-hidden="true" />}
      title={t("finance.reports.title", "Raporty")}
      bodyClassName="gap-5"
    >
      <div className="flex flex-col gap-2">
        <Eyebrow color="muted">{t("finance.reports.board", "Dla zarządu")}</Eyebrow>
        <Text size="sm" color="graphite">
          {t(
            "finance.reports.board_hint",
            "Cały budżet z nazwiskami: plan i wykonanie, finansowanie, co zostało do zrobienia i do zapłaty, każde honorarium i wydatek.",
          )}
        </Text>
        <Button
          variant="secondary"
          onClick={() => void download("board")}
          isLoading={downloading === "board"}
          leftIcon={<FileDown size={14} aria-hidden="true" />}
        >
          {t("finance.reports.board_action", "Raport dla zarządu (PDF)")}
        </Button>
      </div>

      <div className="flex flex-col gap-3 border-t border-hairline pt-4">
        <Eyebrow color="muted">{t("finance.reports.patron", "Dla mecenasa")}</Eyebrow>
        <Text size="sm" color="graphite">
          {t(
            "finance.reports.patron_hint",
            "Koszt koncertu, na co poszły pieniądze i skąd pochodziły — bez nazwisk i bez pojedynczych honorariów. Kwotę, na którą składają się honoraria mniej niż trzech osób, raport łączy z inną, żeby nie dało się z niej odczytać niczyjego honorarium.",
          )}
        </Text>
        <Textarea
          label={t("finance.reports.summary_label", "Kilka zdań o koncercie")}
          placeholder={t(
            "finance.reports.summary_placeholder",
            "Co zabrzmiało, gdzie, dla ilu słuchaczy — raport zaczyna się od tych zdań.",
          )}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={4}
          maxLength={SUMMARY_MAX_LENGTH}
        />
        {isDirty && (
          <Button
            variant="ghost"
            onClick={save}
            isLoading={saveSummary.isPending}
            disabled={!isOnline}
          >
            {t("finance.reports.summary_save", "Zapisz opis")}
          </Button>
        )}
        {isDirty && !isOnline && (
          <Caption color="muted">
            {t("finance.offline.short", "Brak połączenia — rozliczeń nie zapisuje się offline.")}
          </Caption>
        )}
        {moneySources.length > 0 && (
          <Select
            label={t("finance.reports.highlight_label", "Pokaż, co pokryło źródło")}
            value={highlight}
            onValueChange={setHighlight}
            placeholder={t("finance.reports.highlight_none", "Bez wyróżnienia")}
            clearLabel={t("finance.reports.highlight_none", "Bez wyróżnienia")}
            options={moneySources.map((funding) => ({
              value: funding.source.id,
              label: funding.source.name,
            }))}
          />
        )}
        <Button
          variant="secondary"
          onClick={() => void download("patron")}
          isLoading={downloading === "patron"}
          leftIcon={<FileDown size={14} aria-hidden="true" />}
        >
          {t("finance.reports.patron_action", "Sprawozdanie dla mecenasa (PDF)")}
        </Button>
        {(!isClosed || isDirty) && (
          <Caption color="muted">
            {isDirty
              ? t(
                  "finance.reports.unsaved",
                  "Raport drukuje zapisany opis — zapisz zmiany, zanim go pobierzesz.",
                )
              : t(
                  "finance.reports.draft",
                  "Dopóki budżet nie jest zamknięty, raport nosi znak „wersja robocza”.",
                )}
          </Caption>
        )}
      </div>
    </SectionCard>
  );
}
