/**
 * @file ProjectEditorPanel.tsx
 * @description Slide-over modal orchestrator for deep project editing and logistics.
 * Implements strict keyboard accessibility (ESC to close) and dynamic viewport constraints.
 * Provides a fluid tab routing system utilizing AnimatePresence for cinematic cross-fades.
 * Note: Child tabs are responsible for fetching their own relational data via useQuery.
 * @module panel/projects/ProjectEditorPanel
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Briefcase, Calendar1, Grid, Users, 
    ListOrdered, MicVocal, Wrench, Banknote 
} from 'lucide-react';

import type { Project } from '../../../../types';

import DetailsTab from './tabs/DetailsTab';
import MicroCastingTab from './tabs/MicroCastingTab';
import RehearsalsTab from './tabs/RehearsalsTab';
import CastTab from './tabs/CastTab';
import ProgramTab from './tabs/ProgramTab';
import CrewTab from './tabs/CrewTab';
import BudgetTab from './tabs/BudgetTab';
import AttendanceMatrixTab from './tabs/AttendanceMatrixTab';

interface TabDefinition {
    id: string;
    icon: React.ReactNode;
    label: string;
}

const PROJECT_TABS: TabDefinition[] = [
    { id: 'DETAILS', icon: <Briefcase size={14} aria-hidden="true" />, label: 'Szczegóły' },
    { id: 'REHEARSALS', icon: <Calendar1 size={14} aria-hidden="true" />, label: 'Terminarz Prób' },
    { id: 'MATRIX', icon: <Grid size={14} aria-hidden="true" />, label: 'Obecności' }, 
    { id: 'CAST', icon: <Users size={14} aria-hidden="true" />, label: 'Casting Główny' },
    { id: 'PROGRAM', icon: <ListOrdered size={14} aria-hidden="true" />, label: 'Setlista' },
    { id: 'MICRO_CAST', icon: <MicVocal size={14} aria-hidden="true" />, label: 'Mikro-Obsada' },
    { id: 'CREW', icon: <Wrench size={14} aria-hidden="true" />, label: 'Logistyka' },
    { id: 'BUDGET', icon: <Banknote size={14} aria-hidden="true" />, label: 'Budżet' }
];

interface ProjectEditorPanelProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project | null;
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export default function ProjectEditorPanel({ 
    isOpen, 
    onClose, 
    project, 
    activeTab, 
    onTabChange 
}: ProjectEditorPanelProps): React.ReactPortal | null {
    const [mounted, setMounted] = useState<boolean>(false);

    useEffect(() => { 
        setMounted(true); 
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        transition={{ duration: 0.3 }}
                        onClick={onClose} 
                        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" 
                        aria-hidden="true"
                    />
                    
                    <motion.div 
                        initial={{ x: '100%', opacity: 0.5 }} 
                        animate={{ x: 0, opacity: 1 }} 
                        exit={{ x: '100%', opacity: 0.5 }} 
                        transition={{ type: 'spring', damping: 30, stiffness: 250, mass: 1.5 }} 
                        className="relative w-full md:w-[90vw] lg:w-[85vw] max-w-[1600px] h-full bg-[#f8f7f4] shadow-[-20px_0_50px_rgba(0,0,0,0.15)] flex flex-col border-l border-white/60 overflow-hidden"
                        role="dialog" 
                        aria-modal="true" 
                        aria-labelledby="panel-title"
                    >
                        <div className="flex-shrink-0 bg-[#f8f7f4]/95 backdrop-blur-2xl z-20 px-6 md:px-10 pt-8 pb-4">
                            
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-4">
                                    <h3 id="panel-title" className="font-serif text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">
                                        {project ? project.title : 'Kreator Nowego Wydarzenia'}
                                    </h3>
                                    {project?.status === 'DONE' && (
                                        <span className="px-2.5 py-1 bg-stone-200/50 text-stone-600 text-[9px] uppercase tracking-widest font-bold antialiased rounded-md border border-stone-200">
                                            Archiwum
                                        </span>
                                    )}
                                </div>
                                <button 
                                    onClick={onClose} 
                                    className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-3 rounded-2xl active:scale-95 group"
                                    aria-label="Zamknij panel (ESC)"
                                >
                                    <X size={20} className="group-hover:rotate-90 transition-transform duration-300" aria-hidden="true" />
                                </button>
                            </div>

                            {project && (
                                <div className="relative">
                                    <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[#f8f7f4] to-transparent pointer-events-none z-10" />
                                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#f8f7f4] to-transparent pointer-events-none z-10" />
                                    
                                    <div className="flex overflow-x-auto scrollbar-hide gap-2 p-1.5 bg-stone-200/40 border border-stone-200/60 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                                        {PROJECT_TABS.map((tab) => (
                                            <button 
                                                key={tab.id} 
                                                onClick={() => onTabChange(tab.id)} 
                                                className={`flex items-center gap-2 px-5 py-2.5 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex-shrink-0 ${
                                                    activeTab === tab.id 
                                                    ? 'bg-white text-[#002395] shadow-sm border border-white' 
                                                    : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'
                                                }`}
                                            >
                                                {tab.icon} {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-hide bg-gradient-to-b from-transparent to-stone-50/50">
                            <div className="p-4 md:px-10 md:pb-10 pt-2 min-h-full">
                                
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeTab}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -15 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className="w-full"
                                    >
                                        {activeTab === 'DETAILS' && <DetailsTab project={project} onSuccess={() => {}} />}
                                        {activeTab === 'REHEARSALS' && project && <RehearsalsTab projectId={project.id} />}
                                        {activeTab === 'MATRIX' && project && <AttendanceMatrixTab projectId={project.id} />}
                                        {activeTab === 'CAST' && project && <CastTab projectId={project.id} />}
                                        {activeTab === 'PROGRAM' && project && <ProgramTab projectId={project.id} />}
                                        {activeTab === 'MICRO_CAST' && project && <MicroCastingTab projectId={project.id} />}
                                        {activeTab === 'CREW' && project && <CrewTab projectId={project.id} />}
                                        {activeTab === 'BUDGET' && project && <BudgetTab projectId={project.id} />}
                                    </motion.div>
                                </AnimatePresence>

                            </div>
                        </div>
                        
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}