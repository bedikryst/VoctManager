/**
 * @file RehearsalsTab.jsx
 * @description Orchestrates rehearsal scheduling and advanced audience targeting (Tutti, Sectional, Custom).
 * Generates specific attendance matrices based on dynamically resolved participant lists.
 * @architecture 
 * Employs a stateless-read/stateful-write pattern. Consumes all relational data 
 * (rehearsals, participations, artists) directly from the ProjectDataContext cache 
 * to guarantee 0ms render times and prevent N+1 API network flooding.
 * @technologies React Context API, Tailwind CSS (Glassmorphism), Lucide Icons
 * @module project/tabs/RehearsalsTab
 * @author Krystian Bugalski
 */

import { useState, useContext, useMemo } from 'react';
import { MapPin, Trash2, Target, CheckSquare, Clock, Users, MicVocal, UserCheck, Calendar1, Loader2 } from 'lucide-react';
import api from '../../../../utils/api';
import { ProjectDataContext } from '../ProjectDashboard';

export default function RehearsalsTab({ projectId }) {
  // ============================================================================
  // STATE INJECTION & CONTEXT CACHE
  // ============================================================================
  const { rehearsals, participations, artists, fetchGlobal } = useContext(ProjectDataContext);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================================================
  // LOCAL UI & FORM STATE
  // ============================================================================
  const [formData, setFormData] = useState({ 
    date_time: '', 
    location: '', 
    focus: '',
    is_mandatory: true
  });

  const [targetType, setTargetType] = useState('TUTTI');
  const [selectedSections, setSelectedSections] = useState([]); 
  const [customParticipants, setCustomParticipants] = useState([]); 

  // ============================================================================
  // DERIVED DATA (MEMOIZED CONTEXT)
  // ============================================================================
  const projectRehearsals = useMemo(() => {
    return rehearsals
      .filter(r => String(r.project) === String(projectId))
      .sort((a, b) => new Date(a.date_time) - new Date(b.date_time));
  }, [rehearsals, projectId]);

  const projectParticipations = useMemo(() => {
    return participations.filter(p => String(p.project) === String(projectId));
  }, [participations, projectId]);

  const getArtistInfo = (artistId) => artists.find(a => String(a.id) === String(artistId));

  // ============================================================================
  // BUSINESS LOGIC & MUTATION HANDLERS
  // ============================================================================
  
  /**
   * Resolves the final array of Participation IDs based on the selected Audience Target.
   * Cross-references the junction table with the Artist's vocal profile.
   * @returns {Array<string>} Array of Participation UUIDs
   */
  const resolveInvitedParticipants = () => {
    if (targetType === 'TUTTI') {
        return projectParticipations.map(p => p.id);
    } 
    if (targetType === 'SECTIONAL') {
        return projectParticipations.filter(p => {
            const artist = getArtistInfo(p.artist);
            if (!artist || !artist.voice_type) return false;
            return selectedSections.some(sec => artist.voice_type.startsWith(sec));
        }).map(p => p.id);
    }
    return customParticipants; 
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    
    const invitedList = resolveInvitedParticipants();
    if (invitedList.length === 0) {
        alert("Wybierz przynajmniej jedną osobę lub sekcję na próbę!");
        return;
    }

    setIsSubmitting(true);

    try {
      const payload = { 
        ...formData, 
        project: projectId, 
        date_time: new Date(formData.date_time).toISOString(),
        invited_participations: invitedList 
      };
      
      await api.post('/api/rehearsals/', payload);
      
      setFormData({ date_time: '', location: '', focus: '', is_mandatory: true }); 
      setTargetType('TUTTI');
      setSelectedSections([]);
      setCustomParticipants([]);
      
      await fetchGlobal(); 
    } catch (err) { 
      alert("Wystąpił błąd zapisu do bazy. Sprawdź połączenie."); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Usunąć tę próbę? Powiązane listy obecności zostaną bezpowrotnie wykasowane!")) return;
    try { 
      await api.delete(`/api/rehearsals/${id}/`); 
      await fetchGlobal(); 
    } catch (err) {
      console.error("Deletion failed:", err);
    }
  };

  const toggleSection = (sec) => {
      setSelectedSections(prev => prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec]);
  };

  const toggleCustomParticipant = (id) => {
      setCustomParticipants(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  // ============================================================================
  // RENDER HELPERS & STYLES
  // ============================================================================
  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
  const glassInputStyle = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
  const labelStyle = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      
      {/* --- SCHEDULING FORM WIDGET --- */}
      <form onSubmit={handleAdd} className={`${glassCardStyle} p-6 md:p-8 flex flex-col gap-6`}>
        <div className="flex items-center gap-2.5 border-b border-stone-200/60 pb-3">
            <Clock size={16} className="text-[#002395]" />
            <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800">Zaplanuj nową próbę</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex-1 w-full">
                <label className={labelStyle}>Data i Godzina *</label>
                <input 
                    type="datetime-local" required value={formData.date_time} 
                    onChange={e => setFormData({...formData, date_time: e.target.value})} 
                    className={glassInputStyle} 
                />
            </div>
            <div className="flex-1 w-full">
                <label className={labelStyle}>Lokalizacja (Sala) *</label>
                <input 
                    type="text" required value={formData.location} placeholder="np. Sala 102, Akademia"
                    onChange={e => setFormData({...formData, location: e.target.value})} 
                    className={glassInputStyle} 
                />
            </div>
        </div>

        <div className="w-full">
            <label className={labelStyle}>Plan Próby / Repertuar (Focus)</label>
            <textarea 
                rows="2" value={formData.focus} placeholder="np. Requiem cz. 1-3..."
                onChange={e => setFormData({...formData, focus: e.target.value})} 
                className={`${glassInputStyle} resize-none`} 
            />
        </div>

        {/* --- AUDIENCE TARGETING ENGINE --- */}
        <div className="bg-white/60 border border-stone-200/60 rounded-2xl p-5 shadow-sm">
            <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 mb-4 ml-1">Kto jest wezwany na próbę?</label>
            
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                {[
                    { id: 'TUTTI', label: 'Tutti (Wszyscy)', icon: <Users size={14}/> },
                    { id: 'SECTIONAL', label: 'Próba Sekcyjna', icon: <MicVocal size={14}/> },
                    { id: 'CUSTOM', label: 'Wybrane osoby', icon: <UserCheck size={14}/> }
                ].map(type => (
                    <button 
                        key={type.id} type="button" onClick={() => setTargetType(type.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest transition-all active:scale-95 ${targetType === type.id ? 'bg-[#002395] border border-[#001766] text-white shadow-md' : 'bg-white/80 border border-stone-200/80 text-stone-500 hover:bg-white shadow-sm'}`}
                    >
                        {type.icon} {type.label}
                    </button>
                ))}
            </div>

            {/* Sub-routing: Sectional Mode */}
            {targetType === 'SECTIONAL' && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-stone-200/60 animate-fade-in">
                    {[ {id:'S', label:'Soprany'}, {id:'A', label:'Alty'}, {id:'T', label:'Tenory'}, {id:'B', label:'Basy'} ].map(sec => (
                        <button 
                            key={sec.id} type="button" onClick={() => toggleSection(sec.id)}
                            className={`px-5 py-2.5 rounded-xl border text-[10px] antialiased uppercase tracking-widest font-bold transition-all active:scale-95 ${selectedSections.includes(sec.id) ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm' : 'bg-white/60 border-stone-200/80 text-stone-500 hover:border-stone-300 hover:bg-white'}`}
                        >
                            {sec.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Sub-routing: Custom Roster Mode */}
            {targetType === 'CUSTOM' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-4 border-t border-stone-200/60 max-h-[160px] overflow-y-auto scrollbar-hide animate-fade-in">
                    {projectParticipations.map(p => {
                        const artist = getArtistInfo(p.artist);
                        if (!artist) return null;
                        const isSelected = customParticipants.includes(p.id);
                        return (
                            <div 
                                key={p.id} onClick={() => toggleCustomParticipant(p.id)}
                                className={`cursor-pointer px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between transition-all active:scale-95 ${isSelected ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold shadow-sm' : 'bg-white/60 border-stone-200/80 text-stone-600 hover:bg-white'}`}
                            >
                                <span className="truncate tracking-tight font-bold">{artist.first_name} {artist.last_name}</span>
                                <span className="text-[8px] antialiased font-bold uppercase tracking-widest opacity-60 ml-2">{artist.voice_type}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 pt-3">
            <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-white/50 transition-colors">
                <input 
                    type="checkbox" checked={formData.is_mandatory} 
                    onChange={e => setFormData({...formData, is_mandatory: e.target.checked})} 
                    className="w-4 h-4 text-[#002395] rounded-md cursor-pointer border-stone-300 focus:ring-[#002395]" 
                />
                <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-700">Obecność obowiązkowa dla wezwanych</span>
            </label>

            <button type="submit" disabled={isSubmitting} className="w-full md:w-auto px-8 py-3.5 bg-[#002395] hover:bg-[#001766] text-white text-[10px] antialiased uppercase font-bold tracking-[0.15em] rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] disabled:opacity-70 disabled:shadow-none active:scale-95 flex items-center justify-center gap-2">
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                Zapisz w kalendarzu
            </button>
        </div>
      </form>

      {/* --- SCHEDULED SESSIONS FEED --- */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 flex items-center gap-2 mb-5 ml-1">
          <CheckSquare size={16} className="text-[#002395]" /> Harmonogram Prób
        </h4>

        {projectRehearsals.length > 0 ? projectRehearsals.map(reh => {
          const isPast = new Date(reh.date_time) < new Date();
          const invitedCount = reh.invited_participations?.length || 0;
          const isTutti = invitedCount === 0 || invitedCount === projectParticipations.length; 
          
          return (
            <div key={reh.id} className={`flex flex-col md:flex-row justify-between md:items-center p-5 rounded-2xl border shadow-sm transition-all ${isPast ? 'border-stone-200/50 bg-stone-50/40 opacity-75' : 'bg-white/80 backdrop-blur-md border-stone-200/80 hover:border-[#002395]/40 hover:shadow-md'}`}>
                
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                        <div className={`px-3 py-1.5 rounded-lg border font-bold text-sm tracking-tight shadow-sm ${isPast ? 'bg-white/50 border-stone-200 text-stone-500' : 'bg-blue-50 border-blue-100 text-[#002395]'}`}>
                            {new Date(reh.date_time).toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        
                        {isPast && <span className="px-2.5 py-1 bg-stone-200/60 text-stone-600 text-[8px] antialiased uppercase tracking-widest font-bold rounded-md">Zakończona</span>}
                        
                        <span className={`px-2.5 py-1 border text-[8px] antialiased uppercase tracking-widest font-bold rounded-md shadow-sm ${isTutti ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                            {isTutti ? 'TUTTI' : `Wezwanych: ${invitedCount}`}
                        </span>

                        {!reh.is_mandatory && <span className="px-2.5 py-1 bg-orange-50 text-orange-600 border border-orange-200 shadow-sm text-[8px] antialiased uppercase tracking-widest font-bold rounded-md">Opcjonalna</span>}
                    </div>

                    <div className="space-y-2 mt-3 md:mt-0">
                        <div className="text-xs font-bold text-stone-700 flex items-center gap-2">
                            <MapPin size={14} className="text-stone-400" /> {reh.location}
                        </div>
                        {reh.focus && (
                            <div className="text-xs text-stone-600 flex items-start gap-2">
                                <Target size={14} className="text-[#002395] flex-shrink-0 mt-0.5" /> 
                                <span className="italic opacity-90">{reh.focus}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-5 md:mt-0 md:ml-4 flex items-center justify-end border-t md:border-t-0 border-stone-200/50 pt-4 md:pt-0">
                    <button onClick={() => handleDelete(reh.id)} className="text-stone-400 hover:text-red-500 p-2.5 rounded-xl bg-white border border-transparent hover:border-red-200 hover:bg-red-50 transition-all shadow-sm active:scale-95" title="Usuń próbę">
                        <Trash2 size={16}/>
                    </button>
                </div>
            </div>
          );
        }) : (
          <div className={`${glassCardStyle} p-10 text-center text-stone-400 flex flex-col items-center`}>
            <Calendar1 size={32} className="mb-3 opacity-30" />
            <p className="text-[10px] font-bold antialiased uppercase tracking-widest">Brak zaplanowanych prób</p>
          </div>
        )}
      </div>
    </div>
  );
}