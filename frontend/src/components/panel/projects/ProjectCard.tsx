/**
 * @file ProjectCard.tsx
 * @description Expandable dashboard widget representing a single production project.
 * @architecture
 * Oczyszczony z narzutu Local Contextu. Deleguje pobieranie danych całkowicie
 * do dedykowanych hooków wewnątrz sub-widgetów (React Query).
 * @module project/ProjectCard
 * @author Krystian Bugalski
 */

import React, { useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient, useQueries } from '@tanstack/react-query'; // Zmieniono na queryClient
import { toast } from 'sonner';
import { 
  MapPin, ChevronDown, ChevronUp, ListOrdered, Edit2, 
  Trash2, Clock, AlignLeft, FileText, CheckCircle2, 
  ArchiveRestore, Download, Loader2, Briefcase
} from 'lucide-react';

import api from '../../../utils/api';
// Context zostaje TYLKO do UI (openPanel, handleDelete)
import { ProjectDataContext, IProjectDataContext } from './ProjectDashboard';

import type { Project } from '../../../types';

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
  // Pobieramy z Contextu TYLKO funkcje sterujące interfejsem
  const context = useContext(ProjectDataContext) as IProjectDataContext;
  const queryClient = useQueryClient();
  
  if (!context) {
    throw new Error("[ProjectCard] Must be used within a ProjectDataContext.Provider");
  }

  const { openPanel, handleDelete } = context;

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isRunSheetOpen, setIsRunSheetOpen] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const shouldFetch = isExpanded || index < 3;

  const results = useQueries({
    queries: [
      { 
        queryKey: ['rehearsals', project.id], 
        queryFn: async () => (await api.get(`/api/rehearsals/?project=${project.id}`)).data,
        staleTime: 1000 * 60 * 5, 
        enabled: shouldFetch 
      },
      { 
        queryKey: ['participations', project.id], 
        queryFn: async () => (await api.get(`/api/participations/?project=${project.id}`)).data,
        staleTime: 1000 * 60 * 5,
        enabled: shouldFetch
      },
      { 
        queryKey: ['crewAssignments', project.id], 
        queryFn: async () => (await api.get(`/api/crew-assignments/?project=${project.id}`)).data,
        staleTime: 1000 * 60 * 5,
        enabled: shouldFetch
      },
      { 
        queryKey: ['pieceCastings', project.id], 
        queryFn: async () => (await api.get(`/api/piece-castings/?project=${project.id}`)).data,
        staleTime: 1000 * 60 * 30,
        enabled: shouldFetch
      }
    ]
  });

  const localContextValue = React.useMemo<IProjectDataContext>(() => ({
    ...context,
    rehearsals: Array.isArray(results[0].data) ? results[0].data : [],
    participations: Array.isArray(results[1].data) ? results[1].data : [],
    crewAssignments: Array.isArray(results[2].data) ? results[2].data : [],
    pieceCastings: Array.isArray(results[3].data) ? results[3].data : [],
  }), [context, results]);

  const isDone: boolean = project.status === 'DONE';

  const toggleLifecycleStatus = async (e: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.stopPropagation();
    const newStatus = isDone ? 'ACTIVE' : 'DONE';
    const toastId = toast.loading("Aktualizowanie statusu projektu...");
    
    try {
      await api.patch(`/api/projects/${project.id}/`, { status: newStatus });
      
      // ZAMIAST fetchGlobal() -> inwalidujemy klucz projektów (zależnie jak je nazwiesz w Dashboardzie)
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      toast.success(
        `Projekt oznaczony jako ${newStatus === 'DONE' ? 'Zrealizowany' : 'W przygotowaniu'}`, 
        { id: toastId }
      );
    } catch (err) {
      console.error(`[ProjectCard] Failed to toggle status for ${project.id}:`, err);
      toast.error("Błąd serwera", { 
        id: toastId, 
        description: "Nie udało się zmienić statusu projektu. Spróbuj ponownie." 
      });
    }
  };

  const handleDownloadReport = async (
    e: React.MouseEvent<HTMLButtonElement>, 
    endpoint: string, 
    defaultFilename: string, 
    loaderKey: string
  ): Promise<void> => {
    e.stopPropagation();
    setIsDownloading(loaderKey); 
    const toastId = toast.loading(`Trwa generowanie dokumentu...`);

    try {
        const response = await api.get(`/api/projects/${project.id}/${endpoint}/`, { responseType: 'blob' });
        const disposition = response.headers['content-disposition'];
        let filename = defaultFilename;
        
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        const blob = new Blob([response.data], { type: response.headers['content-type'] });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        
        link.remove();
        window.URL.revokeObjectURL(url);
        
        toast.success("Dokument pobrany pomyślnie", { id: toastId });
    } catch (err) {
        console.error(`[ProjectCard] Document streaming failed for ${endpoint}:`, err);
        toast.error("Błąd generowania", { 
          id: toastId, 
          description: "Nie udało się utworzyć dokumentu z powodu błędu serwera." 
        });
    } finally {
        setIsDownloading(null); 
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

        <div 
          className={`p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 cursor-pointer relative z-10 transition-colors ${!isDone && 'hover:bg-white/40'}`}
          onClick={() => setIsExpanded(!isExpanded)}
          role="button"
          aria-expanded={isExpanded}
        >
          <div className="flex items-start gap-4 md:gap-6">
            <div className={`w-16 h-16 rounded-2xl border flex flex-col items-center justify-center flex-shrink-0 shadow-sm ${isDone ? 'bg-stone-200/50 border-stone-300/50 text-stone-500' : 'bg-white border-stone-100 text-[#002395]'}`}>
              <span className="text-[10px] font-bold antialiased uppercase tracking-widest">
                {new Date(project.date_time).toLocaleString('pl-PL', { month: 'short' })}
              </span>
              <span className="text-2xl font-bold leading-none my-0.5">
                {new Date(project.date_time).getDate()}
              </span>
              <span className="text-[9px] font-bold antialiased opacity-75">
                {new Date(project.date_time).toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <div>
              <h3 className="text-xl md:text-3xl font-bold text-stone-900 mb-1.5 flex items-center gap-3 tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                  {project.title}
                  {isDone && <span className="px-2 py-0.5 bg-stone-200 text-stone-600 text-[9px] font-sans uppercase tracking-widest font-bold antialiased rounded-md border border-stone-300">Zakończono</span>}
              </h3>
              
              <div className="flex flex-wrap gap-y-2 gap-x-4 mt-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
                {project.location && (
                    <a 
                      href={`https://maps.google.com/?q=$${encodeURIComponent(project.location)}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-1.5 hover:text-[#002395] transition-colors" 
                      title="Otwórz w Google Maps"
                      onClick={(e) => e.stopPropagation()} 
                    >
                        <MapPin size={14} className="opacity-75"/> 
                        <span className="underline decoration-stone-300 underline-offset-4">{project.location}</span>
                    </a>
                )}
                {project.call_time && (
                  <span className="flex items-center gap-1.5 text-orange-600">
                    <Clock size={14} /> 
                    Zbiórka: {new Date(project.call_time).toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden lg:flex items-center gap-2.5 mr-2">
              <button 
                disabled={isDownloading !== null}
                onClick={(e) => handleDownloadReport(e, 'export_call_sheet', `CallSheet_${project.title}.pdf`, 'CALL_SHEET')} 
                className="px-3.5 py-2 bg-white border border-stone-200/80 text-stone-600 hover:text-[#002395] hover:border-[#002395]/40 disabled:opacity-50 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95"
              >
                  {isDownloading === 'CALL_SHEET' ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>} 
                  {isDownloading === 'CALL_SHEET' ? 'Generowanie...' : 'Call Sheet'}
              </button>
              <button 
                disabled={isDownloading !== null}
                onClick={(e) => handleDownloadReport(e, 'export_zaiks', `ZAiKS_${project.title}.csv`, 'ZAIKS')} 
                className="px-3.5 py-2 bg-white border border-stone-200/80 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-50 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95"
              >
                  {isDownloading === 'ZAIKS' ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>} 
                  ZAiKS (CSV)
              </button>
              <button 
                disabled={isDownloading !== null}
                onClick={(e) => handleDownloadReport(e, 'export_dtp', `DTP_${project.title}.txt`, 'DTP')} 
                className="px-3.5 py-2 bg-white border border-stone-200/80 text-purple-700 hover:bg-purple-50 hover:border-purple-300 disabled:opacity-50 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95"
              >
                  {isDownloading === 'DTP' ? <Loader2 size={14} className="animate-spin"/> : <AlignLeft size={14}/>} 
                  Skład DTP
              </button>

              <button 
                onClick={toggleLifecycleStatus} 
                className={`px-3.5 py-2 border text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95 ${isDone ? 'bg-stone-800 text-white border-stone-900 hover:bg-stone-700' : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'}`}
              >
                  {isDone ? <><ArchiveRestore size={14}/> Przywróć</> : <><CheckCircle2 size={14}/> Zrealizowany</>}
              </button>
            </div>
            
            <div className="text-stone-400 bg-white shadow-sm p-2 rounded-full border border-stone-100 transition-transform duration-300">
                {isExpanded ? <ChevronUp size={20} className="text-[#002395]" /> : <ChevronDown size={20} />}
            </div>
            
            <div className="flex items-center gap-2 border-l border-stone-200/60 pl-5">
                <button 
                  onClick={(e) => { e.stopPropagation(); openPanel(project, 'DETAILS'); }} 
                  className="p-2.5 bg-white border border-stone-200/80 text-stone-600 hover:text-[#002395] hover:border-[#002395]/40 rounded-xl transition-colors shadow-sm"
                  aria-label="Edytuj projekt"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }} 
                  className="p-2.5 bg-white border border-stone-200/80 text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl transition-colors shadow-sm"
                  aria-label="Usuń projekt"
                >
                  <Trash2 size={16} />
                </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }} 
              className="bg-stone-50/40 border-t border-white/60 overflow-hidden cursor-default relative z-0"
            >
              <div className="p-5 md:p-6 space-y-6">
                
                <div className="flex lg:hidden gap-2 border-b border-stone-200/60 pb-5 overflow-x-auto scrollbar-hide">
                  <button onClick={(e) => handleDownloadReport(e, 'export_call_sheet', `CallSheet_${project.title}.pdf`, 'CALL_SHEET_MOB')} className="px-4 py-2.5 bg-white border border-stone-200/80 text-stone-600 text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl flex justify-center items-center gap-2 shadow-sm whitespace-nowrap">
                    {isDownloading === 'CALL_SHEET_MOB' ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>} Call Sheet
                  </button>
                  <button onClick={(e) => handleDownloadReport(e, 'export_zaiks', `ZAiKS_${project.title}.csv`, 'ZAIKS_MOB')} className="px-4 py-2.5 bg-white border border-stone-200/80 text-emerald-700 text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl flex justify-center items-center gap-2 shadow-sm whitespace-nowrap">
                    {isDownloading === 'ZAIKS_MOB' ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>} ZAiKS
                  </button>
                  <button onClick={(e) => handleDownloadReport(e, 'export_dtp', `DTP_${project.title}.txt`, 'DTP_MOB')} className="px-4 py-2.5 bg-white border border-stone-200/80 text-purple-700 text-[10px] font-bold antialiased uppercase tracking-widest rounded-xl flex justify-center items-center gap-2 shadow-sm whitespace-nowrap">
                    {isDownloading === 'DTP_MOB' ? <Loader2 size={14} className="animate-spin"/> : <AlignLeft size={14}/>} Skład DTP
                  </button>
                </div>

                <div className="bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-5 cursor-pointer hover:bg-stone-50/50 transition-colors" onClick={() => setIsRunSheetOpen(!isRunSheetOpen)}>
                    <h4 className="flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
                      <ListOrdered size={16} className="text-[#002395]"/> Harmonogram Wydarzenia (Run-sheet)
                    </h4>
                    <div className="flex items-center gap-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openPanel(project, 'DETAILS'); }} 
                          className="text-[10px] uppercase font-bold antialiased tracking-widest text-[#002395] hover:underline"
                        >
                          Edytuj w panelu
                        </button>
                        <div className="text-stone-400 bg-stone-100 p-1.5 rounded-full">
                          {isRunSheetOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </div>
                    </div>
                  </div>
                  
                  <AnimatePresence>
                      {isRunSheetOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-stone-100">
                              <div className="p-5 bg-stone-50/30">
                                  {project.run_sheet && project.run_sheet.length > 0 ? (
                                      <div className="relative pl-5 border-l-2 border-stone-200 space-y-5 ml-2">
                                          {[...project.run_sheet].sort((a,b) => a.time.localeCompare(b.time)).map((item, idx) => (
                                              <div key={item.id || idx} className="relative">
                                                  <div className="absolute -left-[27px] top-1 w-4 h-4 bg-white border-[3px] border-[#002395] rounded-full shadow-sm"></div>
                                                  <div className="flex flex-col gap-1">
                                                      <span className="text-[10px] font-bold antialiased text-[#002395] bg-blue-50 self-start px-2 py-0.5 rounded-md border border-blue-100/50">{item.time}</span>
                                                      <div>
                                                          <p className="text-sm font-bold text-stone-800">{item.title}</p>
                                                          {item.description && <p className="text-xs text-stone-500 italic mt-1 leading-relaxed">{item.description}</p>}
                                                      </div>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  ) : (
                                      <div>
                                          {project.description ? (
                                              <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{project.description}</p>
                                          ) : <p className="text-xs text-stone-400 italic text-center py-6 border border-dashed border-stone-200 rounded-xl bg-white">Brak szczegółowego planu dla tego wydarzenia.</p>}
                                      </div>
                                  )}
                              </div>
                          </motion.div>
                      )}
                  </AnimatePresence>
                </div>

                {/* Sub-widgets - one same pobiorą sobie dane przez nowego hooka */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <RehearsalsWidget project={project} />
                  <CastWidget project={project} />
                  <ProgramWidget project={project} />
                  <CrewWidget project={project} />
                  <BudgetWidget project={project} />
                </div>
                
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ProjectDataContext.Provider>
  );
}