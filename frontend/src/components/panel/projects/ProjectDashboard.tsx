/**
 * @file ProjectDashboard.tsx
 * @description Master Controller for the Event & Production Management module.
 * Completely eliminates legacy Context API. Child components fetch their own data 
 * instantly via React Query structural sharing.
 * @module panel/projects/ProjectDashboard
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Briefcase, Layers } from 'lucide-react';

import { useProjectDashboard } from './hooks/useProjectDashboard';
import ProjectCard from './ProjectCard/ProjectCard';
import ProjectEditorPanel from './ProjectEditorPanel/ProjectEditorPanel';

import ConfirmModal from '../../../components/ui/ConfirmModal';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Button } from '../../../components/ui/Button';

const MemoizedProjectCard = React.memo(ProjectCard);

const FILTER_OPTIONS = [
    { id: 'ACTIVE', label: 'W przygotowaniu' }, 
    { id: 'DONE', label: 'Archiwum' }, 
    { id: 'ALL', label: 'Wszystkie' }
] as const;

export default function ProjectDashboard(): React.JSX.Element {
    const {
        isLoading, filteredProjects, listFilter, setListFilter,
        isPanelOpen, activeTab, setActiveTab, editingProject,
        projectToDelete, setProjectToDelete, isDeleting,
        openPanel, closePanel, executeDelete
    } = useProjectDashboard();

    useEffect(() => {
        document.body.style.overflow = isPanelOpen || projectToDelete ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isPanelOpen, projectToDelete]);

    return (
        <div className="space-y-6 animate-fade-in relative cursor-default pb-24 max-w-6xl mx-auto px-4 sm:px-0">
            
            <header className="relative pt-6 mb-10">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                                <Briefcase size={12} className="text-[#002395]" aria-hidden="true" />
                                <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                                    Centrum Dowodzenia
                                </p>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                                Wydarzenia i <span className="italic text-[#002395]">Produkcja</span>.
                            </h1>
                        </div>
                        <Button 
                            variant="primary"
                            onClick={() => openPanel(null)} 
                            leftIcon={<Plus size={16} aria-hidden="true" />}
                        >
                            Nowy Projekt
                        </Button>
                    </div>
                </motion.div>
            </header>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="inline-flex items-center p-1.5 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-xl overflow-x-auto max-w-full scrollbar-hide">
                    {FILTER_OPTIONS.map((filter) => (
                        <button 
                            key={filter.id} 
                            onClick={() => setListFilter(filter.id)} 
                            className={`px-5 py-2 text-[9px] font-bold antialiased uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${listFilter === filter.id ? 'bg-white text-[#002395] shadow-sm border border-stone-100' : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'}`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {isLoading ? (
                    <div className="animate-pulse space-y-4">
                        {[1, 2].map((i) => <div key={i} className="h-48 bg-stone-100/50 rounded-[2rem] w-full border border-white/50"></div>)}
                    </div>
                ) : filteredProjects.length > 0 ? (
                    filteredProjects.map((project, idx) => (
                        <MemoizedProjectCard 
                            key={project.id} 
                            project={project} 
                            index={idx} 
                            onEdit={(tab) => openPanel(project, tab || 'DETAILS')}
                            onDelete={() => setProjectToDelete(String(project.id))}
                        /> 
                    ))
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <GlassCard className="p-16 flex flex-col items-center justify-center text-center">
                            <Layers size={48} className="mb-4 text-stone-300 opacity-50" aria-hidden="true" />
                            <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak projektów w tym widoku</span>
                            <span className="text-xs text-stone-400 max-w-sm">Rozpocznij planowanie nowego wydarzenia, klikając przycisk "Nowy Projekt" powyżej.</span>
                        </GlassCard>
                    </motion.div>
                )}
            </div>

            <ProjectEditorPanel 
                isOpen={isPanelOpen}
                onClose={closePanel}
                project={editingProject}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            <ConfirmModal 
                isOpen={!!projectToDelete}
                title="Usunąć projekt?"
                description="Ta akcja jest nieodwracalna. Spowoduje usunięcie wszystkich powiązanych prób, przypisań ekipy i obsady dla tego projektu."
                onConfirm={executeDelete}
                onCancel={() => setProjectToDelete(null)}
                isLoading={isDeleting}
            />

        </div>
    );
}