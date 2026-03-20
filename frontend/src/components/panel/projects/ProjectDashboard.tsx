/**
 * @file ProjectDashboard.tsx
 * @description Master Controller and State Provider for the Event & Production Management module.
 * @architecture
 * ENTERPRISE UPGRADE 2026: "God Fetch" Eliminated. 
 * Global Context now ONLY supplies lightweight dictionaries (Artists, Pieces) with Infinity Cache.
 * Heavy relational data is deferred strictly to isolated child queries.
 * @module project/ProjectDashboard
 * @author Krystian Bugalski
 */

import React, { useState, useCallback, useMemo, useRef, useEffect, createContext } from 'react';
import { motion } from 'framer-motion';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Briefcase, Layers } from 'lucide-react';

import api from '../../../utils/api';

// Child Components
import ProjectCard from './ProjectCard';
import ProjectEditorPanel from './ProjectEditorPanel';
import ConfirmModal from '../../../components/ui/ConfirmModal';

// Type Definitions
import type { 
  Project, Rehearsal, Piece, Participation, 
  CrewAssignment, Artist, Collaborator, PieceCasting 
} from '../../../types';

export interface IProjectDataContext {
  // Puste tablice zostawione celowo dla kompatybilności wstecznej (dla Widgetów)
  rehearsals: Rehearsal[];
  participations: Participation[];
  crewAssignments: CrewAssignment[];
  pieceCastings: PieceCasting[];
  
  // Słowniki (Zawsze dostępne w RAM)
  artists: Artist[];
  crew: Collaborator[];
  pieces: Piece[];
  
  openPanel: (project?: Project | null, tab?: string) => void;
  handleDelete: (id: string) => void;
  // USUNIĘTO: fetchGlobal (nie jest już potrzebne w architekturze React Query)
}

export const ProjectDataContext = createContext<IProjectDataContext | null>(null);
const MemoizedProjectCard = React.memo(ProjectCard);

// --- Static Configuration & Styles ---
type FilterStatus = 'ACTIVE' | 'DONE' | 'ALL';
interface FilterOption { id: FilterStatus; label: string; }

const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
const FILTER_OPTIONS: FilterOption[] = [
  { id: 'ACTIVE', label: 'W przygotowaniu' }, 
  { id: 'DONE', label: 'Archiwum' }, 
  { id: 'ALL', label: 'Wszystkie' }
];

export default function ProjectDashboard(): React.JSX.Element {
  const queryClient = useQueryClient();

  const [listFilter, setListFilter] = useState<FilterStatus>('ACTIVE'); 
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('DETAILS'); 
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const editingProjectRef = useRef<Project | null>(null);
  
  useEffect(() => { editingProjectRef.current = editingProject; }, [editingProject]);

  // ==========================================
  // ENTERPRISE UPGRADE: Dictionary-Only Fetching
  // ==========================================
  const results = useQueries({
    queries: [
      { queryKey: ['projects'], queryFn: async () => (await api.get('/api/projects/')).data },
      { queryKey: ['pieces'], queryFn: async () => (await api.get('/api/pieces/')).data, staleTime: Infinity },
      { queryKey: ['voiceLines'], queryFn: async () => (await api.get('/api/options/voice-lines/')).data, staleTime: Infinity },
      { queryKey: ['artists'], queryFn: async () => (await api.get('/api/artists/')).data, staleTime: Infinity },
      { queryKey: ['collaborators'], queryFn: async () => (await api.get('/api/collaborators/')).data, staleTime: Infinity },
    ]
  });

  const isLoading = results.some((query) => query.isLoading);
  const isError = results.some((query) => query.isError);

  const data = useMemo(() => ({
    projects: Array.isArray(results[0].data) ? results[0].data : [],
    pieces: Array.isArray(results[1].data) ? results[1].data : [],
    voiceLines: Array.isArray(results[2].data) ? results[2].data : [],
    artists: Array.isArray(results[3].data) ? results[3].data : [],
    crew: Array.isArray(results[4].data) ? results[4].data : [],
  }), [results]);

  useEffect(() => {
    if (isError) {
      toast.error("Błąd synchronizacji", { description: "Słowniki nie zostały pobrane poprawnie." });
    }
  }, [isError]);

  useEffect(() => {
      document.body.style.overflow = isPanelOpen || projectToDelete ? 'hidden' : '';
      return () => { document.body.style.overflow = ''; };
  }, [isPanelOpen, projectToDelete]);

  const openPanel = useCallback((project: Project | null = null, tab: string = 'DETAILS'): void => { 
    setEditingProject(project); 
    setActiveTab(tab); 
    setIsPanelOpen(true); 
  }, []);

  const closePanel = useCallback((): void => { 
    setIsPanelOpen(false); 
    setTimeout(() => setEditingProject(null), 300);
  }, []);

  const handleDelete = useCallback((id: string): void => {
    setProjectToDelete(id);
  }, []);

  const executeDelete = useCallback(async (): Promise<void> => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading("Usuwanie projektu...");
    try {
      await api.delete(`/api/projects/${projectToDelete}/`);
      
      // ZAMIAST fetchGlobal() odświeżamy bezpośrednio przez queryClient:
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      toast.success("Projekt usunięty pomyślnie", { id: toastId });
      if (editingProjectRef.current?.id === projectToDelete) closePanel();
    } catch (err) { 
      toast.error("Błąd usuwania", { id: toastId, description: "Sprawdź powiązania projektu w bazie danych." });
    } finally {
      setIsDeleting(false);
      setProjectToDelete(null);
    }
  }, [projectToDelete, queryClient, closePanel]);

  // ==========================================
  // CONTEXT PROVIDER (God Fetch Removed)
  // ==========================================
  const contextValue = useMemo<IProjectDataContext>(() => ({
    rehearsals: [], 
    participations: [], 
    crewAssignments: [], 
    pieceCastings: [], 
    pieces: data.pieces, 
    artists: data.artists, 
    crew: data.crew, 
    openPanel, 
    handleDelete
  }), [data, openPanel, handleDelete]);

  const filteredProjects = useMemo<Project[]>(() => {
    if (!data.projects) return [];
    return data.projects.filter((p: Project) => {
      const status = p.status || 'DRAFT';
      if (listFilter === 'ACTIVE') return status !== 'DONE' && status !== 'CANC';
      if (listFilter === 'DONE') return status === 'DONE' || status === 'CANC';
      return true;
    }).sort((a: Project, b: Project) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  }, [data.projects, listFilter]);

  return (
    <ProjectDataContext.Provider value={contextValue}>
      <div className="space-y-6 animate-fade-in relative cursor-default">
        {/* Header Section */}
        <header className="relative pt-2 mb-8">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                            <Briefcase size={12} className="text-[#002395]" aria-hidden="true" />
                            <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                                Centrum Dowodzenia
                            </p>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                            Wydarzenia i <span className="italic text-[#002395]">Produkcja</span>.
                        </h1>
                    </div>
                    <button 
                      onClick={() => openPanel(null)} 
                      className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] hover:-translate-y-0.5 active:scale-95"
                    >
                        <Plus size={16} aria-hidden="true" /> Nowy Projekt
                    </button>
                </div>
            </motion.div>
        </header>

        {/* Filters Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
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

        {/* Projects Grid View */}
        <div className="grid grid-cols-1 gap-6">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2].map((i) => <div key={i} className="h-32 bg-stone-100/50 rounded-2xl w-full border border-white/50"></div>)}
            </div>
          ) : filteredProjects.length > 0 ? (
            filteredProjects.map((project, idx) => (
              <MemoizedProjectCard key={project.id} project={project} index={idx} /> 
            ))
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${STYLE_GLASS_CARD} p-16 flex flex-col items-center justify-center text-center`}>
              <Layers size={48} className="mb-4 text-stone-300 opacity-50" aria-hidden="true" />
              <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak projektów w tym widoku</span>
              <span className="text-xs text-stone-400 max-w-sm">Rozpocznij planowanie nowego wydarzenia, klikając przycisk powyżej.</span>
            </motion.div>
          )}
        </div>

        <ProjectEditorPanel 
          isOpen={isPanelOpen}
          onClose={closePanel}
          project={editingProject}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          voiceLinesData={data.voiceLines}
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
    </ProjectDataContext.Provider>
  );
}