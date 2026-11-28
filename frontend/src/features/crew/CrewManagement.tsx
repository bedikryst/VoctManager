/**
 * @file CrewManagement.tsx
 * @description The crew: the external collaborators a production calls on,
 * as a list whose rows open the editor panel. Collaborators have no accounts,
 * so there is no dossier and no bulk lifecycle; editing is the open action,
 * and contact lives in each row's menu.
 *
 * The title with "Dodaj osobę", then the toolbar: the search, "Filtry" with
 * the specialty, the company, the contact filter and the order, and the
 * census line with the one quick filter, the collaborators without a full
 * contact.
 * @module features/crew/CrewManagement
 */

import React, { useDeferredValue, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { RotateCcw, UserPlus, UsersRound } from "lucide-react";

import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { FilterToggle } from "@/shared/ui/composites/FilterTokens";
import { ListCensus, ToolbarButton } from "@/shared/ui/composites/ListToolbar";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { RecordList } from "@/shared/ui/composites/RecordList";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";

import { CrewEditorPanel } from "./components/CrewEditorPanel";
import { CrewRow } from "./components/CrewRow";
import { CrewToolbar } from "./components/CrewToolbar";
import { getCrewSpecialtyOptions } from "./constants/crewSpecialties";
import { useCrewData } from "./hooks/useCrewData";

export default function CrewManagement(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isLoading,
    isError,
    crew,
    displayCrew,
    availableCompanies,
    missingContactCount,
    activeFilters,
    hasActiveFilters,
    panelFilterCount,
    searchTerm,
    setSearchTerm,
    specialtyFilter,
    setSpecialtyFilter,
    companyFilter,
    setCompanyFilter,
    contactFilter,
    setContactFilter,
    onlyMissingContact,
    setOnlyMissingContact,
    sortBy,
    setSortBy,
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
  const specialtyOptions = useMemo(() => getCrewSpecialtyOptions(t), [t]);

  useEffect(() => {
    if (!isError) return;
    toast.error(t("crew.toast.sync_warning", "Ostrzeżenie synchronizacji"), {
      description: t("crew.toast.sync_error", "Nie udało się pobrać listy ekipy."),
    });
  }, [isError, t]);

  if (isLoading && crew.length === 0) {
    return <EtherealLoader />;
  }

  const total = crew.length;

  return (
    <PageTransition>
      <div className="relative mx-auto flex max-w-5xl flex-col gap-5 pb-24 pt-6">
        <PageHeader
          size="compact"
          title={t("crew.dashboard.title", "Ekipa techniczna")}
          rightContent={
            <ToolbarButton
              variant="primary"
              icon={<UserPlus size={16} aria-hidden="true" />}
              label={t("crew.dashboard.add_btn", "Dodaj osobę")}
              onClick={() => openPanel(null)}
            />
          }
        />

        <CrewToolbar
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
          specialtyOptions={specialtyOptions}
          specialtyFilter={specialtyFilter}
          onSpecialtyFilter={setSpecialtyFilter}
          availableCompanies={availableCompanies}
          companyFilter={companyFilter}
          onCompanyFilter={setCompanyFilter}
          contactFilter={contactFilter}
          onContactFilter={setContactFilter}
          sortBy={sortBy}
          onSort={setSortBy}
          panelFilterCount={panelFilterCount}
          census={
            <ListCensus
              total={total}
              noun={t("crew.census.people", "osób", { count: total })}
              narrowed={
                hasActiveFilters
                  ? t("crew.census.narrowed", "{{visible}} z {{total}}", {
                      visible: deferredCrew.length,
                      total,
                    })
                  : null
              }
            />
          }
          quickFilters={
            missingContactCount > 0 ? (
              <FilterToggle
                label={t("crew.quick.missing_contact", "{{count}} bez pełnego kontaktu", {
                  count: missingContactCount,
                })}
                pressed={onlyMissingContact}
                onToggle={() => setOnlyMissingContact((on) => !on)}
              />
            ) : null
          }
          activeFilters={activeFilters}
          onResetFilters={resetFilters}
        />

        {deferredCrew.length > 0 ? (
          <RecordList label={t("crew.list_aria", "Ekipa techniczna")}>
            {deferredCrew.map((person) => (
              <CrewRow key={person.id} person={person} onOpen={openPanel} onDelete={requestDelete} />
            ))}
          </RecordList>
        ) : (
          <StatePanel
            icon={<UsersRound size={32} aria-hidden="true" />}
            title={
              hasActiveFilters
                ? t("crew.empty_state.filtered_title", "Nikt nie pasuje do filtrów")
                : t("crew.empty_state.pristine_title", "Nikogo tu jeszcze nie ma")
            }
            description={
              normalizedSearchTerm
                ? t("crew.empty_state.search_results", {
                    defaultValue:
                      "Nie ma osoby ani firmy „{{term}}”. Możesz dodać nową osobę albo zdjąć część filtrów.",
                    term: normalizedSearchTerm,
                  })
                : hasActiveFilters
                  ? t(
                      "crew.empty_state.filters_blocked",
                      "Aktualne filtry ukrywają całą bazę. Wyczyść je, aby wrócić do pełnego spisu.",
                    )
                  : t(
                      "crew.empty_state.start_building",
                      "Tu trafiają osoby, które pracują przy koncertach poza chórem: dźwięk, światło, logistyka.",
                    )
            }
            actions={
              <>
                <Button
                  variant="secondary"
                  casing="sentence"
                  onClick={() => openPanel(null, normalizedSearchTerm)}
                  leftIcon={<UserPlus size={16} aria-hidden="true" />}
                >
                  {normalizedSearchTerm
                    ? t("crew.empty_state.add_search", {
                        defaultValue: "Dodaj osobę „{{term}}”",
                        term: normalizedSearchTerm,
                      })
                    : t("crew.empty_state.add_person", "Dodaj osobę")}
                </Button>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    casing="sentence"
                    onClick={() => {
                      resetFilters();
                      setOnlyMissingContact(false);
                    }}
                    leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                  >
                    {t("crew.filters.clear_filters", "Wyczyść filtry")}
                  </Button>
                )}
              </>
            }
          />
        )}

        <CrewEditorPanel
          isOpen={isPanelOpen}
          onClose={closePanel}
          person={editingPerson}
          initialSearchContext={initialSearchContext}
        />

        <ConfirmModal
          isOpen={!!personToDelete}
          title={t("crew.delete_modal.title", "Usunąć tę osobę z ekipy?")}
          description={t(
            "crew.delete_modal.desc",
            "Zniknie z listy na stałe. Osoby przypisanej już do koncertu nie można usunąć, można tylko poprawić jej dane.",
          )}
          onConfirm={executeDelete}
          onCancel={cancelDelete}
          isLoading={isDeleting}
        />
      </div>
    </PageTransition>
  );
}
