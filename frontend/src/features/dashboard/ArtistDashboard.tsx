/**
 * @file ArtistDashboard.tsx
 * @description Highly personalized Assistant Dashboard for Artists.
 * Presents immediate logistical alerts and quick access to personal resources.
 * @module panel/dashboard/ArtistDashboard
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { 
    Calendar, Music, ArrowRight, Clock, Loader2, 
    MapPin, Sparkles, ChevronRight, Activity, BookOpen,
    UserMinus
} from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import { GlassCard } from '../../../shared/ui/GlassCard';
import { useArtistDashboardData } from './hooks/useArtistDashboardData';

const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } }};
const itemVariants: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }};

export default function ArtistDashboard(): React.JSX.Element {
    const { user } = useAuth();
    const { isLoading, upNextEvent, greeting } = useArtistDashboardData(user?.id);

    if (isLoading) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
                <Loader2 size={32} className="animate-spin text-[#002395]/40" aria-hidden="true" />
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002395]/60">Synchronizacja pulpitu...</span>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-fade-in pb-24 px-4 sm:px-6 lg:px-8">
            
            <header className="relative pt-8">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 shadow-sm mb-6">
                        <div className="relative flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 z-10"></div>
                            <div className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.15em] font-bold antialiased text-stone-600">
                            Witaj na platformie
                        </p>
                    </div>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-stone-900 leading-[1.05] tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                        {greeting}, <span className="italic text-[#002395] font-bold">{user?.first_name || 'Artysto'}</span>.
                    </h1>
                    <p className="text-stone-500 mt-3 font-medium tracking-wide text-sm max-w-xl">
                        Oto Twoje muzyczne podsumowanie na dziś. Sprawdź, gdzie powinieneś być i co powinieneś przygotować.
                    </p>
                </motion.div>
            </header>

            <section>
                <div className="flex items-center gap-2 mb-6">
                    <Sparkles size={16} className="text-[#002395]" aria-hidden="true" />
                    <h2 className="text-[10px] font-bold antialiased uppercase tracking-[0.2em] text-stone-400">
                        Najbliższe wyzwanie
                    </h2>
                </div>
                
                {upNextEvent ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                        <GlassCard variant="dark" className="p-8 md:p-10 relative overflow-hidden group">
                            <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#002395] rounded-full blur-[100px] opacity-60 pointer-events-none transition-transform duration-1000 group-hover:scale-110"></div>
                            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                            
                            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                                <div className="flex-1">
                                    <span className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-[9px] font-bold uppercase tracking-widest backdrop-blur-md mb-5 inline-block shadow-sm text-blue-100">
                                        {upNextEvent.type === 'REHEARSAL' ? 'Próba Muzyczna' : 'Wydarzenie Główne'}
                                    </span>
                                    <h3 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight max-w-2xl text-white">
                                        {upNextEvent.title}
                                    </h3>
                                    
                                    <div className="flex flex-wrap items-center gap-3 text-sm font-medium mt-6 text-stone-300">
                                        <span className="flex items-center gap-2 bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                                            <Calendar size={16} className="text-blue-400" aria-hidden="true" /> 
                                            {upNextEvent.date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </span>
                                        <span className="flex items-center gap-2 bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                                            <Clock size={16} className="text-blue-400" aria-hidden="true" /> 
                                            {upNextEvent.date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {upNextEvent.data.location && (
                                            <span className="flex items-center gap-2 bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                                                <MapPin size={16} className="text-blue-400" aria-hidden="true" /> 
                                                {upNextEvent.data.location}
                                            </span>
                                        )}
                                        
                                        {upNextEvent.type === 'REHEARSAL' && upNextEvent.absences > 0 && (
                                            <span className="flex items-center gap-2 bg-red-500/10 text-red-300 border border-red-500/20 px-4 py-2.5 rounded-xl shadow-sm">
                                                <UserMinus size={16} className="text-red-400" aria-hidden="true" /> 
                                                Zgłoszone nieobecności: {upNextEvent.absences}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <Link 
                                    to={upNextEvent.type === 'REHEARSAL' ? '/panel/schedule' : '/panel/materials'} 
                                    className="w-full lg:w-auto mt-4 lg:mt-0 px-8 py-4 bg-white hover:bg-stone-200 text-stone-900 rounded-2xl font-bold uppercase text-[10px] tracking-[0.15em] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center gap-2 flex-shrink-0 group/btn"
                                >
                                    {upNextEvent.type === 'REHEARSAL' ? 'Sprawdź grafik' : 'Pobierz Nuty'} 
                                    <ArrowRight size={16} className="transform group-hover/btn:translate-x-1 transition-transform" aria-hidden="true" />
                                </Link>
                            </div>
                        </GlassCard>
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-stone-50 border border-dashed border-stone-300/60 rounded-[2rem] p-12 text-center flex flex-col items-center">
                        <Activity size={40} className="text-stone-300 mb-4" aria-hidden="true" />
                        <p className="text-stone-700 text-lg font-bold">Brak nadchodzących wydarzeń</p>
                        <p className="text-stone-500 text-sm mt-2">Odpocznij, twój muzyczny kalendarz jest obecnie pusty.</p>
                    </motion.div>
                )}
            </section>

            {/* BENTO NAVIGATION GRID */}
            <section>
                <div className="flex items-center gap-3 mb-6 ml-2">
                    <div className="w-1 h-6 bg-[#002395] rounded-full"></div>
                    <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.2em] text-stone-400">Moduły Osobiste</h3>
                </div>

                <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    
                    <Link to="/panel/schedule" className="outline-none group block h-full">
                        <motion.div variants={itemVariants} className="h-full">
                            <GlassCard variant="premium" className="p-6 flex flex-col h-full hover:border-[#002395]/40 hover:shadow-[0_20px_40px_rgba(0,35,149,0.08)] hover:-translate-y-1 transition-all duration-500">
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-50/0 to-orange-50/0 group-hover:from-orange-50/50 group-hover:to-transparent transition-colors duration-500 pointer-events-none"></div>
                                <div className="relative z-10 flex-1">
                                    <div className="w-12 h-12 bg-white border border-stone-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-md group-hover:border-orange-200 transition-all duration-500 text-orange-600">
                                        <Calendar size={20} aria-hidden="true" />
                                    </div>
                                    <h4 className="text-xl font-bold text-stone-900 mb-2 tracking-tight group-hover:text-[#002395] transition-colors">Mój Kalendarz</h4>
                                    <p className="text-[11px] text-stone-500 font-medium leading-relaxed">Sprawdź próby, koncerty i w prosty sposób zgłoś swoją nieobecność inspektorowi.</p>
                                </div>
                                <div className="relative z-10 flex items-center justify-between pt-6 border-t border-stone-200/50 group-hover:border-orange-200/50 transition-colors mt-6">
                                    <span className="text-[9px] uppercase tracking-[0.15em] font-bold antialiased text-stone-400 group-hover:text-[#002395] transition-colors">Otwórz Moduł</span>
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-stone-200/60 group-hover:bg-[#002395] group-hover:border-[#002395] shadow-sm transition-all duration-300">
                                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-white transform group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>
                    </Link>

                    <Link to="/panel/materials" className="outline-none group block h-full">
                        <motion.div variants={itemVariants} className="h-full">
                            <GlassCard variant="premium" className="p-6 flex flex-col h-full hover:border-[#002395]/40 hover:shadow-[0_20px_40px_rgba(0,35,149,0.08)] hover:-translate-y-1 transition-all duration-500">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-emerald-50/0 group-hover:from-emerald-50/50 group-hover:to-transparent transition-colors duration-500 pointer-events-none"></div>
                                <div className="relative z-10 flex-1">
                                    <div className="w-12 h-12 bg-white border border-stone-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-md group-hover:border-emerald-200 transition-all duration-500 text-emerald-600">
                                        <Music size={20} aria-hidden="true" />
                                    </div>
                                    <h4 className="text-xl font-bold text-stone-900 mb-2 tracking-tight group-hover:text-[#002395] transition-colors">Materiały</h4>
                                    <p className="text-[11px] text-stone-500 font-medium leading-relaxed">Twoje osobiste repozytorium. Pobierz nuty PDF i ćwicz z dedykowanymi ścieżkami audio.</p>
                                </div>
                                <div className="relative z-10 flex items-center justify-between pt-6 border-t border-stone-200/50 group-hover:border-emerald-200/50 transition-colors mt-6">
                                    <span className="text-[9px] uppercase tracking-[0.15em] font-bold antialiased text-stone-400 group-hover:text-[#002395] transition-colors">Otwórz Moduł</span>
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-stone-200/60 group-hover:bg-[#002395] group-hover:border-[#002395] shadow-sm transition-all duration-300">
                                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-white transform group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>
                    </Link>

                    <Link to="/panel/resources" className="outline-none group block h-full md:col-span-2 lg:col-span-1">
                        <motion.div variants={itemVariants} className="h-full">
                            <GlassCard variant="premium" className="p-6 flex flex-col h-full hover:border-[#002395]/40 hover:shadow-[0_20px_40px_rgba(0,35,149,0.08)] hover:-translate-y-1 transition-all duration-500">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-50/0 to-purple-50/0 group-hover:from-purple-50/50 group-hover:to-transparent transition-colors duration-500 pointer-events-none"></div>
                                <div className="relative z-10 flex-1">
                                    <div className="w-12 h-12 bg-white border border-stone-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-md group-hover:border-purple-200 transition-all duration-500 text-purple-600">
                                        <BookOpen size={20} aria-hidden="true" />
                                    </div>
                                    <h4 className="text-xl font-bold text-stone-900 mb-2 tracking-tight group-hover:text-[#002395] transition-colors">Baza Wiedzy</h4>
                                    <p className="text-[11px] text-stone-500 font-medium leading-relaxed">Sprawdź wytyczne dyrygenta, obowiązujący dress-code oraz regulaminy i umowy.</p>
                                </div>
                                <div className="relative z-10 flex items-center justify-between pt-6 border-t border-stone-200/50 group-hover:border-purple-200/50 transition-colors mt-6">
                                    <span className="text-[9px] uppercase tracking-[0.15em] font-bold antialiased text-stone-400 group-hover:text-[#002395] transition-colors">Otwórz Moduł</span>
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-stone-200/60 group-hover:bg-[#002395] group-hover:border-[#002395] shadow-sm transition-all duration-300">
                                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-white transform group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>
                    </Link>

                </motion.div>
            </section>
        </div>
    );
}