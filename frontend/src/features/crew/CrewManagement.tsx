/**
 * @file CrewManagement.tsx
 * @description Master controller for the External Collaborators dashboard.
 * Keeps the page shell declarative — every domain decision (filtering, metrics,
 * deletion lifecycle) is delegated to the `useCrewData` hook and presentation
 * is fully composed from feature-scoped components.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/CrewManagement
 */

import React, { useDeferredValue, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Plus, Wrench } from "lucide-react";

import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import {
  StaggeredBentoContainer,
  StaggeredBentoItem,
} from "@/shared/ui/kinematics/StaggeredBentoGrid";

import { CrewCard } from "./components/CrewCard";
import { CrewEditorPanel } from "./components/CrewEditorPanel";
import { CrewEmptyState } from "./components/CrewEmptyState";
import { CrewFiltersPanel } from "./components/CrewFiltersPanel";
import { CrewHeroPanel } from "./components/CrewHeroPanel";
import { CrewMetricsGrid } from "./components/CrewMetricsGrid";
import { useCrewData } from "./hooks/useCrewData";

const formatCoverage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

export default function CrewManagement(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isLoading,
    isError,
    crew,
    displayCrew,
    metrics,
    availableCompanies,
    specialtyOptions,
    activeFilters,
    hasActiveFilters,
    activeFilterCount,
    searchTerm,
    setSearchTerm,
    specialtyFilter,
    setSpecialtyFilter,
    companyFilter,
    setCompanyFilter,
    contactFilter,
    setContactFilter,
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
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-0">
        <StaggeredBentoContainer className="flex flex-col gap-6">
          <StaggeredBentoItem>
            <PageHeader
              size="standard"
              roleText={t("crew.dashboard.subtitle", "Logistyka")}
              title={t("crew.dashboard.title", "Ekipa")}
              titleHighlight={t(
                "crew.dashboard.title_highlight",
                "Techniczna",
              )}
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

          <StaggeredBentoItem className="md:hidden">
            <Button
              variant="primary"
              fullWidth
              onClick={() => openPanel(null)}
              leftIcon={<Plus size={16} aria-hidden="true" />}
            >
              {t("crew.dashboard.add_btn", "Dodaj osobę")}
            </Button>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <CrewHeroPanel
              metrics={metrics}
              emailCoverage={emailCoverage}
              phoneCoverage={phoneCoverage}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <CrewMetricsGrid
              metrics={metrics}
              emailCoverage={emailCoverage}
              phoneCoverage={phoneCoverage}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <CrewFiltersPanel
              searchTerm={searchTerm}
              specialtyFilter={specialtyFilter}
              companyFilter={companyFilter}
              contactFilter={contactFilter}
              specialtyOptions={specialtyOptions}
              availableCompanies={availableCompanies}
              hasActiveFilters={hasActiveFilters}
              activeFilterCount={activeFilterCount}
              activeFilters={activeFilters}
              visibleCount={deferredCrew.length}
              totalCount={metrics.totalPeople}
              onSearchTermChange={setSearchTerm}
              onSpecialtyFilterChange={setSpecialtyFilter}
              onCompanyFilterChange={setCompanyFilter}
              onContactFilterChange={setContactFilter}
              onResetFilters={resetFilters}
            />
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <SectionHeader
                  title={t(
                    "crew.dashboard.collection_title",
                    "Zespół produkcyjny",
                  )}
                  icon={<Wrench size={14} aria-hidden="true" />}
                  withFluidDivider={false}
                  className="mb-0 pb-0"
                />
                <Text color="graphite" className="mt-2 max-w-2xl">
                  {t(
                    "crew.dashboard.collection_desc",
                    "Każda karta otwiera szybką edycję profilu, dane firmy i kompletny kontakt operacyjny.",
                  )}
                </Text>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="glass">
                  {t("crew.dashboard.in_view", "{{count}} w widoku", {
                    count: deferredCrew.length,
                  })}
                </Badge>
                {hasActiveFilters && (
                  <Badge variant="outline">
                    {t("crew.dashboard.filtered_view", "Widok filtrowany")}
                  </Badge>
                )}
              </div>
            </div>
          </StaggeredBentoItem>

          <StaggeredBentoItem>
            {deferredCrew.length > 0 ? (
              <StaggeredBentoContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {deferredCrew.map((person) => (
                    <StaggeredBentoItem key={person.id}>
                      <CrewCard
                        person={person}
                        onEdit={openPanel}
                        onDelete={requestDelete}
                      />
                    </StaggeredBentoItem>
                  ))}
                </AnimatePresence>
              </StaggeredBentoContainer>
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
