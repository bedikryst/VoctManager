/**
 * @file CrewTab.tsx
 * @description External Collaborator and Crew Logistics Manager.
 * Employs Hash Maps and Sets for rapid resolution of available crew members.
 * Integrates Framer Motion `<AnimatePresence>` for fluid list mutation animations.
 * @module panel/projects/ProjectEditorPanel/tabs/CrewTab
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Wrench, Trash2, Loader2 } from "lucide-react";

import { useCrewAssignments } from "../hooks/useCrewAssignments";
import { GlassCard } from "../../../../shared/ui/GlassCard";
import { Button } from "../../../../shared/ui/Button";
import { Input } from "../../../../shared/ui/Input";

interface CrewTabProps {
  projectId: string;
}

export default function CrewTab({
  projectId,
}: CrewTabProps): React.JSX.Element | null {
  const {
    isLoading,
    isMutating,
    selectedCrewId,
    setSelectedCrewId,
    roleDesc,
    setRoleDesc,
    availableCrew,
    projectAssignments,
    crewMap,
    handleAssign,
    handleRemove,
  } = useCrewAssignments(projectId);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <form onSubmit={handleAssign}>
        <GlassCard className="p-6 flex flex-col md:flex-row gap-5 items-end">
          <div className="flex-1 w-full">
            <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">
              Zatrudnij z bazy
            </label>
            <select
              required
              value={selectedCrewId}
              onChange={(e) => setSelectedCrewId(e.target.value)}
              className="w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] appearance-none cursor-pointer font-medium"
              disabled={isMutating}
            >
              <option value="">— Wybierz współpracownika —</option>
              {availableCrew.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} ({c.specialty})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 w-full">
            <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">
              Rola na tym koncercie
            </label>
            <Input
              type="text"
              value={roleDesc}
              onChange={(e) => setRoleDesc(e.target.value)}
              placeholder="np. Akustyk FOH"
              disabled={isMutating}
              className="font-medium"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isMutating || !selectedCrewId}
            isLoading={isMutating}
            leftIcon={
              !isMutating ? <Plus size={14} aria-hidden="true" /> : undefined
            }
            className="w-full md:w-auto h-[46px] px-8"
          >
            Przypisz
          </Button>
        </GlassCard>
      </form>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-5 bg-white/40 border-b border-stone-200/60 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shadow-sm">
              <Wrench size={14} className="text-stone-600" aria-hidden="true" />
            </div>
            <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-700">
              Skład Ekipy (Crew)
            </h4>
          </div>
          <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">
            Przypisano: {projectAssignments.length}
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2
              size={24}
              className="animate-spin text-stone-300"
              aria-hidden="true"
            />
          </div>
        ) : (
          <div className="divide-y divide-stone-100/50 max-h-[500px] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
            <AnimatePresence initial={false}>
              {projectAssignments.length > 0 ? (
                projectAssignments.map((assignment) => {
                  const person = crewMap.get(String(assignment.collaborator));
                  if (!person) return null;

                  return (
                    <motion.div
                      key={assignment.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="p-5 flex items-center justify-between hover:bg-white/50 transition-colors"
                    >
                      <div className="flex flex-col gap-0.5">
                        <p className="font-bold text-stone-900 text-sm tracking-tight">
                          {person.first_name} {person.last_name}
                        </p>
                        <p className="text-[9px] font-bold antialiased uppercase text-stone-400 tracking-widest">
                          {assignment.role_description || person.specialty}{" "}
                          {person.company_name && `(${person.company_name})`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemove(assignment.id)}
                        className="p-2.5 text-stone-400 hover:text-red-600 bg-white border border-transparent hover:border-red-200 shadow-sm rounded-xl hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50"
                        disabled={isMutating}
                        title="Usuń z ekipy technicznej"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </motion.div>
                  );
                })
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] text-stone-400 italic p-8 text-center"
                >
                  Brak przypisanej ekipy technicznej.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
