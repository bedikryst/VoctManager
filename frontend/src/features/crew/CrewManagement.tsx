/**
 * @file CrewManagement.tsx
 * @description External-collaborators roster. Specialty-balance strip (read +
 * filter) → search / contact / sort / density toolbar → grid or list of
 * click-to-open cards. Mirrors the artists roster; collaborators have no
 * accounts, so there is no dossier or bulk lifecycle — editing is the primary
 * open action.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/CrewManagement
 */

import React, { useDeferredValue, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Plus, RotateCcw, UsersRound } from "lucide-react";

import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { FilterTokens } from "@/shared/ui/composites/FilterTokens";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";

import { CrewCard } from "./components/CrewCard";
import { CrewRow } from "./components/CrewRow";
import { CrewEditorPanel } from "./components/CrewEditorPanel";
import { CrewSpecialtyBar } from "./components/CrewSpecialtyBar";
import { CrewToolbar } from "./components/CrewToolbar";
import { useCrewData } from "./hooks/useCrewData";

/** `null` where there is nobody to compute a rate over — see the strip header. */
const formatCoverage = (value: number, total: number): number | null =>
  total === 0 ? null : Math.round((value / total) * 100);

export default function CrewManagement(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isLoading,
    isError,
    crew,
    displayCrew,
    metrics,
    specialtyCounts,
    availableCompanies,
    specialtyOptions,
    activeFilters,
    hasActiveFilters,
    searchTerm,
    setSearchTerm,
    specialtyFilter,
    setSpecialtyFilter,
    companyFilter,
    setCompanyFilter,
    contactFilter,
    setContactFilter,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    resetFilters,
    isPanelOpen,
    editingPerson,
    initialSearchContext,
    openPanel,
    closePanel,
    personToDelete,
    requestDelete,
    cancelDelete,
    isDeleting,
    executeDelete,
  } = useCrewData();

  const deferredCrew = useDeferredValue(displayCrew);
  const normalizedSearchTerm = searchTerm.trim();
  const emailCoverage = formatCoverage(metrics.withEmail, metrics.totalPeople);
  const phoneCoverage = formatCoverage(metrics.withPhone, metrics.totalPeople);

  useBodyScrollLock(isPanelOpen || personToDelete !== null);

  useEffect(() => {
    if (!isError) return;
    toast.error(t("crew.toast.sync_warning", "Ostrzeżenie synchronizacji"), {
      description: t(
        "crew.toast.sync_error",
        "Nie udało się pobrać listy współpracowników.",
      ),
    });
  }, [isError, t]);

  if (isLoading && crew.length === 0) {
    return <EtherealLoader />;
  }

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 pb-24 pt-6">
        <StaggeredBentoContainer className="flex flex-col gap-5">
          <StaggeredBentoItem>
            <PageHeader
              size="standard"
              roleText={t("crew.dashboard.subtitle", "Logistyka")}
              title={t("crew.dashboard.title", "Ekipa")}
              titleHighlight={t("crew.dashboard.title_highlight", "Techniczna")}
              rightContent={
                <Button
                  variant="primary"
                  onClick={() => openPanel(null)}
                  leftIcon={<Plus size={16} aria-hidden="true" />}
                >
                  {t("crew.dashboard.add_btn", "Dodaj osobę")}
                </Button>
              }
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <CrewSpecialtyBar
              specialtyOptions={specialtyOptions}
              counts={specialtyCounts}
              totalPeople={metrics.totalPeople}
              uniqueCompanies={metrics.uniqueCompanies}
              emailCoverage={emailCoverage}
              phoneCoverage={phoneCoverage}
              activeSpecialty={specialtyFilter}
              onSelectSpecialty={setSpecialtyFilter}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <CrewToolbar
              searchTerm={searchTerm}
              onSearch={setSearchTerm}
              companyFilter={companyFilter}
              onCompanyFilter={setCompanyFilter}
              availableCompanies={availableCompanies}
              contactFilter={contactFilter}
              onContactFilter={setContactFilter}
              sortBy={sortBy}
              onSort={setSortBy}
              viewMode={viewMode}
              onViewMode={setViewMode}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <FilterTokens
              tokens={activeFilters}
              onClearAll={resetFilters}
              summary={
                <Caption color="muted" className="tabular-nums">
                  {t("crew.filters.summary", {
                    visible: deferredCrew.length,
                    total: metrics.totalPeople,
                    defaultValue: "{{visible}} z {{total}} osób w widoku.",
                  })}
                </Caption>
              }
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            {deferredCrew.length > 0 ? (
              viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {deferredCrew.map((person) => (
                    <CrewCard
                      key={person.id}
                      person={person}
                      onOpen={openPanel}
                      onDelete={requestDelete}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {deferredCrew.map((person) => (
                    <CrewRow
                      key={person.id}
                      person={person}
                      onOpen={openPanel}
                      onDelete={requestDelete}
                    />
                  ))}
                </div>
              )
            ) : (
              <StatePanel
                icon={<UsersRound size={32} aria-hidden="true" />}
                eyebrow={t(
                  "crew.empty_state.title",
                  "Brak osób w bieżącym widoku",
                )}
                title={
                  hasActiveFilters
                    ? t(
                        "crew.empty_state.filtered_title",
                        "Nikt nie pasuje do filtrów",
                      )
                    : t(
                        "crew.empty_state.pristine_title",
                        "Twoja baza ekipy jest pusta",
                      )
                }
                description={
                  normalizedSearchTerm
                    ? t("crew.empty_state.search_results", {
                        defaultValue:
                          'Nie znaleźliśmy osoby ani firmy "{{term}}". Możesz dodać nowy wpis lub usunąć część filtrów.',
                        term: normalizedSearchTerm,
                      })
                    : hasActiveFilters
                      ? t(
                          "crew.empty_state.filters_blocked",
                          "Aktualne filtry ukrywają całą bazę. Wyczyść je, aby wrócić do pełnego spisu.",
                        )
                      : t(
                          "crew.empty_state.start_building",
                          "Rozpocznij budowę zespołu produkcyjnego, dodając pierwszego współpracownika do bazy.",
                        )
                }
                actions={
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => openPanel(null, normalizedSearchTerm)}
                      leftIcon={<Plus size={14} aria-hidden="true" />}
                    >
                      {normalizedSearchTerm
                        ? t("crew.empty_state.add_search", {
                            defaultValue: 'Dodaj wpis "{{term}}"',
                            term: normalizedSearchTerm,
                          })
                        : t(
                            "crew.empty_state.add_person",
                            "Dodaj współpracownika",
                          )}
                    </Button>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        onClick={resetFilters}
                        leftIcon={<RotateCcw size={14} aria-hidden="true" />}
                      >
                        {t("crew.filters.clear_filters", "Wyczyść filtry")}
                      </Button>
                    )}
                  </>
                }
              />
            )}
          </StaggeredBentoItem>
        </StaggeredBentoContainer>

        <CrewEditorPanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          person={editingPerson}
          initialSearchContext={initialSearchContext}
        />

        <ConfirmModal
          isOpen={!!personToDelete}
          title={t("crew.delete_modal.title", "Usunąć tę osobę z bazy?")}
          description={t(
            "crew.delete_modal.desc",
            "Zniknie ona bezpowrotnie ze spisu. Nie można usunąć osób powiązanych już z koncertami (w takim przypadku zaktualizuj jej dane).",
          )}
          onConfirm={executeDelete}
          onCancel={cancelDelete}
          isLoading={isDeleting}
        />
      </div>
    </PageTransition>
  );
}
