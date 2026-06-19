/**
 * @file ArchiveComposersPage.tsx
 * @description Composer-management surface — sibling of [ArchiveManagement].
 * Lists every composer with inline pencil edits, expand-to-see-bio +
 * portrait + pieces, bulk-merge for duplicates that the AI pipeline
 * failed to dedupe.
 *
 * Why a dedicated page: AI creates composers automatically with
 * potentially incomplete or duplicated data. Without a top-level surface
 * the conductor can't fix or consolidate them outside Django admin.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/ArchiveComposersPage
 */

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  ChevronsRight,
  GitMerge,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Caption, Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import type { Composer } from "@/shared/types";

import {
  useComposers,
  useCreateComposer,
  useDeleteComposer,
  useMergeComposers,
} from "./api/archive.queries";
import { ArchiveTabs } from "./components/ArchiveTabs";
import { ComposerRow } from "./components/ComposerRow";

interface AddComposerDraft {
  first_name: string;
  last_name: string;
  birth_year: string;
  death_year: string;
}

const EMPTY_DRAFT: AddComposerDraft = {
  first_name: "",
  last_name: "",
  birth_year: "",
  death_year: "",
};

const composerSearchableLabel = (composer: Composer): string =>
  [composer.first_name, composer.last_name, composer.nationality, composer.bio]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export default function ArchiveComposersPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: composers = [], isLoading } = useComposers();
  const createComposer = useCreateComposer();
  const deleteComposer = useDeleteComposer();
  const mergeComposers = useMergeComposers();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Composer | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [draft, setDraft] = useState<AddComposerDraft>(EMPTY_DRAFT);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [isMergeOpen, setIsMergeOpen] = useState<boolean>(false);

  const composersById = useMemo(
    () => new Map(composers.map((c) => [String(c.id), c])),
    [composers],
  );

  const filtered = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return composers;
    return composers.filter((c) =>
      composerSearchableLabel(c).includes(normalized),
    );
  }, [composers, searchTerm]);

  const totalComposers = composers.length;
  const withPortrait = composers.filter((c) => Boolean(c.portrait_url)).length;
  const orphans = composers.filter((c) => (c.pieces_count ?? 0) === 0).length;

  const selectedComposers = useMemo(
    () =>
      Array.from(selectedIds)
        .map((id) => composersById.get(id))
        .filter((c): c is Composer => Boolean(c)),
    [selectedIds, composersById],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleAddComposer = async () => {
    const trimmed = {
      first_name: draft.first_name.trim() || undefined,
      last_name: draft.last_name.trim(),
      birth_year: draft.birth_year.trim() || undefined,
      death_year: draft.death_year.trim() || undefined,
    };
    if (!trimmed.last_name) {
      toast.error(
        t(
          "archive.composers.add_last_required",
          "Nazwisko kompozytora jest wymagane.",
        ),
      );
      return;
    }
    try {
      await createComposer.mutateAsync(trimmed);
      toast.success(
        t("archive.composers.add_success", "Dodano kompozytora."),
      );
      setDraft(EMPTY_DRAFT);
      setIsAdding(false);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t("archive.composers.add_error", "Nie udało się dodać."),
      );
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      await deleteComposer.mutateAsync(String(pendingDelete.id));
      toast.success(
        t(
          "archive.composers.delete_success",
          "Kompozytor usunięty.",
        ),
      );
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? null;
      toast.error(
        detail ??
          (err instanceof Error
            ? err.message
            : t(
                "archive.composers.delete_error",
                "Nie udało się usunąć kompozytora.",
              )),
      );
    } finally {
      setPendingDelete(null);
    }
  };

  const handleMergeConfirm = async () => {
    if (!mergeTargetId || selectedIds.size < 2) return;
    const sources = selectedComposers.filter(
      (c) => String(c.id) !== mergeTargetId,
    );
    const target = composersById.get(mergeTargetId);
    if (!target) return;

    try {
      // Serial merges — each shifts pieces onto the target and soft-deletes the source.
      for (const source of sources) {
        await mergeComposers.mutateAsync({
          sourceId: String(source.id),
          targetId: mergeTargetId,
        });
      }
      toast.success(
        t(
          "archive.composers.merge_success",
          "Połączono {{count}} kompozytorów w {{target}}.",
          {
            count: sources.length,
            target: `${target.last_name}, ${target.first_name ?? ""}`.trim(),
          },
        ),
      );
      clearSelection();
      setMergeTargetId("");
      setIsMergeOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t(
              "archive.composers.merge_error",
              "Nie udało się połączyć kompozytorów.",
            ),
      );
    }
  };

  if (isLoading) {
    return <EtherealLoader />;
  }

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-5xl flex-col gap-5 pb-24 pt-6">
        <PageHeader
          size="standard"
          roleText={t("archive.composers.subtitle", "Biblioteka nut")}
          title={t("archive.composers.title", "Kompozytorzy")}
          titleHighlight={t("archive.composers.title_highlight", "i aranżerzy")}
          rightContent={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAdding((v) => !v)}
              leftIcon={<Plus size={14} aria-hidden="true" />}
            >
              {t("archive.composers.add_btn", "Dodaj kompozytora")}
            </Button>
          }
        />

        <ArchiveTabs />

        <Text size="sm" color="graphite" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            <strong className="text-ethereal-ink">{totalComposers}</strong>{" "}
            {t("archive.composers.stat_total", "kompozytorów")}
          </span>
          <span aria-hidden="true" className="text-ethereal-incense/40">·</span>
          <span>
            <strong className="text-ethereal-ink">{withPortrait}</strong>{" "}
            {t("archive.composers.stat_portrait", "z portretem")}
          </span>
          <span aria-hidden="true" className="text-ethereal-incense/40">·</span>
          <span>
            <strong className="text-ethereal-ink">{orphans}</strong>{" "}
            {t("archive.composers.stat_orphan", "bez utworów")}
          </span>
        </Text>

        {isAdding && (
          <div className="rounded-2xl border border-ethereal-gold/30 bg-ethereal-gold/5 p-4">
            <Eyebrow color="gold" size="caption" className="mb-3 block">
              {t("archive.composers.add_form_title", "Nowy kompozytor")}
            </Eyebrow>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder={t("archive.composers.add_first", "Imię")}
                value={draft.first_name}
                onChange={(e) =>
                  setDraft({ ...draft, first_name: e.target.value })
                }
                disabled={createComposer.isPending}
              />
              <Input
                placeholder={t("archive.composers.add_last", "Nazwisko *")}
                value={draft.last_name}
                onChange={(e) =>
                  setDraft({ ...draft, last_name: e.target.value })
                }
                disabled={createComposer.isPending}
              />
              <Input
                type="number"
                placeholder={t("archive.composers.add_birth", "Rok urodzenia")}
                value={draft.birth_year}
                onChange={(e) =>
                  setDraft({ ...draft, birth_year: e.target.value })
                }
                disabled={createComposer.isPending}
              />
              <Input
                type="number"
                placeholder={t("archive.composers.add_death", "Rok śmierci")}
                value={draft.death_year}
                onChange={(e) =>
                  setDraft({ ...draft, death_year: e.target.value })
                }
                disabled={createComposer.isPending}
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(EMPTY_DRAFT);
                  setIsAdding(false);
                }}
                disabled={createComposer.isPending}
              >
                {t("common.actions.cancel", "Anuluj")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddComposer}
                disabled={createComposer.isPending || !draft.last_name.trim()}
                isLoading={createComposer.isPending}
              >
                {t("archive.composers.add_submit", "Dodaj")}
              </Button>
            </div>
          </div>
        )}

        {/* Bulk merge bar — expands inline with a target picker when invoked */}
        {selectedIds.size > 0 && (
          <div className="rounded-2xl border border-ethereal-gold/30 bg-ethereal-gold/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Eyebrow color="gold" size="caption">
                  {t(
                    "archive.composers.selected",
                    "Zaznaczono {{count}}",
                    { count: selectedIds.size },
                  )}
                </Eyebrow>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X size={12} aria-hidden="true" className="mr-1" />
                  {t("archive.composers.clear_selection", "Wyczyść")}
                </Button>
              </div>
              {selectedIds.size >= 2 ? (
                isMergeOpen ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsMergeOpen(false);
                      setMergeTargetId("");
                    }}
                  >
                    {t("common.actions.cancel", "Anuluj")}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<GitMerge size={13} aria-hidden="true" />}
                    onClick={() => setIsMergeOpen(true)}
                    disabled={mergeComposers.isPending}
                  >
                    {t(
                      "archive.composers.merge_btn",
                      "Połącz duplikaty",
                    )}
                  </Button>
                )
              ) : (
                <Caption color="muted">
                  {t(
                    "archive.composers.merge_hint",
                    "Zaznacz przynajmniej 2 by połączyć",
                  )}
                </Caption>
              )}
            </div>

            {isMergeOpen && (
              <div className="mt-3 space-y-3 border-t border-ethereal-gold/25 pt-3">
                <div>
                  <Eyebrow color="muted" size="caption" className="mb-2 block">
                    {t(
                      "archive.composers.merge_target_label",
                      "Wybierz kompozytora docelowego — pozostali zostaną do niego przepięci i usunięci",
                    )}
                  </Eyebrow>
                  <div
                    role="radiogroup"
                    aria-label={t(
                      "archive.composers.merge_target_group_aria",
                      "Kompozytor docelowy",
                    )}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {selectedComposers.map((c) => {
                      const isTarget = mergeTargetId === String(c.id);
                      const piecesCount = c.pieces_count ?? 0;
                      const hasPortrait = Boolean(c.portrait_url);
                      const hasMB = Boolean(c.mbid);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={isTarget}
                          onClick={() => setMergeTargetId(String(c.id))}
                          disabled={mergeComposers.isPending}
                          className={cn(
                            "group/card relative cursor-pointer rounded-xl border bg-ethereal-alabaster/80 p-3 text-left transition-all",
                            "hover:-translate-y-px hover:shadow-glass-ethereal-hover",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
                            isTarget
                              ? "border-ethereal-gold/60 bg-ethereal-gold/10 shadow-glass-ethereal"
                              : "border-ethereal-incense/25 hover:border-ethereal-gold/40",
                          )}
                        >
                          {isTarget && (
                            <span
                              className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ethereal-gold text-white"
                              aria-hidden="true"
                            >
                              <CheckCircle2 size={12} strokeWidth={2.5} />
                            </span>
                          )}
                          <div className="flex items-start gap-2.5">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ethereal-incense/20 bg-ethereal-alabaster shadow-sm"
                              aria-hidden="true"
                            >
                              {hasPortrait ? (
                                <img
                                  src={c.portrait_url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <Sparkles
                                  size={12}
                                  className="text-ethereal-gold/60"
                                />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <Text
                                size="sm"
                                weight="semibold"
                                truncate
                                className="block"
                              >
                                {c.last_name}
                                {c.first_name ? `, ${c.first_name}` : ""}
                              </Text>
                              <Caption color="muted" className="block">
                                {[c.birth_year, c.death_year]
                                  .filter(Boolean)
                                  .join("–") || "—"}
                                {c.nationality && ` · ${c.nationality}`}
                              </Caption>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                                    piecesCount > 0
                                      ? "border-ethereal-amethyst/30 bg-ethereal-amethyst/10 text-ethereal-amethyst"
                                      : "border-ethereal-incense/25 bg-ethereal-marble/40 text-ethereal-graphite/70",
                                  )}
                                >
                                  {piecesCount}{" "}
                                  {t(
                                    "archive.composers.merge_card_pieces",
                                    "utw.",
                                  )}
                                </span>
                                {hasMB && (
                                  <span className="inline-flex items-center gap-0.5 rounded-md border border-ethereal-sage/35 bg-ethereal-sage/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-ethereal-sage">
                                    MB
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {mergeTargetId && (
                  <div className="rounded-lg border border-ethereal-incense/15 bg-ethereal-alabaster/60 p-3">
                    <Caption color="muted" className="mb-1 block">
                      {t(
                        "archive.composers.merge_preview",
                        "Po połączeniu:",
                      )}
                    </Caption>
                    <ul className="space-y-0.5 text-[12px] text-ethereal-graphite">
                      {selectedComposers
                        .filter((c) => String(c.id) !== mergeTargetId)
                        .map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center gap-1.5"
                          >
                            <ChevronsRight
                              size={11}
                              aria-hidden="true"
                              className="text-ethereal-crimson"
                            />
                            <span className="truncate">
                              {c.last_name}
                              {c.first_name ? `, ${c.first_name}` : ""} (
                              {c.pieces_count ?? 0}{" "}
                              {t("archive.composers.merge_card_pieces")}) →{" "}
                              {t(
                                "archive.composers.merge_preview_delete",
                                "usunięty",
                              )}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleMergeConfirm}
                    disabled={!mergeTargetId || mergeComposers.isPending}
                    isLoading={mergeComposers.isPending}
                    leftIcon={<GitMerge size={13} aria-hidden="true" />}
                  >
                    {t(
                      "archive.composers.merge_confirm",
                      "Połącz {{count}} kompozytorów",
                      { count: selectedIds.size },
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <Input
          leftIcon={<Search size={16} aria-hidden="true" />}
          type="search"
          placeholder={t(
            "archive.composers.search_placeholder",
            "Szukaj po imieniu, nazwisku, kraju, bio…",
          )}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label={t(
            "archive.composers.search_aria",
            "Szukaj kompozytora",
          )}
        />

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-ethereal-incense/25 bg-ethereal-alabaster/40 px-6 py-12 text-center">
            <Heading as="h3" size="lg" weight="medium">
              {searchTerm
                ? t(
                    "archive.composers.empty_search",
                    "Żaden kompozytor nie pasuje do filtra",
                  )
                : t(
                    "archive.composers.empty_first",
                    "Biblioteka jest pusta",
                  )}
            </Heading>
            <Text color="muted" size="sm">
              {searchTerm
                ? t(
                    "archive.composers.empty_search_hint",
                    "Spróbuj innej frazy lub wyczyść wyszukiwanie.",
                  )
                : t(
                    "archive.composers.empty_first_hint",
                    "Kompozytorzy pojawiają się automatycznie gdy AI rozpoznaje utwór z PDF-a, albo dodaj ręcznie.",
                  )}
            </Text>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((composer) => (
              <ComposerRow
                key={composer.id}
                composer={composer}
                isSelected={selectedIds.has(String(composer.id))}
                onToggleSelected={toggleSelected}
                onDelete={setPendingDelete}
              />
            ))}
          </div>
        )}

        <ConfirmModal
          isOpen={pendingDelete !== null}
          isDestructive
          title={t(
            "archive.composers.delete_modal_title",
            "Usunąć kompozytora?",
          )}
          description={t(
            "archive.composers.delete_modal_desc",
            "Kompozytor zostanie usunięty (soft-delete). Operacja jest dozwolona tylko gdy nie ma przypisanych utworów.",
          )}
          confirmText={t(
            "archive.composers.delete_modal_confirm",
            "Usuń kompozytora",
          )}
          cancelText={t("common.actions.cancel", "Anuluj")}
          isLoading={deleteComposer.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </PageTransition>
  );
}
