/**
 * @file ExpensesPage.tsx
 * @description Wydatki — every cost of the project that is not a person's fee:
 * the venue, travel, printing, rights. One row per vendor's document, with the
 * plan line it is charged to, its files and whether the office has paid it.
 * Everything here is an act — booking, correcting, paying, attaching — and
 * answers at once; there is no draft to save, so nothing waits in a dock.
 * A person is never an expense: whoever invoices for performing or crewing is
 * paid through Honoraria, and the page says so where the mistake is made.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/ExpensesPage
 */

import React, { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Banknote,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Undo2,
} from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import type { ProjectHubContext } from "@/features/projects/ProjectHubLayout";
import { TabLoadingCard } from "@/features/projects/editors/tabs/components/TabLoadingCard";
import { canApproveFinance } from "@/shared/auth/rbac";
import { useIsOnline } from "@/shared/lib/dom/useIsOnline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/composites/DropdownMenu";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useDeleteExpense, useProjectBudget } from "../api/finance.queries";
import { ActSheet } from "../components/ActSheet";
import { BudgetLoadError } from "../components/BudgetLoadError";
import { CostSummaryCard, type CostFigure } from "../components/CostSummaryCard";
import { toastFinanceError } from "../lib/financeErrors";
import { isBudgetWritable } from "../lib/financePresentation";
import { formatAmount, isPositiveAmount } from "../lib/money";
import type { ExpenseRowDTO } from "../types/finance.dto";
import { PaySheet, ReasonSheet } from "./components/ActSheets";
import { ExpenseFilesSheet } from "./components/ExpenseFilesSheet";
import { ExpenseRow } from "./components/ExpenseRow";
import { ExpenseSheet } from "./components/ExpenseSheet";
import { ROW_CONTROL_CLASS } from "./components/RowActionsMenu";

type OpenSheet =
  | { readonly kind: "add" }
  | {
      readonly kind: "edit" | "files" | "pay" | "unpay" | "delete";
      readonly expenseId: string;
    };

interface ExpensesWorkspaceProps {
  readonly projectId: string;
}

function ExpensesWorkspace({ projectId }: ExpensesWorkspaceProps): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isBoard = canApproveFinance(user);
  const isOnline = useIsOnline();
  const query = useProjectBudget(projectId);
  const deleteExpense = useDeleteExpense(projectId);
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [openSheet, setOpenSheet] = useState<OpenSheet | null>(null);

  const budget = query.data;

  // Once, when the expense a warning or a payable pointed at is on screen.
  const focusPresent = Boolean(focusId && budget?.expenses.some((expense) => expense.id === focusId));
  useEffect(() => {
    if (!focusPresent || !focusId) return;
    document
      .getElementById(`expense-row-${focusId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId, focusPresent]);

  if (query.isLoading) {
    return (
      <TabLoadingCard
        icon={<Receipt size={15} aria-hidden="true" />}
        title={t("finance.expenses.title", "Wydatki")}
      />
    );
  }
  if (!budget) return <BudgetLoadError onRetry={() => void query.refetch()} />;

  const status = budget.budget?.status ?? "PLANNING";
  const writable = isBudgetWritable(status);
  const { summary, expenses, lines } = budget;
  const totals = summary.expenses;
  const currency = t("common.currency", "PLN");
  const lineOf = new Map(lines.map((line) => [line.id, line]));
  const blockedReason = !isOnline
    ? t("finance.offline.short", "Brak połączenia — rozliczeń nie zapisuje się offline.")
    : !writable
      ? t("finance.expenses.closed", "Budżet jest zamknięty.")
      : null;

  const figures: CostFigure[] = isPositiveAmount(totals.paid)
    ? [
        {
          key: "paid",
          label: t("finance.summary.paid_all", "Zapłacone"),
          value: formatAmount(totals.paid) ?? "0",
          unit: currency,
          tone: "sage",
        },
        {
          key: "outstanding",
          label: t("finance.summary.outstanding_all", "Do zapłaty"),
          value: formatAmount(totals.outstanding) ?? "0",
          unit: currency,
          tone: "default",
        },
      ]
    : [];

  const find = (expenseId: string): ExpenseRowDTO | undefined =>
    expenses.find((expense) => expense.id === expenseId);
  const opened = openSheet && openSheet.kind !== "add" ? find(openSheet.expenseId) : undefined;
  const close = (): void => setOpenSheet(null);

  const renderMenu = (expense: ExpenseRowDTO): React.JSX.Element => {
    const blocked = blockedReason ?? undefined;
    const open = (kind: "edit" | "files" | "pay" | "unpay" | "delete"): void =>
      setOpenSheet({ kind, expenseId: expense.id });
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={ROW_CONTROL_CLASS}
            aria-label={t("finance.acts.menu_aria", "Działania — {{name}}", {
              name: expense.vendor_name,
            })}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          <DropdownMenuItem
            icon={<Pencil size={14} />}
            onSelect={() => open("edit")}
            disabled={Boolean(blocked)}
            description={blocked}
          >
            {t("finance.expenses.edit", "Edytuj wydatek")}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<Paperclip size={14} />}
            onSelect={() => open("files")}
            description={
              expense.attachments.length > 0
                ? t("finance.expenses.files_count", "Plików: {{count}}", {
                    count: expense.attachments.length,
                  })
                : undefined
            }
          >
            {t("finance.expenses.files", "Pliki")}
          </DropdownMenuItem>
          {!expense.is_paid && (
            <DropdownMenuItem
              icon={<Banknote size={14} />}
              onSelect={() => open("pay")}
              disabled={Boolean(blocked)}
              description={blocked}
            >
              {t("finance.expenses.pay", "Oznacz jako zapłacone")}
            </DropdownMenuItem>
          )}
          {!expense.is_paid && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={<Trash2 size={14} />}
                onSelect={() => open("delete")}
                disabled={Boolean(blocked)}
                description={blocked}
                destructive
              >
                {t("finance.expenses.delete", "Usuń wydatek")}
              </DropdownMenuItem>
            </>
          )}
          {expense.is_paid && (
            <>
              <DropdownMenuSeparator />
              {isBoard ? (
                <DropdownMenuItem
                  icon={<Undo2 size={14} />}
                  onSelect={() => open("unpay")}
                  disabled={Boolean(blocked)}
                  description={blocked}
                  destructive
                >
                  {t("finance.expenses.unpay", "Cofnij zapłatę")}
                </DropdownMenuItem>
              ) : (
                <div className="px-3 py-2">
                  <Caption color="muted">
                    {t(
                      "finance.expenses.board_only",
                      "Cofnięcie zapłaty należy do zarządu. Zapłaconego wydatku nie można usunąć.",
                    )}
                  </Caption>
                </div>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <>
      <div className="w-full space-y-5 pb-24">
        <CostSummaryCard
          title={t("finance.expenses.title", "Wydatki")}
          headlineLabel={t("finance.expenses.headline", "Koszt wydatków")}
          headline={formatAmount(totals.committed) ?? "0"}
          figures={figures}
        />

        <SectionCard
          as="h2"
          scroll
          className="max-h-[70dvh]"
          bodyClassName="p-0 [scrollbar-gutter:stable]"
          icon={<Receipt size={15} aria-hidden="true" />}
          title={t("finance.expenses.list", "Dokumenty")}
          action={
            writable ? (
              <Button
                variant="outline"
                size="sm"
                // Live even offline: the sheet it opens says why it cannot save.
                onClick={() => setOpenSheet({ kind: "add" })}
                leftIcon={<Plus size={14} aria-hidden="true" />}
              >
                {t("finance.expenses.add", "Dodaj wydatek")}
              </Button>
            ) : undefined
          }
        >
          {expenses.length === 0 ? (
            <StatePanel
              variant="inline"
              className="px-5 py-10"
              icon={<Receipt size={22} strokeWidth={1.5} />}
              title={t("finance.expenses.empty", "Brak wydatków")}
              description={t(
                "finance.expenses.empty_desc",
                "Wynajem sali, podróże, druk, prawa do wykonania — każdy koszt, który nie jest honorarium. Honoraria, także fakturowane, są w zakładce Honoraria.",
              )}
            />
          ) : (
            <ul className="divide-y divide-hairline pb-1">
              {expenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  line={expense.budget_line_id ? (lineOf.get(expense.budget_line_id) ?? null) : null}
                  hasPlan={lines.length > 0}
                  isFocused={expense.id === focusId}
                  menu={renderMenu(expense)}
                />
              ))}
            </ul>
          )}
        </SectionCard>

        {expenses.length > 0 && (
          <Text size="xs" color="muted" className="px-1">
            {t(
              "finance.expenses.people_note",
              "Honoraria — także fakturowane przez firmę — rozlicza się w zakładce Honoraria, nie tutaj.",
            )}
          </Text>
        )}
      </div>

      {openSheet?.kind === "add" && (
        <ExpenseSheet projectId={projectId} lines={lines} onClose={close} />
      )}
      {openSheet?.kind === "edit" && opened && (
        <ExpenseSheet projectId={projectId} expense={opened} lines={lines} onClose={close} />
      )}
      {openSheet?.kind === "files" && opened && (
        <ExpenseFilesSheet
          projectId={projectId}
          expense={opened}
          writable={writable}
          onClose={close}
        />
      )}
      {openSheet?.kind === "pay" && opened && (
        <PaySheet
          projectId={projectId}
          kind="expense"
          targets={[{ id: opened.id, label: opened.vendor_name }]}
          onClose={close}
        />
      )}
      {openSheet?.kind === "unpay" && opened && (
        <ReasonSheet
          projectId={projectId}
          mode="unpay"
          targetId={opened.id}
          subtitle={opened.vendor_name}
          onClose={close}
        />
      )}
      {openSheet?.kind === "delete" && opened && (
        <ActSheet
          isOpen
          destructive
          onClose={close}
          title={t("finance.expenses.delete_title", "Usuń wydatek")}
          subtitle={opened.vendor_name}
          confirmLabel={t("finance.expenses.delete_confirm", "Usuń")}
          isPending={deleteExpense.isPending}
          onConfirm={() =>
            deleteExpense.mutate(opened.id, {
              onSuccess: () => {
                toast.success(t("finance.expenses.deleted", "Usunięto wydatek."));
                close();
              },
              onError: (error) =>
                toastFinanceError(error, t, t("finance.expenses.delete_error", "Nie udało się usunąć wydatku.")),
            })
          }
        >
          <Text size="sm" color="graphite">
            {t(
              "finance.expenses.delete_desc",
              "Wydatek zniknie z budżetu razem ze swoją kwotą. Wpis o usunięciu zostaje w historii budżetu.",
            )}
          </Text>
        </ActSheet>
      )}
    </>
  );
}

export default function ExpensesPage(): React.JSX.Element {
  const { project } = useOutletContext<ProjectHubContext>();
  return <ExpensesWorkspace projectId={String(project.id)} />;
}
