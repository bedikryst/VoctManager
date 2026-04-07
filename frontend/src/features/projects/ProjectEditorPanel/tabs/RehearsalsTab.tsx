/**
 * @file RehearsalsTab.tsx
 * @description Orchestrates rehearsal scheduling and advanced audience targeting.
 * Uses Hybrid JIT Fetching via useProjectData to resolve relational models rapidly.
 * @module panel/projects/ProjectEditorPanel/tabs/RehearsalsTab
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Trash2,
  Target,
  CheckSquare,
  Clock,
  Users,
  MicVocal,
  UserCheck,
  Calendar1,
  Loader2,
} from "lucide-react";

import { useRehearsalsTab, TargetType } from "../hooks/useRehearsalsTab";
import ConfirmModal from "../../../../shared/ui/ConfirmModal";
import { GlassCard } from "../../../../shared/ui/GlassCard";
import { Button } from "../../../../shared/ui/Button";
import { Input } from "../../../../shared/ui/Input";

interface RehearsalsTabProps {
  projectId: string;
}

const STYLE_LABEL =
  "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";
const STYLE_GLASS_TEXTAREA =
  "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] resize-none";

export default function RehearsalsTab({
  projectId,
}: RehearsalsTabProps): React.JSX.Element | null {
  const {
    isLoading,
    isSubmitting,
    rehearsalToDelete,
    setRehearsalToDelete,
    isDeleting,
    formData,
    setFormData,
    targetType,
    setTargetType,
    selectedSections,
    customParticipants,
    projectRehearsals,
    projectParticipations,
    artistMap,
    handleAdd,
    handleDeleteClick,
    executeDelete,
    toggleSection,
    toggleCustomParticipant,
  } = useRehearsalsTab(projectId);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <form onSubmit={handleAdd}>
        <GlassCard className="p-6 md:p-8 flex flex-col gap-6">
          <div className="flex items-center gap-2.5 border-b border-stone-200/60 pb-3">
            <Clock size={16} className="text-[#002395]" aria-hidden="true" />
            <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800">
              Zaplanuj nową próbę
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex-1 w-full">
              <label className={STYLE_LABEL}>Data i Godzina *</label>
              <Input
                type="datetime-local"
                required
                value={formData.date_time}
                onChange={(e) =>
                  setFormData({ ...formData, date_time: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>
            <div className="flex-1 w-full">
              <label className={STYLE_LABEL}>Lokalizacja (Sala) *</label>
              <Input
                type="text"
                required
                value={formData.location}
                placeholder="np. Sala 102, Akademia"
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="w-full">
            <label className={STYLE_LABEL}>
              Plan Próby / Repertuar (Focus)
            </label>
            <textarea
              rows={2}
              value={formData.focus}
              placeholder="np. Requiem cz. 1-3..."
              onChange={(e) =>
                setFormData({ ...formData, focus: e.target.value })
              }
              className={STYLE_GLASS_TEXTAREA}
              disabled={isSubmitting}
            />
          </div>

          <div className="bg-white/60 border border-stone-200/60 rounded-2xl p-5 shadow-sm overflow-hidden">
            <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 mb-4 ml-1">
              Kto jest wezwany na próbę?
            </label>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              {[
                {
                  id: "TUTTI",
                  label: "Tutti (Wszyscy)",
                  icon: <Users size={14} aria-hidden="true" />,
                },
                {
                  id: "SECTIONAL",
                  label: "Próba Sekcyjna",
                  icon: <MicVocal size={14} aria-hidden="true" />,
                },
                {
                  id: "CUSTOM",
                  label: "Wybrane osoby",
                  icon: <UserCheck size={14} aria-hidden="true" />,
                },
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setTargetType(type.id as TargetType)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest transition-all active:scale-95 ${targetType === type.id ? "bg-[#002395] border border-[#001766] text-white shadow-md" : "bg-white/80 border border-stone-200/80 text-stone-500 hover:bg-white shadow-sm"}`}
                >
                  {type.icon} {type.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {targetType === "SECTIONAL" && (
                <motion.div
                  key="sectional"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-wrap gap-2 pt-4 border-t border-stone-200/60 overflow-hidden"
                >
                  {[
                    { id: "S", label: "Soprany" },
                    { id: "A", label: "Alty" },
                    { id: "T", label: "Tenory" },
                    { id: "B", label: "Basy" },
                  ].map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => toggleSection(sec.id)}
                      className={`px-5 py-2.5 rounded-xl border text-[10px] antialiased uppercase tracking-widest font-bold transition-all active:scale-95 ${selectedSections.includes(sec.id) ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm" : "bg-white/60 border-stone-200/80 text-stone-500 hover:border-stone-300 hover:bg-white"}`}
                    >
                      {sec.label}
                    </button>
                  ))}
                </motion.div>
              )}

              {targetType === "CUSTOM" && (
                <motion.div
                  key="custom"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-4 border-t border-stone-200/60 max-h-[160px] overflow-y-auto scrollbar-hide"
                >
                  {projectParticipations.map((p) => {
                    const artist = artistMap.get(String(p.artist));
                    if (!artist) return null;

                    const isSelected = customParticipants.includes(
                      String(p.id),
                    );
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleCustomParticipant(String(p.id))}
                        className={`cursor-pointer px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between transition-all active:scale-95 ${isSelected ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold shadow-sm" : "bg-white/60 border-stone-200/80 text-stone-600 hover:bg-white"}`}
                      >
                        <span className="truncate tracking-tight font-bold">
                          {artist.first_name} {artist.last_name}
                        </span>
                        <span className="text-[8px] antialiased font-bold uppercase tracking-widest opacity-60 ml-2">
                          {artist.voice_type_display || artist.voice_type || ""}
                        </span>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 pt-3">
            <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-white/50 transition-colors">
              <input
                type="checkbox"
                checked={formData.is_mandatory}
                onChange={(e) =>
                  setFormData({ ...formData, is_mandatory: e.target.checked })
                }
                className="w-4 h-4 text-[#002395] rounded-md cursor-pointer border-stone-300 focus:ring-[#002395]"
                disabled={isSubmitting}
              />
              <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-700">
                Obecność obowiązkowa dla wezwanych
              </span>
            </label>

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              className="w-full md:w-auto"
            >
              Zapisz w kalendarzu
            </Button>
          </div>
        </GlassCard>
      </form>

      {/* SCHEDULED SESSIONS FEED */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 flex items-center gap-2 mb-5 ml-1">
          <CheckSquare
            size={16}
            className="text-[#002395]"
            aria-hidden="true"
          />{" "}
          Harmonogram Prób
        </h4>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2
              size={24}
              className="animate-spin text-stone-400"
              aria-hidden="true"
            />
          </div>
        ) : projectRehearsals.length > 0 ? (
          projectRehearsals.map((reh) => {
            const isPast = new Date(reh.date_time) < new Date();
            const invitedCount = reh.invited_participations?.length || 0;
            const isTutti =
              invitedCount === 0 ||
              invitedCount === projectParticipations.length;

            return (
              <div
                key={reh.id}
                className={`flex flex-col md:flex-row justify-between md:items-center p-5 rounded-2xl border shadow-sm transition-all ${isPast ? "border-stone-200/50 bg-stone-50/40 opacity-75" : "bg-white/80 backdrop-blur-md border-stone-200/80 hover:border-[#002395]/40 hover:shadow-md"}`}
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div
                      className={`px-3 py-1.5 rounded-lg border font-bold text-sm tracking-tight shadow-sm ${isPast ? "bg-white/50 border-stone-200 text-stone-500" : "bg-blue-50 border-blue-100 text-[#002395]"}`}
                    >
                      {new Date(reh.date_time).toLocaleString("pl-PL", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>

                    {isPast && (
                      <span className="px-2.5 py-1 bg-stone-200/60 text-stone-600 text-[8px] antialiased uppercase tracking-widest font-bold rounded-md">
                        Zakończona
                      </span>
                    )}

                    <span
                      className={`px-2.5 py-1 border text-[8px] antialiased uppercase tracking-widest font-bold rounded-md shadow-sm ${isTutti ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}
                    >
                      {isTutti ? "TUTTI" : `Wezwanych: ${invitedCount}`}
                    </span>

                    {!reh.is_mandatory && (
                      <span className="px-2.5 py-1 bg-orange-50 text-orange-600 border border-orange-200 shadow-sm text-[8px] antialiased uppercase tracking-widest font-bold rounded-md">
                        Opcjonalna
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mt-3 md:mt-0">
                    <div className="text-xs font-bold text-stone-700 flex items-center gap-2">
                      <MapPin
                        size={14}
                        className="text-stone-400"
                        aria-hidden="true"
                      />{" "}
                      {reh.location}
                    </div>
                    {reh.focus && (
                      <div className="text-xs text-stone-600 flex items-start gap-2">
                        <Target
                          size={14}
                          className="text-[#002395] flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span className="italic opacity-90">{reh.focus}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 md:mt-0 md:ml-4 flex items-center justify-end border-t md:border-t-0 border-stone-200/50 pt-4 md:pt-0">
                  <button
                    onClick={() => handleDeleteClick(reh.id)}
                    className="text-stone-400 hover:text-red-500 p-2.5 rounded-xl bg-white border border-transparent hover:border-red-200 hover:bg-red-50 transition-all shadow-sm active:scale-95"
                    title="Usuń próbę"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <GlassCard className="p-10 text-center text-stone-400 flex flex-col items-center">
            <Calendar1
              size={32}
              className="mb-3 opacity-30"
              aria-hidden="true"
            />
            <p className="text-[10px] font-bold antialiased uppercase tracking-widest">
              Brak zaplanowanych prób
            </p>
          </GlassCard>
        )}
      </div>

      <ConfirmModal
        isOpen={!!rehearsalToDelete}
        title="Usunąć tę próbę?"
        description="Powiązane z tą próbą listy obecności zostaną bezpowrotnie wykasowane. Tej operacji nie można cofnąć."
        onConfirm={executeDelete}
        onCancel={() => setRehearsalToDelete(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}
