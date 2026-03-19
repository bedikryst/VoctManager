/**
 * @file Rehearsals.tsx
 * @description Master Attendance Log Module.
 * @architecture
 * ENTERPRISE UPGRADE 2026: Implemented strict Two-Way Data Binding via React Query.
 * Optimizes network requests by deferring text-input syncs to `onBlur` events,
 * preventing API payload spam during active typing.
 * Uses O(1) Hash Maps for instant Artist and Attendance resolution.
 * @module hr/Rehearsals
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
    Calendar, MapPin, Users, CheckCircle2, 
    AlertCircle, Loader2, CheckSquare, Clock, 
    ShieldAlert, Target 
} from 'lucide-react';

import api from '../../utils/api';
import type { Project, Rehearsal, Participation, Attendance, Artist } from '../../types';

// --- Static Styles ---
const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] font-bold";

/**
 * Rehearsals Master Component
 * @returns {React.JSX.Element}
 */
export default function Rehearsals(): React.JSX.Element {
  const queryClient = useQueryClient();

  // --- UI States ---
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeRehearsalId, setActiveRehearsalId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);

  // --- Data Fetching Engine (React Query) ---
  const results = useQueries({
    queries: [
      { queryKey: ['reh-projects'], queryFn: async () => (await api.get('/api/projects/')).data },
      { queryKey: ['reh-rehearsals'], queryFn: async () => (await api.get('/api/rehearsals/')).data },
      { queryKey: ['reh-participations'], queryFn: async () => (await api.get('/api/participations/')).data },
      { queryKey: ['reh-attendances'], queryFn: async () => (await api.get('/api/attendances/')).data },
      { queryKey: ['reh-artists'], queryFn: async () => (await api.get('/api/artists/')).data }
    ]
  });

  const isLoading = results.some(q => q.isLoading);
  const isError = results.some(q => q.isError);

  useEffect(() => {
    if (isError) {
      toast.error("Błąd synchronizacji", { description: "Nie udało się załadować danych z serwera." });
    }
  }, [isError]);

  const data = useMemo(() => ({
    projects: Array.isArray(results[0].data) ? results[0].data as Project[] : [],
    rehearsals: Array.isArray(results[1].data) ? results[1].data as Rehearsal[] : [],
    participations: Array.isArray(results[2].data) ? results[2].data as Participation[] : [],
    attendances: Array.isArray(results[3].data) ? results[3].data as Attendance[] : [],
    artists: Array.isArray(results[4].data) ? results[4].data as Artist[] : []
  }), [results]);

  // --- O(1) Lookup Maps ---
  const artistMap = useMemo<Map<string, Artist>>(() => {
      const map = new Map<string, Artist>();
      data.artists.forEach(a => map.set(String(a.id), a));
      return map;
  }, [data.artists]);

  // --- Contextual Scoping (Memoized) ---
  const projectRehearsals = useMemo(() => {
      if (!selectedProjectId) return [];
      return data.rehearsals
          .filter(r => String(r.project) === String(selectedProjectId))
          .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  }, [data.rehearsals, selectedProjectId]);

  const projectParticipations = useMemo(() => {
      if (!selectedProjectId) return [];
      return data.participations.filter(p => String(p.project) === String(selectedProjectId));
  }, [data.participations, selectedProjectId]);

  // Auto-select first rehearsal if project changes
  useEffect(() => {
      if (projectRehearsals.length > 0 && (!activeRehearsalId || !projectRehearsals.find(r => String(r.id) === activeRehearsalId))) {
          setActiveRehearsalId(String(projectRehearsals[0].id));
      } else if (projectRehearsals.length === 0) {
          setActiveRehearsalId(null);
      }
  }, [projectRehearsals, activeRehearsalId]);

  const activeRehearsal = useMemo(() => {
      return projectRehearsals.find(r => String(r.id) === activeRehearsalId) || null;
  }, [projectRehearsals, activeRehearsalId]);

  // --- Active Rehearsal Scope ---
  const invitedParticipations = useMemo(() => {
      if (!activeRehearsal) return [];
      const invitedIds = activeRehearsal.invited_participations || [];
      const relevantParts = invitedIds.length > 0 
          ? projectParticipations.filter(p => invitedIds.includes(String(p.id)))
          : projectParticipations; // Tutti fallback
      
      // O(1) Sortowanie alfabetyczne
      return relevantParts.sort((a, b) => {
          const nameA = artistMap.get(String(a.artist))?.last_name || '';
          const nameB = artistMap.get(String(b.artist))?.last_name || '';
          return nameA.localeCompare(nameB);
      });
  }, [activeRehearsal, projectParticipations, artistMap]);

  const attendanceMap = useMemo<Map<string, Attendance>>(() => {
      const map = new Map<string, Attendance>();
      if (activeRehearsal) {
          data.attendances
              .filter(a => String(a.rehearsal) === String(activeRehearsal.id))
              .forEach(a => map.set(String(a.participation), a));
      }
      return map;
  }, [data.attendances, activeRehearsal]);

  // --- Statistics ---
  const stats = useMemo(() => {
      let present = 0; let late = 0; let absent = 0; let none = 0;
      invitedParticipations.forEach(p => {
          const att = attendanceMap.get(String(p.id));
          if (!att) none++;
          else if (att.status === 'PRESENT') present++;
          else if (att.status === 'LATE') late++;
          else absent++;
      });
      return { present, late, absent, none, total: invitedParticipations.length };
  }, [invitedParticipations, attendanceMap]);

  // --- Mutations ---
  const handleMarkAllPresent = async (): Promise<void> => {
      if (!activeRehearsalId || invitedParticipations.length === 0) return;
      
      setIsMarkingAll(true);
      const toastId = toast.loading("Zbiorcze zaznaczanie obecności...");

      try {
          const promises = invitedParticipations.map(part => {
              const existing = attendanceMap.get(String(part.id));
              if (existing) {
                  if (existing.status !== 'PRESENT') {
                      return api.patch(`/api/attendances/${existing.id}/`, { status: 'PRESENT', minutes_late: null, excuse_note: null });
                  }
                  return Promise.resolve();
              } else {
                  return api.post('/api/attendances/', {
                      rehearsal: activeRehearsalId,
                      participation: part.id,
                      status: 'PRESENT'
                  });
              }
          });

          await Promise.all(promises);
          await queryClient.invalidateQueries({ queryKey: ['reh-attendances'] });
          toast.success(`Uzupełniono obecność dla ${invitedParticipations.length} osób.`, { id: toastId });
      } catch (err) {
          toast.error("Błąd systemu", { id: toastId, description: "Nie udało się zapisać masowej obecności." });
      } finally {
          setIsMarkingAll(false);
      }
  };

  // --- Render ---
  if (isLoading && !data.projects.length) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-stone-400" size={32} /></div>;
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-6xl mx-auto cursor-default">
      
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                  <CheckSquare size={12} className="text-[#002395]" aria-hidden="true" />
                  <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                      Moduł Inspektora
                  </p>
              </div>
              <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                  Dziennik <span className="italic text-[#002395]">Obecności</span>.
              </h1>
          </motion.div>
      </header>

      {/* --- PROJECT SELECTOR --- */}
      <div className={`${STYLE_GLASS_CARD} p-6 md:p-8 flex flex-col md:flex-row items-end gap-6 relative z-20`}>
        <div className="w-full md:flex-1">
          <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3 ml-1">
            Wybierz kontekst projektu
          </label>
          <select 
            value={selectedProjectId} 
            onChange={e => setSelectedProjectId(e.target.value)} 
            className={`${STYLE_GLASS_INPUT} appearance-none`}
          >
            <option value="">— Wybierz wydarzenie —</option>
            {data.projects.filter(p => p.status !== 'CANC').map(p => (
                <option key={p.id} value={p.id}>{p.title} {p.status === 'DONE' ? '(Archiwum)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* --- EMPTY STATE --- */}
      {!selectedProjectId && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`${STYLE_GLASS_CARD} p-16 flex flex-col items-center justify-center text-center mt-8`}>
            <Calendar size={48} className="mb-4 text-stone-300 opacity-50" aria-hidden="true" />
            <p className="text-[11px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-2">Brak wybranego projektu</p>
            <p className="text-xs text-stone-400 max-w-sm">Aby sprawdzić lub uzupełnić dziennik, wybierz wydarzenie z listy powyżej.</p>
        </motion.div>
      )}

      {/* --- REHEARSAL SCOPE --- */}
      {selectedProjectId && projectRehearsals.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            
            {/* Rehearsal Tabs (Horizontal Scroll) */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-stone-200/60">
              {projectRehearsals.map((reh, idx) => (
                <button 
                  key={reh.id} 
                  onClick={() => setActiveRehearsalId(String(reh.id))}
                  className={`px-5 py-3.5 text-[10px] font-bold antialiased uppercase tracking-widest whitespace-nowrap rounded-t-xl transition-all border-b-2 flex flex-col items-start ${String(activeRehearsalId) === String(reh.id) ? 'border-[#002395] text-[#002395] bg-blue-50/50' : 'border-transparent text-stone-400 hover:text-stone-800 hover:bg-stone-50/50'}`}
                >
                  <span className="opacity-60 mb-0.5">Próba {idx + 1}</span>
                  <span>{new Date(reh.date_time).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })}</span>
                </button>
              ))}
            </div>

            {/* Active Rehearsal Details & Stats */}
            {activeRehearsal && (
                <div className={`${STYLE_GLASS_CARD} p-6 flex flex-col lg:flex-row justify-between gap-6`}>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-[#002395] text-white text-[10px] font-bold antialiased uppercase tracking-widest rounded-lg shadow-sm">
                                {new Date(activeRehearsal.date_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!activeRehearsal.is_mandatory && <span className="px-3 py-1 bg-orange-50 border border-orange-200 text-orange-600 text-[10px] font-bold antialiased uppercase tracking-widest rounded-lg shadow-sm">Opcjonalna</span>}
                        </div>
                        <p className="text-sm font-bold text-stone-800 flex items-center gap-2 mt-4"><MapPin size={16} className="text-[#002395]" aria-hidden="true" /> {activeRehearsal.location}</p>
                        {activeRehearsal.focus && <p className="text-xs text-stone-500 font-medium flex items-center gap-2 mt-2"><Target size={16} className="text-[#002395]" aria-hidden="true" /> {activeRehearsal.focus}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="px-4 py-3 bg-white/60 border border-stone-200/80 rounded-xl flex flex-col items-center min-w-[90px] shadow-sm">
                            <span className="text-[9px] font-bold antialiased text-emerald-600 uppercase tracking-widest">Obecni</span>
                            <span className="text-xl font-black text-emerald-700 mt-1">{stats.present}</span>
                        </div>
                        <div className="px-4 py-3 bg-white/60 border border-stone-200/80 rounded-xl flex flex-col items-center min-w-[90px] shadow-sm">
                            <span className="text-[9px] font-bold antialiased text-orange-600 uppercase tracking-widest">Spóźnieni</span>
                            <span className="text-xl font-black text-orange-700 mt-1">{stats.late}</span>
                        </div>
                        <div className="px-4 py-3 bg-white/60 border border-stone-200/80 rounded-xl flex flex-col items-center min-w-[90px] shadow-sm">
                            <span className="text-[9px] font-bold antialiased text-red-600 uppercase tracking-widest">Nieobecni</span>
                            <span className="text-xl font-black text-red-700 mt-1">{stats.absent}</span>
                        </div>
                        <div className="px-5 py-3 ml-2 border-l border-stone-200/60 flex flex-col items-center justify-center min-w-[90px]">
                            <span className="text-[9px] font-bold antialiased text-stone-400 uppercase tracking-widest">Braki wpisów</span>
                            <span className="text-xl font-black text-stone-800 mt-1">{stats.none} <span className="text-sm font-medium text-stone-400">/ {stats.total}</span></span>
                        </div>
                    </div>
                </div>
            )}

            {/* Mass Actions */}
            <div className="flex justify-end">
                <button 
                  onClick={handleMarkAllPresent}
                  disabled={isMarkingAll || invitedParticipations.length === 0}
                  className="flex items-center gap-2 bg-stone-900 hover:bg-[#002395] text-white text-[9px] uppercase tracking-widest font-bold antialiased py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,0,0,0.15)] active:scale-95 disabled:opacity-50 disabled:shadow-none"
                >
                  {isMarkingAll ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                  Uzupełnij luki jako "Obecny"
                </button>
            </div>

            {/* --- ATTENDANCE TABLE --- */}
            <div className={`${STYLE_GLASS_CARD} overflow-hidden`}>
                <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-left text-sm text-stone-600">
                        <thead className="bg-stone-50/50 backdrop-blur-md text-[9px] antialiased uppercase font-bold tracking-widest text-stone-400 border-b border-stone-200/60">
                        <tr>
                            <th className="px-5 py-4 w-1/4">Wykonawca</th>
                            <th className="px-5 py-4 w-48">Status Obecności</th>
                            <th className="px-5 py-4 hidden sm:table-cell">Szczegóły (Spóźnienie / Notatka)</th>
                            <th className="px-5 py-4 text-right w-16">Opcje</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100/50">
                        {invitedParticipations.map(part => {
                            const artist = artistMap.get(String(part.artist));
                            if (!artist) return null;
                            return (
                                <AttendanceRow 
                                    key={part.id} 
                                    participation={part} 
                                    artist={artist} 
                                    rehearsalId={activeRehearsalId!} 
                                    existingRecord={attendanceMap.get(String(part.id))} 
                                />
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </div>

        </motion.div>
      )}

      {selectedProjectId && projectRehearsals.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${STYLE_GLASS_CARD} text-center p-16 flex flex-col items-center justify-center mt-8`}>
            <AlertCircle size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
            <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-600 mb-2">Brak zaplanowanych prób</span>
            <span className="text-xs text-stone-400 max-w-sm leading-relaxed">Przejdź do zakładki "Wydarzenia", aby dodać pierwszą próbę do harmonogramu tego projektu.</span>
          </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENT: ATTENDANCE ROW MANAGER
// ============================================================================

interface AttendanceRowProps {
  participation: Participation;
  artist: Artist;
  rehearsalId: string;
  existingRecord: Attendance | undefined;
}

/**
 * @description Internal component representing a single row in the attendance matrix.
 * Optimizes network requests by deferring text-input syncs to `onBlur` events.
 */
function AttendanceRow({ participation, artist, rehearsalId, existingRecord }: AttendanceRowProps): React.JSX.Element {
  const queryClient = useQueryClient();
  
  // Local state mirrors the server state initially
  const [status, setStatus] = useState<string>(existingRecord?.status || '');
  const [minutesLate, setMinutesLate] = useState<string>(existingRecord?.minutes_late ? String(existingRecord.minutes_late) : '');
  const [note, setNote] = useState<string>(existingRecord?.excuse_note || '');
  
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Sync local state if parent invalidates data (e.g. "Mark All Present")
  useEffect(() => {
      setStatus(existingRecord?.status || '');
      setMinutesLate(existingRecord?.minutes_late ? String(existingRecord.minutes_late) : '');
      setNote(existingRecord?.excuse_note || '');
  }, [existingRecord]);

  const saveToServer = async (newStatus: string, newMins: string, newNote: string): Promise<void> => {
      setIsSyncing(true);
      try {
          if (!newStatus) {
              if (existingRecord?.id) {
                  await api.delete(`/api/attendances/${existingRecord.id}/`);
                  await queryClient.invalidateQueries({ queryKey: ['reh-attendances'] });
              }
              setIsSyncing(false);
              return;
          }

          const payload = {
              rehearsal: rehearsalId,
              participation: participation.id,
              status: newStatus,
              minutes_late: newStatus === 'LATE' && newMins ? parseInt(newMins) : null,
              excuse_note: newStatus === 'EXCUSED' ? newNote : null
          };

          if (existingRecord?.id) {
              await api.patch(`/api/attendances/${existingRecord.id}/`, payload);
          } else {
              await api.post('/api/attendances/', payload);
          }
          
          await queryClient.invalidateQueries({ queryKey: ['reh-attendances'] });
      } catch (e) {
          toast.error(`Błąd zapisu dla: ${artist.last_name}`);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setStatus(val);
      // Status change implies immediate explicit intent, save instantly
      saveToServer(val, minutesLate, note);
  };

  const handleTextBlur = () => {
      // Defer payload sync until user finishes typing
      if (status) saveToServer(status, minutesLate, note);
  };

  return (
    <tr className="hover:bg-white/60 transition-colors group">
      <td className="px-5 py-4">
          <p className="font-bold text-stone-800 tracking-tight">{artist.first_name} {artist.last_name}</p>
          <p className="text-[9px] uppercase font-bold antialiased text-stone-400 tracking-widest mt-0.5">
            {(artist as any).voice_type_display || artist.voice_type}
          </p>
      </td>
      
      <td className="px-5 py-4">
        <select 
          value={status} 
          onChange={handleStatusChange} 
          disabled={isSyncing}
          className={`w-full px-3 py-2.5 text-xs font-bold border rounded-xl outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] appearance-none cursor-pointer ${
            status === 'PRESENT' ? 'border-emerald-300 text-emerald-700 bg-emerald-50 focus:ring-emerald-500/20' : 
            status === 'LATE' ? 'border-orange-300 text-orange-700 bg-orange-50 focus:ring-orange-500/20' : 
            (status === 'ABSENT' || status === 'EXCUSED') ? 'border-red-300 text-red-700 bg-red-50 focus:ring-red-500/20' : 
            'border-stone-200/80 text-stone-500 bg-white/50 focus:ring-[#002395]/20'
          }`}
        >
          <option value="">— Brak Wpisu —</option>
          <option value="PRESENT">Obecny</option>
          <option value="LATE">Spóźniony</option>
          <option value="ABSENT">Nieobecny</option>
          <option value="EXCUSED">Usprawiedliwiony</option>
        </select>
      </td>
      
      <td className="px-5 py-4 hidden sm:table-cell">
        <AnimatePresence mode="popLayout">
          {status === 'LATE' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-center gap-2">
                <Clock size={14} className="text-orange-500" aria-hidden="true" />
                <input 
                    type="number" min="1" placeholder="Minuty"
                    value={minutesLate} 
                    onChange={(e) => setMinutesLate(e.target.value)}
                    onBlur={handleTextBlur}
                    disabled={isSyncing}
                    className="w-24 text-xs font-bold text-orange-800 px-3 py-2.5 border border-orange-200/80 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white/80 shadow-sm"
                />
            </motion.div>
          )}
          {status === 'EXCUSED' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-500" aria-hidden="true" />
                <input 
                    type="text" placeholder="Powód nieobecności"
                    value={note} 
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={handleTextBlur}
                    disabled={isSyncing}
                    className="w-full max-w-[200px] text-xs font-bold text-red-800 px-3 py-2.5 border border-red-200/80 rounded-xl outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 bg-white/80 shadow-sm"
                />
            </motion.div>
          )}
        </AnimatePresence>
      </td>
      
      <td className="px-5 py-4 text-right">
        <div className="h-5 flex items-center justify-end">
            {isSyncing && <Loader2 size={14} className="animate-spin text-[#002395]" aria-hidden="true" />}
        </div>
      </td>
    </tr>
  );
}