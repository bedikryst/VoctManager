/**
 * @file CrewTab.tsx
 * @description External Collaborator and Crew Logistics Manager.
 * @architecture
 * Orchestrates assignments for non-artistic staff (sound, lighting, logistics).
 * Consumes ProjectDataContext to eliminate N+1 queries.
 * Employs useMemo to prevent complex array filtering during simple text-input renders.
 * Utilizes Sonner for elegant, non-blocking mutation feedback.
 * @module project/tabs/CrewTab
 * @author Krystian Bugalski
 */

import React, { useState, useContext, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus, Wrench, Trash2 } from 'lucide-react';

import api from '../../../../utils/api';
import { ProjectDataContext, IProjectDataContext } from '../ProjectDashboard';
import type { Collaborator, CrewAssignment } from '../../../../types';

interface CrewTabProps {
  projectId: string;
}

// --- Static Configurations & Styles ---
const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden";
const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

/**
 * CrewTab Component
 * @param {CrewTabProps} props - Component properties.
 * @returns {React.JSX.Element | null}
 */
export default function CrewTab({ projectId }: CrewTabProps): React.JSX.Element | null {
  const context = useContext(ProjectDataContext) as IProjectDataContext;

  if (!context) {
    console.error("[CrewTab] Must be used within a ProjectDataContext.Provider");
    return null;
  }

  const { crew, crewAssignments, fetchGlobal } = context;

  // --- Local State ---
  const [selectedCrewId, setSelectedCrewId] = useState<string>('');
  const [roleDesc, setRoleDesc] = useState<string>('');
  const [isMutating, setIsMutating] = useState<boolean>(false);

  // --- Derived Data (Memoized) ---
  const projectAssignments = useMemo<CrewAssignment[]>(() => {
    return crewAssignments.filter((a) => String(a.project) === String(projectId));
  }, [crewAssignments, projectId]);

  const availableCrew = useMemo<Collaborator[]>(() => {
    return crew.filter((c) => !projectAssignments.some((a) => String(a.collaborator) === String(c.id)));
  }, [crew, projectAssignments]);

  // --- Event Handlers ---

  /**
   * Assigns a new crew member to the project.
   * @param {React.FormEvent<HTMLFormElement>} e - The form submission event.
   */
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
      
      await fetchGlobal(); 
      toast.success("Członek ekipy przypisany pomyślnie", { id: toastId });
    } catch (err) {
      console.error("[CrewTab] Assignment failed:", err);
      toast.error("Błąd przypisania", { 
        id: toastId, 
        description: "Nie udało się przypisać członka ekipy do projektu." 
      });
    } finally {
      setIsMutating(false);
    }
  };

  /**
   * Removes a crew member from the project.
   * @param {string | number} id - The UUID of the crew assignment record.
   */
  const handleRemove = async (id: string | number): Promise<void> => {
    const toastId = toast.loading("Usuwanie członka ekipy...");
    try { 
        await api.delete(`/api/crew-assignments/${id}/`); 
        await fetchGlobal(); 
        toast.success("Usunięto przypisanie z projektu", { id: toastId });
    } catch (err) { 
        console.error(`[CrewTab] Failed to remove assignment ${id}:`, err); 
        toast.error("Błąd usuwania", { 
          id: toastId, 
          description: "Nie udało się odpiąć członka ekipy z projektu." 
        });
    }
  };

  // --- Render ---

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Assignment Form */}
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
          <Plus size={14} aria-hidden="true" /> Przypisz
        </button>
      </form>

      {/* Crew Roster Grid */}
      <div className={STYLE_GLASS_CARD}>
        <div className="p-5 bg-white/40 border-b border-white/60 flex items-center gap-2.5 relative z-10">
          <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shadow-sm">
            <Wrench size={14} className="text-stone-600" aria-hidden="true" />
          </div>
          <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-700">
            Skład Ekipy (Crew)
          </h4>
        </div>
        
        <div className="divide-y divide-stone-100/50 max-h-[500px] overflow-y-auto scrollbar-hide">
          {projectAssignments.length > 0 ? projectAssignments.map((assignment) => {
            const person = crew.find((c) => String(c.id) === String(assignment.collaborator));
            if (!person) return null;
            
            // Bezpieczne sprawdzanie danych opcjonalnych z modelu
            const companyName = (person as any).company_name;

            return (
              <div key={assignment.id} className="p-5 flex items-center justify-between hover:bg-white/50 transition-colors">
                <div className="flex flex-col gap-0.5">
                  <p className="font-bold text-stone-900 text-sm tracking-tight">{person.first_name} {person.last_name}</p>
                  <p className="text-[9px] font-bold antialiased uppercase text-stone-400 tracking-widest">
                    {assignment.role_description || person.specialty} {companyName && `(${companyName})`}
                  </p>
                </div>
                <button 
                  onClick={() => handleRemove(assignment.id)} 
                  className="p-2.5 text-stone-400 hover:text-red-600 bg-white border border-transparent hover:border-red-200 shadow-sm rounded-xl hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50"
                  aria-label={`Usuń ${person.first_name} ${person.last_name} z projektu`}
                  disabled={isMutating}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            );
          }) : (
            <p className="text-[11px] text-stone-400 italic p-8 text-center">Brak przypisanej ekipy technicznej.</p>
          )}
        </div>
      </div>
      
    </div>
  );
}