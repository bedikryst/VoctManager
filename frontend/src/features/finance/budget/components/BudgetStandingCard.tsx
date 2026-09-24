/**
 * @file BudgetStandingCard.tsx
 * @description Where the budget stands — open without a plan, being planned,
 * approved, or closed — what that state allows, and the board's acts that move
 * it: approve the plan, open it for a correction, close the books, reopen them.
 * Each is one step, and a step back always states its reason, which the
 * history keeps. A budget with no kosztorys has nothing to approve and closes
 * straight away, unless an awarded grant funds the project: a grant is settled
 * against an approved kosztorys, so the card asks for one instead.
 * A manager outside the board sees the state and one sentence saying who acts
 * on it, never a button that would answer 403. Closing is refused by the
 * server while anything is unsettled; the card says so before the click.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/budget/components/BudgetStandingCard
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Lock, LockOpen, Stamp, Undo2 } from "lucide-react";

import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { useApproveBudget, useCloseBudget, useReopenBudget } from "../../api/finance.queries";
import { ActSheet } from "../../components/ActSheet";
import { toastFinanceError } from "../../lib/financeErrors";
import { budgetStatusName, formatFinanceDate } from "../../lib/financePresentation";
import { formatAmount, isPositiveAmount } from "../../lib/money";
import type { BudgetStatus, ProjectBudgetDTO } from "../../types/finance.dto";

type OpenAct = "approve" | "close" | "reopen";

interface BudgetStandingCardProps {
  readonly projectId: string;
  readonly budget: ProjectBudgetDTO;
  readonly isBoard: boolean;
}

export function BudgetStandingCard({
  projectId,
  budget,
  isBoard,
}: BudgetStandingCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const approve = useApproveBudget(projectId);
  const close = useCloseBudget(projectId);
  const reopen = useReopenBudget(projectId);
  const [openAct, setOpenAct] = useState<OpenAct | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();

  const status: BudgetStatus = budget.budget?.status ?? "PLANNING";
  const { summary } = budget;
  const currency = t("common.currency", "PLN");
  const dayOf = (moment: string | null | undefined): string =>
    moment ? formatFinanceDate(moment.slice(0, 10), i18n.language) : "";

  const unsettled =
    isPositiveAmount(summary.outstanding) || summary.unpriced > 0 || summary.orphaned > 0;
  const hasPlan = budget.lines.length > 0;
  const closesWithoutPlan = status === "PLANNING" && !hasPlan && !budget.plan_required;

  const planningDescription = hasPlan
    ? t(
        "finance.standing.planning",
        "Kosztorys można zmieniać. Zarząd zatwierdza go, gdy plan jest gotowy — koszty zapisuje się w każdym stanie oprócz zamkniętego.",
      )
    : budget.plan_required
      ? t(
          "finance.standing.grant_needs_plan",
          "Projekt ma przyznany grant, a grant rozlicza się według kosztorysu. Dodaj pozycje na karcie Kosztorys — zarząd zatwierdzi go przed zamknięciem budżetu.",
        )
      : t(
          "finance.standing.open",
          "Bez kosztorysu. Koszty i zapłaty zapisuje się normalnie; kosztorys jest potrzebny, gdy wymaga go grant. Gdy wszystko jest rozliczone, zarząd zamyka budżet.",
        );

  const description =
    status === "PLANNING"
      ? planningDescription
      : status === "APPROVED"
        ? t(
            "finance.standing.approved",
            "Zatwierdzony {{date}}. Kosztorys jest zablokowany; koszty i zapłaty zapisuje się dalej.",
            { date: dayOf(budget.budget?.approved_at) },
          )
        : t(
            "finance.standing.closed",
            "Zamknięty {{date}}. Budżetu nie zmienia już nic, dopóki zarząd go nie otworzy.",
            { date: dayOf(budget.budget?.closed_at) },
          );

  const finish = (message: string): void => {
    toast.success(message);
    setOpenAct(null);
    setReason("");
  };

  const onError = (error: unknown): void =>
    toastFinanceError(error, t, t("finance.standing.error", "Nie udało się zmienić stanu budżetu."));

  const confirmReopen = (): void => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError(t("finance.reason.required", "Podaj powód — trafi do historii budżetu."));
      return;
    }
    reopen.mutate(trimmed, {
      onSuccess: () => finish(t("finance.standing.reopened", "Budżet otwarty.")),
      onError,
    });
  };

  const closeAct = (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpenAct("close")}
        disabled={unsettled}
        leftIcon={<Lock size={14} aria-hidden="true" />}
      >
        {t("finance.standing.close", "Zamknij budżet")}
      </Button>
      {unsettled && (
        <Caption color="muted">
          {t(
            "finance.standing.close_blocked",
            "Zamknąć można, gdy wszystko jest zapłacone, każdy ma stawkę i nie zostało honorarium poza obsadą.",
          )}
        </Caption>
      )}
    </>
  );

  return (
    <SectionCard
      as="h2"
      icon={<Stamp size={15} aria-hidden="true" />}
      title={t("finance.standing.title", "Stan budżetu")}
      bodyClassName="gap-4"
    >
      <div className="flex flex-col gap-1">
        <Text as="span" size="base" weight="semibold">
          {budgetStatusName(t, status, hasPlan)}
        </Text>
        <Text as="span" size="sm" color="graphite">
          {description}
        </Text>
      </div>

      {isBoard ? (
        <div className="flex flex-col gap-2">
          {status === "PLANNING" && hasPlan && (
            <Button
              variant="secondary"
              onClick={() => setOpenAct("approve")}
              leftIcon={<Lock size={14} aria-hidden="true" />}
            >
              {t("finance.standing.approve", "Zatwierdź kosztorys")}
            </Button>
          )}
          {closesWithoutPlan && closeAct}
          {status === "APPROVED" && (
            <>
              {closeAct}
              <Button
                variant="ghost"
                onClick={() => setOpenAct("reopen")}
                leftIcon={<LockOpen size={14} aria-hidden="true" />}
              >
                {t("finance.standing.reopen_plan", "Otwórz kosztorys do korekty")}
              </Button>
            </>
          )}
          {status === "CLOSED" && (
            <Button
              variant="ghost"
              onClick={() => setOpenAct("reopen")}
              leftIcon={<Undo2 size={14} aria-hidden="true" />}
            >
              {t("finance.standing.reopen_books", "Otwórz budżet ponownie")}
            </Button>
          )}
        </div>
      ) : (
        <Caption color="muted">
          {t(
            "finance.standing.board_only",
            "Zatwierdza, otwiera do korekty i zamyka zarząd.",
          )}
        </Caption>
      )}

      {openAct === "approve" && (
        <ActSheet
          isOpen
          onClose={() => setOpenAct(null)}
          title={t("finance.standing.approve", "Zatwierdź kosztorys")}
          confirmLabel={t("finance.standing.approve_confirm", "Zatwierdź")}
          isPending={approve.isPending}
          onConfirm={() =>
            approve.mutate(undefined, {
              onSuccess: () => finish(t("finance.standing.approved_done", "Kosztorys zatwierdzony.")),
              onError,
            })
          }
        >
          <Text size="sm" color="graphite">
            {t(
              "finance.standing.approve_desc",
              "Plan na {{amount}} {{currency}} zostanie zablokowany. Zmienić go będzie można tylko po otwarciu do korekty, z podaniem powodu.",
              { amount: formatAmount(summary.planned) ?? "0", currency },
            )}
          </Text>
        </ActSheet>
      )}

      {openAct === "close" && (
        <ActSheet
          isOpen
          onClose={() => setOpenAct(null)}
          title={t("finance.standing.close", "Zamknij budżet")}
          confirmLabel={t("finance.standing.close_confirm", "Zamknij")}
          isPending={close.isPending}
          onConfirm={() =>
            close.mutate(undefined, {
              onSuccess: () => finish(t("finance.standing.closed_done", "Budżet zamknięty.")),
              onError,
            })
          }
        >
          <Text size="sm" color="graphite">
            {t(
              "finance.standing.close_desc",
              "Koszt projektu: {{amount}} {{currency}}, w całości zapłacony. Po zamknięciu nic w budżecie się nie zmieni, dopóki zarząd go nie otworzy.",
              { amount: formatAmount(summary.committed) ?? "0", currency },
            )}
          </Text>
        </ActSheet>
      )}

      {openAct === "reopen" && (
        <ActSheet
          isOpen
          destructive
          onClose={() => setOpenAct(null)}
          title={
            status === "CLOSED"
              ? t("finance.standing.reopen_books", "Otwórz budżet ponownie")
              : t("finance.standing.reopen_plan", "Otwórz kosztorys do korekty")
          }
          confirmLabel={t("finance.standing.reopen_confirm", "Otwórz")}
          isPending={reopen.isPending}
          onConfirm={confirmReopen}
        >
          <Text size="sm" color="graphite">
            {status === "CLOSED"
              ? budget.budget?.approved_at
                ? t(
                    "finance.standing.reopen_books_desc",
                    "Budżet wróci do stanu zatwierdzonego: znów będzie można zapisywać koszty i zapłaty.",
                  )
                : t(
                    "finance.standing.reopen_books_open_desc",
                    "Budżet znów będzie otwarty: będzie można zapisywać koszty i zapłaty.",
                  )
              : t(
                  "finance.standing.reopen_plan_desc",
                  "Kosztorys wróci do planowania i będzie go można zmienić. Potem zarząd zatwierdza go ponownie.",
                )}
          </Text>
          <Textarea
            label={t("finance.reason.label", "Powód")}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(undefined);
            }}
            error={reasonError}
            rows={3}
            maxLength={1000}
          />
        </ActSheet>
      )}
    </SectionCard>
  );
}
