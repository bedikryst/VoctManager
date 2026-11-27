/**
 * @file ArtistManagement.tsx
 * @description The roster: every member of the ensemble, as a list whose rows
 * open the member's dossier, a slide-over; editing happens in the editor
 * panel the dossier or the row's menu opens.
 *
 * Two bands before the list: the title with "Dodaj artystę", then the voice
 * sections as tabs, each with its size ("Alty 12"), which carry the ensemble's
 * balance. The section is held in the address, so a reload keeps it. Possible
 * duplicates fold into one line under the tabs. The toolbar's census line
 * carries the count and the quick filters (invitations unanswered, range
 * proposals awaiting the conductor, the archive, members without push);
 * archived members leave the default list and stand on their own under their
 * chip. "Zaznacz wiele" turns the rows into toggles for the bulk archive and
 * restore. One message composer serves every row.
 * @module features/artists/ArtistManagement
 */

import React, { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { UserPlus, Users } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { FilterToggle } from "@/shared/ui/composites/FilterTokens";
import { ListCensus, ToolbarButton } from "@/shared/ui/composites/ListToolbar";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { RecordList } from "@/shared/ui/composites/RecordList";
import { RouteTabs, type RouteTabItem } from "@/shared/ui/composites/RouteTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Button } from "@/shared/ui/primitives/Button";
import { NewThreadModal } from "@/features/messages/components/NewThreadModal";

import { useArtistDuplicates } from "./api/artist.queries";
import ArtistEditorPanel from "./components/ArtistEditorPanel";
import { ArtistDossier } from "./components/ArtistDossier";
import { ARTIST_COLUMNS, ArtistRow } from "./components/ArtistRow";
import { BulkActionBar } from "./components/BulkActionBar";
import { DuplicateReview } from "./components/DuplicateReview";
import { RosterToolbar } from "./components/RosterToolbar";
import { VOICE_SECTIONS } from "./constants/voiceSections";
import { useArtistData } from "./hooks/useArtistData";
import { ROSTER_QUICK_FILTERS, rosterQuery, type RosterQuickFilter } from "./lib/rosterScope";
import type { DuplicateGroup } from "./types/artist.dto";

const ROSTER_PATH = "/panel/artists";

/** Stable identity, so an idle query never re-renders the page on a new []. */
const EMPTY_DUPLICATE_GROUPS: DuplicateGroup[] = [];

export default function ArtistManagement(): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    isLoading,
    isError,
    voiceTypes,
    section,
    filters,
    searchTerm,
    setSearchTerm,
    rangeFilter,
    setRangeFilter,
    sortBy,
    setSortBy,
    quickFilter,
    setQuickFilter,
    resetFilters,
    sectionCounts,
    quickFilterCounts,
    baseTotal,
    isNarrowed,
    displayArtists,
    isPanelOpen,
    editingArtist,
    initialSearchContext,
    artistToToggle,
    setArtistToToggle,
    isTogglingStatus,
    messageTarget,
    isMessageOpen,
    openMessage,
    closeMessage,
    dossierTarget,
    isDossierOpen,
    openDossier,
    closeDossier,
    selectionMode,
    toggleSelectionMode,
    selectedIds,
    selectionStats,
    toggleSelect,
    clearSelection,
    selectAllVisible,
    pendingBulk,
    setPendingBulk,
    requestBulkToggle,
    executeBulkToggle,
    isBulkPending,
    openPanel,
    closePanel,
    handleToggleRequest,
    executeStatusToggle,
    handleResendActivation,
    resendingIds,
  } = useArtistData();

  // Manager-only server side, so the query is not merely hidden for anyone else
  // — it is never sent.
  const { data: duplicateGroups = EMPTY_DUPLICATE_GROUPS } =
    useArtistDuplicates(isManager(user));

  useEffect(() => {
    if (isError) {
      toast.error(t("artists.dashboard.sync_warning_title", "Ostrzeżenie"), {
        description: t(
          "artists.dashboard.sync_warning_desc",
          "Nie udało się pobrać danych o artystach.",
        ),
      });
    }
  }, [isError, t]);

  if (isLoading && displayArtists.length === 0) {
    return <EtherealLoader />;
  }

  const term = searchTerm.trim();

  // A tab keeps the filters in use: the section is one more way of narrowing
  // the same list, not a different page.
  const sectionHref = (key: (typeof VOICE_SECTIONS)[number]["key"] | ""): string => {
    const query = rosterQuery(key, filters);
    return query ? `${ROSTER_PATH}?${query}` : ROSTER_PATH;
  };
  const tabs: readonly RouteTabItem[] = [
    {
      to: sectionHref(""),
      label: t("artists.filters.all", "Tutti"),
      count: sectionCounts.all,
      active: section === "",
    },
    ...VOICE_SECTIONS.map((voiceSection) => ({
      to: sectionHref(voiceSection.key),
      label: t(voiceSection.labelKey, voiceSection.defaultLabel),
      count: sectionCounts[voiceSection.key],
      active: section === voiceSection.key,
    })),
  ];

  // Each chip only while it has someone to find, one pressed at a time.
  const quickFilterLabels: Readonly<Record<RosterQuickFilter, string>> = {
    pending: t("artists.quick.pending", "{{count}} bez aktywacji", {
      count: quickFilterCounts.pending,
    }),
    range: t("artists.quick.range", "{{count}} skal do oceny", {
      count: quickFilterCounts.range,
    }),
    archived: t("artists.quick.archived", "{{count}} w archiwum", {
      count: quickFilterCounts.archived,
    }),
    no_push: t("artists.quick.no_push", "{{count}} bez powiadomień", {
      count: quickFilterCounts.no_push,
    }),
  };
  const quickFilterChips = ROSTER_QUICK_FILTERS.filter((id) => quickFilterCounts[id] > 0).map(
    (id) => (
      <FilterToggle
        key={id}
        label={quickFilterLabels[id]}
        pressed={quickFilter === id}
        onToggle={() => setQuickFilter((current) => (current === id ? "" : id))}
      />
    ),
  );

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-5xl flex-col gap-5 pb-24 pt-6">
        <PageHeader
          size="compact"
          title={t("artists.dashboard.title", "Baza artystów")}
          rightContent={
            <ToolbarButton
              variant="primary"
              icon={<UserPlus size={16} aria-hidden="true" />}
              label={t("artists.dashboard.add_artist", "Dodaj artystę")}
              onClick={() => openPanel(null)}
            />
          }
        />

        <RouteTabs
          variant="underline"
          items={tabs}
          ariaLabel={t("artists.tabs.aria", "Sekcje zespołu")}
        />

        {duplicateGroups.length > 0 && <DuplicateReview groups={duplicateGroups} />}

        <RosterToolbar
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
          rangeFilter={rangeFilter}
          onRangeFilter={setRangeFilter}
          sortBy={sortBy}
          onSort={setSortBy}
          selectionMode={selectionMode}
          onToggleSelectionMode={toggleSelectionMode}
          census={
            <ListCensus
              total={baseTotal}
              noun={t("artists.census.people", "osób", { count: baseTotal })}
              narrowed={
                isNarrowed
                  ? t("artists.census.narrowed", "{{visible}} z {{total}}", {
                      visible: displayArtists.length,
                      total: baseTotal,
                    })
                  : null
              }
            />
          }
          quickFilters={quickFilterChips}
          onResetFilters={resetFilters}
        />

        {displayArtists.length > 0 ? (
          <RecordList label={t("artists.list_aria", "Członkowie zespołu")} columns={ARTIST_COLUMNS}>
            {displayArtists.map((artist) => (
              <ArtistRow
                key={artist.id}
                artist={artist}
                onOpen={openDossier}
                onMessage={openMessage}
                onEdit={openPanel}
                onToggleStatus={handleToggleRequest}
                onResendActivation={handleResendActivation}
                isResending={resendingIds.has(artist.id)}
                selectionMode={selectionMode}
                selected={selectedIds.has(artist.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </RecordList>
        ) : (
          <StatePanel
            icon={<Users size={32} aria-hidden="true" />}
            title={
              isNarrowed
                ? t("artists.dashboard.empty_filtered_title", "Nikt nie pasuje do filtrów")
                : t("artists.dashboard.empty_roster_title", "Twój zespół jest pusty")
            }
            description={
              term
                ? t("artists.dashboard.empty_desc_search", {
                    defaultValue:
                      'Nie znaleźliśmy chórzysty "{{term}}". Możesz dodać go teraz do bazy.',
                    term,
                  })
                : t(
                    "artists.dashboard.empty_desc_default",
                    "Zmień kryteria wyszukiwania lub dodaj nową osobę do bazy.",
                  )
            }
            actions={
              <Button
                variant="secondary"
                casing="sentence"
                onClick={() => openPanel(null, term)}
                leftIcon={<UserPlus size={16} aria-hidden="true" />}
              >
                {term
                  ? t("artists.dashboard.add_search_term", {
                      defaultValue: "Dodaj: {{term}}",
                      term,
                    })
                  : t("artists.dashboard.add_artist", "Dodaj artystę")}
              </Button>
            }
          />
        )}

        <ArtistEditorPanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          artist={editingArtist}
          voiceTypes={voiceTypes}
          initialSearchContext={initialSearchContext}
        />

        <ConfirmModal
          isOpen={!!artistToToggle}
          title={
            artistToToggle?.willBeActive
              ? t("artists.dashboard.activate_title", "Aktywować profil?")
              : t("artists.dashboard.archive_title", "Zarchiwizować artystę?")
          }
          description={
            artistToToggle?.willBeActive
              ? t(
                  "artists.dashboard.activate_desc",
                  "Artysta odzyska możliwość logowania się do platformy i będzie widoczny w obsadzie nowych projektów.",
                )
              : t(
                  "artists.dashboard.archive_desc",
                  "Artysta utraci dostęp do panelu. Jego dane historyczne w przeszłych projektach zostaną zachowane.",
                )
          }
          onConfirm={executeStatusToggle}
          onCancel={() => setArtistToToggle(null)}
          isLoading={isTogglingStatus}
        />

        {messageTarget && (
          <NewThreadModal
            isOpen={isMessageOpen}
            onClose={closeMessage}
            isManager
            presetArtistId={messageTarget.id}
            presetArtistName={`${messageTarget.first_name} ${messageTarget.last_name}`}
          />
        )}

        <ArtistDossier
          isOpen={isDossierOpen}
          onClose={closeDossier}
          artist={dossierTarget}
          onEdit={(artist) => {
            closeDossier();
            openPanel(artist);
          }}
          onMessage={openMessage}
          onResendActivation={handleResendActivation}
          isResending={
            dossierTarget !== null && resendingIds.has(dossierTarget.id)
          }
        />

        <ConfirmModal
          isOpen={pendingBulk !== null}
          title={
            pendingBulk?.isActive
              ? t("artists.bulk.restore_title", "Przywrócić zaznaczonych?")
              : t("artists.bulk.archive_title", "Zarchiwizować zaznaczonych?")
          }
          description={
            pendingBulk?.isActive
              ? t("artists.bulk.restore_desc", {
                  defaultValue:
                    "Zaznaczeni artyści ({{n}}) odzyskają dostęp do platformy i widoczność w obsadzie.",
                  n: pendingBulk?.ids.length ?? 0,
                })
              : t("artists.bulk.archive_desc", {
                  defaultValue:
                    "Zaznaczeni artyści ({{n}}) stracą dostęp do panelu. Dane historyczne zostaną zachowane.",
                  n: pendingBulk?.ids.length ?? 0,
                })
          }
          onConfirm={executeBulkToggle}
          onCancel={() => setPendingBulk(null)}
          isLoading={isBulkPending}
        />

        <AnimatePresence>
          {selectionMode && (
            <BulkActionBar
              selectedTotal={selectionStats.total}
              activeCount={selectionStats.active}
              archivedCount={selectionStats.archived}
              visibleCount={displayArtists.length}
              onSelectAll={selectAllVisible}
              onClear={clearSelection}
              onArchive={() => requestBulkToggle(false)}
              onRestore={() => requestBulkToggle(true)}
              onExit={toggleSelectionMode}
              isPending={isBulkPending}
            />
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
