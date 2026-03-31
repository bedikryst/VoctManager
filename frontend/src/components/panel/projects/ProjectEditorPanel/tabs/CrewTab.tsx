/**
 * @file CrewTab.tsx
 * @description External Collaborator and Crew Logistics Manager.
 * @architecture
 * ENTERPRISE 2026:
 * - Deprecated `useProjectData` in favor of Hybrid JIT Fetching (Context for definitions, React Query for relations).
 * - Employs O(1) Hash Maps and Sets to securely and rapidly resolve available crew members.
 * - Integrates Framer Motion `<AnimatePresence>` for fluid, zero-jank mounting/unmounting of crew roster cards.
 * BUGFIX: Implemented `queryKeys` factory for global cache synchronization.
 * @module project/ProjectEditorPanel/tabs/CrewTab
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useContext } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Wrench, Trash2, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import api from '../../../../../utils/api';
import { queryKeys } from '../../../../../utils/queryKeys';
import { ProjectDataContext, IProjectDataContext } from '../../ProjectDashboard';
import type { Collaborator, CrewAssignment } from '../../../../../types';

interface CrewTabProps {
  projectId: string;
}

const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden";
const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function CrewTab({ projectId }: CrewTabProps): React.JSX.Element | null {
  const queryClient = useQueryClient();
  
  const context = useContext(ProjectDataContext) as IProjectDataContext;
  if (!context) return null;
  const { crew } = context;

  // --- Safe JIT Data Fetching with Query Keys Factory ---
  const { data: crewAssignments = [], isLoading } = useQuery<CrewAssignment[]>({
    queryKey: queryKeys.crewAssignments.byProject(projectId),
    queryFn: async () => {
      const res = await api.get(`/api/crew-assignments/?project=${projectId}`);
      return Array.isArray(res.data) ? res.data : (res.data?.results || []);
    },
    staleTime: 60000
  });

  const [selectedCrewId, setSelectedCrewId] = useState<string>('');
  const [roleDesc, setRoleDesc] = useState<string>('');
  const [isMutating, setIsMutating] = useState<boolean>(false);

  const projectAssignments = useMemo<CrewAssignment[]>(() => {
    return crewAssignments.filter((a) => String(a.project) === String(projectId));
  }, [crewAssignments, projectId]);

  const assignedCrewIds = useMemo<Set<string>>(() => {
    return new Set(projectAssignments.map((a) => String(a.collaborator)));
  }, [projectAssignments]);

  const availableCrew = useMemo<Collaborator[]>(() => {
    return crew.filter((c) => !assignedCrewIds.has(String(c.id)));
  }, [crew, assignedCrewIds]);

  const crewMap = useMemo<Map<string, Collaborator>>(() => {
    const map = new Map<string, Collaborator>();
    crew.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [crew]);

  const handleAssign = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!selectedCrewId) return;

    setIsMutating(true);
    const toastId = toast.loading("Przypisywanie członka ekipy...");

    try {
      await api.post('/api/crew-assignments/', { 
        project: projectId, 
        collaborator: selectedCrewId,
        role_description: roleDesc 
      });
      
      setSelectedCrewId('');
      setRoleDesc('');
      
      await queryClient.invalidateQueries({ queryKey: queryKeys.crewAssignments.all });
      toast.success("Członek ekipy przypisany pomyślnie", { id: toastId });
    } catch (err) {
      toast.error("Błąd przypisania", { id: toastId, description: "Nie udało się przypisać członka ekipy do projektu." });
    } finally {
      setIsMutating(false);
    }
  };

  const handleRemove = async (id: string | number): Promise<void> => {
    const toastId = toast.loading("Usuwanie członka ekipy...");
    try { 
        await api.delete(`/api/crew-assignments/${id}/`); 
        await queryClient.invalidateQueries({ queryKey: queryKeys.crewAssignments.all });
        toast.success("Usunięto przypisanie z projektu", { id: toastId });
    } catch (err) { 
        toast.error("Błąd usuwania", { id: toastId, description: "Nie udało się odpiąć członka ekipy z projektu." });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      
      <form onSubmit={handleAssign} className={`${STYLE_GLASS_CARD} p-6 flex flex-col md:flex-row gap-5 items-end`}>
        <div className="flex-1 w-full">
          <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">
            Zatrudnij z bazy
          </label>
          <select 
            required 
            value={selectedCrewId} 
            onChange={(e) => setSelectedCrewId(e.target.value)} 
            className={STYLE_GLASS_INPUT} 
            disabled={isMutating}
          >
            <option value="">— Wybierz współpracownika —</option>
            {availableCrew.map((c) => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.specialty})</option>
            ))}
          </select>
        </div>
        
        <div className="flex-1 w-full">
          <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">
            Rola na tym koncercie
          </label>
          <input 
            type="text" 
            value={roleDesc} 
            onChange={(e) => setRoleDesc(e.target.value)} 
            placeholder="np. Akustyk FOH" 
            className={STYLE_GLASS_INPUT} 
            disabled={isMutating}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isMutating || !selectedCrewId}
          className="w-full md:w-auto h-[46px] px-8 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase font-bold antialiased tracking-widest rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.2)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.3)] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:shadow-none"
        >
          {isMutating ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />} 
          Przypisz
        </button>
      </form>

      <div className={STYLE_GLASS_CARD}>
        <div className="p-5 bg-white/40 border-b border-white/60 flex items-center justify-between relative z-10">
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
                <Loader2 size={24} className="animate-spin text-stone-300" aria-hidden="true" />
            </div>
        ) : (
            <div className="divide-y divide-stone-100/50 max-h-[500px] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
              <AnimatePresence initial={false}>
                {projectAssignments.length > 0 ? projectAssignments.map((assignment) => {
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
                        <p className="font-bold text-stone-900 text-sm tracking-tight">{person.first_name} {person.last_name}</p>
                        <p className="text-[9px] font-bold antialiased uppercase text-stone-400 tracking-widest">
                          {assignment.role_description || person.specialty} {person.company_name && `(${person.company_name})`}
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
                }) : (
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
      </div>
    </div>
  );
}