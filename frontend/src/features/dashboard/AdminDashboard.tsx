/**
 * @file AdminDashboard.tsx
 * @description Mission Control Dashboard for Choir Managers & Conductors.
 * Presents global telemetric data, logistical alerts, and navigation modules.
 * @module panel/dashboard/AdminDashboard
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { 
    Calendar, Music, FileText, Users, Briefcase, 
    ArrowRight, Clock, MapPin, Wrench, 
    ChevronRight, ListOrdered, MicVocal, Activity, UserMinus,
    Plus
} from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import { GlassCard } from '../../../shared/ui/GlassCard';
import { useAdminDashboardData } from './hooks/useAdminDashboardData';

const ADMIN_MODULES = [
    { id: 'projects', title: 'Zarządzanie Projektami', desc: 'Centrum dowodzenia produkcją.', features: ['Harmonogramy', 'Setlisty', 'Casting'], icon: <Briefcase size={20} className="text-[#002395]" />, path: '/panel/project-management' },
    { id: 'archive', title: 'Archiwum Nut', desc: 'Centralna baza biblioteki muzycznej.', features: ['Pliki PDF', 'Ścieżki Audio', 'Wymagania'], icon: <Music size={20} className="text-[#002395]" />, path: '/panel/archive-management' },
    { id: 'artists', title: 'Baza Artystów', desc: 'Zarządzanie chórem i solistami.', features: ['Statystyki SATB', 'Profile', 'A vista'], icon: <Users size={20} className="text-[#002395]" />, path: '/panel/artists' },
    { id: 'contracts', title: 'Kadry i Płace', desc: 'Finanse, umowy i budżetowanie.', features: ['Stawki', 'Dokumenty', 'Budżet'], icon: <FileText size={20} className="text-[#002395]" />, path: '/panel/contracts' },
    { id: 'crew', title: 'Ekipa Techniczna', desc: 'Logistyka i reżyseria wydarzeń.', features: ['Dźwięk', 'Światło', 'Firmy'], icon: <Wrench size={20} className="text-[#002395]" />, path: '/panel/crew' }
];

const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } }};
const itemVariants: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }};

export default function AdminDashboard(): React.JSX.Element {
    const { user } = useAuth();
    const { isLoading, adminStats, nextProject, nextProjectStats, nextRehearsal } = useAdminDashboardData();

    if (isLoading) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center space-y-5">
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-16 h-16 border-4 border-[#002395]/20 rounded-full"></div>
                    <div className="w-16 h-16 border-4 border-[#002395] rounded-full border-t-transparent animate-spin"></div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002395]/60">Wczytywanie telemetrii...</span>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-fade-in relative cursor-default pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <header className="relative pt-8">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 shadow-sm mb-6">
                        <div className="relative flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 z-10"></div>
                            <div className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.15em] font-bold antialiased text-stone-600">
                            Zalogowano jako: {user?.first_name || 'Admin'}
                        </p>
                    </div>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-stone-900 leading-[1.05] tracking-tight max-w-4xl" style={{ fontFamily: "'Cormorant', serif" }}>
                        Twoje cyfrowe biuro <span className="italic text-[#002395] font-bold">produkcji muzycznej</span>.
                    </h1>
                </motion.div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* 1. ADMIN KPI WIDGET - 2026 OLED STYLE */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="col-span-1">
                    <GlassCard variant="dark" className="h-full p-8 md:p-10 flex flex-col justify-between group">
                        <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#002395] rounded-full blur-[100px] opacity-50 pointer-events-none transition-transform duration-1000 group-hover:scale-110"></div>
                        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                        
                        <div className="relative z-10 mb-10">
                            <div className="flex items-center gap-2.5">
                                <Activity size={16} className="text-blue-400" aria-hidden="true" />
                                <span className="text-[10px] font-bold antialiased uppercase tracking-[0.2em] text-stone-400">Telemetria Bazy</span>
                            </div>
                        </div>

                        <div className="relative z-10 grid grid-cols-2 gap-y-8 gap-x-4 mb-6">
                            <div>
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-1.5">Baza Utworów</p>
                                <p className="text-4xl font-black tracking-tight text-white">{adminStats.totalPieces}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-1.5">Aktywne Projekty</p>
                                <p className="text-4xl font-black tracking-tight text-blue-300">{adminStats.activeProjects}</p>
                            </div>
                            <div className="col-span-2 border-t border-white/10 pt-6 mt-2">
                                <div className="flex justify-between items-end mb-4">
                                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500">
                                        Gotowość Zespołu
                                    </p>
                                    <span className="text-[10px] font-bold text-stone-300 bg-white/10 px-2 py-1 rounded-md">{adminStats.satb.Total} os.</span>
                                </div>
                                
                                <div className="space-y-3">
                                    {[
                                        { label: 'Soprany', val: adminStats.satb.S, color: 'bg-rose-500' },
                                        { label: 'Alty', val: adminStats.satb.A, color: 'bg-purple-500' },
                                        { label: 'Tenory', val: adminStats.satb.T, color: 'bg-sky-500' },
                                        { label: 'Basy', val: adminStats.satb.B, color: 'bg-emerald-500' }
                                    ].map(voice => (
                                        <div key={voice.label} className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold text-stone-400 w-12">{voice.label}</span>
                                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div className={`${voice.color} h-full rounded-full`} style={{ width: `${adminStats.satb.Total ? (voice.val / adminStats.satb.Total) * 100 : 0}%` }}></div>
                                            </div>
                                            <span className="text-xs font-bold text-white w-6 text-right">{voice.val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* 2. NEXT PROJECT SPOTLIGHT */}
                <div className="xl:col-span-2 flex flex-col gap-6">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="flex-1">
                        <GlassCard variant="premium" className="h-full p-8 md:p-10 flex flex-col justify-between">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

                            <div className="relative z-10 flex items-center gap-2 mb-8">
                                <Calendar size={16} className="text-[#002395]" aria-hidden="true" />
                                <span className="text-[10px] font-bold antialiased uppercase tracking-[0.2em] text-stone-400">Pulpit Produkcyjny</span>
                            </div>

                            {nextProject && nextProjectStats ? (
                                <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                                    <div className="flex-1">
                                        <span className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold uppercase tracking-widest rounded-lg mb-4">
                                            Nadchodzące Wydarzenie
                                        </span>
                                        <h2 className="text-3xl md:text-5xl font-medium text-stone-900 tracking-tight leading-tight mb-6 max-w-2xl" style={{ fontFamily: "'Cormorant', serif" }}>
                                            {nextProject.title}
                                        </h2>
                                        
                                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-stone-700 mb-6">
                                            <span className="flex items-center gap-2 bg-stone-50 px-4 py-2.5 rounded-xl border border-stone-200/80 shadow-sm">
                                                <Clock size={14} className="text-[#002395]" aria-hidden="true" />
                                                {new Date(nextProject.date_time).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </span>
                                            {nextProject.location && (
                                                <span className="flex items-center gap-2 bg-stone-50 px-4 py-2.5 rounded-xl border border-stone-200/80 shadow-sm">
                                                    <MapPin size={14} className="text-[#002395]" aria-hidden="true" />
                                                    {nextProject.location}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-6 border-t border-stone-200/80 pt-5">
                                            <span className="flex flex-col gap-1">
                                                <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 flex items-center gap-1.5"><ListOrdered size={12} /> Repertuar</span>
                                                <span className="text-sm font-bold text-stone-800">{nextProjectStats.piecesCount} utworów</span>
                                            </span>
                                            <div className="w-px h-8 bg-stone-200"></div>
                                            <span className="flex flex-col gap-1">
                                                <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 flex items-center gap-1.5"><MicVocal size={12} /> Do koncertu</span>
                                                <span className="text-sm font-bold text-stone-800">{nextProjectStats.rehearsalsLeft} prób</span>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <Link to="/panel/project-management" className="shrink-0 inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-stone-900 hover:bg-[#002395] text-white text-[10px] font-bold antialiased uppercase tracking-[0.15em] rounded-2xl transition-all shadow-[0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_10px_25px_rgba(0,35,149,0.3)] hover:-translate-y-0.5 active:scale-95 group">
                                        Zarządzaj Produkcją <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 md:py-16 text-center relative z-10 w-full bg-stone-50/50 border border-dashed border-stone-300/60 rounded-[2rem]">
                                    <div className="w-16 h-16 bg-white rounded-full shadow-sm border border-stone-100 flex items-center justify-center mb-5">
                                        <Briefcase size={28} className="text-[#002395]/40" aria-hidden="true" />
                                    </div>
                                    <h3 className="text-lg font-bold text-stone-800 mb-1">Brak aktywnych wydarzeń</h3>
                                    <p className="text-sm font-medium text-stone-500 mb-6 max-w-sm">
                                        Aktualnie nie prowadzisz żadnego projektu koncertowego w systemie.
                                    </p>
                                    <Link 
                                        to="/panel/project-management" 
                                        className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-[#002395] border border-stone-200/80 hover:border-[#002395] text-stone-700 hover:text-white text-[10px] font-bold antialiased uppercase tracking-[0.15em] rounded-xl transition-all shadow-sm active:scale-95 group"
                                    >
                                        <Plus size={16} className="text-stone-400 group-hover:text-white/70" /> Zaplanuj nowy projekt
                                    </Link>
                                </div>
                            )}
                        </GlassCard>
                    </motion.div>

                    {/* 3. NEXT REHEARSAL ALERT */}
                    {nextRehearsal && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            <div className="bg-gradient-to-r from-orange-50 to-white border border-orange-200/60 shadow-sm rounded-[2rem] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden group">
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #f97316 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

                                <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
                                    <div className="w-12 h-12 rounded-[1rem] bg-white text-orange-500 flex items-center justify-center shadow-sm border border-orange-100 flex-shrink-0">
                                        <Clock size={20} aria-hidden="true" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                                            <p className="text-[9px] font-bold antialiased uppercase tracking-[0.15em] text-orange-600/90 truncate">Najbliższa Próba: {nextRehearsal.projectTitle}</p>
                                        </div>
                                        <p className="font-bold text-stone-900 text-lg tracking-tight">
                                            {new Date(nextRehearsal.date_time).toLocaleString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="relative z-10 flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0 justify-end">
                                    {(nextRehearsal.absent_count || 0) > 0 ? (
                                        <span className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest shadow-sm">
                                            <UserMinus size={14} /> Nieobecności: {nextRehearsal.absent_count}
                                        </span>
                                    ) : (
                                        <span className="hidden md:flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-2 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest shadow-sm">
                                            100% Frekwencji
                                        </span>
                                    )}
                                    
                                    <Link to="/panel/project-management" className="p-3 bg-white border border-stone-200/80 text-stone-500 hover:text-[#002395] hover:border-[#002395] rounded-xl transition-all shadow-sm active:scale-95" title="Otwórz dziennik projektu">
                                        <ArrowRight size={16} />
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

            </div>

            {/* NAVIGATION MODULES */}
            <section className="pt-8">
                <div className="flex items-center gap-3 mb-8 ml-2">
                    <div className="w-1 h-6 bg-[#002395] rounded-full"></div>
                    <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.2em] text-stone-400">Moduły Systemowe</h3>
                </div>
                
                <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                    {ADMIN_MODULES.map((card) => (
                        <Link key={card.id} to={card.path} className="outline-none group block h-full">
                            <motion.div variants={itemVariants} className="h-full">
                                <GlassCard variant="premium" className="p-6 flex flex-col h-full hover:border-[#002395]/40 hover:shadow-[0_20px_40px_rgba(0,35,149,0.08)] hover:-translate-y-1 transition-all duration-500">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-50/0 group-hover:from-blue-50/50 group-hover:to-transparent transition-colors duration-500 pointer-events-none"></div>

                                    <div className="relative z-10 flex-1">
                                        <div className="w-12 h-12 bg-white border border-stone-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-md group-hover:border-blue-200 transition-all duration-500">
                                            {card.icon}
                                        </div>
                                        <h4 className="text-lg font-bold text-stone-900 mb-2 tracking-tight group-hover:text-[#002395] transition-colors">{card.title}</h4>
                                        <p className="text-[11px] text-stone-500 font-medium leading-relaxed mb-6">{card.desc}</p>
                                    </div>

                                    <div className="relative z-10 flex flex-wrap gap-1.5 mb-6">
                                        {card.features.map((feature, idx) => (
                                            <span key={idx} className="px-2.5 py-1 bg-stone-100/80 text-stone-500 text-[9px] font-bold antialiased uppercase tracking-widest rounded-md border border-stone-200/50 group-hover:bg-white group-hover:border-[#002395]/20 group-hover:text-[#002395]/80 transition-colors">
                                                {feature}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="relative z-10 flex items-center justify-between pt-5 border-t border-stone-200/60 group-hover:border-blue-200/50 transition-colors mt-auto">
                                        <span className="text-[9px] uppercase tracking-[0.15em] font-bold antialiased text-stone-400 group-hover:text-[#002395] transition-colors">Otwórz Moduł</span>
                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-stone-200/60 group-hover:bg-[#002395] group-hover:border-[#002395] shadow-sm transition-all duration-300">
                                            <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-white transform group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                                        </div>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        </Link>
                    ))}
                </motion.div>
            </section>
        </div>
    );
}