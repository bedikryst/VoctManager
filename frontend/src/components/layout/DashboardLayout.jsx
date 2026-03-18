/**
 * @file DashboardLayout.jsx
 * @description Main architectural wrapper for the authenticated zone.
 * UX UPGRADE: 2025 "Floating Island" Sidebar with Glassmorphism, pill-shaped navigation,
 * and a seamless Gradient Mask scroll area (Scrollbar Nuke).
 * @module core/DashboardLayout
 * @author Krystian Bugalski
 */

import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
    LayoutDashboard, 
    Users, 
    Briefcase, 
    Music, 
    CalendarCheck, 
    LogOut, 
    Menu, 
    X, 
    FileText,
    Calendar,
    Headphones,
    FolderOpen,
    Wrench
} from 'lucide-react';

export default function DashboardLayout() {
    const { user, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const isAdmin = user?.is_admin;

    const adminNavGroups = [
        {
            label: "Menu Główne",
            links: [
                { to: '/panel', icon: <LayoutDashboard size={18} />, label: 'Pulpit Zarządu' },
            ]
        },
        {
            label: "Produkcja (Wydarzenia)",
            links: [
                { to: '/panel/project-management', icon: <Briefcase size={18} />, label: 'Projekty i Koncerty' },
                { to: '/panel/rehearsals', icon: <CalendarCheck size={18} />, label: 'Dziennik Obecności' },
            ]
        },
        {
            label: "Zasoby i Administracja",
            links: [
                { to: '/panel/artists', icon: <Users size={18} />, label: 'Zarządzanie Zespołem' },
                { to: '/panel/crew', icon: <Wrench size={18} />, label: 'Ekipa Techniczna' },
                { to: '/panel/contracts', icon: <FileText size={18} />, label: 'Kadry i Płace' },
                { to: '/panel/archive-management', icon: <Music size={18} />, label: 'Utwory, Nuty, MIDI' },
            ]
        },
        {
            label: "Strefa Chórzysty",
            links: [
                { to: '/panel/schedule', icon: <Calendar size={18} />, label: 'Mój Harmonogram' },
                { to: '/panel/materials', icon: <Headphones size={18} />, label: 'Materiały do prób' },
                { to: '/panel/resources', icon: <FolderOpen size={18} />, label: 'Zasoby Fundacji' },
            ]
        }
    ];

    const artistNavGroups = [
        {
            label: "Menu Główne",
            links: [
                { to: '/panel', icon: <LayoutDashboard size={18} />, label: 'Mój Pulpit' },
            ]
        },
        {
            label: "Moja Strefa",
            links: [
                { to: '/panel/schedule', icon: <Calendar size={18} />, label: 'Mój Harmonogram' },
                { to: '/panel/materials', icon: <Headphones size={18} />, label: 'Materiały do prób' },
                { to: '/panel/resources', icon: <FolderOpen size={18} />, label: 'Zasoby Fundacji' },
            ]
        }
    ];

    const navGroups = isAdmin ? adminNavGroups : artistNavGroups;

    useEffect(() => {
        document.body.classList.add('admin-mode');
        return () => document.body.classList.remove('admin-mode');
    }, []);

    const NavItem = ({ to, icon, label }) => (
        <NavLink
            to={to}
            end={to === '/panel'} 
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-bold text-xs tracking-wide border ${
                    isActive 
                    ? 'bg-[#002395] text-white border-[#002395] shadow-[0_4px_14px_rgba(0,35,149,0.3)]' 
                    : 'text-stone-500 border-transparent hover:bg-stone-100 hover:text-stone-900'
                }`
            }
        >
            {icon}
            <span>{label}</span>
        </NavLink>
    );

    return (
        <div className="min-h-screen bg-[#f4f2ee] flex cursor-default" style={{ fontFamily: "'Poppins', sans-serif" }}>
            
            {/* --- DESKTOP SIDEBAR (FLOATING ISLAND) --- */}
            <aside className="hidden md:flex flex-col w-[260px] bg-white/90 backdrop-blur-xl border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] fixed top-4 bottom-4 left-4 z-20 rounded-3xl overflow-hidden">
                
                <div className="p-6 pb-2 flex-shrink-0 relative z-10">
                    <h2 className="text-2xl font-medium text-stone-900" style={{ fontFamily: "'Cormorant', serif" }}>
                        Voct<span className="italic text-[#002395]">Manager</span>
                    </h2>
                    <div className="mt-2 inline-flex items-center px-2 py-1 rounded-md bg-stone-100 border border-stone-200">
                        <p className="text-[9px] uppercase tracking-widest text-stone-500 font-bold">
                            {isAdmin ? 'Panel Zarządu' : 'Panel Artysty'}
                        </p>
                    </div>
                </div>

                {/* UX UPGRADE: Twarde wymuszenie ukrycia scrollbara + Maska Gradientowa */}
                <nav 
                    className="flex-1 px-4 py-2 overflow-y-auto relative z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                    style={{
                        maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)'
                    }}
                >
                    <div className="space-y-5 py-4">
                        {navGroups.map((group, idx) => (
                            <div key={idx}>
                                <p className="px-4 text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-2">
                                    {group.label}
                                </p>
                                <div className="space-y-0.5">
                                    {group.links.map(link => <NavItem key={link.to} {...link} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                </nav>

                <div className="p-4 bg-stone-50/50 border-t border-white/50 flex-shrink-0 relative z-10">
                    <div className="px-4 py-3 mb-3 rounded-2xl bg-white border border-stone-100 shadow-sm">
                        <p className="text-xs font-bold text-stone-800 truncate">{user?.first_name} {user?.last_name}</p>
                        <p className="text-[10px] text-[#002395] uppercase font-bold tracking-widest mt-0.5">{user?.voice_type_display}</p>
                    </div>
                    <button 
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                    >
                        <LogOut size={16} /> Wyloguj się
                    </button>
                </div>
            </aside>

            {/* --- MOBILE TOPBAR (GLASSMORPHISM) --- */}
            <header className="md:hidden fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-stone-200/50 z-50 px-4 py-4 flex justify-between items-center shadow-sm">
                <h2 className="text-xl font-medium text-stone-900" style={{ fontFamily: "'Cormorant', serif" }}>
                    Voct<span className="italic text-[#002395]">Manager</span>
                </h2>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-stone-600 p-1 bg-stone-100 rounded-lg">
                    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </header>

            {/* --- MOBILE MENU OVERLAY --- */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-[#f4f2ee] pt-20 px-4 flex flex-col overflow-y-auto">
                    <nav className="flex-1 py-4 space-y-6">
                        {navGroups.map((group, idx) => (
                            <div key={idx}>
                                <p className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-2">
                                    {group.label}
                                </p>
                                <div className="space-y-1">
                                    {group.links.map(link => <NavItem key={link.to} {...link} />)}
                                </div>
                            </div>
                        ))}
                    </nav>
                    <button onClick={logout} className="mt-4 mb-8 flex items-center justify-center gap-3 w-full py-4 text-red-600 font-bold uppercase tracking-widest text-xs bg-white border border-red-100 shadow-sm rounded-xl">
                        <LogOut size={18} /> Wyloguj się
                    </button>
                </div>
            )}

            {/* --- MAIN CONTENT INJECTION NODE --- */}
            <main className="flex-1 md:pl-[290px] pt-24 md:pt-4 p-4 md:pr-8 md:pb-8 transition-all min-w-0">
                <div className="max-w-6xl mx-auto w-full">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}