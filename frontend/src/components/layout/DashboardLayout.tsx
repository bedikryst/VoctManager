/**
 * @file DashboardLayout.tsx
 * @description Main architectural wrapper for the authenticated zone.
 * @architecture Enterprise 2026 Standards
 * UX UPGRADE: Premium "Floating Island" Sidebar with Deep Glassmorphism.
 * Added Framer Motion for liquid mobile menu transitions.
 * CONTENT UPGRADE: Restored "Strefa Chórzysty" for Admins.
 * BUGFIX: Restored `admin-mode` class to body to prevent index.css from hiding the cursor.
 * LAYOUT FIX: Implemented global layout padding in the <main> wrapper to ensure 
 * breathing room (Negative Space) on the right side across all nested routes.
 * @module core/DashboardLayout
 * @author Krystian Bugalski
 */

import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LayoutDashboard, Users, Briefcase, Music, 
    CalendarCheck, LogOut, Menu, X, FileText,
    Calendar, Headphones, FolderOpen, Wrench, Settings
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

interface AuthUser {
    id?: string | number;
    username?: string;
    first_name?: string;
    last_name?: string;
    is_admin?: boolean;
    artist_profile_id?: string | number;
    voice_type_display?: string;
}

export default function DashboardLayout(): React.JSX.Element {
    const { user, logout } = useAuth() as { user: AuthUser | null, logout: () => void };
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const isAdmin = user?.is_admin;

    // --- RBAC Navigation Arrays ---
    const adminNavGroups = [
        {
            label: "Przegląd",
            links: [
                { to: '/panel', icon: <LayoutDashboard size={18} aria-hidden="true" />, label: 'Pulpit Zarządu' },
            ]
        },
        {
            label: "Produkcja",
            links: [
                { to: '/panel/project-management', icon: <Briefcase size={18} aria-hidden="true" />, label: 'Projekty i Koncerty' },
                { to: '/panel/rehearsals', icon: <CalendarCheck size={18} aria-hidden="true" />, label: 'Dziennik Obecności' },
            ]
        },
        {
            label: "Administracja Bazy",
            links: [
                { to: '/panel/artists', icon: <Users size={18} aria-hidden="true" />, label: 'Zarządzanie Zespołem' },
                { to: '/panel/crew', icon: <Wrench size={18} aria-hidden="true" />, label: 'Ekipa Techniczna' },
                { to: '/panel/contracts', icon: <FileText size={18} aria-hidden="true" />, label: 'Kadry i Płace' },
                { to: '/panel/archive-management', icon: <Music size={18} aria-hidden="true" />, label: 'Archiwum Nut' },
            ]
        },
        {
            label: "Strefa Chórzysty",
            links: [
                { to: '/panel/schedule', icon: <Calendar size={18} aria-hidden="true" />, label: 'Mój Harmonogram' },
                { to: '/panel/materials', icon: <Headphones size={18} aria-hidden="true" />, label: 'Materiały do prób' },
                { to: '/panel/resources', icon: <FolderOpen size={18} aria-hidden="true" />, label: 'Baza Wiedzy' },
            ]
        }
    ];

    const artistNavGroups = [
        {
            label: "Przegląd",
            links: [
                { to: '/panel', icon: <LayoutDashboard size={18} aria-hidden="true" />, label: 'Mój Pulpit' },
            ]
        },
        {
            label: "Moja Strefa",
            links: [
                { to: '/panel/schedule', icon: <Calendar size={18} aria-hidden="true" />, label: 'Mój Harmonogram' },
                { to: '/panel/materials', icon: <Headphones size={18} aria-hidden="true" />, label: 'Materiały do prób' },
                { to: '/panel/resources', icon: <FolderOpen size={18} aria-hidden="true" />, label: 'Baza Wiedzy' },
            ]
        }
    ];

    const navGroups = isAdmin ? adminNavGroups : artistNavGroups;

    // KRYTYCZNA POPRAWKA: Przywrócenie .admin-mode do body, aby index.css nie ukrywał myszki
    useEffect(() => {
        document.body.classList.add('admin-mode');
        document.body.style.backgroundColor = "#f4f2ee";
        
        return () => { 
            document.body.classList.remove('admin-mode');
            document.body.style.backgroundColor = ""; 
        };
    }, []);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [isMobileMenuOpen]);

    // --- Sub-components ---
    const NavItem = ({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) => (
        <NavLink
            to={to}
            end={to === '/panel'} 
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold text-xs tracking-wide border ${
                    isActive 
                    ? 'bg-[#002395] text-white border-[#001766] shadow-[0_8px_20px_rgba(0,35,149,0.25)]' 
                    : 'text-stone-500 border-transparent hover:bg-stone-100 hover:text-stone-900 hover:shadow-sm'
                }`
            }
        >
            {icon}
            <span>{label}</span>
        </NavLink>
    );

    const UserAvatar = () => {
        const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
        return (
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#002395] border border-blue-100 flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0">
                {initials}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#f4f2ee] flex font-sans">
            
            {/* ==========================================
                DESKTOP SIDEBAR (FLOATING ISLAND)
            ========================================== */}
            <aside className="hidden md:flex flex-col w-[280px] bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] shadow-[inset_0_1px_0_rgba(255,255,255,1)] fixed top-4 bottom-4 left-4 z-20 rounded-[2rem] overflow-hidden">
                
                <div className="p-7 pb-4 flex-shrink-0 relative z-10">
                    <h2 className="text-3xl font-medium text-stone-900 tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                        Voct<span className="italic text-[#002395]">Manager</span>
                    </h2>
                    <div className="mt-2.5 inline-flex items-center px-2.5 py-1 rounded-md bg-white border border-stone-200/60 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
                        <p className="text-[9px] uppercase tracking-widest text-stone-500 font-bold">
                            {isAdmin ? 'Panel Zarządu' : 'Panel Artysty'}
                        </p>
                    </div>
                </div>

                <nav 
                    className="flex-1 px-5 py-2 overflow-y-auto relative z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                    style={{
                        maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)'
                    }}
                >
                    <div className="space-y-6 py-4">
                        {navGroups.map((group, idx) => (
                            <div key={idx}>
                                <p className="px-4 text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-3 border-b border-stone-100/50 pb-2">
                                    {group.label}
                                </p>
                                <div className="space-y-1">
                                    {group.links.map(link => <NavItem key={link.to} {...link} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                </nav>

                <div className="p-5 bg-stone-50/50 border-t border-white/60 flex-shrink-0 relative z-10 flex flex-col gap-3">
                    <div className="p-3 rounded-2xl bg-white border border-stone-200/60 shadow-sm flex items-center justify-between group">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <UserAvatar />
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-stone-800 truncate">{user?.first_name} {user?.last_name}</p>
                                <p className="text-[9px] text-stone-400 uppercase font-bold tracking-widest mt-0.5 truncate">
                                    {isAdmin ? 'Administrator' : user?.voice_type_display || 'Artysta'}
                                </p>
                            </div>
                        </div>
                        <Link to="/panel" className="p-2 text-stone-300 hover:text-[#002395] hover:bg-blue-50 rounded-lg transition-colors" title="Ustawienia Profilu">
                            <Settings size={16} aria-hidden="true" />
                        </Link>
                    </div>

                    <button 
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100 active:scale-95"
                    >
                        <LogOut size={16} aria-hidden="true" /> Wyloguj się
                    </button>

                    <div className="text-center pt-2">
                        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-stone-400 opacity-60">
                            VoctManager Enterprise • v1.0
                        </span>
                    </div>
                </div>
            </aside>

            {/* ==========================================
                MOBILE TOPBAR (GLASSMORPHISM)
            ========================================== */}
            <header className="md:hidden fixed top-0 w-full bg-white/80 backdrop-blur-2xl border-b border-stone-200/60 z-50 px-5 py-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-medium text-stone-900 tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                        Voct<span className="italic text-[#002395]">Manager</span>
                    </h2>
                </div>
                <button 
                    onClick={() => setIsMobileMenuOpen(true)} 
                    className="text-stone-600 p-2 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors border border-stone-200/80 active:scale-95"
                >
                    <Menu size={20} aria-hidden="true" />
                </button>
            </header>

            {/* ==========================================
                MOBILE MENU OVERLAY (FRAMER MOTION)
            ========================================== */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="md:hidden fixed inset-0 z-40 bg-stone-900/20 backdrop-blur-sm"
                            aria-hidden="true"
                        />
                        <motion.div 
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="md:hidden fixed top-0 right-0 bottom-0 w-4/5 max-w-sm bg-[#f4f2ee] shadow-2xl z-50 flex flex-col border-l border-white/60"
                        >
                            <div className="flex justify-between items-center p-5 border-b border-stone-200/50 bg-white/80 backdrop-blur-xl flex-shrink-0 z-20">
                                <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395]">Nawigacja</span>
                                <button onClick={() => setIsMobileMenuOpen(false)} className="text-stone-400 hover:text-stone-900 bg-white border border-stone-200 shadow-sm p-2 rounded-xl transition-all active:scale-95">
                                    <X size={18} aria-hidden="true" />
                                </button>
                            </div>

                            <nav className="flex-1 px-5 py-6 overflow-y-auto space-y-6">
                                {navGroups.map((group, idx) => (
                                    <div key={idx}>
                                        <p className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-3 border-b border-stone-200/60 pb-2">
                                            {group.label}
                                        </p>
                                        <div className="space-y-1.5">
                                            {group.links.map(link => <NavItem key={link.to} {...link} />)}
                                        </div>
                                    </div>
                                ))}
                            </nav>

                            <div className="p-5 bg-white/80 backdrop-blur-xl border-t border-stone-200/50 flex-shrink-0 space-y-4 z-20">
                                <div className="flex items-center gap-3">
                                    <UserAvatar />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-stone-800 truncate">{user?.first_name} {user?.last_name}</p>
                                        <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest truncate">{isAdmin ? 'Zarząd' : 'Artysta'}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={logout} 
                                    className="flex items-center justify-center gap-2 w-full py-3.5 text-red-600 font-bold uppercase tracking-widest text-[10px] bg-red-50 hover:bg-red-100 transition-colors border border-red-100 shadow-sm rounded-xl active:scale-95"
                                >
                                    <LogOut size={16} aria-hidden="true" /> Wyloguj się
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ==========================================
                MAIN CONTENT INJECTION NODE
            ========================================== */}
            {/* ZMIANY W PADDINGU GLOBALNYM: pl-[320px] i pr-8 lg:pr-12 zapewnia idealny oddech z prawej strony dla wszystkich widoków */}
            <main className="flex-1 md:pl-[320px] pt-24 md:pt-8 px-4 sm:px-6 md:pr-8 lg:pr-12 pb-12 transition-all min-w-0 relative z-0">
                {/* Wymuszamy maksymalną szerokość i wyśrodkowanie na wszystkich ładowanych kartach */}
                <div className="w-full h-full max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}