/**
 * @file Schedule.tsx
 * @description Main Controller for the Artist Timeline.
 * Renders chronological rehearsal and project cards with absence reporting capabilities.
 * @module panel/schedule/Schedule
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Loader2, CalendarHeart } from 'lucide-react';

import { useAuth } from '../../app/providers/AuthProvider';
import { useScheduleData } from './hooks/useScheduleData';
import TimelineProjectCard from './cards/TimelineProjectCard';
import TimelineRehearsalCard from './cards/TimelineRehearsalCard'; 
import { GlassCard } from '../../shared/ui/GlassCard';

export default function Schedule(): React.JSX.Element {
    const { user } = useAuth();
    const {
        isLoading, viewMode, setViewMode, expandedEventId, 
        setExpandedEventId, filteredEvents, handleAbsenceSubmit, artistId
    } = useScheduleData(user?.id);

    return (
        <div className="space-y-6 animate-fade-in relative cursor-default pb-24 max-w-4xl mx-auto px-4 sm:px-0">
            
            <header className="relative pt-6 mb-10">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                        <Calendar size={12} className="text-[#002395]" aria-hidden="true" />
                        <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">Osobisty Kalendarz</p>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                        Mój <span className="italic text-[#002395]">Harmonogram</span>.
                    </h1>
                    <p className="text-stone-500 mt-2 font-medium tracking-wide text-sm">
                        Sprawdzaj próby, zgłaszaj nieobecności i śledź plany koncertowe.
                    </p>
                </motion.div>
            </header>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="inline-flex items-center p-1.5 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-xl overflow-x-auto max-w-full scrollbar-hide">
                    {[{ id: 'UPCOMING', label: 'Nadchodzące' }, { id: 'PAST', label: 'Historia' }].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => { setViewMode(tab.id as 'UPCOMING' | 'PAST'); setExpandedEventId(null); }} 
                            className={`px-5 py-2 text-[9px] font-bold antialiased uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${viewMode === tab.id ? 'bg-white text-[#002395] shadow-sm border border-stone-100' : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative z-10">
                <div className="absolute left-[19px] md:left-[31px] top-6 bottom-0 w-0.5 bg-gradient-to-b from-[#002395]/20 via-stone-200/50 to-transparent z-0 hidden sm:block"></div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 size={32} className="animate-spin text-[#002395]/40 mb-4" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[#002395]/60">Pobieranie grafiku...</span>
                    </div>
                ) : filteredEvents.length > 0 ? (
                    <div className="space-y-6">
                        <AnimatePresence mode="popLayout">
                            {filteredEvents.map((ev) => (
                                ev.type === 'PROJECT' ? (
                                    <TimelineProjectCard 
                                        key={ev.id} 
                                        event={ev} 
                                        isExpanded={expandedEventId === ev.id} 
                                        onToggle={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)} 
                                        artistId={artistId}
                                    />
                                ) : (
                                    <TimelineRehearsalCard 
                                        key={ev.id} 
                                        event={ev} 
                                        isExpanded={expandedEventId === ev.id} 
                                        onToggle={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)} 
                                        onSubmitReport={handleAbsenceSubmit}
                                        viewMode={viewMode}
                                    />
                                )
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10">
                        <GlassCard className="p-16 flex flex-col items-center justify-center text-center">
                            <CalendarHeart size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
                            <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak wpisów w kalendarzu</span>
                            <span className="text-xs text-stone-400 max-w-sm">W tym widoku nie masz przypisanych żadnych spotkań ani koncertów.</span>
                        </GlassCard>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
