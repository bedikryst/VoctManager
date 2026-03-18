/**
 * @file DashboardHome.jsx
 * @description Dashboard Overview Component.
 * UX UPGRADE: Awwwards 2026 Standards. Pixel-perfect negative space management,
 * embedded background watermarks, inner glass reflections, and rigid flexbox rhythms.
 * Implements micro-typography techniques (antialiasing, font-weight reduction on small labels).
 * @module core/DashboardHome
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Calendar, Music, FileText, Users, Briefcase, 
    ArrowRight, Clock, Loader2, MapPin, AlertCircle,
    ChevronDown, ChevronUp, Download, PlayCircle, ListOrdered, AlignLeft,
    Sparkles, Youtube
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export default function DashboardHome() {
    const { user } = useAuth();
    const isAdmin = user?.is_admin;

    const [stats, setStats] = useState({
        nextRehearsal: null,
        activeArtists: 0,
        activeProjects: 0,
        isLoading: true
    });

    const [artistSpotlight, setArtistSpotlight] = useState({
        nextProject: null,
        programItems: [],
        roster: []
    });

    const [expandedItemId, setExpandedItemId] = useState(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [rehearsalsRes, artistsRes, projectsRes, programItemsRes, piecesRes] = await Promise.all([
                    api.get('/api/rehearsals/'),
                    api.get('/api/artists/'),
                    api.get('/api/projects/'),
                    api.get('/api/program-items/'),
                    api.get('/api/pieces/')
                ]);

                const rehearsals = Array.isArray(rehearsalsRes.data) ? rehearsalsRes.data : [];
                const artists = Array.isArray(artistsRes.data) ? artistsRes.data : [];
                const projects = Array.isArray(projectsRes.data) ? projectsRes.data : [];
                const programItems = Array.isArray(programItemsRes.data) ? programItemsRes.data : [];
                const pieces = Array.isArray(piecesRes.data) ? piecesRes.data : [];

                const now = new Date();

                if (isAdmin) {
                    const upcomingRehearsals = rehearsals
                        .filter(r => new Date(r.date_time) >= now)
                        .sort((a, b) => new Date(a.date_time) - new Date(b.date_time));
                    
                    const activeArtistsCount = artists.filter(a => a.is_active).length;
                    const activeProjectsCount = projects.filter(p => new Date(p.date_time) >= now || p.status !== 'DONE').length;

                    setStats({
                        nextRehearsal: upcomingRehearsals.length > 0 ? upcomingRehearsals[0] : null,
                        activeArtists: activeArtistsCount,
                        activeProjects: activeProjectsCount,
                        isLoading: false
                    });
                } else {
                    const upcomingProjects = projects
                        .filter(p => new Date(p.date_time) >= now && p.status !== 'DONE')
                        .sort((a, b) => new Date(a.date_time) - new Date(b.date_time));

                    if (upcomingProjects.length > 0) {
                        const nextProj = upcomingProjects[0];
                        
                        const projProgram = programItems
                            .filter(pi => pi.project === nextProj.id)
                            .sort((a, b) => a.order - b.order)
                            .map(pi => {
                                const pieceId = typeof pi.piece === 'object' ? pi.piece.id : pi.piece;
                                const fullPiece = pieces.find(p => p.id === pieceId);
                                return { ...pi, pieceData: fullPiece };
                            });
                        
                        let fetchedRoster = [];
                        try {
                            const rosterRes = await api.get(`/api/projects/${nextProj.id}/roster/`);
                            fetchedRoster = Array.isArray(rosterRes.data) ? rosterRes.data : [];
                        } catch (rosterErr) {
                            console.error("Failed to fetch concert roster:", rosterErr);
                        }

                        setArtistSpotlight({ nextProject: nextProj, programItems: projProgram, roster: fetchedRoster });
                    }
                    setStats(prev => ({ ...prev, isLoading: false }));
                }

            } catch (error) {
                console.error("Dashboard orchestration failed", error);
                setStats(prev => ({ ...prev, isLoading: false }));
            }
        };

        fetchDashboardData();
    }, [isAdmin]);

    const currentHour = new Date().getHours();
    const greeting = currentHour < 18 ? 'Dzień dobry' : 'Dobry wieczór';
    
    const currentDate = new Intl.DateTimeFormat('pl-PL', { 
        weekday: 'long', day: 'numeric', month: 'long' 
    }).format(new Date());

    const adminCards = [
        { title: "Wydarzenia i Obsada", desc: "Zarządzaj produkcjami i castingiem artystów.", icon: <Briefcase className="w-5 h-5 text-[#002395]" />, link: "/panel/project-management", accent: "from-blue-50 to-indigo-50/20", colSpan: "md:col-span-2" },
        { title: "Kadry i Płace", desc: "Masowe umowy PDF i stawki.", icon: <FileText className="w-5 h-5 text-stone-700" />, link: "/panel/contracts", accent: "from-slate-50 to-stone-50/20", colSpan: "md:col-span-1" },
        { title: "Dziennik Obecności", desc: "Zarządzaj harmonogramem.", icon: <Calendar className="w-5 h-5 text-emerald-700" />, link: "/panel/rehearsals", accent: "from-emerald-50 to-teal-50/20", colSpan: "md:col-span-1" },
        { title: "Archiwum Nuty", desc: "Biblioteka utworów, nut PDF i nagrań audio.", icon: <Music className="w-5 h-5 text-amber-700" />, link: "/panel/archive-management", accent: "from-amber-50 to-orange-50/20", colSpan: "md:col-span-2" },
    ];

    const artistCards = [
        { title: "Mój Harmonogram", desc: "Sprawdzaj próby i zgłaszaj nieobecności.", icon: <Clock className="w-5 h-5 text-stone-700" />, link: "/panel/schedule", accent: "from-stone-50 to-slate-50/20", colSpan: "md:col-span-1" },
        { title: "Materiały do Prób", desc: "Pobieraj partytury i ćwicz ze ścieżkami audio.", icon: <Music className="w-5 h-5 text-[#002395]" />, link: "/panel/materials", accent: "from-blue-50 to-indigo-50/20", colSpan: "md:col-span-2" },
    ];

    const displayCards = isAdmin ? adminCards : artistCards;

    const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
    const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };

    const handleAudioPlay = (e) => {
        document.querySelectorAll('audio').forEach(audioEl => {
            if (audioEl !== e.target) audioEl.pause();
        });
    };

    const formatDuration = (totalSeconds) => {
        if (!totalSeconds) return null;
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m > 0 ? `${m} min` : ''} ${s > 0 ? `${s} sek` : ''}`.trim();
    };

    const myVoiceGroup = user?.voice_type_display ? user.voice_type_display.charAt(0).toUpperCase() : null;

    const groupedRoster = useMemo(() => {
        if (!artistSpotlight.roster) return {};
        return artistSpotlight.roster.reduce((acc, artist) => {
            const group = artist.voice_type || 'Inne';
            if (!acc[group]) acc[group] = [];
            acc[group].push(artist);
            return acc;
        }, {});
    }, [artistSpotlight.roster]);

    // UI Theme Mapping
    const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl relative overflow-hidden";

    return (
        <div className="space-y-8 animate-fade-in pb-12 cursor-default">
            
            {/* --- GREETING HEADER --- */}
            <header className="relative pt-2">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                        <Sparkles size={12} className="text-[#002395]" />
                        <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                            {currentDate}
                        </p>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                        {greeting}, <br className="md:hidden" />
                        <span className="italic text-[#002395]">{user?.first_name}</span>.
                    </h1>
                </motion.div>
            </header>

            {/* --- ADMIN KPI SECTION (BENTO GRID) --- */}
            {isAdmin && (
                <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    
                    <div className={`${glassCardStyle} p-5 flex flex-col justify-between md:col-span-2 group hover:bg-white/90 transition-colors h-[140px]`}>
                        {/* Background Watermark */}
                        <div className="absolute -right-8 -top-5 text-[#002395] opacity-[0.10] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                            <Calendar size={180} strokeWidth={1} />
                        </div>
                        
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex items-center justify-between">
                                <div className="p-2 bg-blue-50 text-[#002395] rounded-xl"><Calendar size={16} /></div>
                                <span className="text-[8px] font-bold antialiased uppercase tracking-widest text-stone-400">Najbliższa Próba</span>
                            </div>
                            <div className="min-w-0 mt-auto">
                                {stats.isLoading ? <Loader2 size={20} className="animate-spin text-stone-300" /> : (
                                    stats.nextRehearsal ? (
                                        <>
                                            <p className="text-xl md:text-2xl font-bold text-stone-900 truncate tracking-tight">
                                                {new Date(stats.nextRehearsal.date_time).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <p className="text-[11px] text-stone-500 font-medium truncate flex items-center gap-1 mt-0.5">
                                                <MapPin size={10} className="text-stone-400"/> {stats.nextRehearsal.location}
                                            </p>
                                        </>
                                    ) : <p className="text-sm font-bold text-stone-400">Brak w kalendarzu</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={`${glassCardStyle} p-5 flex flex-col justify-between group hover:bg-white/90 transition-colors h-[140px]`}>
                        <div className="absolute -right-6 -bottom-6 text-emerald-900 opacity-[0.10] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                            <Users size={120} strokeWidth={1} />
                        </div>
                        
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex items-center justify-between">
                                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl"><Users size={16} /></div>
                            </div>
                            <div className="mt-auto">
                                {stats.isLoading ? <Loader2 size={20} className="animate-spin text-stone-300" /> : (
                                    <p className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight leading-none">
                                        {stats.activeArtists}
                                    </p>
                                )}
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-1">Aktywnych Artystów</p>
                            </div>
                        </div>
                    </div>

                    <div className={`${glassCardStyle} p-5 flex flex-col justify-between group hover:bg-white/90 transition-colors h-[140px]`}>
                        <div className="absolute -right-6 -bottom-6 text-amber-900 opacity-[0.10] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                            <Briefcase size={120} strokeWidth={1} />
                        </div>

                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex items-center justify-between">
                                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl"><Briefcase size={16} /></div>
                            </div>
                            <div className="mt-auto">
                                {stats.isLoading ? <Loader2 size={20} className="animate-spin text-stone-300" /> : (
                                    <p className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight leading-none">
                                        {stats.activeProjects}
                                    </p>
                                )}
                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-1">Wydarzeń w toku</p>
                            </div>
                        </div>
                    </div>

                </motion.section>
            )}

            {/* --- ARTIST SPOTLIGHT SESSIONS --- */}
            {!isAdmin && artistSpotlight.nextProject && (
                <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <div className="bg-white/80 backdrop-blur-2xl rounded-2xl border border-white shadow-[0_10px_30px_rgb(0,0,0,0.05)] overflow-hidden">
                        
                        <div className="bg-gradient-to-br from-[#002395] via-[#001766] to-[#000a33] p-6 md:p-8 text-white relative overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                            
                            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div>
                                    <span className="inline-block px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[8px] font-bold antialiased uppercase tracking-widest mb-3 border border-white/20">
                                        Najbliższe Wydarzenie
                                    </span>
                                    <h3 className="text-2xl md:text-3xl font-serif font-bold tracking-tight">{artistSpotlight.nextProject.title}</h3>
                                </div>
                                <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10">
                                    <Calendar className="text-blue-200" size={16} />
                                    <span className="text-sm font-bold">
                                        {new Date(artistSpotlight.nextProject.date_time).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                            
                            <div className="lg:col-span-1 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3 bg-stone-50/50 p-3 rounded-xl border border-stone-100">
                                        <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><AlertCircle className="w-4 h-4" /></div>
                                        <div>
                                            <p className="text-[8px] font-bold antialiased uppercase tracking-widest text-stone-400">Call Time (Zbiórka)</p>
                                            <p className="text-sm font-bold text-stone-800">
                                                {artistSpotlight.nextProject.call_time ? new Date(artistSpotlight.nextProject.call_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : 'Nie wyznaczono'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-1.5">
                                        <div className="p-1.5 bg-blue-50 text-[#002395] rounded-lg"><Clock className="w-4 h-4" /></div>
                                        <div>
                                            <p className="text-[8px] font-bold antialiased uppercase tracking-widest text-stone-400">Start Koncertu</p>
                                            <p className="text-xs font-bold text-stone-800">
                                                {new Date(artistSpotlight.nextProject.date_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-1.5">
                                        <div className="p-1.5 bg-blue-50 text-[#002395] rounded-lg"><MapPin className="w-4 h-4" /></div>
                                        <div>
                                            <p className="text-[8px] font-bold antialiased uppercase tracking-widest text-stone-400">Lokalizacja</p>
                                            <p className="text-xs font-bold text-stone-800 leading-tight">{artistSpotlight.nextProject.location || 'Brak danych'}</p>
                                        </div>
                                    </div>
                                </div>

                                {(artistSpotlight.nextProject.run_sheet?.length > 0 || artistSpotlight.nextProject.description) && (
                                    <div className="pt-6 border-t border-stone-100">
                                        {artistSpotlight.nextProject.run_sheet?.length > 0 && (
                                            <div className="mb-5">
                                                <h4 className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-4 flex items-center gap-1.5">
                                                    <ListOrdered size={12} /> Harmonogram
                                                </h4>
                                                <div className="relative pl-4 border-l-2 border-stone-200 space-y-3 ml-1.5">
                                                    {[...artistSpotlight.nextProject.run_sheet].sort((a,b) => a.time.localeCompare(b.time)).map((item, idx) => (
                                                        <div key={item.id || idx} className="relative">
                                                            <div className="absolute -left-[22px] top-1 w-3 h-3 bg-white border-2 border-[#002395] rounded-full shadow-sm"></div>
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[10px] font-bold antialiased text-[#002395] bg-blue-50 self-start px-1.5 py-0.5 rounded">{item.time}</span>
                                                                <div>
                                                                    <p className="text-xs font-bold text-stone-800 mt-0.5">{item.title}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="lg:col-span-2 space-y-5">
                                <div className="bg-stone-50/50 rounded-2xl p-5 border border-stone-100">
                                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3 flex items-center gap-1.5">
                                        <Music size={12} /> Program Koncertu
                                    </p>
                                    {artistSpotlight.programItems.length > 0 ? (
                                        <div className="space-y-2">
                                            {artistSpotlight.programItems.map((item, idx) => {
                                                const piece = item.pieceData;
                                                const isExpanded = expandedItemId === item.id;
                                                const myTracks = piece?.tracks?.filter(t => {
                                                    if (!myVoiceGroup) return false;
                                                    const label = (t.title || t.voice_part_display || '').toUpperCase();
                                                    return label.startsWith(myVoiceGroup) || label.includes('TUTTI');
                                                }) || [];

                                                return (
                                                    <div key={item.id} className="bg-white rounded-xl border border-stone-200/60 shadow-sm overflow-hidden transition-all duration-300">
                                                        <div 
                                                            className="flex gap-3 items-center p-3 cursor-pointer hover:bg-stone-50 transition-colors"
                                                            onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                                                        >
                                                            <span className="w-6 h-6 rounded-lg bg-stone-100 text-stone-500 text-[10px] font-bold antialiased flex items-center justify-center flex-shrink-0">
                                                                {idx + 1}
                                                            </span>
                                                            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 truncate">
                                                                <span className="font-bold text-stone-800 text-xs truncate">
                                                                    {piece ? piece.title : 'Nieznany utwór'}
                                                                </span>
                                                            </div>
                                                            <div className="text-stone-400 bg-stone-50 p-1 rounded-full">
                                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                            </div>
                                                        </div>

                                                        <AnimatePresence>
                                                            {isExpanded && (
                                                                <motion.div 
                                                                    initial={{ height: 0, opacity: 0 }} 
                                                                    animate={{ height: 'auto', opacity: 1 }} 
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    className="bg-stone-50/50 border-t border-stone-100 px-3 py-3"
                                                                >
                                                                    <div className="flex gap-2 mb-3">
                                                                        {piece?.sheet_music && (
                                                                            <a href={piece.sheet_music} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white border border-stone-200 rounded-lg text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395] hover:border-[#002395]/40 transition-all shadow-sm">
                                                                                <Download size={12} /> Nuty PDF
                                                                            </a>
                                                                        )}
                                                                        {piece?.reference_recording && (
                                                                            <a href={piece.reference_recording} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white border border-stone-200 rounded-lg text-[9px] uppercase tracking-widest font-bold antialiased text-red-600 hover:border-red-200 transition-all shadow-sm">
                                                                                <Youtube size={12} /> Youtube
                                                                            </a>
                                                                        )}
                                                                    </div>

                                                                    {myTracks.length > 0 ? (
                                                                        <div className="space-y-1.5">
                                                                            {myTracks.map(track => (
                                                                                <div key={track.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-2 border border-stone-100 rounded-lg shadow-sm">
                                                                                    <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-emerald-700 flex items-center gap-1.5">
                                                                                        <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center"><PlayCircle size={10}/></div>
                                                                                        {track.title || track.voice_part_display}
                                                                                    </span>
                                                                                    <audio controls controlsList="nodownload" className="h-7 w-full sm:w-48 outline-none" preload="none" onPlay={handleAudioPlay}>
                                                                                        <source src={track.audio_file} type="audio/mpeg" />
                                                                                    </audio>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-[9px] text-stone-400 italic text-center py-2">Brak dedykowanej ścieżki audio.</p>
                                                                    )}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-stone-400 italic bg-white p-4 rounded-xl border border-stone-100 text-center">Setlista czeka na zatwierdzenie.</p>
                                    )}
                                </div>

                                <div className="bg-stone-50/50 rounded-3xl p-6 border border-stone-100">
                                    <p className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-5 flex items-center gap-2">
                                        <Users size={14} /> Pełny Skład (Roster)
                                    </p>
                                    {Object.keys(groupedRoster).length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                            {Object.entries(groupedRoster).map(([voiceGroup, artists]) => (
                                                <div key={voiceGroup}>
                                                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-200 pb-2">
                                                        {voiceGroup} <span className="opacity-50">({artists.length})</span>
                                                    </h4>
                                                    <ul className="space-y-2">
                                                        {artists.map(artist => (
                                                            <li key={artist.id} className="text-xs font-bold text-stone-700 truncate flex items-center gap-2" title={artist.name}>
                                                                <div className="w-1.5 h-1.5 rounded-full bg-stone-300"></div> {artist.name}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-stone-400 italic text-center p-4">Brak zatwierdzonej obsady.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.section>
            )}

            {/* --- QUICK ACTIONS GRID --- */}
            <section className="pt-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-px flex-1 bg-gradient-to-r from-stone-200 to-transparent"></div>
                    <h3 className="text-[9px] font-bold antialiased uppercase tracking-[0.25em] text-stone-400">
                        Narzędzia
                    </h3>
                    <div className="h-px flex-1 bg-gradient-to-l from-stone-200 to-transparent"></div>
                </div>

                <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {displayCards.map((card, idx) => (
                        <Link key={idx} to={card.link} className={`block group outline-none ${card.colSpan || 'md:col-span-1'}`}>
                            <motion.div variants={itemVariants} className={`${glassCardStyle} min-h-[160px] p-6 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between`}>
                                <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-30 group-hover:opacity-80 transition-opacity duration-300 pointer-events-none`}></div>
                                
                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div className="w-10 h-10 bg-white border border-stone-100 shadow-sm rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                                        {card.icon}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-stone-900 mb-1.5 tracking-tight">{card.title}</h4>
                                        <p className="text-[11px] text-stone-500 font-medium leading-relaxed max-w-sm">{card.desc}</p>
                                    </div>
                                </div>
                                <div className="relative z-10 flex items-center justify-between mt-6 pt-3 border-t border-stone-100/50">
                                    <span className="text-[8px] uppercase tracking-widest font-bold antialiased text-stone-400 group-hover:text-[#002395] transition-colors">
                                        Moduł
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-[#002395] transform group-hover:translate-x-1 transition-all duration-300" />
                                </div>
                            </motion.div>
                        </Link>
                    ))}
                </motion.div>
            </section>
        </div>
    );
}