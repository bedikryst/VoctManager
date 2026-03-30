/**
 * @file ProjectCard.tsx
 * @description Main orchestrator component for the expandable Project Card. 
 * @architecture
 * Implements the "Container/Presenter" pattern with Enterprise Bento-Box Layout.
 * Strictly divides UX into "Artistic" (Conductor focus) and "Production" (Manager focus) zones.
 * @module project/ProjectCard
 * @author Krystian Bugalski
 */

import React, { useState, useContext, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient, useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Briefcase, Music, Wrench } from 'lucide-react';

import api from '../../../../utils/api';
import { ProjectDataContext, IProjectDataContext } from '../ProjectDashboard';
import type { Project } from '../../../../types';

import ProjectCardHeader from './ProjectCardHeader'; 
import ProjectCardDetails from './ProjectCardDetails';
import SpotifyWidget from './SpotifyWidget';
import RunSheetWidget from './RunSheetWidget';
import RehearsalsWidget from './widgets/RehearsalsWidget';
import CastWidget from './widgets/CastWidget';
import ProgramWidget from './widgets/ProgramWidget';
import CrewWidget from './widgets/CrewWidget';
import BudgetWidget from './widgets/BudgetWidget';

const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)] hover:border-[#002395]/20 hover:-translate-y-0.5";
const STYLE_DISABLED = "bg-stone-50/50 border-stone-200/60 rounded-2xl opacity-75 grayscale hover:grayscale-0";

interface ProjectCardProps {
  project: Project;
  index: number;
}

export default function ProjectCard({ project, index }: ProjectCardProps): React.JSX.Element {
  const context = useContext(ProjectDataContext) as IProjectDataContext;
  const queryClient = useQueryClient();
  
  if (!context) throw new Error("[ProjectCard] Must be used within a ProjectDataContext.Provider");

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const shouldFetch = isExpanded || index < 3;
  const isDone = project.status === 'DONE';

  const results = useQueries({
    queries: [
      { queryKey: ['rehearsals', project.id], queryFn: async () => (await api.get(`/api/rehearsals/?project=${project.id}`)).data, staleTime: 300000, enabled: shouldFetch },
      { queryKey: ['participations', project.id], queryFn: async () => (await api.get(`/api/participations/?project=${project.id}`)).data, staleTime: 300000, enabled: shouldFetch },
      { queryKey: ['crewAssignments', project.id], queryFn: async () => (await api.get(`/api/crew-assignments/?project=${project.id}`)).data, staleTime: 300000, enabled: shouldFetch },
      { queryKey: ['pieceCastings', project.id], queryFn: async () => (await api.get(`/api/piece-castings/?participation__project=${project.id}`)).data, staleTime: 1800000, enabled: shouldFetch }
    ]
  });

  const localContextValue = useMemo<IProjectDataContext>(() => ({
    ...context,
    rehearsals: Array.isArray(results[0].data) ? results[0].data : [],
    participations: Array.isArray(results[1].data) ? results[1].data : [],
    crewAssignments: Array.isArray(results[2].data) ? results[2].data : [],
    pieceCastings: Array.isArray(results[3].data) ? results[3].data : [],
  }), [context, results[0].data, results[1].data, results[2].data, results[3].data]);

  const toggleLifecycleStatus = async (e: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.stopPropagation();
    const newStatus = isDone ? 'ACTIVE' : 'DONE';
    const toastId = toast.loading("Aktualizowanie statusu...");
    try {
      await api.patch(`/api/projects/${project.id}/`, { status: newStatus });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`Projekt oznaczony jako ${newStatus === 'DONE' ? 'Zrealizowany' : 'W przygotowaniu'}`, { id: toastId });
    } catch (err) {
      toast.error("Błąd serwera", { id: toastId, description: "Nie udało się zmienić statusu." });
    }
  };

  return (
    <ProjectDataContext.Provider value={localContextValue}>
      <div className={`relative transition-all duration-300 overflow-hidden group ${isDone ? STYLE_DISABLED : STYLE_GLASS_CARD}`}>
        
        {!isDone && (
            <div className="absolute -right-8 -top-8 text-[#002395] opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                <Briefcase size={200} strokeWidth={1} aria-hidden="true" />
            </div>
        )}

        <ProjectCardHeader 
          project={project}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          onStatusToggle={toggleLifecycleStatus}
        />

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }} 
              className="bg-stone-50/40 border-t border-white/60 overflow-hidden cursor-default relative z-0"
            >
              <div className="p-5 md:p-8 space-y-10">
                
                {/* STREFA ARTYSTYCZNA (Priorytet Dyrygenta) */}
                <div className="space-y-4">
                  <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395]">
                    <Music size={14} /> Pulpit Artystyczny
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Wiersz 1: Próby (Duże) i Program (Mniejsze) */}
                    <div className="lg:col-span-2">
                        <RehearsalsWidget project={project} />
                    </div>
                    <div className="lg:col-span-1">
                        <ProgramWidget project={project} />
                    </div>
                    {/* Wiersz 2: Obsada i Playlista Spotify */}
                    <div className="lg:col-span-2">
                        <CastWidget project={project} />
                    </div>
                    <div className="lg:col-span-1">
                        <SpotifyWidget playlistUrl={project.spotify_playlist_url} />
                    </div>
                  </div>
                </div>

                {/* STREFA PRODUKCYJNA (Priorytet Menedżera) */}
                <div className="space-y-4 pt-6 border-t border-stone-200/50">
                  <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
                    <Wrench size={14} /> Logistyka i Produkcja
                  </h4>
                  
                  {/* Wiersz 1: Idealne 50/50 Harmonogram i Szczegóły */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="flex flex-col h-full">
                        <RunSheetWidget project={project} />
                    </div>
                    <div className="flex flex-col h-full gap-6">
                        <ProjectCardDetails project={project} />
                    </div>
                  </div>

                  {/* Wiersz 2: Budżet i Ekipa techniczna */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                    <div className="lg:col-span-2">
                        <BudgetWidget project={project} />
                    </div>
                    <div className="lg:col-span-1">
                        <CrewWidget project={project} />
                    </div>
                  </div>
                </div>
                
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ProjectDataContext.Provider>
  );
}