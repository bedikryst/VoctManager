/**
 * @file ProjectEditorPanel.tsx
 * @description Slide-over panel for editing deep project details and production logistics.
 * @architecture
 * Fully encapsulates complex UI states (mobile tabs, slide animations) keeping the parent clean.
 * Lazy-loads content tabs based on the active selection.
 * @module project/ProjectEditorPanel
 * @author Krystian Bugalski
 */

import React, { useState, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Briefcase, Calendar1, Grid, Users, 
  ListOrdered, MicVocal, Wrench, Banknote, ChevronDown 
} from 'lucide-react';

// Context & Types
import { ProjectDataContext, IProjectDataContext } from './ProjectDashboard';
import type { Project, VoiceLineOption } from '../../../types';

// Tab Components
import DetailsTab from './tabs/DetailsTab';
import MicroCastingTab from './tabs/MicroCastingTab';
import RehearsalsTab from './tabs/RehearsalsTab';
import CastTab from './tabs/CastTab';
import ProgramTab from './tabs/ProgramTab';
import CrewTab from './tabs/CrewTab';
import BudgetTab from './tabs/BudgetTab';
import AttendanceMatrixTab from './tabs/AttendanceMatrixTab';

// --- Static Configurations ---
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
  voiceLinesData: VoiceLineOption[]; 
}

/**
 * ProjectEditorPanel Component
 * @param {ProjectEditorPanelProps} props
 * @returns {React.JSX.Element}
 */
export default function ProjectEditorPanel({ 
  isOpen, onClose, project, activeTab, onTabChange, voiceLinesData
}: ProjectEditorPanelProps): React.JSX.Element | null {
  const context = useContext(ProjectDataContext) as IProjectDataContext;
  const [isMobileTabMenuOpen, setIsMobileTabMenuOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  // Upewniamy się, że portal renderuje się tylko po stronie klienta
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!context || !mounted) return null;

  const handleTabSelect = (tabId: string) => {
    onTabChange(tabId);
    setIsMobileTabMenuOpen(false);
  };

  // OWINĘLIŚMY CAŁY ZWRACANY KOD W createPortal:
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-[90]" 
            aria-hidden="true"
          />
          
          {/* Slide-out Panel */}
          <motion.div 
            initial={{ left: '100%' }} animate={{ left: 0 }} exit={{ left: '100%' }} 
            transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
            className="fixed inset-y-0 right-0 w-full bg-[#f4f2ee] shadow-2xl z-[100] flex flex-col border-l border-white/60"
            role="dialog" aria-modal="true" aria-labelledby="panel-title"
          >
            {/* 1. Panel Header */}
            <div className="flex justify-between items-center px-6 md:px-10 pt-6 md:pt-10 pb-6 flex-shrink-0 z-20">
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
                className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-3 rounded-2xl active:scale-95"
                aria-label="Zamknij panel"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {/* 2. Panel Navigation (Tabs) - Visible only if editing an existing project */}
            {project && (
              <div className="flex-shrink-0 relative z-30 px-6 md:px-10 pb-6">
                
                {/* Mobile Menu */}
                <div className="md:hidden">
                    <div className="relative">
                        <button 
                            onClick={() => setIsMobileTabMenuOpen(!isMobileTabMenuOpen)}
                            className="w-full flex items-center justify-between bg-white border border-stone-200 px-4 py-3.5 rounded-2xl shadow-sm hover:border-[#002395]/40 transition-colors"
                        >
                            <div className="flex items-center gap-2.5 text-[#002395] font-bold text-[10px] antialiased uppercase tracking-widest">
                                {PROJECT_TABS.find((t) => t.id === activeTab)?.icon}
                                {PROJECT_TABS.find((t) => t.id === activeTab)?.label}
                            </div>
                            <ChevronDown size={16} className={`text-stone-400 transition-transform duration-300 ${isMobileTabMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                        
                        <AnimatePresence>
                            {isMobileTabMenuOpen && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} 
                                    className="absolute left-0 right-0 top-[calc(100%+0.5rem)] bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden z-[100] flex flex-col"
                                >
                                    {PROJECT_TABS.map((tab) => (
                                        <button 
                                            key={tab.id} 
                                            onClick={() => handleTabSelect(tab.id)} 
                                            className={`w-full flex items-center gap-3 px-5 py-4 text-[10px] font-bold antialiased uppercase tracking-widest border-b border-stone-100 last:border-0 transition-colors ${activeTab === tab.id ? 'bg-blue-50 text-[#002395]' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900'}`}
                                        >
                                            {tab.icon} {tab.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Desktop Menu */}
                <div className="hidden md:flex overflow-x-auto scrollbar-hide">
                    <div className="inline-flex items-center p-1.5 bg-stone-200/40 backdrop-blur-xl border border-stone-200/60 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                    {PROJECT_TABS.map((tab) => (
                    <button 
                        key={tab.id} 
                        onClick={() => handleTabSelect(tab.id)} 
                        className={`px-5 py-2.5 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
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
              </div>
            )}
            {/* 3. Panel Content Area (Routing simulation) */}
            <div className="flex-1 overflow-y-auto p-4 md:px-10 md:pb-10 relative">
              <div className="max-w-6xl mx-auto">
                {activeTab === 'DETAILS' && (
                  <DetailsTab 
                    project={project} 
                    onSuccess={() => {}} 
                  />
                )}
                {activeTab === 'REHEARSALS' && project && <RehearsalsTab projectId={project.id} />}
                {activeTab === 'MATRIX' && project && <AttendanceMatrixTab projectId={project.id} />}
                {activeTab === 'CAST' && project && <CastTab projectId={project.id} />}
                {activeTab === 'PROGRAM' && project && <ProgramTab projectId={project.id} />}
                {activeTab === 'MICRO_CAST' && project && <MicroCastingTab projectId={project.id} voiceLines={voiceLinesData} />}
                {activeTab === 'CREW' && project && <CrewTab projectId={project.id} />}
                {activeTab === 'BUDGET' && project && <BudgetTab projectId={project.id} />}
              </div>
            </div>
            
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}