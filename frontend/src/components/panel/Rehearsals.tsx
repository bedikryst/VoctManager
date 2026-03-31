/**
 * @file Rehearsals.tsx
 * @description Master Attendance Log and Inspector Dashboard.
 * @architecture Enterprise 2026
 * UX UPGRADE: Migrated to a "Data-Dense" layout. Rehearsals are now selected via a compact 
 * horizontal timeline. Artist rows use segmented controls and minimalistic inputs.
 * BUGFIX: Restored `minutes_late` tracking logic and encapsulated `saveToServer` within 
 * memoized rows to prevent global DOM re-renders during active typing.
 * BUGFIX: Fixed TypeScript prop mismatches (`rate` and `existingRecord`).
 * @module hr/Rehearsals
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
    Calendar, MapPin, CheckCircle2, 
    AlertCircle, Loader2, CheckSquare, Clock, 
    Target, SearchX, Briefcase,
    ChevronDown, Edit3, UserMinus
} from 'lucide-react';

import api from '../../utils/api';
import { queryKeys } from '../../utils/queryKeys';
import type { Project, Rehearsal, Participation, Attendance, Artist } from '../../types';

const extractData = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.results && Array.isArray(payload.results)) return payload.results;
    return [];
};

const STYLE_PREMIUM_GLASS = "bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] shadow-[inset_0_1px_0_rgba(255,255,255,1)] rounded-[2rem]";
const STYLE_DARK_GLASS_INPUT = "w-full px-5 py-4 text-sm text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] font-bold appearance-none cursor-pointer hover:bg-white/10";

// ============================================================================
// SUB-COMPONENT: MEMOIZED ARTIST ROW (Self-Contained API Logic)
// ============================================================================
interface ArtistRowProps {
    part: Participation;
    artist: Artist;
    rehearsalId: string;
    existingRecord: Attendance | undefined;
}

const ArtistRow = React.memo(({ part, artist, rehearsalId, existingRecord }: ArtistRowProps) => {
    const queryClient = useQueryClient();
    
    const [status, setStatus] = useState<string | null>(existingRecord?.status || null);
    const [minutesLate, setMinutesLate] = useState<string>(existingRecord?.minutes_late ? String(existingRecord.minutes_late) : '');
    const [note, setNote] = useState<string>(existingRecord?.excuse_note || '');
    const [isSyncing, setIsSyncing] = useState<boolean>(false);

    useEffect(() => {
        setStatus(existingRecord?.status || null);
        setMinutesLate(existingRecord?.minutes_late ? String(existingRecord.minutes_late) : '');
        setNote(existingRecord?.excuse_note || '');
    }, [existingRecord]);

    const saveToServer = async (newStatus: string | null, newMins: string, newNote: string) => {
        setIsSyncing(true);
        try {
            if (!newStatus) {
                if (existingRecord?.id) {
                    await api.delete(`/api/attendances/${existingRecord.id}/`);
                    await Promise.all([
                        queryClient.invalidateQueries({ queryKey: queryKeys.rehearsals.all }),
                        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
                    ]);
                }
                setIsSyncing(false);
                return;
            }

            const payload = {
                rehearsal: rehearsalId,
                participation: part.id,
                status: newStatus,
                minutes_late: newStatus === 'LATE' && newMins ? parseInt(newMins) : null,
                excuse_note: (newStatus === 'EXCUSED' || newStatus === 'ABSENT' || newStatus === 'LATE') ? newNote : null
            };

            if (existingRecord?.id) {
                await api.patch(`/api/attendances/${existingRecord.id}/`, payload);
            } else {
                await api.post('/api/attendances/', payload);
            }
            
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.rehearsals.all }),
                queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
            ]);
        } catch (e) {
            toast.error(`Błąd zapisu dla: ${artist.last_name}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleStatusToggle = (targetStatus: string) => {
        const nextStatus = status === targetStatus ? null : targetStatus;
        setStatus(nextStatus);
        saveToServer(nextStatus, minutesLate, note);
    };

    const handleTextBlur = () => {
        if (status) saveToServer(status, minutesLate, note);
    };

    return (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3 bg-white/60 hover:bg-white transition-colors border-b border-stone-100/80 group">
            {/* Dane Artysty */}
            <div className="flex items-center gap-3 w-full md:w-64 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200/80 flex items-center justify-center text-[10px] font-bold text-stone-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                    {artist.first_name[0]}{artist.last_name[0]}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-stone-800 tracking-tight truncate">{artist.first_name} {artist.last_name}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">{artist.voice_type_display || artist.voice_type}</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col xl:flex-row items-start xl:items-center gap-3 md:gap-6 w-full justify-end">
                {/* Segmented Control (Zamiast <select>) */}
                <div className="flex bg-stone-100/50 p-1 rounded-xl border border-stone-200/60 shadow-sm w-full sm:w-auto flex-shrink-0">
                    <button 
                        onClick={() => handleStatusToggle('PRESENT')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${status === 'PRESENT' ? 'bg-emerald-500 text-white shadow-md' : 'text-stone-500 hover:text-stone-800 hover:bg-white'}`}
                    >
                        Obecny
                    </button>
                    <button 
                        onClick={() => handleStatusToggle('LATE')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${status === 'LATE' ? 'bg-orange-500 text-white shadow-md' : 'text-stone-500 hover:text-stone-800 hover:bg-white'}`}
                    >
                        Spóźniony
                    </button>
                    <button 
                        onClick={() => handleStatusToggle('ABSENT')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${status === 'ABSENT' ? 'bg-red-500 text-white shadow-md' : 'text-stone-500 hover:text-stone-800 hover:bg-white'}`}
                    >
                        Nieobecny
                    </button>
                    <button 
                        onClick={() => handleStatusToggle('EXCUSED')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${status === 'EXCUSED' ? 'bg-purple-500 text-white shadow-md' : 'text-stone-500 hover:text-stone-800 hover:bg-white'}`}
                    >
                        Zwolniony
                    </button>
                </div>

                {/* Notatki i Minuty (AnimatePresence) */}
                <div className="flex items-center gap-2 w-full sm:w-auto flex-1 xl:flex-none justify-end">
                    <AnimatePresence mode="popLayout">
                        {status === 'LATE' && (
                            <motion.div initial={{ opacity: 0, scale: 0.9, width: 0 }} animate={{ opacity: 1, scale: 1, width: 'auto' }} exit={{ opacity: 0, scale: 0.9, width: 0 }} className="relative flex-shrink-0">
                                <Clock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-orange-400" />
                                <input 
                                    type="number" min="1" placeholder="Ile min?"
                                    value={minutesLate} onChange={(e) => setMinutesLate(e.target.value)} onBlur={handleTextBlur} disabled={isSyncing}
                                    className="w-24 text-xs font-bold text-orange-800 py-2 pl-7 pr-2 border border-orange-200/80 rounded-lg outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-orange-50/50 shadow-sm transition-all"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="relative w-full sm:w-56 flex-shrink-0 flex items-center">
                        <Edit3 size={12} className={`absolute left-3 ${status === 'EXCUSED' ? 'text-purple-400' : status === 'LATE' ? 'text-orange-400' : status === 'ABSENT' ? 'text-red-400' : 'text-stone-300'}`} />
                        <input 
                            type="text" placeholder="Notatka (opcjonalnie)"
                            value={note} onChange={(e) => setNote(e.target.value)} onBlur={handleTextBlur} disabled={isSyncing}
                            className={`w-full text-xs font-medium pl-8 pr-8 py-2 rounded-lg outline-none focus:ring-2 transition-all ${
                                status === 'EXCUSED' ? 'bg-purple-50/50 text-purple-800 border border-purple-200/80 focus:ring-purple-500/20 focus:border-purple-400 placeholder-purple-300' : 
                                status === 'LATE' ? 'bg-orange-50/50 text-orange-800 border border-orange-200/80 focus:ring-orange-500/20 focus:border-orange-400 placeholder-orange-300' :
                                status === 'ABSENT' ? 'bg-red-50/50 text-red-800 border border-red-200/80 focus:ring-red-500/20 focus:border-red-400 placeholder-red-300' :
                                'bg-transparent hover:bg-stone-50 focus:bg-white text-stone-700 border border-transparent hover:border-stone-200 focus:border-[#002395]/40 focus:ring-[#002395]/20 placeholder-stone-300'
                            }`}
                        />
                        {isSyncing && <Loader2 size={12} className="absolute right-3 animate-spin text-stone-400" />}
                    </div>
                </div>
            </div>
        </div>
    );
}, (prev, next) => {
    return prev.existingRecord?.status === next.existingRecord?.status &&
           prev.existingRecord?.excuse_note === next.existingRecord?.excuse_note &&
           prev.existingRecord?.minutes_late === next.existingRecord?.minutes_late &&
           prev.rehearsalId === next.rehearsalId;
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function Rehearsals(): React.JSX.Element {
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeRehearsalId, setActiveRehearsalId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);

  const results = useQueries({
    queries: [
      { queryKey: queryKeys.projects.all, queryFn: async () => (await api.get('/api/projects/')).data },
      { queryKey: queryKeys.rehearsals.all, queryFn: async () => (await api.get('/api/rehearsals/')).data },
      { queryKey: queryKeys.participations.all, queryFn: async () => (await api.get('/api/participations/')).data },
      { queryKey: queryKeys.attendances.all, queryFn: async () => (await api.get('/api/attendances/')).data },
      { queryKey: queryKeys.artists.all, queryFn: async () => (await api.get('/api/artists/')).data }
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
    projects: extractData(results[0].data) as Project[],
    rehearsals: extractData(results[1].data) as Rehearsal[],
    participations: extractData(results[2].data) as Participation[],
    attendances: extractData(results[3].data) as Attendance[],
    artists: extractData(results[4].data) as Artist[]
  }), [results]);

  // --- SMART CONTEXT RESOLUTION (Auto-Select Project) ---
  useEffect(() => {
      if (!selectedProjectId && data.projects.length > 0) {
          const now = new Date();
          const activeProjects = data.projects.filter(p => p.status === 'ACTIVE' || p.status === 'DRAFT');
          const upcoming = activeProjects
              .filter(p => new Date(p.date_time) >= new Date(now.getTime() - 24 * 60 * 60 * 1000))
              .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

          if (upcoming.length > 0) {
              setSelectedProjectId(String(upcoming[0].id));
          } else {
              const past = [...data.projects].sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
              setSelectedProjectId(String(past[0].id));
          }
      }
  }, [data.projects, selectedProjectId]);

  // --- HASH MAPS & RELATIONS ---
  const artistMap = useMemo<Map<string, Artist>>(() => {
      const map = new Map<string, Artist>();
      data.artists.forEach(a => map.set(String(a.id), a));
      return map;
  }, [data.artists]);

  const projectRehearsals = useMemo(() => {
      if (!selectedProjectId) return [];
      return data.rehearsals
          .filter(r => String(r.project) === String(selectedProjectId))
          .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  }, [data.rehearsals, selectedProjectId]);

  const projectParticipations = useMemo(() => {
      if (!selectedProjectId) return [];
      return data.participations.filter(p => String(p.project) === String(selectedProjectId) && p.status !== 'DEC');
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

  const invitedParticipations = useMemo(() => {
      if (!activeRehearsal) return [];
      const invitedIds = activeRehearsal.invited_participations || [];
      const relevantParts = invitedIds.length > 0 
          ? projectParticipations.filter(p => invitedIds.includes(String(p.id)))
          : projectParticipations; // Tutti fallback
      
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

  // --- KPI STATS ---
  const stats = useMemo(() => {
      let present = 0; let late = 0; let absent = 0; let none = 0; let excused = 0;
      invitedParticipations.forEach(p => {
          const att = attendanceMap.get(String(p.id));
          if (!att) none++;
          else if (att.status === 'PRESENT') present++;
          else if (att.status === 'LATE') late++;
          else if (att.status === 'EXCUSED') excused++;
          else absent++;
      });
      const total = invitedParticipations.length;
      const completionRate = total > 0 ? ((total - none) / total) * 100 : 0;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
      
      return { present, late, absent, excused, none, total, completionRate, rate };
  }, [invitedParticipations, attendanceMap]);

  // --- MUTATIONS ---
  const handleMarkAllPresent = async (): Promise<void> => {
      if (!activeRehearsalId || invitedParticipations.length === 0) return;
      
      setIsMarkingAll(true);
      const toastId = toast.loading("Zbiorcze zaznaczanie obecności...");

      try {
          const promises = invitedParticipations.map(part => {
              const existing = attendanceMap.get(String(part.id));
              if (existing) {
                  if (existing.status !== 'PRESENT' && existing.status !== 'EXCUSED' && existing.status !== 'LATE') {
                      return api.patch(`/api/attendances/${existing.id}/`, { status: 'PRESENT', minutes_late: null, excuse_note: null });
                  }
                  return Promise.resolve();
              } else {
                  return api.post('/api/attendances/', { rehearsal: activeRehearsalId, participation: part.id, status: 'PRESENT' });
              }
          });

          await Promise.all(promises);
          
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.attendances.all }),
            queryClient.invalidateQueries({ queryKey: queryKeys.rehearsals.all }),
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
          ]);
          
          toast.success(`Uzupełniono luki jako "Obecny".`, { id: toastId });
      } catch (err) {
          toast.error("Błąd systemu", { id: toastId, description: "Nie udało się zapisać masowej obecności." });
      } finally {
          setIsMarkingAll(false);
      }
  };

  // --- RENDER ---
  if (isLoading && !data.projects.length) {
    return (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 size={32} className="animate-spin text-[#002395]/40" />
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002395]/60">Ładowanie dziennika...</span>
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-24 max-w-7xl mx-auto cursor-default px-4 sm:px-6 lg:px-8">
      
      <header className="relative pt-8 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                  <CheckSquare size={12} className="text-[#002395]" aria-hidden="true" />
                  <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                      Moduł Inspektora
                  </p>
              </div>
              <h1 className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                  Dziennik <span className="italic text-[#002395] font-bold">Obecności</span>.
              </h1>
              <p className="text-stone-500 mt-3 font-medium tracking-wide text-sm max-w-xl">
                  Zarządzaj frekwencją, sprawdzaj usprawiedliwienia i monitoruj zaangażowanie zespołu w czasie rzeczywistym.
              </p>
          </motion.div>
      </header>

      <div className="bg-[#0a0a0a] p-6 md:p-8 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex flex-col md:flex-row md:items-center gap-6 relative overflow-hidden group border border-stone-800">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#002395] rounded-full blur-[100px] opacity-40 pointer-events-none group-hover:opacity-60 transition-opacity duration-1000"></div>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        
        <div className="relative z-10 w-full flex flex-col sm:flex-row gap-5 items-center">
            <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 text-blue-300">
                <Briefcase size={24} aria-hidden="true" />
            </div>
            <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold antialiased uppercase tracking-[0.2em] text-stone-400 mb-2 ml-1">
                    Aktywne Wydarzenie (Kontekst Dziennika)
                </label>
                <div className="relative">
                    <select 
                        value={selectedProjectId} 
                        onChange={e => setSelectedProjectId(e.target.value)} 
                        className={STYLE_DARK_GLASS_INPUT}
                    >
                        <option value="" className="text-stone-900">— Wybierz wydarzenie z bazy —</option>
                        {data.projects.filter(p => p.status !== 'CANC').map(p => (
                            <option key={p.id} value={p.id} className="text-stone-900">{p.title} {p.status === 'DONE' ? '(Archiwum)' : ''}</option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-stone-400">
                        <ChevronDown size={18} />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {!selectedProjectId && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`${STYLE_PREMIUM_GLASS} p-16 flex flex-col items-center justify-center text-center mt-8`}>
            <Calendar size={48} className="mb-4 text-stone-300 opacity-50" aria-hidden="true" />
            <p className="text-[11px] font-bold antialiased text-stone-600 uppercase tracking-widest mb-2">Brak wybranego projektu</p>
            <p className="text-xs text-stone-400 max-w-sm leading-relaxed">Aby sprawdzić lub uzupełnić dziennik inspektora, wybierz wydarzenie z przełącznika kontekstu powyżej.</p>
        </motion.div>
      )}

      {selectedProjectId && projectRehearsals.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            
            {/* Rehearsal Horizontal Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-stone-200/60">
              {projectRehearsals.map((reh, idx) => {
                  const isSelected = String(activeRehearsalId) === String(reh.id);
                  const isPast = new Date(reh.date_time) < new Date();
                  return (
                      <button 
                          key={reh.id} 
                          onClick={() => setActiveRehearsalId(String(reh.id))}
                          className={`flex flex-col items-start p-3.5 min-w-[150px] rounded-2xl border transition-all text-left flex-shrink-0 active:scale-95 ${isSelected ? 'bg-white border-[#002395] shadow-[0_10px_25px_rgba(0,35,149,0.1)] ring-1 ring-[#002395]' : 'bg-white/50 border-white/80 shadow-sm hover:bg-white'}`}
                      >
                          <span className={`text-[9px] font-bold antialiased uppercase tracking-widest mb-1 ${isSelected ? 'text-[#002395]' : 'text-stone-400'}`}>
                              {new Date(reh.date_time).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                          </span>
                          <span className={`text-xl font-black tracking-tight leading-none mb-1.5 ${isSelected ? 'text-stone-900' : isPast ? 'text-stone-400' : 'text-stone-700'}`}>
                              {new Date(reh.date_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-[8px] font-bold uppercase tracking-widest text-stone-400 truncate max-w-full">
                              {reh.location || 'Brak lok.'}
                          </span>
                      </button>
                  );
              })}
            </div>

            {/* Active Rehearsal Metadata & Stats Dashboard */}
            {activeRehearsal && (
                <div className={`${STYLE_PREMIUM_GLASS} overflow-hidden flex flex-col`}>
                    <div className="p-6 md:p-8 bg-stone-50/50 border-b border-stone-200/60 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-3 py-1.5 bg-blue-50 text-[#002395] text-[8px] font-bold uppercase tracking-widest rounded border border-blue-100 shadow-sm">
                                    {activeRehearsal.invited_participations?.length ? 'Próba Sekcyjna / Wybrani' : 'Tutti'}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-stone-900 tracking-tight leading-tight">{activeRehearsal.focus || 'Praca Bieżąca'}</h3>
                            <div className="flex items-center gap-4 mt-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
                                <span className="flex items-center gap-1.5"><Clock size={12}/> {new Date(activeRehearsal.date_time).toLocaleString('pl-PL', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="flex items-center gap-1.5"><MapPin size={12}/> {activeRehearsal.location}</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:gap-4 bg-white p-3 rounded-2xl border border-stone-200/80 shadow-sm">
                            <div className="flex flex-col items-center px-4 py-1 border-r border-stone-100 last:border-0">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Frekwencja</span>
                                <span className={`text-lg font-black ${stats.rate >= 80 ? 'text-emerald-600' : stats.rate >= 50 ? 'text-orange-500' : 'text-red-500'}`}>{stats.rate}%</span>
                            </div>
                            <div className="flex flex-col items-center px-4 py-1 border-r border-stone-100 last:border-0">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Obecni</span>
                                <span className="text-lg font-black text-stone-800">{stats.present + stats.late}<span className="text-xs text-stone-400 ml-1">/ {stats.total}</span></span>
                            </div>
                            <div className="flex flex-col items-center px-4 py-1 border-r border-stone-100 last:border-0">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Braki</span>
                                <span className="text-lg font-black text-red-500">{stats.absent + stats.excused}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end p-4 border-b border-stone-200/60 bg-white">
                        <button 
                          onClick={handleMarkAllPresent}
                          disabled={isMarkingAll || invitedParticipations.length === 0 || stats.none === 0}
                          className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] uppercase tracking-[0.15em] font-bold antialiased py-3 px-5 rounded-xl transition-all shadow-sm active:scale-95"
                        >
                          {isMarkingAll ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                          Uzupełnij luki ({stats.none}) jako "Obecny"
                        </button>
                    </div>

                    <div className="flex-1 overflow-x-hidden overflow-y-auto max-h-[60vh] bg-stone-50/30">
                        {['S', 'A', 'T', 'B'].map((voiceGroup) => {
                            const groupParts = invitedParticipations.filter(p => {
                                const artist = artistMap.get(String(p.artist));
                                return artist?.voice_type?.startsWith(voiceGroup);
                            });

                            if (groupParts.length === 0) return null;

                            return (
                                <div key={voiceGroup} className="mb-6 last:mb-0">
                                    <div className="bg-stone-100/80 px-4 py-2 border-y border-stone-200/60 sticky top-0 z-10 backdrop-blur-md">
                                        <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395]">
                                            {voiceGroup === 'S' ? 'Soprany' : voiceGroup === 'A' ? 'Alty' : voiceGroup === 'T' ? 'Tenory' : 'Basy'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        {groupParts.map((part) => {
                                            const artist = artistMap.get(String(part.artist));
                                            if (!artist) return null;
                                            return (
                                                <ArtistRow 
                                                    key={part.id}
                                                    part={part}
                                                    artist={artist}
                                                    existingRecord={attendanceMap.get(String(part.id))}
                                                    rehearsalId={activeRehearsal.id}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {invitedParticipations.length === 0 && (
                            <div className="text-center py-16 text-stone-400">
                                <SearchX size={32} className="mx-auto mb-3 opacity-30" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">Brak obsady</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
      )}

      {selectedProjectId && projectRehearsals.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${STYLE_PREMIUM_GLASS} text-center p-16 flex flex-col items-center justify-center mt-8`}>
            <AlertCircle size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
            <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-600 mb-2">Brak zaplanowanych prób</span>
            <span className="text-xs text-stone-400 max-w-sm leading-relaxed">Przejdź do zakładki "Zarządzanie Projektami", aby zaplanować harmonogram prób do tego projektu.</span>
          </motion.div>
      )}
    </div>
  );
}