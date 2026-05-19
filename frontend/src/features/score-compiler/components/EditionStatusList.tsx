/**
 * @file EditionStatusList.tsx
 * @description Live list of ScoreEdition rows on the conductor's review
 * dashboard. Pulls from the auto-polling `useScoreEditions` query so that
 * in-progress entries animate through their phases without a refresh. Each
 * card surfaces enough metadata for triage and exposes "Review", "Open PDF",
 * "Re-run", and "Delete" actions.
 * @architecture Enterprise SaaS 2026
 * @module features/score-compiler/components/EditionStatusList
 */

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ExternalLink,
  FileMusic,
  Library,
  RefreshCcw,
  ScrollText,
  Trash2,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Caption,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

import {
  useDeleteScoreEdition,
  useReingestScoreEdition,
  useScoreEditions,
} from "../api/score-compiler.queries";
import {
  isIngestionInProgress,
  type ScoreEditionListDTO,
} from "../types/score-compiler.dto";
import { EditionStatusBadge } from "./EditionStatusBadge";

interface EditionStatusListProps {
  readonly onReview: (id: string) => void;
}

const fmtCost = (cents: number): string =>
  cents <= 0
    ? "—"
    : cents < 100
      ? `${cents}¢`
      : `$${(cents / 100).toFixed(2)}`;

const fmtRelative = (iso: string): string => {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
};

export const EditionStatusList = ({
  onReview,
}: EditionStatusListProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useScoreEditions();
  const { mutate: reingest, isPending: isReingesting } =
    useReingestScoreEdition();
  const { mutate: deleteEdition, isPending: isDeleting } =
    useDeleteScoreEdition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingReingestId, setPendingReingestId] = useState<string | null>(
    null,
  );

  const inProgressCount = useMemo(
    () =>
      (data ?? []).filter((e) => isIngestionInProgress(e.ingestion_status))
        .length,
    [data],
  );

  const sectionTitle = t(
    "score_compiler.list.section",
    "Biblioteka wydań",
  );

  if (isLoading) {
    return (
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <SectionHeader title={sectionTitle} />
        <div className="flex justify-center py-10">
          <EtherealLoader />
        </div>
      </GlassCard>
    );
  }

  if (isError) {
    return (
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <SectionHeader title={sectionTitle} />
        <Text color="crimson">
          {t(
            "score_compiler.list.fetch_error",
            "Nie udało się pobrać listy wydań:",
          )}{" "}
          {error instanceof Error
            ? error.message
            : t("score_compiler.toast.unknown_error", "nieznany błąd")}
        </Text>
      </GlassCard>
    );
  }

  const editions = data ?? [];

  return (
    <>
      <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
        <SectionHeader title={sectionTitle} />

        <div className="mb-4 flex items-baseline justify-between">
          <Caption color="muted">
            {editions.length === 0
              ? t(
                  "score_compiler.list.empty_summary",
                  "Brak wydań do zatwierdzenia",
                )
              : t(
                  "score_compiler.list.summary",
                  "{{total}} wydań · {{inProgress}} w trakcie",
                  { total: editions.length, inProgress: inProgressCount },
                )}
          </Caption>
          {inProgressCount > 0 && (
            <Caption color="muted">
              {t("score_compiler.list.polling", "Aktualizacja co 3 s")}
            </Caption>
          )}
        </div>

        {editions.length === 0 ? (
          <EmptyState />
        ) : (
          <ul role="list" className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {editions.map((edition) => (
                <EditionRow
                  key={edition.id}
                  edition={edition}
                  onReview={onReview}
                  onAskReingest={(id) => setPendingReingestId(id)}
                  onAskDelete={(id) => setPendingDeleteId(id)}
                  busy={isReingesting || isDeleting}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </GlassCard>

      <ConfirmModal
        isOpen={pendingReingestId !== null}
        isDestructive={false}
        title={t(
          "score_compiler.reingest.title",
          "Uruchomić pipeline ponownie?",
        )}
        description={t(
          "score_compiler.reingest.description",
          "Powtórna ingestia naliczy nowe koszty wywołań Claude (do limitu {{cap}}¢ per wydanie) i wyzeruje licznik wydatków. Użyj, gdy zmieniłeś prompt lub pipeline padł z powodu chwilowego błędu sieci.",
          { cap: 200 },
        )}
        confirmText={t(
          "score_compiler.reingest.confirm",
          "Uruchom pipeline",
        )}
        cancelText={t("common.actions.cancel", "Anuluj")}
        isLoading={isReingesting}
        onCancel={() => setPendingReingestId(null)}
        onConfirm={() => {
          if (!pendingReingestId) return;
          const id = pendingReingestId;
          reingest(
            { id, force: false },
            {
              onSuccess: () => {
                toast.success(
                  t(
                    "score_compiler.toast.reingest_success",
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
                        "score_compiler.toast.reingest_error",
                        "Nie udało się ponownie uruchomić pipeline.",
                      ),
                ),
            },
          );
        }}
      />

      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        title={t(
          "score_compiler.list.delete_title",
          "Usunąć wydanie?",
        )}
        description={t(
          "score_compiler.list.delete_description",
          "Wydanie zostanie usunięte z biblioteki kompilatora. Plik PDF pozostaje w archiwum (soft-delete), ale nie będzie już dostępny w tym widoku.",
        )}
        confirmText={t(
          "score_compiler.list.delete_confirm",
          "Usuń wydanie",
        )}
        cancelText={t("common.actions.cancel", "Anuluj")}
        isLoading={isDeleting}
        isDestructive
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) return;
          deleteEdition(pendingDeleteId, {
            onSuccess: () => {
              toast.success(
                t(
                  "score_compiler.list.delete_success",
                  "Wydanie usunięte.",
                ),
              );
              setPendingDeleteId(null);
            },
            onError: (err) =>
              toast.error(
                err instanceof Error
                  ? err.message
                  : t(
                      "score_compiler.list.delete_error",
                      "Nie udało się usunąć wydania.",
                    ),
              ),
          });
        }}
      />
    </>
  );
};

// ---------------------------------------------------------------------------

interface EditionRowProps {
  readonly edition: ScoreEditionListDTO;
  readonly onReview: (id: string) => void;
  readonly onAskReingest: (id: string) => void;
  readonly onAskDelete: (id: string) => void;
  readonly busy: boolean;
}

const EditionRow = ({
  edition,
  onReview,
  onAskReingest,
  onAskDelete,
  busy,
}: EditionRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const inProgress = isIngestionInProgress(edition.ingestion_status);
  const canReview =
    edition.ingestion_status === "AWAI" || edition.ingestion_status === "RDY ";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="rounded-3xl border border-ethereal-incense/15 bg-ethereal-alabaster/65 p-4 md:p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-ethereal-gold/30 bg-ethereal-gold/10 text-ethereal-gold"
            aria-hidden="true"
          >
            <FileMusic size={18} strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <Heading as="h3" size="lg" weight="medium" className="truncate">
              {edition.piece_title?.trim() ||
                edition.original_filename ||
                t("score_compiler.list.untitled", "Bez tytułu")}
            </Heading>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {edition.composer_name && (
                <Caption color="muted">{edition.composer_name}</Caption>
              )}
              {edition.original_filename && edition.piece_title && (
                <Caption color="muted" className="truncate max-w-[28ch]">
                  · {edition.original_filename}
                </Caption>
              )}
              <Caption color="muted">
                · {fmtRelative(edition.created_at)}
              </Caption>
              <Caption color="muted">
                · {fmtCost(edition.ingestion_cost_cents)}
              </Caption>
            </div>
            {edition.ingestion_error && (
              <Text
                size="xs"
                color="crimson"
                className="mt-2 line-clamp-2"
                title={edition.ingestion_error}
              >
                {edition.ingestion_error}
              </Text>
            )}
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 md:flex-col md:items-end">
          <EditionStatusBadge status={edition.ingestion_status} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant={canReview ? "primary" : "outline"}
              size="sm"
              leftIcon={<ScrollText size={14} aria-hidden="true" />}
              disabled={!canReview && inProgress}
              onClick={() => onReview(edition.id)}
            >
              {canReview
                ? t("score_compiler.list.review_btn", "Przegląd")
                : t("score_compiler.list.details_btn", "Szczegóły")}
            </Button>
            {edition.piece && (
              <Button
                asChild
                variant="outline"
                size="sm"
                leftIcon={<Library size={14} aria-hidden="true" />}
                title={t(
                  "score_compiler.list.open_in_archive_title",
                  "Otwórz utwór w bibliotece archiwum",
                )}
              >
                <Link to="/panel/archive-management">
                  {t(
                    "score_compiler.list.open_in_archive_btn",
                    "W archiwum",
                  )}
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCcw size={14} aria-hidden="true" />}
              onClick={() => onAskReingest(edition.id)}
              disabled={busy || inProgress}
              title={t(
                "score_compiler.review.reingest_btn",
                "Uruchom pipeline ponownie",
              )}
            >
              {t("score_compiler.list.rerun_btn", "Re-run")}
            </Button>
            <Button
              variant="icon"
              size="icon"
              aria-label={t(
                "score_compiler.list.delete_aria",
                "Usuń wydanie",
              )}
              onClick={() => onAskDelete(edition.id)}
              disabled={busy}
              className="h-9 w-9 text-ethereal-graphite hover:text-ethereal-crimson"
            >
              <Trash2 size={15} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </motion.li>
  );
};

// ---------------------------------------------------------------------------

const EmptyState = (): React.JSX.Element => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-ethereal-incense/25 bg-ethereal-alabaster/40 px-6 py-12 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ethereal-incense/30 bg-ethereal-marble/70 text-ethereal-graphite"
        aria-hidden="true"
      >
        <ExternalLink size={20} strokeWidth={1.6} />
      </span>
      <Heading as="h3" size="lg" weight="medium">
        {t("score_compiler.list.empty_title", "Brak wydań w kolejce")}
      </Heading>
      <Text color="muted" size="sm" className="max-w-md">
        {t(
          "score_compiler.list.empty_body",
          "Prześlij PDF partytury powyżej, a Score Package Compiler wyciągnie metadane, rozpozna utwór, doda tłumaczenia i notkę programową. Wydania pojawią się tu automatycznie.",
        )}
      </Text>
    </div>
  );
};
