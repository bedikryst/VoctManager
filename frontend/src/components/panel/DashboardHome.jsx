/**
 * @file DashboardHome.jsx
 * @description Dashboard Overview Component.
 * Acts as the landing page within the protected panel. Displays a personalized greeting
 * and Role-Based Access Control (RBAC) quick action shortcuts.
 * @author Krystian Bugalski
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { Calendar, Music, FileText, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardHome() {
    // Retrieve authenticated user data from the global context
    const { user } = useAuth();
    const isAdmin = user?.is_admin;

    // --- QUICK ACTION CARDS (RBAC Configurations) ---
    const adminCards = [
        { title: "Zarządzaj Umowami", desc: "Generuj PDF-y i paczki ZIP dla projektów.", icon: <FileText className="w-6 h-6 text-[#002395]" />, link: "/panel/contracts" },
        { title: "Planowanie Prób", desc: "Zarządzaj harmonogramem i obecnościami.", icon: <Calendar className="w-6 h-6 text-[#002395]" />, link: "/panel/rehearsals" },
        { title: "Archiwum Nuty", desc: "Zarządzaj biblioteką utworów i nagrań.", icon: <Music className="w-6 h-6 text-[#002395]" />, link: "/panel/repertoire" },
    ];

    const artistCards = [
        { title: "Materiały do Prób", desc: "Pobierz nuty i nagrania (midi/audio).", icon: <Music className="w-6 h-6 text-[#002395]" />, link: "/panel/materials" },
        { title: "Harmonogram", desc: "Sprawdź daty najbliższych prób i koncertów.", icon: <Calendar className="w-6 h-6 text-[#002395]" />, link: "/panel/schedule" },
    ];

    const displayCards = isAdmin ? adminCards : artistCards;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* HERO / WELCOME SECTION */}
            <div className="bg-white p-8 rounded-xl border border-stone-200 shadow-sm relative overflow-hidden">
                {/* Subtle abstract background gradient */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#002395] opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                
                <div className="relative z-10">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 mb-2">
                        {isAdmin ? 'Pulpit Zarządu' : 'Pulpit Artysty'}
                    </p>
                    <h1 className="text-4xl md:text-5xl font-medium text-stone-900 mb-4" style={{ fontFamily: "'Cormorant', serif" }}>
                        Witaj, {user?.first_name}!
                    </h1>
                    <p className="text-stone-500 font-light max-w-2xl">
                        To jest Twoje centrum dowodzenia VoctManager. 
                        {isAdmin 
                            ? " Wybierz moduł poniżej, aby zarządzać logistyką zespołu." 
                            : " Znajdziesz tutaj wszystkie potrzebne materiały, nuty oraz wygenerowane umowy."}
                    </p>
                </div>
            </div>

            {/* QUICK ACTIONS GRID */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 mb-4">Szybki dostęp</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {displayCards.map((card, idx) => (
                        <Link key={idx} to={card.link}>
                            <motion.div 
                                whileHover={{ y: -4 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm hover:shadow-md hover:border-stone-300 transition-all group h-full flex flex-col cursor-pointer"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#002395]/10 transition-colors">
                                    {card.icon}
                                </div>
                                <h4 className="text-stone-900 font-bold mb-2">{card.title}</h4>
                                <p className="text-sm text-stone-500 font-light flex-grow">{card.desc}</p>
                                
                                <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity">
                                    Przejdź <ChevronRight className="w-3 h-3" />
                                </div>
                            </motion.div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}