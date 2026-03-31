/**
 * @file Rehearsals.tsx
 * @description Master Attendance Log and Inspector Dashboard view.
 * Integrates horizontal timeline controls, segmented artist row states, and KPI analytics.
 * @module panel/Rehearsals
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
    Calendar, MapPin, CheckCircle2, AlertCircle, 
    Loader2, CheckSquare, Clock, SearchX, Briefcase, ChevronDown
} from 'lucide-react';

import { useRehearsalsData } from './hooks/useRehearsalsData';
import { GlassCard } from '../../ui/GlassCard';
import { Button } from '../../ui/Button';
import { ArtistRow } from './ArtistRow';

export default function Rehearsals(): React.JSX.Element {
    const {
        isLoading, isError, projects, selectedProjectId, setSelectedProjectId,
        projectRehearsals, activeRehearsalId, setActiveRehearsalId,
        activeRehearsal, invitedParticipations, artistMap, attendanceMap,
        stats, isMarkingAll, handleMarkAllPresent
    } = useRehearsalsData();

    useEffect(() => {
        if (isError) {
            toast.error("Błąd synchronizacji", { description: "Nie udało się załadować danych z serwera." });
        }
    }, [isError]);

    if (isLoading && projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 size={32} className="animate-spin text-[#002395]/40" aria-hidden="true" />
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

            <GlassCard variant="dark" className="flex flex-col md:flex-row md:items-center gap-6">
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
                                className="w-full px-5 py-4 text-sm text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold appearance-none cursor-pointer hover:bg-white/10"
                            >
                                <option value="" className="text-stone-900">— Wybierz wydarzenie z bazy —</option>
                                {projects.filter(p => p.status !== 'CANC').map(p => (
                                    <option key={p.id} value={p.id} className="text-stone-900">{p.title} {p.status === 'DONE' ? '(Archiwum)' : ''}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-stone-400">
                                <ChevronDown size={18} />
                            </div>
                        </div>
                    </div>
                </div>
            </GlassCard>

            {!selectedProjectId && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                    <GlassCard variant="premium" className="text-center flex flex-col items-center justify-center p-16 mt-8">
                        <Calendar size={48} className="mb-4 text-stone-300 opacity-50" aria-hidden="true" />
                        <p className="text-[11px] font-bold antialiased text-stone-600 uppercase tracking-widest mb-2">Brak wybranego projektu</p>
                        <p className="text-xs text-stone-400 max-w-sm leading-relaxed">Aby sprawdzić lub uzupełnić dziennik inspektora, wybierz wydarzenie z przełącznika kontekstu powyżej.</p>
                    </GlassCard>
                </motion.div>
            )}

            {selectedProjectId && projectRehearsals.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                    
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-stone-200/60">
                        {projectRehearsals.map((reh) => {
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

                    {activeRehearsal && (
                        <GlassCard noPadding variant="premium" className="flex flex-col">
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
                                <Button 
                                    variant="primary"
                                    onClick={handleMarkAllPresent}
                                    disabled={isMarkingAll || invitedParticipations.length === 0 || stats.none === 0}
                                    isLoading={isMarkingAll}
                                    leftIcon={!isMarkingAll ? <CheckCircle2 size={16} aria-hidden="true" /> : undefined}
                                >
                                    Uzupełnij luki ({stats.none}) jako "Obecny"
                                </Button>
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
                        </GlassCard>
                    )}
                </motion.div>
            )}

            {selectedProjectId && projectRehearsals.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <GlassCard variant="premium" className="text-center flex flex-col items-center justify-center p-16 mt-8">
                        <AlertCircle size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
                        <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-600 mb-2">Brak zaplanowanych prób</span>
                        <span className="text-xs text-stone-400 max-w-sm leading-relaxed">Przejdź do zakładki "Zarządzanie Projektami", aby zaplanować harmonogram prób do tego projektu.</span>
                    </GlassCard>
                </motion.div>
            )}
        </div>
    );
}