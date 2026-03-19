/**
 * @file DashboardHome.tsx
 * @description Dashboard Overview Component (Entry Point).
 * @architecture Enterprise 2026 Standards
 * UX UPGRADE: Premium Bento Grid, Ambient Mesh Glows, Feature Pills.
 * DATA UPGRADE: Deep data aggregation for tactical project KPIs.
 * SECURITY FIX: Resolved empty Artist Stats card by correctly asserting `user.id`
 * as the Artist Profile ID and isolating API scopes for non-admin users.
 * @module core/DashboardHome
 * @author Krystian Bugalski
 */

import React, { useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
    Calendar, Music, FileText, Users, Briefcase, 
    ArrowRight, Clock, Loader2, MapPin, Sparkles, Wrench, 
    ChevronRight, BookOpen, AlertCircle, ListOrdered, 
    MicVocal, ClipboardCheck, PlayCircle, Activity
} from 'lucide-react';

import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import type { Project, Artist, Rehearsal, ProgramItem, Participation, Piece } from '../../types';

interface AuthUser {
    id?: string | number;
    username?: string;
    first_name?: string;
    is_admin?: boolean;
}

const STYLE_PREMIUM_GLASS = "bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] shadow-[inset_0_1px_0_rgba(255,255,255,1)] rounded-[2rem] relative overflow-hidden";

interface DashboardModule {
    id: string;
    title: string;
    desc: string;
    features: string[];
    icon: React.ReactNode;
    path: string;
}

const ADMIN_MODULES: DashboardModule[] = [
    { id: 'projects', title: 'Zarządzanie Projektami', desc: 'Główne centrum dowodzenia produkcją.', features: ['Harmonogramy', 'Setlisty', 'Mikro-casting'], icon: <Briefcase size={20} className="text-[#002395]" aria-hidden="true" />, path: '/panel/project-management' },
    { id: 'archive', title: 'Archiwum Nut', desc: 'Centralna baza biblioteki muzycznej.', features: ['Pliki PDF', 'Ścieżki MIDI/MP3', 'Wymagania Divisi'], icon: <Music size={20} className="text-[#002395]" aria-hidden="true" />, path: '/panel/archive-management' },
    { id: 'artists', title: 'Baza Artystów', desc: 'Zarządzanie chórem i solistami.', features: ['Statystyki SATB', 'Profile Wokalne', 'Oceny a vista'], icon: <Users size={20} className="text-[#002395]" aria-hidden="true" />, path: '/panel/artists' },
    { id: 'contracts', title: 'Kadry i Płace', desc: 'Finanse, umowy i budżetowanie.', features: ['Masowe Stawki', 'Generowanie PDF', 'Kontrola Budżetu'], icon: <FileText size={20} className="text-[#002395]" aria-hidden="true" />, path: '/panel/contracts' },
    { id: 'crew', title: 'Ekipa Techniczna', desc: 'Logistyka i reżyseria wydarzeń.', features: ['Reżyserzy Dźwięku', 'Oświetlenie', 'Baza Firm'], icon: <Wrench size={20} className="text-[#002395]" aria-hidden="true" />, path: '/panel/crew' }
];

const ARTIST_MODULES: DashboardModule[] = [
    { id: 'schedule', title: 'Mój Harmonogram', desc: 'Twój osobisty kalendarz wydarzeń.', features: ['Zgłaszanie Nieobecności', 'Karty Projektów', 'Harmonogram Dnia'], icon: <Calendar size={20} className="text-[#002395]" aria-hidden="true" />, path: '/panel/schedule' },
    { id: 'materials', title: 'Materiały do Ćwiczeń', desc: 'Baza nut i materiałów edukacyjnych.', features: ['Twoja Partia (Divisi)', 'Nuty PDF', 'Ścieżki Audio'], icon: <Music size={20} className="text-[#002395]" aria-hidden="true" />, path: '/panel/materials' },
    { id: 'resources', title: 'Baza Wiedzy', desc: 'Dokumenty, regulaminy i wytyczne.', features: ['Dress Code', 'Regulaminy', 'Polityka Prywatności'], icon: <BookOpen size={20} className="text-[#002395]" aria-hidden="true" />, path: '/panel/resources' }
];

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function DashboardHome(): React.JSX.Element {
    const { user } = useAuth() as { user: AuthUser | null };
    const isAdmin = user?.is_admin;

    // ZABEZPIECZENIE: Zwykły artysta odpytuje tylko SWOJE partycypacje (?artist=id) i nie pobiera całej listy artystów
    const results = useQueries({
        queries: [
            { queryKey: ['dash-projects'], queryFn: async () => (await api.get('/api/projects/')).data, enabled: !!user },
            { queryKey: ['dash-rehearsals'], queryFn: async () => (await api.get('/api/rehearsals/')).data, enabled: !!user },
            { queryKey: ['dash-artists'], queryFn: async () => isAdmin ? (await api.get('/api/artists/')).data : [], enabled: !!user }, 
            { queryKey: ['dash-participations', user?.id], queryFn: async () => isAdmin ? (await api.get('/api/participations/')).data : (await api.get(`/api/participations/?artist=${user?.id}`)).data, enabled: !!user?.id },
            { queryKey: ['dash-program'], queryFn: async () => (await api.get('/api/program-items/')).data, enabled: !!user },
            { queryKey: ['dash-pieces'], queryFn: async () => (await api.get('/api/pieces/')).data, enabled: !!user } 
        ]
    });

    const isLoading = results.some(q => q.isLoading);
    const isError = results.some(q => q.isError);

    useEffect(() => {
        if (isError) toast.error("Błąd synchronizacji", { description: "Nie udało się załadować wszystkich statystyk." });
    }, [isError]);

    const data = useMemo(() => ({
        projects: Array.isArray(results[0].data) ? results[0].data as Project[] : [],
        rehearsals: Array.isArray(results[1].data) ? results[1].data as Rehearsal[] : [],
        artists: Array.isArray(results[2].data) ? results[2].data as Artist[] : [],
        participations: Array.isArray(results[3].data) ? results[3].data as Participation[] : [],
        programItems: Array.isArray(results[4].data) ? results[4].data as ProgramItem[] : [],
        pieces: Array.isArray(results[5].data) ? results[5].data as Piece[] : []
    }), [results]);


    // --- GLOBAL ADMIN KPIs ---
    const adminStats = useMemo(() => {
        if (!isAdmin) return null;
        const activeProjects = data.projects.filter(p => p.status === 'ACTIVE').length;
        const totalProjects = data.projects.length;
        const totalPieces = data.pieces.length;
        
        const activeArtistsList = data.artists.filter(a => a.is_active);
        const satb = {
            S: activeArtistsList.filter(a => a.voice_type?.startsWith('S')).length,
            A: activeArtistsList.filter(a => a.voice_type?.startsWith('A') || a.voice_type === 'MEZ').length,
            T: activeArtistsList.filter(a => a.voice_type?.startsWith('T') || a.voice_type === 'CT').length,
            B: activeArtistsList.filter(a => a.voice_type?.startsWith('B')).length,
            Total: activeArtistsList.length
        };

        return { activeProjects, totalProjects, totalPieces, satb };
    }, [data, isAdmin]);


    // --- ARTIST PERSONAL KPIs ---
    const artistStats = useMemo(() => {
        if (isAdmin || !user?.id) return null;
        
        // Zamiast szukać w liście artystów, po prostu używamy Twojego własnego ID z tokena.
        const resolvedArtistId = user.id;

        const myActiveParticipations = data.participations.filter(p => String(p.artist) === String(resolvedArtistId) && p.status !== 'DEC');
        const myProjectIds = myActiveParticipations.map(p => String(p.project));
        
        const activeProj = data.projects.filter(p => myProjectIds.includes(String(p.id)) && p.status === 'ACTIVE');
        const activeProjIds = data.projects.filter(p => myProjectIds.includes(String(p.id)) && p.status === 'ACTIVE').map(p => String(p.id));

        const piecesToLearn = data.programItems.filter(pi => activeProjIds.includes(String(pi.project))).length; 
        
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const upcomingRehsThisWeek = data.rehearsals.filter(r => myProjectIds.includes(String(r.project)) && new Date(r.date_time) >= now && new Date(r.date_time) <= nextWeek).length;

        return {
            activeProjectsCount: activeProj.length,
            piecesToLearn,
            upcomingRehsThisWeek
        };
    }, [data, isAdmin, user]);


    // --- TIMELINE / SPOTLIGHT ---
    const nextRehearsal = useMemo(() => {
        const now = new Date();
        let futureRehearsals = data.rehearsals.filter(r => new Date(r.date_time) > now);
        
        if (!isAdmin && user?.id) {
            const resolvedArtistId = user.id;
            const userProjectIds = data.participations.filter(p => String(p.artist) === String(resolvedArtistId) && p.status !== 'DEC').map(p => String(p.project));
            futureRehearsals = futureRehearsals.filter(r => userProjectIds.includes(String(r.project)));
        }
        return futureRehearsals.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0] || null;
    }, [data.rehearsals, data.participations, isAdmin, user]);

    const nextProject = useMemo(() => {
        const now = new Date();
        let relevantProjects = data.projects.filter(p => p.status === 'ACTIVE' && new Date(p.date_time) > now);
        
        if (!isAdmin && user?.id) { 
            const resolvedArtistId = user.id;
            const userProjectIds = data.participations.filter(p => String(p.artist) === String(resolvedArtistId) && p.status !== 'DEC').map(p => String(p.project));
            relevantProjects = relevantProjects.filter(p => userProjectIds.includes(String(p.id)));
        }
        return relevantProjects.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0] || null;
    }, [data.projects, data.participations, isAdmin, user]);

    // --- NEXT PROJECT DEEP STATS ---
    const nextProjectStats = useMemo(() => {
        if (!nextProject) return null;
        const now = new Date();
        const piecesCount = data.programItems.filter(pi => String(pi.project) === String(nextProject.id)).length;
        const rehearsalsLeft = data.rehearsals.filter(r => String(r.project) === String(nextProject.id) && new Date(r.date_time) > now).length;
        return { piecesCount, rehearsalsLeft };
    }, [nextProject, data.programItems, data.rehearsals]);


    // --- RENDER ---
    if (isLoading) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center space-y-5">
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-16 h-16 border-4 border-[#002395]/20 rounded-full"></div>
                    <div className="w-16 h-16 border-4 border-[#002395] rounded-full border-t-transparent animate-spin"></div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002395]/60">Inicjalizacja Systemu</span>
            </div>
        );
    }

    const modulesToRender = isAdmin ? ADMIN_MODULES : ARTIST_MODULES;
    const userDisplayName = user?.first_name || user?.username || 'Artysto';

    return (
        <div className="space-y-12 animate-fade-in relative cursor-default pb-16 max-w-7xl mx-auto px-6 lg:pl-12 lg:pr-8">
            
            <header className="relative pt-6">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                    <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/60 backdrop-blur-md border border-white/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-6">
                        <div className="relative flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 z-10"></div>
                            <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.15em] font-bold antialiased text-stone-600">
                            Witaj, {userDisplayName}
                        </p>
                    </div>
                    {isAdmin ? (
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-stone-900 leading-[1.05] tracking-tight max-w-4xl" style={{ fontFamily: "'Cormorant', serif" }}>
                            Twoje cyfrowe biuro <span className="italic text-[#002395]">produkcji muzycznej</span>.
                        </h1>
                    ) : (
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-stone-900 leading-[1.05] tracking-tight max-w-4xl" style={{ fontFamily: "'Cormorant', serif" }}>
                            Twój cyfrowy <span className="italic text-[#002395]">panel muzyczny</span>.
                        </h1>
                    )}
                    
                </motion.div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. KPI CARD (ADMIN vs ARTIST) */}
                {isAdmin && adminStats ? (
                    // WIDOK ADMINA
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="col-span-1 bg-stone-900 rounded-[2rem] p-8 relative overflow-hidden group shadow-[0_10px_40px_rgba(0,0,0,0.15)] text-white border border-stone-800 flex flex-col justify-between">
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#002395] rounded-full blur-[80px] opacity-60 pointer-events-none transition-transform duration-1000 group-hover:scale-125"></div>
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
                        
                        <div className="relative z-10 mb-8">
                            <div className="flex items-center gap-2.5">
                                <Sparkles size={16} className="text-blue-300" aria-hidden="true" />
                                <span className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400">Przegląd Bazy Danych</span>
                            </div>
                        </div>

                        <div className="relative z-10 grid grid-cols-2 gap-y-6 gap-x-4 mb-6">
                            <div>
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-1">Utwory (Archiwum)</p>
                                <p className="text-3xl font-black tracking-tight text-white">{adminStats.totalPieces}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-1">Suma Projektów</p>
                                <p className="text-3xl font-bold tracking-tight text-stone-300">{adminStats.totalProjects}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-1">Aktywne Wydarzenia</p>
                                <p className="text-3xl font-bold tracking-tight text-blue-200">{adminStats.activeProjects}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-1">Aktywny Zespół</p>
                                <p className="text-3xl font-bold tracking-tight text-emerald-300">{adminStats.satb.Total}</p>
                            </div>
                        </div>

                        <div className="relative z-10 pt-4 border-t border-stone-800 flex justify-between items-center text-[10px] font-bold antialiased tracking-widest">
                            <span className="text-rose-400 flex flex-col items-center">S<span className="text-white text-sm mt-0.5">{adminStats.satb.S}</span></span>
                            <span className="text-purple-400 flex flex-col items-center">A<span className="text-white text-sm mt-0.5">{adminStats.satb.A}</span></span>
                            <span className="text-sky-400 flex flex-col items-center">T<span className="text-white text-sm mt-0.5">{adminStats.satb.T}</span></span>
                            <span className="text-emerald-400 flex flex-col items-center">B<span className="text-white text-sm mt-0.5">{adminStats.satb.B}</span></span>
                        </div>
                    </motion.div>
                ) : artistStats ? (
                    // WIDOK ARTYSTY
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="col-span-1 bg-stone-900 rounded-[2rem] p-8 relative overflow-hidden group shadow-[0_10px_40px_rgba(0,0,0,0.15)] text-white border border-stone-800 flex flex-col justify-between">
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#002395] rounded-full blur-[80px] opacity-60 pointer-events-none transition-transform duration-1000 group-hover:scale-125"></div>
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
                        
                        <div className="relative z-10 mb-8">
                            <div className="flex items-center gap-2.5">
                                <Activity size={16} className="text-blue-300" aria-hidden="true" />
                                <span className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400">Twoje Podsumowanie</span>
                            </div>
                        </div>

                        <div className="relative z-10 space-y-6">
                            <div>
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-1">Aktywne Obsady</p>
                                <p className="text-4xl font-black tracking-tight text-white">{artistStats.activeProjectsCount} <span className="text-sm font-medium text-stone-400">wydarzenia</span></p>
                            </div>
                            <div className="h-px w-full bg-gradient-to-r from-stone-800 to-transparent"></div>
                            <div>
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-1">Materiały do opanowania</p>
                                <p className="text-3xl font-bold tracking-tight text-blue-200">{artistStats.piecesToLearn} <span className="text-sm font-medium text-stone-400">utworów</span></p>
                            </div>
                            <div className="h-px w-full bg-gradient-to-r from-stone-800 to-transparent"></div>
                            <div>
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-1">Próby w tym tygodniu</p>
                                <p className="text-3xl font-bold tracking-tight text-emerald-300">{artistStats.upcomingRehsThisWeek}</p>
                            </div>
                        </div>
                    </motion.div>
                ) : null}

                {/* 2. NEXT PROJECT SPOTLIGHT */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className={`${STYLE_PREMIUM_GLASS} p-8 md:p-10 lg:col-span-2 flex flex-col justify-between`}>
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/40 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

                    <div className="relative z-10 flex items-center gap-2 mb-8">
                        <Calendar size={16} className="text-[#002395]" aria-hidden="true" />
                        <span className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400">Najbliższe Wydarzenie</span>
                    </div>

                    {nextProject && nextProjectStats ? (
                        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
                            <div className="flex-1">
                                <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium text-stone-900 tracking-tight leading-tight mb-5 max-w-2xl" style={{ fontFamily: "'Cormorant', serif" }}>
                                    {nextProject.title}
                                </h2>
                                
                                <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-stone-600 mb-5">
                                    <span className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-stone-200/60 shadow-sm">
                                        <Clock size={14} className="text-[#002395]" aria-hidden="true" />
                                        {new Date(nextProject.date_time).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </span>
                                    {nextProject.location && (
                                        <span className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-stone-200/60 shadow-sm">
                                            <MapPin size={14} className="text-[#002395]" aria-hidden="true" />
                                            {nextProject.location}
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-4 border-t border-stone-200/60 pt-4">
                                    <span className="flex items-center gap-1.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
                                        <ListOrdered size={14} className="text-stone-400" aria-hidden="true"/> 
                                        Repertuar: <span className="text-stone-800">{nextProjectStats.piecesCount}</span> utworów
                                    </span>
                                    <span className="flex items-center gap-1.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
                                        <MicVocal size={14} className="text-stone-400" aria-hidden="true"/> 
                                        Do koncertu: <span className="text-stone-800">{nextProjectStats.rehearsalsLeft}</span> prób
                                    </span>
                                    {nextProject.call_time && (
                                        <span className="flex items-center gap-1.5 text-[10px] font-bold antialiased uppercase tracking-widest text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md border border-orange-100">
                                            <ClipboardCheck size={12} aria-hidden="true"/> 
                                            Zbiórka: {new Date(nextProject.call_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                    {nextProject.date_time && (
                                        <span className="flex items-center gap-1.5 text-[10px] font-bold antialiased uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                            <PlayCircle size={12} aria-hidden="true"/> 
                                            Start: {new Date(nextProject.date_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <Link to={isAdmin ? `/panel/project-management` : `/panel/schedule`} className="shrink-0 inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-stone-900 hover:bg-[#002395] text-white text-[10px] font-bold antialiased uppercase tracking-[0.15em] rounded-xl transition-all shadow-[0_8px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_10px_25px_rgba(0,35,149,0.3)] active:scale-95 group">
                                Przejdź do kokpitu 
                                <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-stone-400 relative z-10">
                            <Calendar size={40} className="mb-4 opacity-20" aria-hidden="true" />
                            <p className="text-[11px] uppercase font-bold tracking-widest antialiased text-stone-500 mb-2">Brak nadchodzących wydarzeń</p>
                            <p className="text-sm font-medium">Kalendarz koncertowy jest obecnie pusty.</p>
                        </div>
                    )}
                </motion.div>
                
                {/* 3. NEXT REHEARSAL ALERT */}
                {nextRehearsal && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="col-span-1 lg:col-span-3 bg-gradient-to-r from-amber-50 to-white border border-amber-200/60 shadow-sm rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #d97706 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-[1.25rem] bg-white text-amber-600 flex items-center justify-center shadow-sm border border-amber-100 flex-shrink-0">
                                <Clock size={24} aria-hidden="true" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                    <p className="text-[10px] font-bold antialiased uppercase tracking-widest text-amber-600/90">Przypomnienie o próbie</p>
                                </div>
                                <p className="font-bold text-stone-900 text-xl tracking-tight">
                                    {new Date(nextRehearsal.date_time).toLocaleString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>

                        <div className="relative z-10 bg-white/80 backdrop-blur-sm px-5 py-3 rounded-xl border border-amber-100/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] flex-1 md:max-w-md">
                            <p className="text-sm font-bold text-stone-800 flex items-center gap-2"><MapPin size={14} className="text-amber-500" aria-hidden="true"/> {nextRehearsal.location}</p>
                            {nextRehearsal.focus && <p className="text-xs text-stone-500 font-medium mt-1 truncate">{nextRehearsal.focus}</p>}
                        </div>
                        
                        <div className="relative z-10 flex-shrink-0 w-full md:w-auto">
                            {!isAdmin ? (
                                <Link to="/panel/schedule" className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest transition-all shadow-sm active:scale-95">
                                    <AlertCircle size={14} aria-hidden="true" /> Zgłoś Nieobecność
                                </Link>
                            ) : (
                                <Link to="/panel/rehearsals" className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest transition-all shadow-sm active:scale-95">
                                    <ClipboardCheck size={14} aria-hidden="true" /> Sprawdź Dziennik
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* --- NAVIGATION MODULES --- */}
            <section className="pt-8">
                <div className="flex items-center gap-3 mb-8 ml-2">
                    <div className="w-1 h-6 bg-[#002395] rounded-full"></div>
                    <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.2em] text-stone-400">Moduły Systemowe</h3>
                </div>
                
                <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                    {modulesToRender.map((card) => (
                        <Link key={card.id} to={card.path} className="outline-none group block h-full">
                            <motion.div variants={itemVariants} className={`${STYLE_PREMIUM_GLASS} p-6 flex flex-col h-full hover:border-[#002395]/40 hover:shadow-[0_20px_40px_rgba(0,35,149,0.08)] hover:-translate-y-1 transition-all duration-500`}>
                                
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-50/0 group-hover:from-blue-50/50 group-hover:to-transparent transition-colors duration-500 pointer-events-none"></div>

                                <div className="relative z-10 flex-1">
                                    <div className="w-12 h-12 bg-stone-50 border border-stone-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-white group-hover:scale-110 group-hover:shadow-md group-hover:border-blue-100 transition-all duration-500">
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

                                <div className="relative z-10 flex items-center justify-between pt-5 border-t border-stone-200/50 group-hover:border-blue-200/50 transition-colors mt-auto">
                                    <span className="text-[9px] uppercase tracking-[0.15em] font-bold antialiased text-stone-400 group-hover:text-[#002395] transition-colors">
                                        Otwórz
                                    </span>
                                    <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center border border-stone-200/60 group-hover:bg-[#002395] group-hover:border-[#002395] transition-all duration-300">
                                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-white transform group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                                    </div>
                                </div>
                            </motion.div>
                        </Link>
                    ))}
                </motion.div>
            </section>
        </div>
    );
}