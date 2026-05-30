/**
 * @file EditionsList.tsx
 * @description Per-edition card list inside the Archive editor's AI Review
 * tab. Each card surfaces: PDF download, ingestion status, cost-to-date,
 * pipeline error (if any), plus actions: Approve (AWAI → RDY), Re-run
 * pipeline (incurs new AI cost), Delete edition (soft-delete).
 *
 * Manager flow: upload → pipeline runs → status flips to AWAI →
 * conductor reviews piece-level fields above this list → Approve here to
 * mark the edition canonical and notify the chorus.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/EditionsList
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, FileDown, RefreshCcw, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { EditionStatusBadge } from "@/shared/ui/composites/repertoire";
import { INGESTION_STATUS, type ScoreEditionSummary } from "@/shared/types";

import {
  useApproveEdition,
  useDeleteEdition,
  useReingestEdition,
} from "../api/archive.queries";

interface EditionsListProps {
  readonly editions: readonly ScoreEditionSummary[];
}

const fmtCost = (cents: number | undefined): string => {
  const value = cents ?? 0;
  if (value <= 0) return "—";
  if (value < 100) return `${value}¢`;
  return `$${(value / 100).toFixed(2)}`;
};

const fmtRelative = (iso: string | undefined): string => {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
};

export const EditionsList = ({
  editions,
}: EditionsListProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const [pendingApproveId, setPendingApproveId] = useState<string | null>(null);
  const [pendingReingestId, setPendingReingestId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const approve = useApproveEdition();
  const reingest = useReingestEdition();
  const remove = useDeleteEdition();

  if (editions.length === 0) return null;

  const ordered = [...editions].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });

  const handleApprove = (id: string) => {
    approve.mutate(id, {
      onSuccess: () => {
        toast.success(
          t(
            "archive.editions.approve_success",
            "Wydanie zatwierdzone — chór dostanie powiadomienie.",
          ),
        );
        setPendingApproveId(null);
      },
      onError: (err) =>
        toast.error(
          err instanceof Error
            ? err.message
            : t(
                "archive.editions.approve_error",
                "Nie udało się zatwierdzić wydania.",
              ),
        ),
    });
  };

  const handleReingest = (id: string) => {
    reingest.mutate(
      { id, force: false },
      {
        onSuccess: () => {
          toast.success(
            t(
              "archive.editions.reingest_success",
              "Pipeline uruchomiony — koszty zostały wyzerowane.",
            ),
          );
          setPendingReingestId(null);
        },
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? err.message
              : t(
                  "archive.editions.reingest_error",
                  "Nie udało się uruchomić pipeline ponownie.",
                ),
          ),
      },
    );
  };

  const handleDelete = (id: string) => {
    remove.mutate(id, {
      onSuccess: () => {
        toast.success(
          t("archive.editions.delete_success", "Wydanie usunięte."),
        );
        setPendingDeleteId(null);
      },
      onError: (err) =>
        toast.error(
          err instanceof Error
            ? err.message
            : t("archive.editions.delete_error", "Nie udało się usunąć wydania."),
        ),
    });
  };

  return (
    <>
      <ul role="list" className="flex flex-col gap-3">
        {ordered.map((edition) => {
          const canApprove =
            edition.ingestion_status === INGESTION_STATUS.AWAITING;
          const isFailed = edition.ingestion_status === INGESTION_STATUS.FAILED;

          return (
            <li
              key={edition.id}
              className="rounded-3xl border border-ethereal-incense/15 bg-ethereal-alabaster/65 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-ethereal-amethyst/40 bg-ethereal-amethyst/10 text-ethereal-amethyst"
                    aria-hidden="true"
                  >
                    <FileDown size={16} strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0">
                    <Text
                      size="sm"
                      weight="semibold"
                      truncate
                      className="block"
                    >
                      {edition.original_filename ||
                        t("archive.editions.untitled", "Bez nazwy")}
                    </Text>
                    <Caption color="muted" className="block">
                      {[
                        edition.is_default
                          ? t("archive.editions.default", "domyślne")
                          : null,
                        edition.publisher,
                        edition.edition_year ? String(edition.edition_year) : null,
                        edition.page_count
                          ? t(
                              "archive.editions.pages_count",
                              "{{count}} stron",
                              { count: edition.page_count },
                            )
                          : null,
                        fmtRelative(edition.created_at),
                        fmtCost(edition.ingestion_cost_cents),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Caption>
                    {isFailed && edition.ingestion_error && (
                      <Text
                        size="xs"
                        color="crimson"
                        className="mt-1 line-clamp-2"
                        title={edition.ingestion_error}
                      >
                        {edition.ingestion_error}
                      </Text>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <EditionStatusBadge status={edition.ingestion_status} />
                  <div className="flex flex-wrap items-center gap-2">
                    {edition.pdf_file && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        leftIcon={<ExternalLink size={13} aria-hidden="true" />}
                      >
                        <a
                          href={edition.pdf_file}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("archive.editions.open_pdf", "Otwórz PDF")}
                        </a>
                      </Button>
                    )}
                    {canApprove && (
                      <Button
                        size="sm"
                        leftIcon={<CheckCircle2 size={13} aria-hidden="true" />}
                        onClick={() => setPendingApproveId(edition.id)}
                        disabled={approve.isPending}
                      >
                        {t("archive.editions.approve", "Zatwierdź")}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<RefreshCcw size={13} aria-hidden="true" />}
                      onClick={() => setPendingReingestId(edition.id)}
                      disabled={reingest.isPending}
                      title={t(
                        "archive.editions.reingest_title",
                        "Uruchom pipeline ponownie (naliczy nowe koszty AI)",
                      )}
                    >
                      {t("archive.editions.reingest", "Re-run")}
                    </Button>
                    <Button
                      variant="icon"
                      size="icon"
                      aria-label={t(
                        "archive.editions.delete_aria",
                        "Usuń wydanie",
                      )}
                      onClick={() => setPendingDeleteId(edition.id)}
                      disabled={remove.isPending}
                      className="h-9 w-9 text-ethereal-graphite hover:text-ethereal-crimson"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmModal
        isOpen={pendingApproveId !== null}
        title={t(
          "archive.editions.approve_modal_title",
          "Zatwierdzić wydanie?",
        )}
        description={t(
          "archive.editions.approve_modal_desc",
          "Po zatwierdzeniu materiały staną się widoczne dla chóru, a wszyscy uczestnicy projektu dostaną powiadomienie. Upewnij się, że AI-wyciągnięte pola (tytuł, kompozytor, IPA, tłumaczenia) są zweryfikowane.",
        )}
        confirmText={t("archive.editions.approve_confirm", "Zatwierdź")}
        cancelText={t("common.actions.cancel", "Anuluj")}
        isLoading={approve.isPending}
        onCancel={() => setPendingApproveId(null)}
        onConfirm={() => pendingApproveId && handleApprove(pendingApproveId)}
      />

      <ConfirmModal
        isOpen={pendingReingestId !== null}
        title={t(
          "archive.editions.reingest_modal_title",
          "Uruchomić pipeline ponownie?",
        )}
        description={t(
          "archive.editions.reingest_modal_desc",
          "Powtórna ingestia naliczy nowe koszty Claude (do limitu per wydanie) i wyzeruje licznik wydatków. Użyj, jeśli zmieniłeś prompt lub pipeline padł z powodu chwilowego błędu.",
        )}
        confirmText={t(
          "archive.editions.reingest_confirm",
          "Uruchom pipeline",
        )}
        cancelText={t("common.actions.cancel", "Anuluj")}
        isLoading={reingest.isPending}
        onCancel={() => setPendingReingestId(null)}
        onConfirm={() => pendingReingestId && handleReingest(pendingReingestId)}
      />

      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        isDestructive
        title={t("archive.editions.delete_modal_title", "Usunąć wydanie?")}
        description={t(
          "archive.editions.delete_modal_desc",
          "Wydanie zostanie usunięte z biblioteki. Plik PDF pozostaje na storage (soft-delete), ale nie będzie już widoczny w aplikacji.",
        )}
        confirmText={t("archive.editions.delete_confirm", "Usuń wydanie")}
        cancelText={t("common.actions.cancel", "Anuluj")}
        isLoading={remove.isPending}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => pendingDeleteId && handleDelete(pendingDeleteId)}
      />
    </>
  );
};
