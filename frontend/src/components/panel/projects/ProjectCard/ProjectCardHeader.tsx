/**
 * @file ProjectCardHeader.tsx
 * @description Renders the compact, scannable header for a project card.
 * @module project/ProjectCard/components
 */

import React, { useMemo, useContext } from 'react';
import { MapPin, ChevronDown, ChevronUp, Clock, FileText, CheckCircle2, ArchiveRestore, Download, Loader2, AlignLeft, Edit2, Trash2 } from 'lucide-react';
import type { Project } from '../../../../types';
import { ProjectDataContext, IProjectDataContext } from '../ProjectDashboard';
import { useProjectExport } from './hooks/useDirectDownload';

interface ProjectCardHeaderProps {
  project: Project;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusToggle: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
}

export default function ProjectCardHeader({ 
  project, isExpanded, onToggle, onStatusToggle 
}: ProjectCardHeaderProps): React.JSX.Element {
  const { openPanel, handleDelete } = useContext(ProjectDataContext) as IProjectDataContext;
  const { downloadReport, isDownloading } = useProjectExport(project.id);
  const isDone = project.status === 'DONE';

  const projectDate = useMemo(() => new Date(project.date_time), [project.date_time]);
  const callTimeDate = useMemo(() => project.call_time ? new Date(project.call_time) : null, [project.call_time]);

  // ENTERPRISE FIX: Corrected Google Maps API Search Link
  const googleMapsUrl = useMemo(() => {
    return project.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.location)}` : null;
  }, [project.location]);

  return (
    <div 
      className={`p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 cursor-pointer relative z-10 transition-colors ${!isDone && 'hover:bg-white/40'}`}
      onClick={onToggle}
      role="button"
      aria-expanded={isExpanded}
    >
      <div className="flex items-start gap-4 md:gap-6 w-full md:w-auto">
        
        <div className={`w-16 h-16 rounded-2xl border flex flex-col items-center justify-center flex-shrink-0 shadow-sm ${isDone ? 'bg-stone-200/50 border-stone-300/50 text-stone-500' : 'bg-white border-stone-100 text-[#002395]'}`}>
          <span className="text-[10px] font-bold antialiased uppercase tracking-widest">
            {projectDate.toLocaleString('pl-PL', { month: 'short' })}
          </span>
          <span className="text-2xl font-bold leading-none my-0.5">
            {projectDate.getDate()}
          </span>
          <span className="text-[9px] font-bold antialiased opacity-75">
            {projectDate.toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-xl md:text-3xl font-bold text-stone-900 mb-1.5 flex flex-wrap items-center gap-3 tracking-tight leading-none" style={{ fontFamily: "'Cormorant', serif" }}>
            <span className="truncate">{project.title}</span>
            {isDone && <span className="px-2 py-0.5 bg-stone-200 text-stone-600 text-[9px] font-sans uppercase tracking-widest font-bold antialiased rounded-md border border-stone-300 whitespace-nowrap">Archiwum</span>}
          </h3>
          
          <div className="flex flex-wrap gap-y-2 gap-x-4 mt-2.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
            {googleMapsUrl && (
              <a 
                href={googleMapsUrl} target="_blank" rel="noopener noreferrer" 
                className="flex items-center gap-1.5 hover:text-[#002395] transition-colors truncate" 
                title="Otwórz w Google Maps" onClick={(e) => e.stopPropagation()} 
              >
                <MapPin size={14} className="opacity-75 flex-shrink-0"/> 
                <span className="underline decoration-stone-300 underline-offset-4 truncate">{project.location}</span>
              </a>
            )}
            {callTimeDate && (
              <span className="flex items-center gap-1.5 text-orange-600 whitespace-nowrap">
                <Clock size={14} /> Call Time: {callTimeDate.toLocaleString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between md:justify-end gap-5 w-full md:w-auto mt-2 md:mt-0">
        <div className="hidden xl:flex items-center gap-2.5 mr-2">
          <button disabled={isDownloading !== null} onClick={(e) => { e.stopPropagation(); downloadReport('export_call_sheet', `CallSheet_${project.title}.pdf`, 'CALL_SHEET'); }} className="px-3.5 py-2 bg-white border border-stone-200/80 text-stone-600 hover:text-[#002395] hover:border-[#002395]/40 disabled:opacity-50 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95">
            {isDownloading === 'CALL_SHEET' ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>} Call Sheet
          </button>
          <button disabled={isDownloading !== null} onClick={(e) => { e.stopPropagation(); downloadReport('export_zaiks', `ZAiKS_${project.title}.csv`, 'ZAIKS'); }} className="px-3.5 py-2 bg-white border border-stone-200/80 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-50 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95">
            {isDownloading === 'ZAIKS' ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>} ZAiKS
          </button>
          <button disabled={isDownloading !== null} onClick={(e) => { e.stopPropagation(); downloadReport('export_dtp', `DTP_${project.title}.txt`, 'DTP'); }} className="px-3.5 py-2 bg-white border border-stone-200/80 text-purple-700 hover:bg-purple-50 hover:border-purple-300 disabled:opacity-50 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95">
            {isDownloading === 'DTP' ? <Loader2 size={14} className="animate-spin"/> : <AlignLeft size={14}/>} DTP
          </button>
          <button onClick={onStatusToggle} className={`px-3.5 py-2 border text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95 ${isDone ? 'bg-stone-800 text-white border-stone-900 hover:bg-stone-700' : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'}`}>
            {isDone ? <><ArchiveRestore size={14}/> Przywróć</> : <><CheckCircle2 size={14}/> Zakończ</>}
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border-r md:border-l border-stone-200/60 pr-4 md:pr-0 md:pl-5">
            <button onClick={(e) => { e.stopPropagation(); openPanel(project, 'DETAILS'); }} className="p-2.5 bg-white border border-stone-200/80 text-stone-600 hover:text-[#002395] hover:border-[#002395]/40 rounded-xl transition-colors shadow-sm"><Edit2 size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }} className="p-2.5 bg-white border border-stone-200/80 text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl transition-colors shadow-sm"><Trash2 size={16} /></button>
          </div>
          <div className="text-stone-400 bg-white shadow-sm p-2 rounded-full border border-stone-100 transition-transform duration-300 ml-auto md:ml-0">
            {isExpanded ? <ChevronUp size={20} className="text-[#002395]" /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>
    </div>
  );
}