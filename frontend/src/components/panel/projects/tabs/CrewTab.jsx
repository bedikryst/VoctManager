/**
 * @file CrewTab.jsx
 * @description External Collaborator and Crew Logistics Manager.
 * Orchestrates assignments for non-artistic staff (sound, lighting, logistics).
 * ENTERPRISE OPTIMIZATION: Integrated with ProjectDataContext to eliminate N+1 queries.
 * UI UPGRADE: Integrated Glassmorphism forms, input focus states, and scalable grids.
 * @module project/tabs/CrewTab
 * @author Krystian Bugalski
 */

import { useState, useContext } from 'react';
import { Plus, Wrench, Trash2 } from 'lucide-react';
import api from '../../../../utils/api';
import { ProjectDataContext } from '../ProjectDashboard';

export default function CrewTab({ projectId }) {
  const { crew, crewAssignments, fetchGlobal } = useContext(ProjectDataContext);

  const [selectedCrewId, setSelectedCrewId] = useState('');
  const [roleDesc, setRoleDesc] = useState('');

  const projectAssignments = crewAssignments.filter(a => a.project === projectId);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedCrewId) return;
    try {
      await api.post('/api/crew-assignments/', { 
        project: projectId, 
        collaborator: selectedCrewId,
        role_description: roleDesc 
      });
      setSelectedCrewId('');
      setRoleDesc('');
      fetchGlobal(); 
    } catch (err) {
      alert("Błąd przypisywania członka ekipy.");
    }
  };

  const handleRemove = async (id) => {
    try { 
        await api.delete(`/api/crew-assignments/${id}/`); 
        fetchGlobal(); 
    } catch (err) { 
        console.error(err); 
    }
  };

  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden";
  const glassInputStyle = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      <form onSubmit={handleAssign} className={`${glassCardStyle} p-6 flex flex-col md:flex-row gap-5 items-end`}>
        <div className="flex-1 w-full">
          <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">Zatrudnij z bazy</label>
          <select required value={selectedCrewId} onChange={e => setSelectedCrewId(e.target.value)} className={glassInputStyle}>
            <option value="">— Wybierz współpracownika —</option>
            {crew.filter(c => !projectAssignments.find(a => a.collaborator === c.id)).map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.specialty})</option>
            ))}
          </select>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1">Rola na tym koncercie</label>
          <input type="text" value={roleDesc} onChange={e => setRoleDesc(e.target.value)} placeholder="np. Akustyk FOH" className={glassInputStyle} />
        </div>
        <button type="submit" className="w-full md:w-auto h-[46px] px-8 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase font-bold antialiased tracking-widest rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.2)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.3)] flex items-center justify-center gap-2 active:scale-95">
          <Plus size={14} /> Przypisz
        </button>
      </form>

      <div className={glassCardStyle}>
        <div className="p-5 bg-white/40 border-b border-white/60 flex items-center gap-2.5 relative z-10">
          <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shadow-sm"><Wrench size={14} className="text-stone-600" /></div>
          <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-700">Skład Ekipy (Crew)</h4>
        </div>
        <div className="divide-y divide-stone-100/50 max-h-[500px] overflow-y-auto scrollbar-hide">
          {projectAssignments.length > 0 ? projectAssignments.map(assignment => {
            const person = crew.find(c => c.id === assignment.collaborator);
            if (!person) return null;
            return (
              <div key={assignment.id} className="p-5 flex items-center justify-between hover:bg-white/50 transition-colors">
                <div className="flex flex-col gap-0.5">
                  <p className="font-bold text-stone-900 text-sm tracking-tight">{person.first_name} {person.last_name}</p>
                  <p className="text-[9px] font-bold antialiased uppercase text-stone-400 tracking-widest">
                    {assignment.role_description || person.specialty} {person.company_name && `(${person.company_name})`}
                  </p>
                </div>
                <button onClick={() => handleRemove(assignment.id)} className="p-2.5 text-stone-400 hover:text-red-600 bg-white border border-transparent hover:border-red-200 shadow-sm rounded-xl hover:bg-red-50 transition-all active:scale-95">
                  <Trash2 size={16} />
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