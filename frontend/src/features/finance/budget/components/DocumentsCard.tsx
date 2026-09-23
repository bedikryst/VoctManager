/**
 * @file DocumentsCard.tsx
 * @description What leaves the panel for the office: the project's ledger as a
 * CSV, and every issued contract in one ZIP. Both are fetched through the
 * signed-in session and saved from memory — the ZIP is packed by a background
 * task and streamed by a manager-only view, never left at a public address.
 * The ZIP is offered only once a contract exists; before that there is
 * nothing to pack, and the card says so instead of offering a button that
 * would answer "no contracts".
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/DocumentsCard
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Archive, FileSpreadsheet, FolderDown } from "lucide-react";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useContractsZip, ZipExportError } from "../../api/finance.queries";
import { FinanceService } from "../../api/finance.service";
import { financeErrorCopy, toastFinanceError } from "../../lib/financeErrors";

interface DocumentsCardProps {
  readonly projectId: string;
  /** Live contracts on the ledger — what the ZIP would hold. */
  readonly contractCount: number;
}

export function DocumentsCard({
  projectId,
  contractCount,
}: DocumentsCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const zip = useContractsZip(projectId);
  const [isExporting, setIsExporting] = useState(false);

  const exportCsv = async (): Promise<void> => {
    setIsExporting(true);
    try {
      await FinanceService.downloadProjectLedger(projectId);
    } catch (error) {
      toastFinanceError(error, t, t("finance.download.error", "Nie udało się pobrać dokumentu."));
    } finally {
      setIsExporting(false);
    }
  };

  const exportZip = async (): Promise<void> => {
    const toastId = toast.loading(t("finance.zip.working", "Pakuję umowy…"));
    try {
      const count = await zip.run();
      toast.success(t("finance.zip.done", "Pobrano umowy: {{count}}.", { count }), { id: toastId });
    } catch (error) {
      if (error instanceof ZipExportError) {
        toast.error(t("finance.zip.failed", "Nie udało się przygotować paczki"), {
          id: toastId,
          description: financeErrorCopy(t, error.code) ?? undefined,
        });
        return;
      }
      toastFinanceError(error, t, t("finance.zip.error", "Nie udało się pobrać paczki umów."), toastId);
    }
  };

  return (
    <SectionCard
      as="h2"
      icon={<FolderDown size={15} aria-hidden="true" />}
      title={t("finance.overview.documents", "Dla biura")}
      bodyClassName="gap-5"
    >
      <div className="flex flex-col gap-2">
        <Text size="sm" color="graphite">
          {t(
            "finance.overview.csv_hint",
            "Każde honorarium wliczone w koszt: odbiorca, forma, numer umowy, kwoty i daty. Otwiera się w Excelu.",
          )}
        </Text>
        <Button
          variant="secondary"
          onClick={() => void exportCsv()}
          isLoading={isExporting}
          leftIcon={<FileSpreadsheet size={14} aria-hidden="true" />}
        >
          {t("finance.overview.csv", "Rozliczenie (CSV)")}
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline pt-4">
        {contractCount > 0 ? (
          <>
            <Text size="sm" color="graphite">
              {t("finance.overview.zip_hint", "Wystawione umowy z aneksami, po jednym PDF na osobę: {{count}}.", {
                count: contractCount,
              })}
            </Text>
            <Button
              variant="secondary"
              onClick={() => void exportZip()}
              isLoading={zip.state === "working"}
              leftIcon={<Archive size={14} aria-hidden="true" />}
            >
              {t("finance.overview.zip", "Umowy (ZIP)")}
            </Button>
          </>
        ) : (
          <Caption color="muted">
            {t(
              "finance.overview.zip_empty",
              "Paczka umów pojawi się, gdy wystawisz pierwszą umowę w Honorariach.",
            )}
          </Caption>
        )}
      </div>
    </SectionCard>
  );
}
