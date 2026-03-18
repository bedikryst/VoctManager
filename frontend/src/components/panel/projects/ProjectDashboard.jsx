/**
 * @file ProjectDashboard.jsx
 * @description Master Controller and State Provider for the Event & Production Management module.
 * * @architecture
 * Implements the Provider Pattern (React Context API) to serve as a Single Source of Truth 
 * for all nested production tabs. Utilizes strict memoization (useMemo, useCallback) to 
 * prevent unnecessary re-renders across the deeply nested component tree.
 * * @module project/ProjectDashboard
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, createContext } from 'react';
import { useNavigate } from 'react-router-dom';

// Third-party libraries
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Briefcase, Users, ListOrdered, MicVocal, 
  X, Wrench, Banknote, Layers, Grid, ChevronDown, Calendar1 
} from 'lucide-react';

// Internal utilities & API
import api from '../../../utils/api';

// Components
import ProjectCard from './ProjectCard';
import DetailsTab from './tabs/DetailsTab';
import MicroCastingTab from './tabs/MicroCastingTab';
import RehearsalsTab from './tabs/RehearsalsTab';
import CastTab from './tabs/CastTab';
import ProgramTab from './tabs/ProgramTab';
import CrewTab from './tabs/CrewTab';
import BudgetTab from './tabs/BudgetTab';
import AttendanceMatrixTab from './tabs/AttendanceMatrixTab';

// Constants
const PROJECT_TABS = [
  { id: 'DETAILS', icon: <Briefcase size={14} />, label: 'Szczegóły' },
  { id: 'REHEARSALS', icon: <Calendar1 size={14} />, label: 'Terminarz Prób' },
  { id: 'MATRIX', icon: <Grid size={14} />, label: 'Obecności' }, 
  { id: 'CAST', icon: <Users size={14} />, label: 'Casting Główny' },
  { id: 'PROGRAM', icon: <ListOrdered size={14} />, label: 'Setlista' },
  { id: 'MICRO_CAST', icon: <MicVocal size={14} />, label: 'Mikro-Obsada' },
  { id: 'CREW', icon: <Wrench size={14} />, label: 'Logistyka' },
  { id: 'BUDGET', icon: <Banknote size={14} />, label: 'Budżet' }
];

const FILTER_OPTIONS = [
  { id: 'ACTIVE', label: 'W przygotowaniu' }, 
  { id: 'DONE', label: 'Archiwum' }, 
  { id: 'ALL', label: 'Wszystkie' }
];

export const ProjectDataContext = createContext(null);

const MemoizedProjectCard = React.memo(ProjectCard);

/**
 * ProjectDashboard Component
 * @returns {JSX.Element} The main dashboard view for projects.
 */
export default function ProjectDashboard() {
  // --- State: Domain Data ---
  const [projects, setProjects] = useState([]);
  const [rehearsals, setRehearsals] = useState([]); 
  const [pieces, setPieces] = useState([]); 
  const [voiceLines, setVoiceLines] = useState([]); 
  const [participations, setParticipations] = useState([]);
  const [crewAssignments, setCrewAssignments] = useState([]);
  const [artists, setArtists] = useState([]);
  const [crew, setCrew] = useState([]);
  const [pieceCastings, setPieceCastings] = useState([]); 

  // --- State: UI & Controls ---
  const [isLoading, setIsLoading] = useState(true);
  const [listFilter, setListFilter] = useState('ACTIVE'); 
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('DETAILS'); 
  const [editingProject, setEditingProject] = useState(null);
  const [isMobileTabMenuOpen, setIsMobileTabMenuOpen] = useState(false);

  const editingProjectRef = useRef(null);
  
  // Keep ref in sync with state for callbacks
  useEffect(() => { 
      editingProjectRef.current = editingProject; 
  }, [editingProject]);

  /**
   * Fetches all required global data for the dashboard.
   * @async
   */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const responses = await Promise.all([
        api.get('/api/projects/'),
        api.get('/api/rehearsals/'),
        api.get('/api/pieces/'),
        api.get('/api/options/voice-lines/'),
        api.get('/api/participations/'),
        api.get('/api/crew-assignments/'),
        api.get('/api/artists/'),
        api.get('/api/collaborators/'),
        api.get('/api/piece-castings/')
      ]);
      
      // Destructure responses and ensure arrays fallback to []
      const [
        projRes, rehRes, piecesRes, voiceRes, partRes, 
        crewAssignRes, artRes, crewRes, castRes
      ] = responses;

      setProjects(Array.isArray(projRes.data) ? projRes.data : []);
      setRehearsals(Array.isArray(rehRes.data) ? rehRes.data : []);
      setPieces(Array.isArray(piecesRes.data) ? piecesRes.data : []);
      setVoiceLines(Array.isArray(voiceRes.data) ? voiceRes.data : []);
      setParticipations(Array.isArray(partRes.data) ? partRes.data : []);
      setCrewAssignments(Array.isArray(crewAssignRes.data) ? crewAssignRes.data : []);
      setArtists(Array.isArray(artRes.data) ? artRes.data : []);
      setCrew(Array.isArray(crewRes.data) ? crewRes.data : []);
      setPieceCastings(Array.isArray(castRes.data) ? castRes.data : []);
    } catch (err) {
      console.error("[ProjectDashboard] Failed to fetch global data:", err);
      // TODO: Replace with enterprise toast notification (e.g., react-hot-toast)
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { 
      fetchData(); 
  }, [fetchData]);

  // Viewport Scroll Lock for modal overlay management
  useEffect(() => {
      document.body.style.overflow = isPanelOpen ? 'hidden' : '';
      return () => { document.body.style.overflow = ''; };
  }, [isPanelOpen]);

  /**
   * Opens the side panel for a specific project and tab.
   * @param {Object|null} project - The project to edit, or null for a new project.
   * @param {string} tab - The tab identifier to open.
   */
  const openPanel = useCallback((project = null, tab = 'DETAILS') => { 
    setEditingProject(project); 
    setActiveTab(tab); 
    setIsPanelOpen(true); 
  }, []);

  /**
   * Closes the side panel and resets editing state.
   */
  const closePanel = useCallback(() => { 
    setIsMobileTabMenuOpen(false); 
    setIsPanelOpen(false); 
    setTimeout(() => setEditingProject(null), 300); // Wait for exit animation
  }, []);

  /**
   * Handles hard deletion of a project.
   * @param {string|number} id - Project ID
   */
  const handleDelete = useCallback(async (id) => {
    // TODO: Replace window.confirm with a custom Dialog component
    if (!window.confirm("Czy na pewno chcesz bezpowrotnie usunąć ten projekt?")) return;
    
    try {
      await api.delete(`/api/projects/${id}/`);
      fetchData();
      if (editingProjectRef.current?.id === id) {
        closePanel();
      }
    } catch (err) { 
      console.error(`[ProjectDashboard] Failed to delete project ${id}:`, err);
      alert("Nie udało się usunąć projektu. Sprawdź powiązania w bazie danych."); 
    }
  }, [fetchData, closePanel]);

  // Context Provider Value Memoization
  const contextValue = useMemo(() => ({
    rehearsals, participations, crewAssignments, artists, crew, pieces, pieceCastings,
    openPanel, handleDelete, fetchGlobal: fetchData
  }), [rehearsals, participations, crewAssignments, artists, crew, pieces, pieceCastings, openPanel, handleDelete, fetchData]);

  // Derived state: Filtered and sorted projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const status = p.status || 'DRAFT';
      if (listFilter === 'ACTIVE') return status !== 'DONE' && status !== 'CANC';
      if (listFilter === 'DONE') return status === 'DONE' || status === 'CANC';
      return true;
    }).sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  }, [projects, listFilter]);

  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";

  return (
    <ProjectDataContext.Provider value={contextValue}>
      <div className="space-y-6 animate-fade-in relative cursor-default">
        
        {/* --- Header Section --- */}
        <header className="relative pt-2 mb-8">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                            <Briefcase size={12} className="text-[#002395]" />
                            <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                                Centrum Dowodzenia
                            </p>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                            Wydarzenia i <span className="italic text-[#002395]">Produkcja</span>.
                        </h1>
                    </div>
                    <button 
                      onClick={() => openPanel()} 
                      className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] hover:-translate-y-0.5 active:scale-95"
                    >
                        <Plus size={16} /> Nowy Projekt
                    </button>
                </div>
            </motion.div>
        </header>

        {/* --- Filters Section --- */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="inline-flex items-center p-1.5 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-xl overflow-x-auto max-w-full scrollbar-hide">
              {FILTER_OPTIONS.map(filter => (
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

        {/* --- Projects Grid --- */}
        <div className="grid grid-cols-1 gap-6">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2].map(i => <div key={i} className="h-32 bg-stone-100/50 rounded-2xl w-full border border-white/50"></div>)}
            </div>
          ) : filteredProjects.length > 0 ? (
            filteredProjects.map((project) => (
              <MemoizedProjectCard key={project.id} project={project} /> 
            ))
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${glassCardStyle} p-16 flex flex-col items-center justify-center text-center`}>
              <Layers size={48} className="mb-4 text-stone-300 opacity-50" />
              <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak projektów w tym widoku</span>
              <span className="text-xs text-stone-400 max-w-sm">Rozpocznij planowanie nowego wydarzenia, klikając przycisk powyżej.</span>
            </motion.div>
          )}
        </div>

        {/* --- Slide-over Panel --- */}
        <AnimatePresence>
          {isPanelOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={closePanel} 
                className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40" 
                aria-hidden="true"
              />
              
              <motion.div 
                initial={{ left: '100%' }} animate={{ left: 0 }} exit={{ left: '100%' }} 
                transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
                className="fixed inset-y-0 right-0 w-full bg-[#f4f2ee] shadow-2xl z-50 flex flex-col border-l border-white/60"
                role="dialog"
                aria-modal="true"
              >
                {/* Panel Header */}
                <div className="flex justify-between items-center px-6 md:px-10 pt-6 md:pt-10 pb-6 flex-shrink-0 z-20">
                  <div className="flex items-center gap-4">
                      <h3 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">
                        {editingProject ? editingProject.title : 'Kreator Nowego Wydarzenia'}
                      </h3>
                      {editingProject?.status === 'DONE' && (
                        <span className="px-2.5 py-1 bg-stone-200/50 text-stone-600 text-[9px] uppercase tracking-widest font-bold antialiased rounded-md border border-stone-200">
                          Archiwum
                        </span>
                      )}
                  </div>
                  <button 
                    onClick={closePanel} 
                    className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-3 rounded-2xl active:scale-95"
                    aria-label="Zamknij panel"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Panel Navigation */}
                {editingProject && (
                  <div className="flex-shrink-0 relative z-30 px-6 md:px-10 pb-6">
                    
                    {/* Mobile Menu */}
                    <div className="md:hidden">
                        <div className="relative">
                            <button 
                                onClick={() => setIsMobileTabMenuOpen(!isMobileTabMenuOpen)}
                                className="w-full flex items-center justify-between bg-white border border-stone-200 px-4 py-3.5 rounded-2xl shadow-sm hover:border-[#002395]/40 transition-colors"
                            >
                                <div className="flex items-center gap-2.5 text-[#002395] font-bold text-[10px] antialiased uppercase tracking-widest">
                                    {PROJECT_TABS.find(t => t.id === activeTab)?.icon}
                                    {PROJECT_TABS.find(t => t.id === activeTab)?.label}
                                </div>
                                <ChevronDown size={16} className={`text-stone-400 transition-transform duration-300 ${isMobileTabMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            <AnimatePresence>
                                {isMobileTabMenuOpen && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} 
                                        className="absolute left-0 right-0 top-[calc(100%+0.5rem)] bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
                                    >
                                        {PROJECT_TABS.map(tab => (
                                            <button 
                                                key={tab.id} 
                                                onClick={() => { setActiveTab(tab.id); setIsMobileTabMenuOpen(false); }} 
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
                        {PROJECT_TABS.map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id)} 
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

                {/* Panel Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:px-10 md:pb-10 relative">
                  <div className="max-w-6xl mx-auto">
                    {activeTab === 'DETAILS' && (
                      <DetailsTab 
                        project={editingProject} 
                        onSuccess={(updatedProject) => { 
                          setEditingProject(updatedProject); 
                          fetchData(); 
                        }} 
                      />
                    )}
                    {activeTab === 'REHEARSALS' && editingProject && <RehearsalsTab projectId={editingProject.id} />}
                    {activeTab === 'MATRIX' && editingProject && <AttendanceMatrixTab projectId={editingProject.id} />}
                    {activeTab === 'CAST' && editingProject && <CastTab projectId={editingProject.id} />}
                    {activeTab === 'PROGRAM' && editingProject && <ProgramTab projectId={editingProject.id} />}
                    {activeTab === 'MICRO_CAST' && editingProject && <MicroCastingTab projectId={editingProject.id} voiceLines={voiceLines} />}
                    {activeTab === 'CREW' && editingProject && <CrewTab projectId={editingProject.id} />}
                    {activeTab === 'BUDGET' && editingProject && <BudgetTab projectId={editingProject.id} />}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </ProjectDataContext.Provider>
  );
}