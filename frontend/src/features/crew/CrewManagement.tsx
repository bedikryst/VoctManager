/**
 * @file CrewManagement.tsx
 * @description External Collaborators & Crew Management Module Controller.
 * Delegates data fetching and filtering to the useCrewData hook and isolates rendering to CrewCard.
 * @module panel/crew/CrewManagement
 */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Plus, Search, Filter, Wrench } from "lucide-react";

import { ConfirmModal } from "@ui/composites/ConfirmModal";
import { Button } from "@ui/primitives/Button";
import { Input } from "@ui/primitives/Input";
import { GlassCard } from "@ui/composites/GlassCard";
import { useBodyScrollLock } from "@/shared/lib/hooks/useBodyScrollLock";

import CrewEditorPanel from "./components/CrewEditorPanel";
import { CrewCard } from "./components/CrewCard";
import { useCrewData } from "./hooks/useCrewData";
import { SPECIALTY_CHOICES } from "./types/crew.dto";

export default function CrewManagement(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isLoading,
    isError,
    displayCrew,
    searchTerm,
    setSearchTerm,
    specialtyFilter,
    setSpecialtyFilter,
    isPanelOpen,
    editingPerson,
    initialSearchContext,
    personToDelete,
    setPersonToDelete,
    isDeleting,
    openPanel,
    closePanel,
    executeDelete,
  } = useCrewData();

  useEffect(() => {
    if (isError)
      toast.error(t("crew.toast.sync_warning", "Ostrzeżenie"), {
        description: t(
          "crew.toast.sync_error",
          "Nie udało się pobrać listy współpracowników.",
        ),
      });
  }, [isError, t]);

  useBodyScrollLock(isPanelOpen || personToDelete !== null);

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-7xl mx-auto px-4 sm:px-0">
      <header className="relative pt-2 mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                <Wrench size={12} className="text-brand" aria-hidden="true" />
                <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-brand/80">
                  {t("crew.dashboard.subtitle", "Logistyka")}
                </p>
              </div>
              <h1
                className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                {t("crew.dashboard.title", "Ekipa")}{" "}
                <span className="italic text-brand">
                  {t("crew.dashboard.title_highlight", "Techniczna")}
                </span>
                .
              </h1>
            </div>
            <Button
              variant="primary"
              onClick={() => openPanel(null)}
              leftIcon={<Plus size={16} aria-hidden="true" />}
            >
              {t("crew.dashboard.add_btn", "Dodaj Osobę / Firmę")}
            </Button>
          </div>
        </motion.div>
      </header>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <Input
            leftIcon={<Search size={16} />}
            type="text"
            placeholder={t(
              "crew.dashboard.search_placeholder",
              "Szukaj po nazwisku lub firmie...",
            )}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-72 flex-shrink-0">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Filter size={16} className="text-stone-400" aria-hidden="true" />
          </div>
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] font-bold appearance-none cursor-pointer"
          >
            <option value="">
              {t("crew.dashboard.filter_all", "Wszystkie specjalizacje")}
            </option>
            {SPECIALTY_CHOICES.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-64 bg-stone-100/50 rounded-[2rem] border border-white/50 animate-pulse"
            ></div>
          ))
        ) : displayCrew.length > 0 ? (
          <AnimatePresence>
            {displayCrew.map((person) => (
              <CrewCard
                key={person.id}
                person={person}
                onEdit={openPanel}
                onDelete={(id) => setPersonToDelete(id)}
              />
            ))}
          </AnimatePresence>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full"
          >
            <GlassCard className="p-16 text-center flex flex-col items-center justify-center">
              <Wrench
                size={48}
                className="text-stone-300 mb-4 opacity-50"
                aria-hidden="true"
              />
              <span className="text-[11px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-2">
                {t("crew.dashboard.empty_title", "Brak wyników")}
              </span>

              {searchTerm ? (
                <div className="flex flex-col items-center gap-3 mt-2">
                  <span className="text-xs text-stone-400 max-w-sm">
                    {t(
                      "crew.dashboard.empty_desc_search",
                      'Nie znaleźliśmy firmy lub osoby "{{term}}". Możesz dodać ją teraz.',
                      { term: searchTerm },
                    )}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => openPanel(null, searchTerm)}
                    leftIcon={<Plus size={14} aria-hidden="true" />}
                    className="mt-2"
                  >
                    {t(
                      "crew.dashboard.add_search_term",
                      "Dodaj do bazy: {{term}}",
                      { term: searchTerm },
                    )}
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-stone-400 max-w-sm">
                  {t(
                    "crew.dashboard.empty_desc_default",
                    "Zmień filtry lub dodaj nową osobę / firmę do bazy.",
                  )}
                </span>
              )}
            </GlassCard>
          </motion.div>
        )}
      </div>

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
        onCancel={() => setPersonToDelete(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}
