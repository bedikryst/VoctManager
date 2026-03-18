/**
 * @file Rehearsals.jsx
 * @description Master Attendance Log Module.
 * ENTERPRISE UPGRADE 2026: Implemented Two-Way Data Binding (Local State Sync) between 
 * AttendanceRow and the Master Component to prevent data loss during tab switching.
 * UI UPGRADE: Glassmorphism layout, antialiased micro-typography, Soft UI data rows,
 * and a premium "Zero Data State" dashboard for project contextualization.
 * @module hr/Rehearsals
 * @author Krystian Bugalski
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, CheckCircle2, AlertCircle, Loader2, CheckSquare, Clock, ShieldAlert } from 'lucide-react';
import api from '../../utils/api';

export default function Rehearsals() {
  const [projects, setProjects] = useState([]);
  const [rehearsals, setRehearsals] = useState([]);
  const [participations, setParticipations] = useState([]);
  const [attendances, setAttendances] = useState([]); 
  
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeRehearsalId, setActiveRehearsalId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const fetchData = async () => {
    try {
      const [projRes, rehRes, partRes, attRes] = await Promise.all([
        api.get('/api/projects/'),
        api.get('/api/rehearsals/'),
        api.get('/api/participations/'),
        api.get('/api/attendances/')
      ]);
      
      setProjects(Array.isArray(projRes.data) ? projRes.data : []);
      setRehearsals(Array.isArray(rehRes.data) ? rehRes.data : []);
      setParticipations(Array.isArray(partRes.data) ? partRes.data : []);
      setAttendances(Array.isArray(attRes.data) ? attRes.data : []);
    } catch (err) {
      console.error("Data loading error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentRehearsals = rehearsals
    .filter(r => String(r.project) === String(selectedProjectId))
    .sort((a, b) => new Date(a.date_time) - new Date(b.date_time));

  const projectCast = participations.filter(p => String(p.project) === String(selectedProjectId));
  const activeRehearsal = currentRehearsals.find(r => String(r.id) === String(activeRehearsalId));

  // --- Targeted Attendance Logic ---
  let currentCast = projectCast;
  if (activeRehearsal && activeRehearsal.invited_participations && activeRehearsal.invited_participations.length > 0) {
      currentCast = projectCast.filter(p => activeRehearsal.invited_participations.includes(p.id));
  }
  
  currentCast.sort((a, b) => {
      const voiceCompare = (a.artist_voice_type_display || '').localeCompare(b.artist_voice_type_display || '');
      if (voiceCompare !== 0) return voiceCompare;
      return (a.artist_name || '').localeCompare(b.artist_name || '');
  });

  const handleProjectChange = (e) => {
    setSelectedProjectId(e.target.value);
    setActiveRehearsalId(null);
  };

  /**
   * Updates the master attendances state in memory after a child component saves to the DB.
   * Guarantees that switching tabs won't cause the UI to revert to stale data.
   */
  const handleUpdateLocalAttendance = (savedRecord) => {
    setAttendances(prev => {
        const index = prev.findIndex(a => a.id === savedRecord.id);
        if (index !== -1) {
            const updated = [...prev];
            updated[index] = savedRecord;
            return updated;
        }
        return [...prev, savedRecord];
    });
  };

  const handleMarkAllPresent = async () => {
    if (!activeRehearsalId || currentCast.length === 0) return;
    setIsMarkingAll(true);
    
    try {
        for (const part of currentCast) {
            const existingRecord = attendances.find(
                a => String(a.rehearsal) === String(activeRehearsalId) && String(a.participation) === String(part.id)
            );
            
            if (!existingRecord) {
                await api.post('/api/attendances/', { rehearsal: activeRehearsalId, participation: part.id, status: 'PRESENT' });
            } else if (existingRecord.status !== 'PRESENT') {
                await api.patch(`/api/attendances/${existingRecord.id}/`, { status: 'PRESENT' });
            }
        }
        await fetchData(); 
    } catch (err) {
        console.error(err);
        alert("Wystąpił błąd podczas operacji zbiorczej. Serwer odrzucił żądanie.");
    } finally {
        setIsMarkingAll(false);
    }
  };

  // Derived Metrics
  const presentCount = currentCast.filter(p => attendances.some(a => String(a.rehearsal) === String(activeRehearsalId) && String(a.participation) === String(p.id) && a.status === 'PRESENT')).length;
  const lateCount = currentCast.filter(p => attendances.some(a => String(a.rehearsal) === String(activeRehearsalId) && String(a.participation) === String(p.id) && a.status === 'LATE')).length;
  const absentCount = currentCast.filter(p => attendances.some(a => String(a.rehearsal) === String(activeRehearsalId) && String(a.participation) === String(p.id) && a.status === 'ABSENT')).length;
  const excusedCount = currentCast.filter(p => attendances.some(a => String(a.rehearsal) === String(activeRehearsalId) && String(a.participation) === String(p.id) && a.status === 'EXCUSED')).length;

  // --- UI Shared Classes ---
  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
  const glassInputStyle = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-6xl mx-auto cursor-default">
      
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                  <Calendar size={12} className="text-[#002395]" />
                  <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                      Zarządzanie Harmonogramem
                  </p>
              </div>
              <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                  Dziennik <span className="italic text-[#002395]">Obecności</span>.
              </h1>
          </motion.div>
      </header>

      <div className={`${glassCardStyle} p-6 md:p-8`}>
        
        {/* --- PROJECT SELECTOR --- */}
        <div className="mb-8 max-w-md relative z-20">
          <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3 ml-1">Wybierz wydarzenie (Kontekst Prób)</label>
          <select 
            value={selectedProjectId} 
            onChange={handleProjectChange} 
            disabled={isLoading}
            className={`${glassInputStyle} font-medium appearance-none disabled:opacity-50`}
          >
            <option value="">— Wybierz wydarzenie —</option>
            {projects.filter(p => p.status !== 'CANC').map(p => (
                <option key={p.id} value={p.id}>{p.title} {p.status === 'DONE' ? '(Archiwum)' : ''}</option>
            ))}
          </select>
        </div>

        {/* --- ZERO DATA STATE --- */}
        {!selectedProjectId && (
           <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-12 lg:p-16 flex flex-col items-center justify-center text-center relative overflow-hidden bg-stone-50/50 rounded-[2rem] border border-white/60 shadow-inner">
              <div className="absolute -right-8 -bottom-12 text-stone-200 opacity-30 pointer-events-none">
                 <CheckSquare size={250} strokeWidth={1} />
              </div>
              <Calendar size={48} className="text-[#002395] mb-6 opacity-80 relative z-10" />
              <h2 className="text-2xl font-bold text-stone-800 tracking-tight mb-2 relative z-10" style={{ fontFamily: "'Cormorant', serif" }}>Cyfrowy Dziennik Prób</h2>
              <p className="text-sm text-stone-500 max-w-md leading-relaxed relative z-10">Wybierz wydarzenie z listy powyżej, aby zarządzać listami obecności, weryfikować spóźnienia i dodawać usprawiedliwienia.</p>
           </motion.div>
        )}

        {/* --- ACTIVE WORKSPACE --- */}
        {selectedProjectId && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 border-t border-stone-200/60 pt-8 relative z-10">
            
            {/* LEFT COLUMN: Rehearsal List */}
            <div className="lg:col-span-1 space-y-5">
              <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-800 flex items-center gap-2 mb-4 ml-1">
                <Calendar size={14} className="text-[#002395]" /> Lista Prób
              </h3>
              
              <div className="space-y-3 max-h-[650px] overflow-y-auto pr-2 scrollbar-hide">
                  {currentRehearsals.length > 0 ? currentRehearsals.map(rehearsal => {
                    const dateObj = new Date(rehearsal.date_time);
                    const isActive = activeRehearsalId === rehearsal.id;
                    const isPast = dateObj < new Date();
                    
                    return (
                      <div 
                        key={rehearsal.id}
                        onClick={() => setActiveRehearsalId(rehearsal.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${isActive ? 'bg-[#002395] border-[#001766] text-white shadow-[0_10px_20px_rgba(0,35,149,0.2)] transform scale-[1.02]' : (isPast ? 'bg-stone-50/40 border-stone-200/60 hover:border-stone-300 opacity-75' : 'bg-white/80 backdrop-blur-sm border-stone-200/80 hover:border-[#002395]/40 shadow-sm')}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl shadow-sm flex-shrink-0 ${isActive ? 'bg-white/20 text-white border border-white/20' : 'bg-stone-100 text-[#002395] border border-stone-200'}`}>
                            <span className="text-[9px] font-bold antialiased uppercase tracking-widest">{dateObj.toLocaleString('pl-PL', { month: 'short' })}</span>
                            <span className="text-xl font-black leading-none mt-0.5">{dateObj.getDate()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-sm tracking-tight ${isActive ? 'text-white' : 'text-stone-900'}`}>
                              {dateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className={`text-[9px] font-bold antialiased uppercase tracking-widest flex items-center gap-1.5 mt-1.5 truncate ${isActive ? 'text-blue-200' : 'text-stone-500'}`}>
                              <MapPin size={10} className="flex-shrink-0" /> <span className="truncate">{rehearsal.location}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="p-6 text-center bg-white/40 border border-dashed border-stone-300/60 rounded-2xl">
                        <p className="text-[10px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-1">Brak prób</p>
                        <p className="text-xs text-stone-400">Przejdź do kreatora projektu, aby dodać spotkania.</p>
                    </div>
                  )}
              </div>
            </div>

            {/* RIGHT COLUMN: Interactive Attendance List */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                {activeRehearsalId ? (
                  <motion.div 
                    key={activeRehearsalId}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="bg-stone-50/40 backdrop-blur-xl border border-white/60 rounded-[2rem] p-5 md:p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                  >
                    <div className="mb-8 pb-6 border-b border-stone-200/60">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-800 flex items-center gap-2">
                                <Users size={16} className="text-[#002395]" /> 
                                Lista Obecności ({currentCast.length} osób)
                            </h3>
                            <div className="flex gap-2.5">
                                <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 bg-white px-3 py-1.5 rounded-lg border border-stone-200/60 shadow-sm flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Auto-zapis
                                </span>
                                {!activeRehearsal.is_mandatory && <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200 shadow-sm">Opcjonalna</span>}
                            </div>
                        </div>

                        {activeRehearsal.focus && (
                            <p className="text-sm text-stone-700 italic border-l-2 border-[#002395] pl-4 py-2 bg-white/60 rounded-r-xl shadow-sm mb-6 leading-relaxed">
                                <span className="font-bold antialiased not-italic text-[9px] uppercase tracking-widest text-[#002395] block mb-1">Cel Próby:</span>
                                {activeRehearsal.focus}
                            </p>
                        )}

                        {/* Bento Metrics for Attendance */}
                        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-stone-200/60 shadow-sm">
                            <div className="flex flex-wrap gap-3">
                                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[9px] font-bold antialiased uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                    <CheckCircle2 size={12}/> Ob: {presentCount}
                                </span>
                                <span className="px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-lg text-[9px] font-bold antialiased uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                    <Clock size={12}/> Spóź: {lateCount}
                                </span>
                                <span className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[9px] font-bold antialiased uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                    <AlertCircle size={12}/> Nb: {absentCount}
                                </span>
                                <span className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg text-[9px] font-bold antialiased uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                    <ShieldAlert size={12}/> Uspraw: {excusedCount}
                                </span>
                            </div>
                            <button 
                                onClick={handleMarkAllPresent}
                                disabled={isMarkingAll || currentCast.length === 0}
                                className="w-full xl:w-auto px-6 py-2.5 bg-stone-900 hover:bg-[#002395] text-white text-[10px] font-bold antialiased uppercase tracking-[0.15em] rounded-xl transition-all shadow-[0_4px_14px_rgba(0,0,0,0.15)] active:scale-95 flex items-center justify-center gap-2 disabled:bg-stone-300 disabled:shadow-none"
                            >
                                {isMarkingAll ? <Loader2 size={14} className="animate-spin"/> : <CheckSquare size={14}/>}
                                Obecność 100%
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                      {currentCast.length > 0 ? currentCast.map(participation => {
                        const existingRecord = attendances.find(
                            a => String(a.rehearsal) === String(activeRehearsalId) && String(a.participation) === String(participation.id)
                        );

                        return (
                          <AttendanceRow 
                            key={participation.id} 
                            participation={participation} 
                            rehearsalId={activeRehearsalId}
                            existingRecord={existingRecord}
                            onUpdateAttendance={handleUpdateLocalAttendance}
                          />
                        );
                      }) : (
                        <div className="p-10 text-center bg-white/60 rounded-2xl border border-dashed border-stone-300/60 flex flex-col items-center">
                            <Users size={32} className="text-stone-300 mb-3 opacity-50" />
                            <p className="text-[10px] font-bold antialiased text-stone-500 uppercase tracking-widest">Brak wezwanych chórzystów.</p>
                            <p className="text-xs text-stone-400 mt-1 max-w-xs">Skonfiguruj zaproszenia na tę próbę w panelu projektu.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200/60 rounded-[2rem] bg-stone-50/30">
                    <Calendar size={48} className="mb-4 text-stone-300 opacity-50" />
                    <p className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-500">Wybierz próbę z kalendarza z lewej</p>
                    <p className="text-xs mt-2">aby otworzyć elektroniczny dziennik obecności dla wybranej grupy.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

/**
 * @component AttendanceRow
 * @description Sub-component representing a single artist's attendance record.
 * Employs the Explicit Interaction pattern and informs the parent of data updates.
 */
function AttendanceRow({ participation, rehearsalId, existingRecord, onUpdateAttendance }) {
  const [localData, setLocalData] = useState({
      status: existingRecord?.status || 'PRESENT',
      minutesLate: existingRecord?.minutes_late || '',
      note: existingRecord?.excuse_note || ''
  });
  
  const recordIdRef = useRef(existingRecord?.id || null);
  const timeoutRef = useRef(null);
  const [saveState, setSaveState] = useState('idle');

  useEffect(() => {
    recordIdRef.current = existingRecord?.id || null;
    setLocalData({
        status: existingRecord?.status || 'PRESENT',
        minutesLate: existingRecord?.minutes_late || '',
        note: existingRecord?.excuse_note || ''
    });
  }, [existingRecord]);

  const handleFieldChange = (field, value) => {
      const updatedData = { ...localData, [field]: value };
      setLocalData(updatedData);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      timeoutRef.current = setTimeout(() => {
          saveToBackend(updatedData);
      }, 800);
  };

  const saveToBackend = async (dataToSave) => {
      setSaveState('saving');
      try {
        const payload = {
          rehearsal: rehearsalId,
          participation: participation.id,
          status: dataToSave.status,
          minutes_late: dataToSave.status === 'LATE' && dataToSave.minutesLate ? parseInt(dataToSave.minutesLate) : null,
          excuse_note: dataToSave.status === 'EXCUSED' ? dataToSave.note : ''
        };

        let savedRecord;
        if (recordIdRef.current) {
            const res = await api.patch(`/api/attendances/${recordIdRef.current}/`, payload);
            savedRecord = res.data;
        } else {
            const res = await api.post('/api/attendances/', payload);
            recordIdRef.current = res.data.id; 
            savedRecord = res.data;
        }
        
        if (onUpdateAttendance && savedRecord) {
            onUpdateAttendance(savedRecord);
        }

        setSaveState('success');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch (err) {
        console.error("Auto-save error:", err);
        setSaveState('error');
      }
  };

  return (
    <div className="bg-white/60 backdrop-blur-md p-4 rounded-xl border border-white/80 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-all hover:shadow-md hover:bg-white hover:border-[#002395]/30 group">
      
      <div className="flex-1 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center flex-shrink-0 border border-stone-200/60 shadow-inner">
           {saveState === 'saving' && <Loader2 size={16} className="text-[#002395] animate-spin" />}
           {saveState === 'success' && <CheckCircle2 size={18} className="text-emerald-500" />}
           {saveState === 'error' && <AlertCircle size={18} className="text-red-500" />}
           {saveState === 'idle' && <span className="text-sm font-bold text-stone-400 group-hover:text-[#002395] transition-colors">{participation.artist_name?.charAt(0) || '-'}</span>}
        </div>
        
        <div>
          <p className="font-bold text-stone-900 text-sm tracking-tight group-hover:text-[#002395] transition-colors">{participation.artist_name || `Uczestnik #${participation.artist}`}</p>
          <p className="text-[9px] uppercase font-bold antialiased text-stone-400 tracking-widest mt-0.5">{participation.artist_voice_type_display || 'Brak głosu'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select 
          value={localData.status}
          onChange={(e) => handleFieldChange('status', e.target.value)}
          className={`text-[9px] font-bold antialiased uppercase tracking-widest px-4 py-2.5 rounded-xl outline-none border transition-all cursor-pointer shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md appearance-none ${
            localData.status === 'PRESENT' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            localData.status === 'LATE' ? 'bg-orange-50 border-orange-200 text-orange-700' :
            localData.status === 'ABSENT' ? 'bg-red-50 border-red-200 text-red-700' :
            'bg-blue-50 border-blue-200 text-[#002395]'
          }`}
        >
          <option value="PRESENT">Obecny</option>
          <option value="LATE">Spóźniony</option>
          <option value="ABSENT">Nieobecny</option>
          <option value="EXCUSED">Usprawiedliwiony</option>
        </select>

        <AnimatePresence>
          {localData.status === 'LATE' && (
            <motion.input 
              initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: '80px' }} exit={{ opacity: 0, width: 0 }}
              type="number" min="1" placeholder="Minuty"
              value={localData.minutesLate} 
              onChange={(e) => handleFieldChange('minutesLate', e.target.value)}
              className="text-xs font-bold text-stone-800 px-3 py-2.5 border border-stone-200/80 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white/80 shadow-sm"
            />
          )}
          {localData.status === 'EXCUSED' && (
            <motion.input 
              initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: '160px' }} exit={{ opacity: 0, width: 0 }}
              type="text" placeholder="Powód usprawiedliwienia"
              value={localData.note} 
              onChange={(e) => handleFieldChange('note', e.target.value)}
              className="text-xs font-bold text-stone-800 px-3 py-2.5 border border-stone-200/80 rounded-xl outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 bg-white/80 shadow-sm"
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}