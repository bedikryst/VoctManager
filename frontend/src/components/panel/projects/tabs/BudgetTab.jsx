/**
 * @file BudgetTab.jsx
 * @description Financial estimation and fee assignment widget.
 * ENTERPRISE OPTIMIZATION: Implements "Dirty State Tracking" to defer API syncing 
 * only to fields mutated by the user, neutralizing N+1 request flooding on large rosters.
 * UI UPGRADE: 2026 Bento Architecture, premium input fields, and gradient accent cards.
 * @module project/tabs/BudgetTab
 * @author Krystian Bugalski
 */

import { useState, useContext, useMemo } from 'react';
import { Loader2, Banknote, Users, Wrench, Sparkles } from 'lucide-react';
import api from '../../../../utils/api';
import { ProjectDataContext } from '../ProjectDashboard';

export default function BudgetTab({ projectId }) {
  const { participations, crewAssignments, artists, crew, fetchGlobal } = useContext(ProjectDataContext);

  const [dirtyArtists, setDirtyArtists] = useState({}); 
  const [dirtyCrew, setDirtyCrew] = useState({});

  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const projectParticipations = useMemo(() => participations.filter(p => p.project === projectId), [participations, projectId]);
  const projectCrewAssignments = useMemo(() => crewAssignments.filter(a => a.project === projectId), [crewAssignments, projectId]);

  const handleFeeChange = (id, value, type) => {
    const numericValue = value ? parseInt(value) : null;
    if (type === 'artist') {
      setDirtyArtists(prev => ({ ...prev, [id]: numericValue }));
    } else {
      setDirtyCrew(prev => ({ ...prev, [id]: numericValue }));
    }
  };

  const handleSaveBudget = async () => {
    setIsSaving(true);
    setStatusMsg({ type: '', text: '' });
    
    const modifiedArtistIds = Object.keys(dirtyArtists);
    const modifiedCrewIds = Object.keys(dirtyCrew);

    if (modifiedArtistIds.length === 0 && modifiedCrewIds.length === 0) {
        setStatusMsg({ type: 'success', text: 'Brak nowych zmian do zapisania.' });
        setIsSaving(false);
        setTimeout(() => setStatusMsg({ type: '', text: '' }), 2000);
        return;
    }

    try {
      const syncPromises = [];
      
      modifiedArtistIds.forEach(id => {
          syncPromises.push(api.patch(`/api/participations/${id}/`, { fee: dirtyArtists[id] }));
      });
      
      modifiedCrewIds.forEach(id => {
          syncPromises.push(api.patch(`/api/crew-assignments/${id}/`, { fee: dirtyCrew[id] }));
      });
      
      await Promise.all(syncPromises);
      
      await fetchGlobal();

      setDirtyArtists({});
      setDirtyCrew({});
      
      setStatusMsg({ type: 'success', text: `Zapisano zmiany dla ${syncPromises.length} osób.` });
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Błąd podczas zapisu budżetu.' });
    } finally {
      setIsSaving(false);
    }
  };

  const totalArtists = projectParticipations.reduce((sum, p) => {
      const activeFee = dirtyArtists.hasOwnProperty(p.id) ? dirtyArtists[p.id] : p.fee;
      return sum + (Number(activeFee) || 0);
  }, 0);

  const totalCrew = projectCrewAssignments.reduce((sum, c) => {
      const activeFee = dirtyCrew.hasOwnProperty(c.id) ? dirtyCrew[c.id] : c.fee;
      return sum + (Number(activeFee) || 0);
  }, 0);
  
  const grandTotal = totalArtists + totalCrew;

  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden";
  const glassInputStyle = "bg-white/50 backdrop-blur-sm border border-stone-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] rounded-xl";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {statusMsg.text && (
        <div className={`p-4 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest mb-2 border shadow-sm ${statusMsg.type === 'success' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700' : 'bg-red-50/80 border-red-200 text-red-700'}`}>
          {statusMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className={`${glassCardStyle} p-6 flex flex-col justify-center items-center relative group hover:-translate-y-0.5 transition-transform`}>
          <div className="absolute -right-4 -bottom-4 text-stone-200 opacity-20 pointer-events-none group-hover:scale-110 transition-transform duration-700"><Users size={100}/></div>
          <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2 relative z-10">Koszty Artystyczne</p>
          <p className="text-2xl font-bold text-stone-800 tracking-tight relative z-10">{totalArtists.toLocaleString('pl-PL')} PLN</p>
        </div>
        <div className={`${glassCardStyle} p-6 flex flex-col justify-center items-center relative group hover:-translate-y-0.5 transition-transform`}>
          <div className="absolute -right-4 -bottom-4 text-stone-200 opacity-20 pointer-events-none group-hover:scale-110 transition-transform duration-700"><Wrench size={100}/></div>
          <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2 relative z-10">Koszty Techniczne</p>
          <p className="text-2xl font-bold text-stone-800 tracking-tight relative z-10">{totalCrew.toLocaleString('pl-PL')} PLN</p>
        </div>
        <div className="bg-gradient-to-br from-[#002395] via-[#001766] to-[#000a33] p-6 rounded-2xl shadow-[0_10px_30px_rgba(0,35,149,0.15)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] flex flex-col justify-center items-center text-white relative overflow-hidden group hover:-translate-y-0.5 transition-transform">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
          <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-blue-200 mb-2 relative z-10 flex items-center gap-1.5"><Sparkles size={12}/> Kosztorys Całkowity</p>
          <p className="text-3xl font-bold tracking-tight relative z-10">{grandTotal.toLocaleString('pl-PL')} PLN</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${glassCardStyle} flex flex-col h-[500px]`}>
          <div className="p-5 bg-white/40 border-b border-white/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm"><Users size={14} className="text-[#002395]" /></div>
                <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-700">Honoraria Wokalne</h4>
            </div>
            {Object.keys(dirtyArtists).length > 0 && <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]" title="Niezapisane zmiany"></span>}
          </div>
          <div className="divide-y divide-stone-100/50 flex-1 overflow-y-auto scrollbar-hide">
            {projectParticipations.length > 0 ? projectParticipations.map(part => {
              const artist = artists.find(a => a.id === part.artist);
              if (!artist) return null;
              
              const isDirty = dirtyArtists.hasOwnProperty(part.id);
              const currentFeeValue = isDirty ? dirtyArtists[part.id] : part.fee;

              return (
                <div key={part.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isDirty ? 'bg-orange-50/20' : 'hover:bg-white/50'}`}>
                  <div>
                    <p className="font-bold text-stone-900 text-sm tracking-tight">{artist.first_name} {artist.last_name}</p>
                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-0.5">{artist.voice_type_display}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="number" min="0" step="50" placeholder="0" 
                      value={currentFeeValue || ''} onChange={(e) => handleFeeChange(part.id, e.target.value, 'artist')}
                      className={`w-28 px-3 py-2 text-right text-sm focus:outline-none transition-all ${isDirty ? 'border-orange-300 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white shadow-sm rounded-xl' : `${glassInputStyle} focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40`}`} 
                    />
                    <span className={`text-[10px] font-bold antialiased uppercase tracking-widest ${isDirty ? 'text-orange-500' : 'text-stone-400'}`}>PLN</span>
                  </div>
                </div>
              );
            }) : <p className="text-[11px] text-stone-400 italic p-8 text-center">Brak artystów w tym projekcie.</p>}
          </div>
        </div>

        <div className={`${glassCardStyle} flex flex-col h-[500px]`}>
          <div className="p-5 bg-white/40 border-b border-white/60 flex items-center justify-between">
             <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shadow-sm"><Wrench size={14} className="text-stone-600" /></div>
                <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-700">Koszty Logistyki</h4>
             </div>
             {Object.keys(dirtyCrew).length > 0 && <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]" title="Niezapisane zmiany"></span>}
          </div>
          <div className="divide-y divide-stone-100/50 flex-1 overflow-y-auto scrollbar-hide">
            {projectCrewAssignments.length > 0 ? projectCrewAssignments.map(assign => {
              const person = crew.find(c => c.id === assign.collaborator);
              if (!person) return null;
              
              const isDirty = dirtyCrew.hasOwnProperty(assign.id);
              const currentFeeValue = isDirty ? dirtyCrew[assign.id] : assign.fee;

              return (
                <div key={assign.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isDirty ? 'bg-orange-50/20' : 'hover:bg-white/50'}`}>
                  <div>
                    <p className="font-bold text-stone-900 text-sm tracking-tight">{person.first_name} {person.last_name}</p>
                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-0.5">{assign.role_description || person.specialty}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="number" min="0" step="50" placeholder="0" 
                      value={currentFeeValue || ''} onChange={(e) => handleFeeChange(assign.id, e.target.value, 'crew')}
                      className={`w-28 px-3 py-2 text-right text-sm focus:outline-none transition-all ${isDirty ? 'border-orange-300 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white shadow-sm rounded-xl' : `${glassInputStyle} focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40`}`} 
                    />
                    <span className={`text-[10px] font-bold antialiased uppercase tracking-widest ${isDirty ? 'text-orange-500' : 'text-stone-400'}`}>PLN</span>
                  </div>
                </div>
              );
            }) : <p className="text-[11px] text-stone-400 italic p-8 text-center">Brak ekipy technicznej.</p>}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-stone-200/50">
        <button 
          onClick={handleSaveBudget} disabled={isSaving || (Object.keys(dirtyArtists).length === 0 && Object.keys(dirtyCrew).length === 0)} 
          className="w-full md:w-auto md:min-w-[240px] md:mx-auto py-4 px-8 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.2)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.3)] disabled:shadow-none flex justify-center items-center gap-2 active:scale-95"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
          {isSaving ? 'Zapisywanie...' : 'Zapisz Kosztorys'}
        </button>
      </div>

    </div>
  );
}