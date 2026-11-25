/**
 * @file ArchiveComposersPage.tsx
 * @description The library's composers: every composer in the catalogue, as a
 * list whose rows open the composer's record (`ComposerRecordDialog`), where
 * the record is read and corrected. The list itself edits nothing.
 *
 * The AI creates composers as it reads scores, sometimes with a name spelled
 * twice or without its MusicBrainz link, so the page is where the catalogue is
 * kept clean: the census line's two quick filters find the composers missing
 * their MusicBrainz link and those left without pieces, and "Połącz duplikaty"
 * turns the rows into toggles for merging two entries of one person. "Dodaj
 * kompozytora" is the piece card's own dialog, and opens the new record. The
 * header and toolbar are the library's (`ArchiveManagement`), so the two tabs
 * do not change shape under the manager's eye.
 * @module features/archive/ArchiveComposersPage
 */

import React, { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { GitMerge, Plus, Search, Users, X } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { foldDiacritics } from "@/shared/lib/text";
import type { Composer } from "@/shared/types";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { FilterToggle } from "@/shared/ui/composites/FilterTokens";
import { ListCensus, ListToolbar, ToolbarButton } from "@/shared/ui/composites/ListToolbar";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { RecordList } from "@/shared/ui/composites/RecordList";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";

import { useComposers, useDeleteComposer } from "./api/archive.queries";
import { ArchiveTabs } from "./components/ArchiveTabs";
import { ComposerMergeBar, ComposerMergeDialog } from "./components/ComposerMerge";
import { ComposerRecordDialog } from "./components/ComposerRecordDialog";
import { COMPOSER_COLUMNS, ComposerRow } from "./components/ComposerRow";
import { CreateComposer } from "./piece-card/ComposerProperty";

type ComposerFilter = "no_mb" | "orphans";

const isOrphan = (composer: Composer): boolean =>
  composer.is_orphan ?? (composer.pieces_count ?? 0) === 0;

const FILTERS: Readonly<Record<ComposerFilter, (composer: Composer) => boolean>> = {
  no_mb: (composer) => !composer.mbid,
  orphans: isOrphan,
};

// Names only, the ones the row and the record show, plus the variants the
// catalogue knows ("J.S. Bach"). Folded, not merely lowercased: this library
// is Polish, so "gorecki" has to find Górecki and "lukaszewski" Łukaszewski.
const composerSearchKey = (composer: Composer): string =>
  foldDiacritics(
    [composer.first_name, composer.last_name, composer.full_name, ...(composer.aliases ?? [])]
      .filter(Boolean)
      .join(" "),
  );

export default function ArchiveComposersPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: composers = [], isLoading } = useComposers();
  const deleteComposer = useDeleteComposer();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filter, setFilter] = useState<ComposerFilter | null>(null);
  const [mergeMode, setMergeMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [isMergeOpen, setIsMergeOpen] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Composer | null>(null);

  const composersById = useMemo(
    () => new Map(composers.map((composer) => [String(composer.id), composer])),
    [composers],
  );

  const normalizedSearch = foldDiacritics(searchTerm.trim());
  const visible = useMemo(
    () =>
      composers.filter(
        (composer) =>
          (!filter || FILTERS[filter](composer)) &&
          (!normalizedSearch || composerSearchKey(composer).includes(normalizedSearch)),
      ),
    [composers, filter, normalizedSearch],
  );

  // Merged or deleted entries drop out of the selection as the list refetches.
  const selectedComposers = Array.from(selectedIds)
    .map((id) => composersById.get(id))
    .filter((composer): composer is Composer => Boolean(composer));
  const openComposer = openId ? composersById.get(openId) : undefined;

  const total = composers.length;
  const withoutMb = composers.filter(FILTERS.no_mb).length;
  const orphans = composers.filter(FILTERS.orphans).length;

  // A filter whose count reaches zero (the last orphan deleted, the last
  // unlinked composer refreshed or merged) switches itself off: its toggle is
  // gone, so nothing else could, and the list behind it would stay empty.
  const filterCounts: Readonly<Record<ComposerFilter, number>> = { no_mb: withoutMb, orphans };
  if (filter && !isLoading && filterCounts[filter] === 0) {
    setFilter(null);
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitMerge = () => {
    setMergeMode(false);
    setIsMergeOpen(false);
    setSelectedIds(new Set());
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      await deleteComposer.mutateAsync(String(pendingDelete.id));
      toast.success(t("archive.composers.delete_success", "Kompozytor usunięty."));
    } catch (error) {
      toastApiError(error, t, {
        fallbackDescription: t("archive.composers.delete_error", "Nie udało się usunąć kompozytora."),
      });
    } finally {
      setPendingDelete(null);
    }
  };

  if (isLoading) {
    return <EtherealLoader />;
  }

  // The two exceptions worth hunting for, as filters that say their size.
  // Each appears only while there is something to find, and one is on at a time.
  const filterLabels: Readonly<Record<ComposerFilter, string>> = {
    no_mb: t("archive.composers.filter_no_mb", "{{count}} bez MusicBrainz", { count: withoutMb }),
    orphans: t("archive.composers.filter_orphans", "{{count}} bez utworów", { count: orphans }),
  };
  const filterChips = (["no_mb", "orphans"] as const)
    .filter((id) => filterCounts[id] > 0)
    .map((id) => (
      <FilterToggle
        key={id}
        label={filterLabels[id]}
        pressed={filter === id}
        onToggle={() => setFilter((current) => (current === id ? null : id))}
      />
    ));

  const isNarrowed = Boolean(normalizedSearch) || filter !== null;

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-5xl flex-col gap-5 pb-24 pt-6">
        <PageHeader
          size="compact"
          title={t("archive.composers.title", "Kompozytorzy")}
          rightContent={
            <ToolbarButton
              variant="primary"
              icon={<Plus size={16} aria-hidden="true" />}
              label={t("archive.composers.add_btn", "Dodaj kompozytora")}
              onClick={() => setIsAdding(true)}
            />
          }
        />

        <ArchiveTabs />

        <ListToolbar
          search={
            <Input
              leftIcon={<Search size={16} aria-hidden="true" />}
              type="search"
              placeholder={t("archive.composers.search_placeholder", "Szukaj po imieniu lub nazwisku…")}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label={t("archive.composers.search_aria", "Szukaj kompozytora")}
            />
          }
          controls={
            <ToolbarButton
              icon={<GitMerge size={16} aria-hidden="true" />}
              label={t("archive.composers.merge_btn", "Połącz duplikaty")}
              on={mergeMode}
              aria-pressed={mergeMode}
              onClick={() => (mergeMode ? exitMerge() : setMergeMode(true))}
            />
          }
          census={
            <>
              <ListCensus
                total={total}
                noun={t("archive.composers.stat_total", "kompozytorów", { count: total })}
                narrowed={
                  isNarrowed
                    ? t("archive.search.summary_filtered", "{{visible}} z {{total}}", {
                        visible: visible.length,
                        total,
                      })
                    : null
                }
              />
              {filterChips}
            </>
          }
        />

        {visible.length === 0 ? (
          <StatePanel
            icon={<Users size={32} aria-hidden="true" />}
            title={
              isNarrowed
                ? t("archive.composers.empty_search", "Żaden kompozytor nie pasuje")
                : t("archive.composers.empty_first", "Nie ma jeszcze kompozytorów")
            }
            description={
              isNarrowed
                ? t("archive.composers.empty_search_hint", "Spróbuj innej pisowni albo wyczyść wyszukiwanie.")
                : t(
                    "archive.composers.empty_first_hint",
                    "Kompozytorzy pojawiają się sami, gdy AI rozpozna utwór z PDF-a. Możesz też dodać kompozytora ręcznie.",
                  )
            }
            actions={
              isNarrowed ? (
                <Button
                  variant="ghost"
                  casing="sentence"
                  onClick={() => {
                    setSearchTerm("");
                    setFilter(null);
                  }}
                  leftIcon={<X size={16} aria-hidden="true" />}
                >
                  {t("archive.composers.clear_search", "Wyczyść wyszukiwanie")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  casing="sentence"
                  onClick={() => setIsAdding(true)}
                  leftIcon={<Plus size={16} aria-hidden="true" />}
                >
                  {t("archive.composers.add_btn", "Dodaj kompozytora")}
                </Button>
              )
            }
          />
        ) : (
          <RecordList label={t("archive.composers.list_aria", "Kompozytorzy w bibliotece")} columns={COMPOSER_COLUMNS}>
            {visible.map((composer) => (
              <ComposerRow
                key={composer.id}
                composer={composer}
                onOpen={(chosen) => setOpenId(String(chosen.id))}
                onDelete={setPendingDelete}
                selectionMode={mergeMode}
                selected={selectedIds.has(String(composer.id))}
                onToggleSelect={toggleSelect}
              />
            ))}
          </RecordList>
        )}

        {isAdding && (
          <CreateComposer
            onCreated={(created) => setOpenId(String(created.id))}
            onClose={() => setIsAdding(false)}
          />
        )}

        {openComposer && (
          <ComposerRecordDialog composer={openComposer} onClose={() => setOpenId(null)} />
        )}

        <AnimatePresence>
          {mergeMode && (
            <ComposerMergeBar
              selectedCount={selectedComposers.length}
              onMerge={() => setIsMergeOpen(true)}
              onExit={exitMerge}
            />
          )}
        </AnimatePresence>

        {isMergeOpen && selectedComposers.length >= 2 && (
          <ComposerMergeDialog
            composers={selectedComposers}
            onClose={() => setIsMergeOpen(false)}
            onMerged={exitMerge}
          />
        )}

        <ConfirmModal
          isOpen={pendingDelete !== null}
          isDestructive
          casing="sentence"
          title={t("archive.composers.delete_modal_title", "Usunąć kompozytora?")}
          description={t(
            "archive.composers.delete_modal_desc",
            "Zniknie z listy kompozytorów. Usunąć można tylko kompozytora, do którego nie jest przypisany żaden utwór.",
          )}
          confirmText={t("archive.composers.delete_modal_confirm", "Usuń kompozytora")}
          cancelText={t("common.actions.cancel", "Anuluj")}
          isLoading={deleteComposer.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </PageTransition>
  );
}
