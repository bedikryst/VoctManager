/**
 * @file DashboardLayout.jsx
 * @description Main architectural wrapper for the authenticated zone.
 * Handles Role-Based Access Control (RBAC) navigation (Admin vs Artist) 
 * and responsive sidebar/topbar rendering.
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
    ListOrdered
} from 'lucide-react';

export default function DashboardLayout() {
    const { user, logout } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Verify user role to render appropriate navigation
    const isAdmin = user?.is_admin;

    // --- NAVIGATION CONFIGURATION ---
    const adminLinks = [
        { to: '/panel', icon: <LayoutDashboard size={20} />, label: 'Pulpit Zarządu' },
        { to: '/panel/projects', icon: <Briefcase size={20} />, label: 'Projekty i Koncerty' },
        { to: '/panel/contracts', icon: <Users size={20} />, label: 'Kadry i Płace' },
        { to: '/panel/repertoire', icon: <Music size={20} />, label: 'Archiwum Nuty' },
        { to: '/panel/rehearsals', icon: <CalendarCheck size={20} />, label: 'Obecności na Próbach' },
        { to: '/panel/program', icon: <ListOrdered size={20} />, label: 'Kreator Programu' },
        { to: '/panel/artists', icon: <Users size={20} />, label: 'Zespół' },
        { to: '/panel/schedule', icon: <CalendarCheck size={20} />, label: 'Harmonogram' },
        { to: '/panel/materials', icon: <Music size={20} />, label: 'Materiały do prób' },
        { to: '/panel/project-management', icon: <Briefcase size={20} />, label: 'Zarządzanie' },
        { to: '/panel/archive-management', icon: <Music size={20} />, label: 'Archiwum' },
    ];

    const artistLinks = [
        { to: '/panel', icon: <LayoutDashboard size={20} />, label: 'Mój Pulpit' },
        { to: '/panel/materials', icon: <Music size={20} />, label: 'Materiały do prób' },
        { to: '/panel/schedule', icon: <CalendarCheck size={20} />, label: 'Harmonogram' },
    ];

    const navLinks = isAdmin ? adminLinks : artistLinks;

    useEffect(() => {
        document.body.classList.add('admin-mode');
        return () => document.body.classList.remove('admin-mode');
    }, []);


    // Reusable navigation item component
    const NavItem = ({ to, icon, label }) => (
        <NavLink
            to={to}
            end={to === '/panel'} // Prevents '/panel' from always matching as active
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-md transition-all font-medium text-sm ${
                    isActive 
                    ? 'bg-[#002395] text-white shadow-md' 
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                }`
            }
        >
            {icon}
            <span>{label}</span>
        </NavLink>
    );

    return (
        <div className="min-h-screen bg-[#fdfbf7] flex cursor-default" style={{ fontFamily: "'Poppins', sans-serif" }}>
            
            {/* --- DESKTOP SIDEBAR --- */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-stone-200 fixed h-full z-10 shadow-sm">
                <div className="p-6 border-b border-stone-100">
                    <h2 className="text-2xl font-medium text-stone-900" style={{ fontFamily: "'Cormorant', serif" }}>
                        Voct<span className="italic text-[#002395]">Manager</span>
                    </h2>
                    <p className="text-[10px] uppercase tracking-widest text-stone-400 mt-1 font-bold">
                        {isAdmin ? 'Panel Zarządu' : 'Panel Artysty'}
                    </p>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navLinks.map((link) => (
                        <NavItem key={link.to} {...link} />
                    ))}
                </nav>

                <div className="p-4 border-t border-stone-100">
                    <div className="px-4 py-3 mb-2 rounded-md bg-stone-50 border border-stone-100">
                        <p className="text-xs font-bold text-stone-800">{user?.first_name} {user?.last_name}</p>
                        <p className="text-[10px] text-stone-500 uppercase">{user?.voice_type_display}</p>
                    </div>
                    <button 
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut size={20} />
                        <span>Wyloguj się</span>
                    </button>
                </div>
            </aside>

            {/* --- MOBILE TOPBAR --- */}
            <header className="md:hidden fixed top-0 w-full bg-white border-b border-stone-200 z-20 px-4 py-4 flex justify-between items-center shadow-sm">
                <h2 className="text-xl font-medium text-stone-900" style={{ fontFamily: "'Cormorant', serif" }}>
                    Voct<span className="italic text-[#002395]">Manager</span>
                </h2>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-stone-600">
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </header>

            {/* --- MOBILE MENU OVERLAY --- */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-10 bg-white pt-20 px-4 flex flex-col">
                    <nav className="flex-1 space-y-2">
                        {navLinks.map((link) => (
                            <NavItem key={link.to} {...link} />
                        ))}
                    </nav>
                    <button onClick={logout} className="mt-auto mb-8 flex items-center justify-center gap-3 w-full py-4 text-red-600 font-bold bg-red-50 rounded-md">
                        <LogOut size={20} /> Wyloguj się
                    </button>
                </div>
            )}

            {/* --- MAIN CONTENT AREA --- */}
            {/* Added left margin (md:ml-64) to accommodate the fixed desktop sidebar */}
            <main className="flex-1 md:ml-64 pt-20 md:pt-0 p-6 md:p-10 transition-all">
                <div className="max-w-6xl mx-auto">
                    {/* React Router dynamically injects the matched child route here */}
                    <Outlet />
                </div>
            </main>
        </div>
    );
}