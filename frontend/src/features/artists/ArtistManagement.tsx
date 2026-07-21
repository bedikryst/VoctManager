/**
 * @file ArtistManagement.tsx
 * @description Roster command centre. Ensemble-balance strip (section read +
 * filter) → search / sort / density toolbar → grid or list of singers. Editing
 * happens in a slide-over; one-click messaging is wired at the page level so a
 * single thread composer serves every card and row.
 * @architecture Enterprise SaaS 2026
 * @module features/artists/ArtistManagement
 */

import React, { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { UserPlus, Users } from "lucide-react";

import { useArtistData } from "./hooks/useArtistData";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import ArtistEditorPanel from "./components/ArtistEditorPanel";
import { ArtistCard } from "./components/ArtistCard";
import { ArtistRow } from "./components/ArtistRow";
import { ArtistDossier } from "./components/ArtistDossier";
import { BulkActionBar } from "./components/BulkActionBar";
import { EnsembleBalance } from "./components/EnsembleBalance";
import { RosterToolbar } from "./components/RosterToolbar";
import { NewThreadModal } from "@/features/messages/components/NewThreadModal";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

export default function ArtistManagement(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isLoading,
    isError,
    voiceTypes,
    searchTerm,
    setSearchTerm,
    voiceFilter,
    setVoiceFilter,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    ensembleBalance,
    accountPendingCount,
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

  // Deep-links from the command palette: ?focus=<id> opens that singer's
  // dossier, ?new=1 opens the create panel. Consumed once (a ref guard), then
  // the param is stripped so refresh / back doesn't reopen the surface.
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current) return;
    const focusId = searchParams.get("focus");
    const wantsNew = searchParams.get("new") === "1";
    if (!focusId && !wantsNew) return;
    if (isLoading) return;

    deepLinkConsumed.current = true;
    if (wantsNew) {
      openPanel(null);
    } else if (focusId) {
      const target = displayArtists.find(
        (artist) => String(artist.id) === focusId,
      );
      if (target) openDossier(target);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    isLoading,
    displayArtists,
    openDossier,
    openPanel,
    setSearchParams,
  ]);

  useBodyScrollLock(
    isPanelOpen ||
      isDossierOpen ||
      artistToToggle !== null ||
      pendingBulk !== null,
  );

  if (isLoading && displayArtists.length === 0) {
    return <EtherealLoader />;
  }

  const isFiltering = Boolean(searchTerm.trim()) || voiceFilter !== "";

  return (
    <PageTransition>
      <div className="relative mx-auto max-w-7xl cursor-default pb-24 pt-6">
        <StaggeredBentoContainer className="space-y-5">
          <StaggeredBentoItem>
            <PageHeader
              size="standard"
              roleText={t("artists.dashboard.subtitle", "Zasoby Ludzkie")}
              title={t("artists.dashboard.title_prefix", "Zarządzanie")}
              titleHighlight={t("artists.dashboard.title_highlight", "Zespołem")}
              rightContent={
                <Button
                  variant="primary"
                  onClick={() => openPanel(null)}
                  leftIcon={<UserPlus size={16} aria-hidden="true" />}
                >
                  {t("artists.dashboard.add_artist", "Dodaj Artystę")}
                </Button>
              }
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <EnsembleBalance
              balance={ensembleBalance}
              accountPending={accountPendingCount}
              activeSection={voiceFilter}
              onSelectSection={setVoiceFilter}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <RosterToolbar
              searchTerm={searchTerm}
              onSearch={setSearchTerm}
              sortBy={sortBy}
              onSort={setSortBy}
              viewMode={viewMode}
              onViewMode={setViewMode}
              selectionMode={selectionMode}
              onToggleSelectionMode={toggleSelectionMode}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            {displayArtists.length > 0 ? (
              viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <AnimatePresence>
                    {displayArtists.map((artist) => (
                      <ArtistCard
                        key={artist.id}
                        artist={artist}
                        onOpen={openDossier}
                        onMessage={openMessage}
                        onToggleStatus={handleToggleRequest}
                        onResendActivation={handleResendActivation}
                        isResending={resendingIds.has(artist.id)}
                        selectionMode={selectionMode}
                        selected={selectedIds.has(artist.id)}
                        onToggleSelect={toggleSelect}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {displayArtists.map((artist) => (
                    <ArtistRow
                      key={artist.id}
                      artist={artist}
                      onOpen={openDossier}
                      onMessage={openMessage}
                      onToggleStatus={handleToggleRequest}
                      onResendActivation={handleResendActivation}
                      isResending={resendingIds.has(artist.id)}
                      selectionMode={selectionMode}
                      selected={selectedIds.has(artist.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              )
            ) : (
              <StatePanel
                icon={<Users size={32} aria-hidden="true" />}
                eyebrow={t("artists.dashboard.empty_title", "Brak wyników")}
                title={
                  isFiltering
                    ? t(
                        "artists.dashboard.empty_filtered_title",
                        "Nikt nie pasuje do filtrów",
                      )
                    : t(
                        "artists.dashboard.empty_roster_title",
                        "Twój zespół jest pusty",
                      )
                }
                description={
                  searchTerm.trim()
                    ? t("artists.dashboard.empty_desc_search", {
                        defaultValue:
                          'Nie znaleźliśmy chórzysty "{{term}}". Możesz dodać go teraz do bazy.',
                        term: searchTerm,
                      })
                    : t(
                        "artists.dashboard.empty_desc_default",
                        "Zmień kryteria wyszukiwania lub dodaj nową osobę do bazy.",
                      )
                }
                actions={
                  searchTerm.trim() ? (
                    <Button
                      variant="secondary"
                      onClick={() => openPanel(null, searchTerm)}
                      leftIcon={<UserPlus size={14} aria-hidden="true" />}
                    >
                      {t("artists.dashboard.add_search_term", {
                        defaultValue: "Dodaj: {{term}}",
                        term: searchTerm,
                      })}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => openPanel(null)}
                      leftIcon={<UserPlus size={14} aria-hidden="true" />}
                    >
                      {t("artists.dashboard.add_artist", "Dodaj Artystę")}
                    </Button>
                  )
                }
              />
            )}
          </StaggeredBentoItem>
        </StaggeredBentoContainer>

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
