/**
 * @file FeesPage.tsx
 * @description Honoraria — the project's fee ledger, in three cards: the cast,
 * the crew, and payees from outside both. Two kinds of change live here and
 * they behave differently on purpose:
 *  - amounts and forms are DRAFTS. They preview in the rail and the rows, and
 *    the shared save bar commits them as one atomic batch, so a whole repricing
 *    can be looked at before it lands.
 *  - issuing a contract and marking a fee paid are ACTS. They happen at once,
 *    per row or on a selection, and a row whose price is still a draft cannot
 *    take one — it would settle the old price.
 * Nothing is queued offline: while the device has no network the save bar and
 * every act are disabled, and each says why.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/FeesPage
 */

import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, UserPlus, Users, Wallet, Wrench } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import type { ProjectHubContext } from "@/features/projects/ProjectHubLayout";
import { TabLoadingCard } from "@/features/projects/editors/tabs/components/TabLoadingCard";
import { canApproveFinance } from "@/shared/auth/rbac";
import { useIsOnline } from "@/shared/lib/dom/useIsOnline";
import { useNow } from "@/shared/lib/dom/useNow";
import { EditorActionBar } from "@/shared/ui/composites/EditorActionBar";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { useIssueContract } from "../api/finance.queries";
import { FinanceService } from "../api/finance.service";
import { CostSummaryCard, type CostFigure } from "../components/CostSummaryCard";
import { toastFinanceError } from "../lib/financeErrors";
import { categoryLabel } from "../lib/financePresentation";
import { canIssue, canPay, isSelectable } from "../lib/ledgerActs";
import { isPriceEditable } from "../lib/feeDraft";
import { formatAmount, formatGrosze, isPositiveAmount, toGrosze } from "../lib/money";
import { isFeeCategory, type LedgerRowDTO } from "../types/finance.dto";
import { FeeDetailsSheet } from "./components/FeeDetailsSheet";
import { FeeRow } from "./components/FeeRow";
import { HoursSheet, PaySheet, ReasonSheet, SignSheet } from "./components/ActSheets";
import { LedgerCard } from "./components/LedgerCard";
import { OneOffPayeeSheet } from "./components/OneOffPayeeSheet";
import { RowActionsMenu } from "./components/RowActionsMenu";
import { SelectionBar } from "./components/SelectionBar";
import { StandardRateField } from "./components/StandardRateField";
import { useFeeLedger } from "./useFeeLedger";

type OpenAct =
  | { readonly kind: "pay"; readonly rows: readonly LedgerRowDTO[] }
  | { readonly kind: "unpay" | "annul" | "sign" | "hours" | "details"; readonly row: LedgerRowDTO }
  | { readonly kind: "one_off" };

const MINUTE_MS = 60_000;

interface FeesWorkspaceProps {
  readonly projectId: string;
  readonly onDirtyStateChange?: (isDirty: boolean) => void;
}

function FeesWorkspace({
  projectId,
  onDirtyStateChange,
}: FeesWorkspaceProps): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isBoard = canApproveFinance(user);
  const isOnline = useIsOnline();
  const ledger = useFeeLedger(projectId, onDirtyStateChange);
  const issueContract = useIssueContract(projectId);
  const [searchParams] = useSearchParams();
  const focusKey = searchParams.get("focus");

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [openAct, setOpenAct] = useState<OpenAct | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  // One clock for the whole ledger, quantised to the minute: "the concert has
  // passed" is an answer about now, and the rows below must not disagree.
  const now = useNow(MINUTE_MS);
  const nowMinute = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS;
  const concertAt = ledger.budget ? Date.parse(ledger.budget.project.date_time) : Number.NaN;
  const concertPassed = Number.isFinite(concertAt) && concertAt <= nowMinute;

  const { rows, summary, isDirty } = ledger;

  // A selection only holds rows that can still take a bulk act; a row that
  // got paid or contracted under it drops out.
  useEffect(() => {
    setSelected((previous) => {
      const reachable = new Set(rows.filter(isSelectable).map((row) => row.key));
      const next = new Set([...previous].filter((key) => reachable.has(key)));
      return next.size === previous.size ? previous : next;
    });
  }, [rows]);

  // A warning names its row by key; a payable on the portfolio page knows only
  // its cost item. Either reaches the same row.
  const isFocus = (row: LedgerRowDTO): boolean =>
    focusKey !== null && (row.key === focusKey || row.cost_item_id === focusKey);
  const focusedKey = rows.find(isFocus)?.key ?? null;

  useEffect(() => {
    if (!focusedKey) return;
    document
      .getElementById(`fee-row-${focusedKey}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusedKey]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.key)),
    [rows, selected],
  );
  const issuable = selectedRows.filter(canIssue);
  const payable = selectedRows.filter(canPay);

  const offlineReason = isOnline
    ? null
    : t("finance.offline.short", "Brak połączenia — rozliczeń nie zapisuje się offline.");

  const toggle = (key: string): void =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const issueOne = (row: LedgerRowDTO): void => {
    if (!row.cost_item_id) return;
    issueContract.mutate(row.cost_item_id, {
      onSuccess: () =>
        toast.success(t("finance.issue.done_one", "Wystawiono umowę: {{name}}.", {
          name: row.payee_name,
        })),
      onError: (error) =>
        toastFinanceError(error, t, t("finance.issue.error", "Nie udało się wystawić umowy.")),
    });
  };

  // Sequential, not parallel: each contract takes the next number in its
  // series, and a refusal halfway should stop the run with the rest untouched.
  const issueSelected = async (): Promise<void> => {
    setIsIssuing(true);
    const toastId = toast.loading(t("finance.issue.working", "Wystawiam umowy…"));
    let issued = 0;
    try {
      for (const row of issuable) {
        if (!row.cost_item_id) continue;
        await issueContract.mutateAsync(row.cost_item_id);
        issued += 1;
      }
      toast.success(t("finance.issue.done_many", "Wystawiono umowy: {{count}}.", { count: issued }), {
        id: toastId,
      });
      setSelected(new Set());
    } catch (error) {
      toastFinanceError(
        error,
        t,
        t("finance.issue.partial", "Wystawione umowy: {{done}} z {{total}}. Pozostałe czekają.", {
          done: issued,
          total: issuable.length,
        }),
        toastId,
      );
    } finally {
      setIsIssuing(false);
    }
  };

  const download = (run: () => Promise<void>): void => {
    void run().catch((error: unknown) =>
      toastFinanceError(
        error,
        t,
        t("finance.download.error", "Nie udało się pobrać dokumentu."),
      ),
    );
  };

  if (ledger.isLoading) {
    return (
      <TabLoadingCard
        icon={<Wallet size={15} aria-hidden="true" />}
        title={t("finance.fees.title", "Honoraria")}
      />
    );
  }

  if (ledger.isError || !ledger.budget) {
    return (
      <StatePanel
        tone="danger"
        icon={<AlertTriangle size={28} strokeWidth={1.5} />}
        title={t("finance.load_error.title", "Nie udało się wczytać budżetu.")}
        description={t(
          "finance.load_error.description",
          "Serwer nie odpowiedział. Spróbuj ponownie za chwilę.",
        )}
        actions={
          <Button
            variant="secondary"
            onClick={ledger.refetch}
            leftIcon={<RefreshCw size={14} aria-hidden="true" />}
          >
            {t("common.actions.retry", "Ponów")}
          </Button>
        }
      />
    );
  }

  // Honoraria reads the fees' share of the budget; expenses have a tab of their own.
  const server = ledger.budget.summary;
  const serverFees = server.fees;
  const currency = t("common.currency", "PLN");
  const committedHeadline = isDirty
    ? formatGrosze(summary.committed)
    : (formatAmount(serverFees.committed) ?? "0");

  const categoryFigures: CostFigure[] = isDirty
    ? [...summary.byCategory.entries()]
        .filter(([, grosze]) => grosze > 0)
        .map(([category, grosze]) => ({
          key: category,
          label: categoryLabel(t, category),
          value: formatGrosze(grosze),
          unit: currency,
          tone: "default" as const,
        }))
    : server.by_category
        .filter((total) => isFeeCategory(total.category) && isPositiveAmount(total.committed))
        .map((total) => ({
          key: total.category,
          label: categoryLabel(t, total.category),
          value: formatAmount(total.committed) ?? "0",
          unit: currency,
          tone: "default" as const,
        }));

  const unpriced = isDirty ? summary.unpriced : server.unpriced;
  const figures: CostFigure[] = [
    // One category is the headline again; the split earns a slot only as a split.
    ...(categoryFigures.length > 1 ? categoryFigures : []),
    ...(isPositiveAmount(serverFees.paid)
      ? [
          {
            key: "paid",
            label: t("finance.summary.paid", "Wypłacone"),
            value: formatAmount(serverFees.paid) ?? "0",
            unit: currency,
            tone: "sage" as const,
          },
          {
            key: "outstanding",
            label: t("finance.summary.outstanding", "Do wypłaty"),
            // A draft never touches a paid fee, so what is owed after the save
            // is the previewed cost less what the server says is paid.
            value: isDirty
              ? formatGrosze(Math.max(summary.committed - (toGrosze(serverFees.paid) ?? 0), 0))
              : (formatAmount(serverFees.outstanding) ?? "0"),
            unit: currency,
            tone: "default" as const,
          },
        ]
      : []),
    ...(isPositiveAmount(server.in_kind)
      ? [
          {
            key: "in_kind",
            label: t("finance.summary.in_kind", "Wkład wolontariuszy"),
            value: formatAmount(server.in_kind) ?? "0",
            unit: currency,
            tone: "default" as const,
          },
        ]
      : []),
    ...(unpriced > 0
      ? [
          {
            key: "unpriced",
            label: t("finance.summary.unpriced", "Bez stawki"),
            value: String(unpriced),
            unit: t("common.people_short", "os."),
            tone: "gold" as const,
          },
        ]
      : []),
  ];

  const hasPlan = ledger.budget.lines.length > 0;

  const renderRow = (row: LedgerRowDTO): React.JSX.Element => {
    const preview = ledger.previewOf(row);
    const blockedReason =
      offlineReason ??
      (preview.isPending || preview.isInvalid
        ? t("finance.acts.blocked_by_draft", "Najpierw zapisz albo odrzuć zmianę stawki.")
        : null);
    return (
      <FeeRow
        key={row.key}
        row={row}
        preview={preview}
        concertPassed={concertPassed}
        outsidePlan={
          hasPlan && row.counted && row.budget_line_id === null && row.form !== "VOLUNTEER"
        }
        isFocused={row.key === focusedKey}
        selection={
          isSelectable(row)
            ? { selected: selected.has(row.key), onToggle: () => toggle(row.key) }
            : null
        }
        onAmountChange={(value) => ledger.setAmount(row, value)}
        menu={
          <RowActionsMenu
            row={row}
            currentForm={preview.next.form}
            formEditable={isPriceEditable(row)}
            blockedReason={blockedReason}
            isBoard={isBoard}
            acts={{
              onFormChange: (form) => ledger.setForm(row, form),
              onDetails: () => setOpenAct({ kind: "details", row }),
              onIssue: () => issueOne(row),
              onDownloadContract: () => {
                if (row.contract) {
                  const id = row.contract.id;
                  download(() => FinanceService.downloadContract(id));
                }
              },
              onDownloadBill: () => {
                if (row.contract) {
                  const id = row.contract.id;
                  download(() => FinanceService.downloadBill(id));
                }
              },
              onSign: () => setOpenAct({ kind: "sign", row }),
              onHours: () => setOpenAct({ kind: "hours", row }),
              onPay: () => setOpenAct({ kind: "pay", rows: [row] }),
              onUnpay: () => setOpenAct({ kind: "unpay", row }),
              onAnnul: () => setOpenAct({ kind: "annul", row }),
            }}
          />
        }
      />
    );
  };

  const unpricedIn = (sectionRows: readonly LedgerRowDTO[]): number =>
    sectionRows.filter((row) => row.billable && ledger.previewOf(row).next.grosze === null).length;

  const closeAct = (): void => setOpenAct(null);

  return (
    <>
      <div className="w-full space-y-5 pb-24">
        <CostSummaryCard
          title={t("finance.fees.title", "Honoraria")}
          headlineLabel={t("finance.fees.headline", "Koszt honorariów")}
          headline={committedHeadline}
          figures={figures}
          note={
            isDirty
              ? t("finance.fees.preview_note", "Podgląd: tak będzie po zapisaniu zmian.")
              : undefined
          }
        />

        <LedgerCard
          title={t("finance.fees.cast", "Obsada")}
          icon={<Users size={15} aria-hidden="true" />}
          rowCount={ledger.sections.cast.length}
          unpricedCount={unpricedIn(ledger.sections.cast)}
          emptyTitle={t("finance.fees.cast_empty", "Brak obsady")}
          emptyDescription={t(
            "finance.fees.cast_empty_desc",
            "Honoraria pojawią się tutaj, gdy dodasz muzyków w zakładce Obsada.",
          )}
          toolbar={
            ledger.repriceable("cast") > 0 ? (
              <StandardRateField
                value={ledger.standardRateOf("cast")}
                affectedCount={ledger.repriceable("cast")}
                isInvalid={ledger.isStandardRateInvalid("cast")}
                onChange={(value) => ledger.setStandardRate("cast", value)}
              />
            ) : undefined
          }
        >
          {ledger.sections.cast.map(renderRow)}
        </LedgerCard>

        <LedgerCard
          title={t("finance.fees.crew", "Ekipa")}
          icon={<Wrench size={15} aria-hidden="true" />}
          rowCount={ledger.sections.crew.length}
          unpricedCount={unpricedIn(ledger.sections.crew)}
          emptyTitle={t("finance.fees.crew_empty", "Brak ekipy")}
          emptyDescription={t(
            "finance.fees.crew_empty_desc",
            "Stawki współpracowników pojawią się tutaj, gdy zatrudnisz ich w zakładce Ekipa.",
          )}
          toolbar={
            ledger.repriceable("crew") > 0 ? (
              <StandardRateField
                value={ledger.standardRateOf("crew")}
                affectedCount={ledger.repriceable("crew")}
                isInvalid={ledger.isStandardRateInvalid("crew")}
                onChange={(value) => ledger.setStandardRate("crew", value)}
              />
            ) : undefined
          }
        >
          {ledger.sections.crew.map(renderRow)}
        </LedgerCard>

        <LedgerCard
          title={t("finance.fees.one_off", "Spoza obsady")}
          icon={<UserPlus size={15} aria-hidden="true" />}
          rowCount={ledger.sections.oneOff.length}
          unpricedCount={unpricedIn(ledger.sections.oneOff)}
          emptyTitle={t("finance.fees.one_off_empty", "Nikt spoza obsady")}
          emptyDescription={t(
            "finance.fees.one_off_empty_desc",
            "Ktoś, komu fundacja płaci, choć nie występuje ani nie pracuje przy koncercie — np. tłumacz tekstów programu.",
          )}
          action={
            <Button
              variant="outline"
              size="sm"
              // Live even offline: the sheet it opens says why it cannot save.
              onClick={() => setOpenAct({ kind: "one_off" })}
              leftIcon={<UserPlus size={14} aria-hidden="true" />}
            >
              {t("finance.fees.add_one_off", "Dodaj osobę")}
            </Button>
          }
        >
          {ledger.sections.oneOff.map(renderRow)}
        </LedgerCard>
      </div>

      <EditorActionBar
        isOpen={isDirty}
        description={
          offlineReason ??
          t(
            "finance.draft.description",
            "Zmiany stawek. Wystawianie umów i wypłaty poczekają na zapis.",
          )
        }
        onCancel={ledger.reset}
        onConfirm={() => void ledger.save()}
        isLoading={ledger.isSaving}
        isConfirmDisabled={!isOnline}
      />

      <SelectionBar
        isOpen={!isDirty && selected.size > 0}
        selectedCount={selected.size}
        issuableCount={issuable.length}
        payableCount={payable.length}
        blockedReason={offlineReason}
        isWorking={isIssuing}
        onIssue={() => void issueSelected()}
        onPay={() => setOpenAct({ kind: "pay", rows: payable })}
        onClear={() => setSelected(new Set())}
      />

      {openAct?.kind === "pay" && (
        <PaySheet
          projectId={projectId}
          kind="fee"
          targets={openAct.rows.flatMap((row) =>
            row.cost_item_id ? [{ id: row.cost_item_id, label: row.payee_name }] : [],
          )}
          onClose={closeAct}
        />
      )}
      {openAct?.kind === "unpay" && openAct.row.cost_item_id && (
        <ReasonSheet
          projectId={projectId}
          mode="unpay"
          targetId={openAct.row.cost_item_id}
          subtitle={openAct.row.payee_name}
          onClose={closeAct}
        />
      )}
      {openAct?.kind === "annul" && openAct.row.contract && (
        <ReasonSheet
          projectId={projectId}
          mode="annul"
          targetId={openAct.row.contract.id}
          subtitle={`${openAct.row.contract.number} · ${openAct.row.payee_name}`}
          onClose={closeAct}
        />
      )}
      {openAct?.kind === "sign" && (
        <SignSheet projectId={projectId} row={openAct.row} onClose={closeAct} />
      )}
      {openAct?.kind === "hours" && (
        <HoursSheet projectId={projectId} row={openAct.row} onClose={closeAct} />
      )}
      {openAct?.kind === "details" && (
        <FeeDetailsSheet
          projectId={projectId}
          row={openAct.row}
          lines={ledger.budget.lines}
          onClose={closeAct}
        />
      )}
      {openAct?.kind === "one_off" && (
        <OneOffPayeeSheet projectId={projectId} onClose={closeAct} />
      )}
    </>
  );
}

export default function FeesPage(): React.JSX.Element {
  const { project, setDirty } = useOutletContext<ProjectHubContext>();
  return <FeesWorkspace projectId={String(project.id)} onDirtyStateChange={setDirty} />;
}
