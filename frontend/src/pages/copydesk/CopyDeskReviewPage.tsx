/**
 * @file CopyDeskReviewPage.tsx
 * @description `/redakcja/przeglad` — the reviewer's queue: everything an
 * editor is waiting on a verdict for, and the pile of decisions the repository
 * has not yet been told about. Default export required for the lazy route.
 *
 * The address was promised by stage B in three places — the push, the digest
 * e-mail's CTA and the bell's deep link — and this is what it finally answers.
 *
 * Two things the surface has to keep saying, because getting either wrong makes
 * it lie:
 *
 *  - **Accepting is not publishing.** It marks a value as one the reviewer
 *    means to commit. The road to the site is `copy:apply` → `git diff` →
 *    commit, and `PatchBand` is what keeps that visible after the queue empties.
 *  - **Two proposals on one field are not a conflict to resolve automatically.**
 *    §6b keeps both, the queue prints both, and accepting one leaves the other
 *    open — which the field says, because nothing else on screen could.
 *
 * Reviewing is `is_staff` and not the copy-desk capability: accepting is not an
 * opinion about wording, it is the decision to put a value into the repository.
 * An editor who reaches this address is told that rather than shown a queue
 * they could look at and never settle.
 * @architecture Enterprise SaaS 2026
 * @module pages/copydesk/CopyDeskReviewPage
 */

import React, { useCallback, useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Inbox, ShieldCheck, TriangleAlert } from "lucide-react";

import { PatchBand } from "@/features/copydesk/components/PatchBand";
import { QueueField } from "@/features/copydesk/components/QueueField";
import {
  useCopyDeskQueue,
  useReviewProposal,
} from "@/features/copydesk/api/copydesk.queries";
import { buildQueue, countQueue } from "@/features/copydesk/lib/queue";
import {
  familyIcon,
  formatCount,
  scopeFamily,
} from "@/features/copydesk/lib/scopeGroups";
import type { CopyDeskOutletContext } from "@/widgets/copy-desk-shell/CopyDeskShell";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { StatLine, type StatLineItem } from "@/shared/ui/composites/StatLine";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";

export default function CopyDeskReviewPage(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const language = i18n.language || "pl";
  const { contents } = useOutletContext<CopyDeskOutletContext>();
  const isReviewer = contents.is_reviewer;

  const { data, isLoading, error, refetch } = useCopyDeskQueue(isReviewer);
  const review = useReviewProposal();
  const pendingId = review.isPending
    ? (review.variables?.proposalId ?? null)
    : null;

  const groups = useMemo(() => buildQueue(data?.segments ?? []), [data]);
  const totals = useMemo(() => countQueue(groups), [groups]);

  const onDecide = useCallback(
    (proposalId: string, status: "ACCEPTED" | "REJECTED", value?: string) => {
      review.mutate(
        { proposalId, status, value },
        {
          onSuccess: () =>
            toast.success(
              status === "ACCEPTED"
                ? t(
                    "copy_desk.queue.accepted_toast",
                    "Przyjęte — czeka w paczce do wpisania.",
                  )
                : t("copy_desk.queue.rejected_toast", "Odrzucone."),
            ),
          onError: () =>
            toast.error(
              t(
                "copy_desk.queue.verdict_failed",
                "Nie udało się zapisać decyzji. Spróbuj jeszcze raz.",
              ),
            ),
        },
      );
    },
    [review, t],
  );

  const backToContents = (
    <Button variant="outline" size="sm" asChild>
      <Link to="/redakcja">{t("copy_desk.review.back", "Spis treści")}</Link>
    </Button>
  );

  if (!isReviewer) {
    return (
      <PageTransition className="min-h-0">
        <div className="mx-auto w-full max-w-xl py-12">
          <StatePanel
            icon={<ShieldCheck size={22} aria-hidden="true" />}
            eyebrow={t("copy_desk.eyebrow", "Redakcja")}
            title={t(
              "copy_desk.review.refused_title",
              "Przegląd należy do wydawcy",
            )}
            description={t(
              "copy_desk.review.refused_description",
              "Przyjęcie zmiany kończy się wpisem do repozytorium, więc rozstrzyga ją osoba, która publikuje serwis. Twoje propozycje czekają na nią w spisie.",
            )}
            actions={backToContents}
          />
        </div>
      </PageTransition>
    );
  }

  if (isLoading) {
    return (
      <EtherealLoader
        message={t("copy_desk.queue.loading", "Zbieram propozycje...")}
      />
    );
  }

  if (error || !data) {
    return (
      <PageTransition className="min-h-0">
        <div className="mx-auto w-full max-w-xl py-12">
          <StatePanel
            icon={<TriangleAlert size={22} aria-hidden="true" />}
            eyebrow={t("copy_desk.eyebrow", "Redakcja")}
            title={t("copy_desk.unreachable.title", "Redakcja się nie otworzyła")}
            description={t(
              "copy_desk.queue.unreachable_description",
              "Nie udało się pobrać kolejki. Nic nie zostało rozstrzygnięte — spróbuj ponownie za chwilę.",
            )}
            actions={
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                {t("copy_desk.unreachable.retry", "Spróbuj ponownie")}
              </Button>
            }
          />
        </div>
      </PageTransition>
    );
  }

  // Counted from the rows this page is drawing, so the sentence and the cards
  // below it answer for the same set.
  const census: StatLineItem[] = [
    {
      id: "proposals",
      value: formatCount(totals.proposals, language),
      label: t("copy_desk.queue.proposals", {
        count: totals.proposals,
        defaultValue: "propozycji",
      }),
    },
    {
      id: "fields",
      value: formatCount(totals.fields, language),
      label: t("copy_desk.editor.fields", {
        count: totals.fields,
        defaultValue: "pól",
      }),
    },
    {
      id: "pages",
      value: formatCount(totals.pages, language),
      label: t("copy_desk.contents.pages", {
        count: totals.pages,
        defaultValue: "stron",
      }),
    },
  ];

  return (
    <PageTransition className="min-h-0">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-16 pt-6">
        <PageHeader
          title={t("copy_desk.review.title", "Przegląd")}
          titleHighlight={t("copy_desk.review.title_highlight", "zmian")}
          rightContent={backToContents}
        />

        {/* The rule, said once and before the first verdict — the moment the
            question "what does this button do to the site" actually arises. */}
        <Text size="sm" color="graphite">
          {t(
            "copy_desk.queue.rule",
            "Przyjęcie nie dotyka serwisu: zbiera zmianę do paczki, którą wpisuje się do repozytorium osobnym poleceniem. Na stronę wchodzi dopiero przez commit.",
          )}
        </Text>

        <PatchBand patch={data.patch} />

        {groups.length === 0 ? (
          <StatePanel
            icon={<Inbox size={22} aria-hidden="true" />}
            eyebrow={t("copy_desk.eyebrow", "Redakcja")}
            title={t("copy_desk.queue.empty_title", "Nic nie czeka na decyzję")}
            description={t(
              "copy_desk.queue.empty_description",
              "Kiedy redaktor zapisze zmianę, pojawi się tutaj — ze starym i nowym brzmieniem obok siebie.",
            )}
            actions={backToContents}
          />
        ) : (
          <>
            <StatLine stats={census} />

            {groups.map((group) => {
              const Icon = familyIcon(scopeFamily(group.scope));
              return (
                <SectionCard
                  key={group.scope}
                  as="h2"
                  title={group.label}
                  icon={<Icon size={15} strokeWidth={1.5} aria-hidden="true" />}
                  action={
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/redakcja/${group.scope}`}>
                        {t("copy_desk.queue.open_page", "Cała strona")}
                      </Link>
                    </Button>
                  }
                  bodyClassName="p-0"
                >
                  <ul className="divide-y divide-hairline">
                    {group.entries.map((entry) => (
                      <QueueField
                        key={entry.segment.id}
                        entry={entry}
                        onDecide={onDecide}
                        pendingId={pendingId}
                      />
                    ))}
                  </ul>
                </SectionCard>
              );
            })}

            {/* The consequence a reviewer cannot see from any one row, and the
                reason §2 exists: the translations built on a Polish sentence are
                out of date the moment it is accepted. */}
            <Caption color="graphite" className="border-t border-hairline pt-3">
              {t(
                "copy_desk.queue.polish_note",
                "Przyjęcie polskiego unieważnia tłumaczenia tego pola — wrócą tu jako nieaktualne, kiedy paczka trafi do repozytorium.",
              )}
            </Caption>
          </>
        )}
      </div>
    </PageTransition>
  );
}
