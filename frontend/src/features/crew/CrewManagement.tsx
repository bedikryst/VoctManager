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
import { Plus, RotateCcw, X } from "lucide-react";

import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
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
import { CrewEmptyState } from "./components/CrewEmptyState";
import { CrewSpecialtyBar } from "./components/CrewSpecialtyBar";
import { CrewToolbar } from "./components/CrewToolbar";
import { useCrewData } from "./hooks/useCrewData";

const formatCoverage = (value: number, total: number): number =>
  total === 0 ? 0 : Math.round((value / total) * 100);

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
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <Caption color="muted" className="tabular-nums">
                {t("crew.filters.summary", {
                  visible: deferredCrew.length,
                  total: metrics.totalPeople,
                  defaultValue: "{{visible}} z {{total}} osób w widoku.",
                })}
              </Caption>

              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2">
                  {activeFilters.map((token) => (
                    <button
                      key={token.id}
                      type="button"
                      onClick={token.clear}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ethereal-ink/10 bg-ethereal-alabaster/70 px-3 py-1 text-[11px] font-medium text-ethereal-graphite transition-colors hover:border-ethereal-gold/35 hover:text-ethereal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/30"
                    >
                      <span>{token.label}</span>
                      <X size={12} aria-hidden="true" />
                    </button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    leftIcon={<RotateCcw size={13} aria-hidden="true" />}
                  >
                    {t("crew.filters.clear_filters", "Wyczyść filtry")}
                  </Button>
                </div>
              )}
            </div>
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
              <CrewEmptyState
                searchTerm={normalizedSearchTerm}
                hasActiveFilters={hasActiveFilters}
                onCreatePerson={() => openPanel(null, normalizedSearchTerm)}
                onResetFilters={resetFilters}
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
