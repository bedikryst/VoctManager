/**
 * @file ProjectCard.jsx
 * @description Expandable concert dashboard widget representing a single project.
 * * @architecture
 * Consumes data exclusively via ProjectDataContext to prevent Prop Drilling.
 * Implements granular Document streaming handlers (BLOB) for PDF/CSV generation.
 * Memoized heavily by the parent module to prevent unnecessary repaints.
 * * @module project/ProjectCard
 * @author Krystian Bugalski
 */

import React, { useState, useContext, useMemo } from 'react';
import { ProjectDataContext } from './ProjectDashboard'; 

// Third-party libraries
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Users, Calendar, ChevronDown, ChevronUp, 
  ListOrdered, Edit2, Trash2, Clock, AlignLeft, Wrench, 
  Banknote, FileText, CheckCircle2, ArchiveRestore, Download,
  Loader2, Music, Briefcase
} from 'lucide-react';

// Internal utilities & API
import api from '../../../utils/api';

/**
 * Parses duration into a human-readable format.
 * @param {number} totalSeconds - The duration in seconds.
 * @returns {string|null} Formatted string.
 */
const formatTotalDuration = (totalSeconds) => {
  if (!totalSeconds || totalSeconds === 0) return null;
  const m = Math.floor(totalSeconds / 60);
  const h = Math.floor(m / 60);
  const remainingMins = m % 60;
  if (h > 0) return `~ ${h}h ${remainingMins}min muzyki`;
  return `~ ${m} min muzyki`;
};

/**
 * ProjectCard Component
 * @param {Object} props
 * @param {Object} props.project - The project data object.
 * @returns {JSX.Element}
 */
export default function ProjectCard({ project }) {
  const { 
    rehearsals, participations, crewAssignments, artists, 
    crew, pieces, pieceCastings, openPanel, handleDelete, fetchGlobal 
  } = useContext(ProjectDataContext);

  // --- State ---
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRunSheetOpen, setIsRunSheetOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(null);

  // --- Derived Data (Memoized for performance) ---
  const projectRehearsals = useMemo(() => {
    return rehearsals
      .filter(r => r.project === project.id)
      .sort((a,b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  }, [rehearsals, project.id]);

  const pastRehearsals = projectRehearsals.filter(r => new Date(r.date_time) < new Date());
  const projectParticipations = participations?.filter(p => p.project === project.id) || [];
  const projectCrew = crewAssignments?.filter(c => c.project === project.id) || [];
  
  const totalBudget = useMemo(() => {
    const totalArtistsCost = projectParticipations.reduce((sum, p) => sum + (Number(p.fee) || 0), 0);
    const totalCrewCost = projectCrew.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);
    return totalArtistsCost + totalCrewCost;
  }, [projectParticipations, projectCrew]);

  const isDone = project.status === 'DONE';

  const totalConcertDurationSeconds = useMemo(() => {
    return project.program?.reduce((sum, item) => {
      const pieceId = item.piece_id || item.piece;
      const pieceObj = pieces.find(p => String(p.id) === String(pieceId));
      return sum + (pieceObj?.estimated_duration || 0);
    }, 0) || 0;
  }, [project.program, pieces]);

  // --- Handlers ---

  /**
   * Toggles the active/done lifecycle status of the project.
   * @param {React.MouseEvent} e 
   */
  const toggleLifecycleStatus = async (e) => {
    e.stopPropagation();
    const newStatus = isDone ? 'ACTIVE' : 'DONE';
    try {
      await api.patch(`/api/projects/${project.id}/`, { status: newStatus });
      fetchGlobal();
    } catch (err) {
      console.error(`[ProjectCard] Failed to toggle status for ${project.id}:`, err);
      // TODO: Replace with Toast
      alert("Wystąpił błąd podczas zmiany statusu projektu. Sprawdź połączenie.");
    }
  };

  /**
   * Handles binary data streaming (BLOBs) for document generation.
   * Extracts filename dynamically from the Content-Disposition header if available.
   * * @param {React.MouseEvent} e - Click event
   * @param {string} endpoint - API endpoint suffix
   * @param {string} defaultFilename - Fallback filename
   * @param {string} loaderKey - State key to identify which button is loading
   */
  const handleDownloadReport = async (e, endpoint, defaultFilename, loaderKey) => {
    e.stopPropagation();
    setIsDownloading(loaderKey); 

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
    } catch (err) {
        console.error(`[ProjectCard] Document streaming failed for ${endpoint}:`, err);
        // TODO: Replace with Toast
        alert("Błąd serwera podczas generowania dokumentu.");
    } finally {
        setIsDownloading(null); 
    }
  };

  // --- Styles ---
  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
  const disabledStyle = "bg-stone-50/50 border-stone-200/60 rounded-2xl opacity-75 grayscale hover:grayscale-0 transition-all duration-300";

  return (
    <div className={`relative transition-all duration-300 overflow-hidden group ${isDone ? disabledStyle : `${glassCardStyle} hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)] hover:border-[#002395]/20 hover:-translate-y-0.5`}`}>
      
      {/* Background Decorator */}
      {!isDone && (
          <div className="absolute -right-8 -top-8 text-[#002395] opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-700">
              <Briefcase size={200} strokeWidth={1} aria-hidden="true" />
          </div>
      )}

      {/* Primary Card View (Always Visible) */}
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
                    href={`https://maps.google.com/?q=${encodeURIComponent(project.location)}`} 
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
          {/* Quick Actions (Desktop) */}
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

      {/* Expanded Details Section */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className="bg-stone-50/40 border-t border-white/60 overflow-hidden cursor-default relative z-0"
          >
            <div className="p-5 md:p-6 space-y-6">
              
              {/* Quick Actions (Mobile) */}
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

              {/* Run-sheet Section */}
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

              {/* Sub-widgets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* 1. Rehearsals Widget */}
                <div onClick={() => openPanel(project, 'REHEARSALS')} className="bg-white border border-stone-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#002395]/40 hover:shadow-md transition-all group min-h-[220px]">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors"><Calendar size={16} className="text-[#002395] group-hover:scale-110 transition-transform" /> Najbliższe Próby</h4>
                    <button className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity">Edytuj</button>
                  </div>
                  
                  {projectRehearsals.length > 0 ? (
                    <>
                      <div className="mb-4">
                        <div className="flex justify-between text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2">
                          <span>Postęp</span>
                          <span>{pastRehearsals.length} / {projectRehearsals.length}</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-1.5">
                          <div className="bg-[#002395] h-1.5 rounded-full transition-all" style={{ width: `${(pastRehearsals.length / projectRehearsals.length) * 100}%` }}></div>
                        </div>
                      </div>
                      <ul className="space-y-3 flex-1 mt-2">
                        {projectRehearsals.filter(r => new Date(r.date_time) >= new Date()).slice(0, 3).map(reh => {
                          const invitedCount = reh.invited_participations?.length || 0;
                          const isTutti = invitedCount === 0 || invitedCount === projectParticipations.length;

                          return (
                            <li key={reh.id} className="text-[11px] text-stone-600 flex flex-col gap-1 border-b border-stone-50 last:border-0 pb-2 last:pb-0">
                                <div className="flex items-start justify-between">
                                <div className="flex items-start gap-2.5">
                                    <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 shadow-sm ${reh.is_mandatory ? 'bg-[#002395]' : 'bg-orange-400'}`}></div>
                                    <div className="flex flex-col">
                                    <span>
                                        <strong className="text-stone-800">{new Date(reh.date_time).toLocaleDateString('pl-PL', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</strong>
                                        <span className="text-stone-400 ml-1">({reh.location})</span>
                                    </span>
                                    {reh.focus && <span className="text-[10px] text-stone-500 italic line-clamp-1 mt-0.5">{reh.focus}</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`text-[8px] uppercase tracking-widest font-bold antialiased px-1.5 py-0.5 rounded ${isTutti ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'}`}>
                                        {isTutti ? 'TUTTI' : 'SEKCYJNA'}
                                    </span>
                                    {!reh.is_mandatory && <span className="text-[8px] text-orange-600 font-bold antialiased uppercase tracking-widest">Opcjonalna</span>}
                                </div>
                                </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : <p className="text-xs text-stone-400 italic flex-1 flex items-center justify-center py-4">Brak zaplanowanych prób.</p>}
                </div>

                {/* 2. Cast Access Widget */}
                <div onClick={() => openPanel(project, 'CAST')} className="bg-white border border-stone-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#002395]/40 hover:shadow-md transition-all group min-h-[220px]">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors"><Users size={16} className="text-[#002395] group-hover:scale-110 transition-transform" /> Obsada Wokalna</h4>
                    <button className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity">Edytuj</button>
                  </div>
                  <div className="flex-1 flex flex-col justify-center items-center py-2">
                    <div className="flex flex-wrap justify-center gap-2 mb-2">
                        {projectParticipations.slice(0, 9).map(part => {
                            const artist = artists.find(a => String(a.id) === String(part.artist));
                            if (!artist) return null;
                            return (
                                <span key={part.id} className="px-2.5 py-1 bg-stone-50 text-stone-700 text-[10px] font-bold antialiased uppercase tracking-widest rounded-md border border-stone-200 shadow-sm">
                                    {artist.first_name} {artist.last_name.charAt(0)}.
                                </span>
                            );
                        })}
                        {projectParticipations.length > 9 && (
                            <span className="px-2.5 py-1 bg-blue-50 text-[#002395] text-[10px] font-bold antialiased uppercase tracking-widest rounded-md border border-blue-200 shadow-sm">
                                +{projectParticipations.length - 9}
                            </span>
                        )}
                        {projectParticipations.length === 0 && (
                            <span className="text-xs text-stone-400 italic">Brak obsady wokalnej.</span>
                        )}
                    </div>
                  </div>
                  <div className="text-center text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-auto border-t border-stone-100 pt-3">Zatrudnionych: {projectParticipations.length}</div>
                </div>

                {/* 3. Program Setlist Widget */}
                <div onClick={() => openPanel(project, 'PROGRAM')} className="bg-white border border-stone-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#002395]/40 hover:shadow-md transition-all group min-h-[220px]">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors"><ListOrdered size={16} className="text-[#002395] group-hover:scale-110 transition-transform" /> Program Koncertu</h4>
                    <button onClick={(e) => { e.stopPropagation(); openPanel(project, 'MICRO_CAST'); }} className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity">Divisi</button>
                  </div>
                  
                  {project.program && project.program.length > 0 ? (
                    <div className="flex flex-col h-full justify-between">
                        <ul className="space-y-2 flex-1 mb-3">
                        {project.program.sort((a,b) => a.order - b.order).slice(0, 5).map((item, index) => {
                            const pieceId = item.piece_id || item.piece;
                            const pieceObj = pieces.find(p => String(p.id) === String(pieceId));
                            const requirements = pieceObj?.voice_requirements || [];
                            const safeCastings = pieceCastings || [];
                            
                            let statusColor = "bg-stone-50 border-stone-100";
                            let textColor = "text-stone-500";
                            let statusText = "Brak wymagań";
                            
                            if (requirements.length > 0) {
                                let missingTotal = 0;
                                requirements.forEach(req => {
                                    const assigned = safeCastings.filter(c => 
                                        String(c.piece) === String(pieceId) && 
                                        c.voice_line === req.voice_line && 
                                        projectParticipations.some(p => String(p.id) === String(c.participation))
                                    ).length;
                                    if (assigned < req.quantity) missingTotal += (req.quantity - assigned);
                                });
                                
                                if (missingTotal > 0) {
                                    statusColor = "bg-red-50 border-red-200";
                                    textColor = "text-red-600";
                                    statusText = "Nieobsadzony";
                                } else {
                                    statusColor = "bg-emerald-50 border-emerald-200";
                                    textColor = "text-emerald-700";
                                    statusText = "Obsadzony";
                                }
                            }

                            return (
                                <li key={item.id || index} className={`text-[11px] flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${statusColor}`}>
                                <span className={`truncate pr-2 font-bold ${textColor}`}>
                                    <strong className="opacity-40 w-4 inline-block font-bold">{index + 1}.</strong> {item.title || item.piece_title}
                                </span>
                                <span className={`text-[8px] font-bold antialiased uppercase tracking-widest ${textColor}`}>{statusText}</span>
                                </li>
                            );
                        })}
                        {project.program.length > 5 && <li className="text-[10px] font-bold antialiased text-stone-400 uppercase text-center pt-2">...i {project.program.length - 5} więcej</li>}
                        </ul>
                        
                        <div className="mt-auto border-t border-stone-100 pt-3 text-center">
                            {totalConcertDurationSeconds > 0 ? (
                                <span className="inline-flex items-center gap-1.5 text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100">
                                    <Music size={12} /> {formatTotalDuration(totalConcertDurationSeconds)}
                                </span>
                            ) : (
                                <span className="text-[9px] uppercase tracking-widest font-bold antialiased text-stone-400">Czas nieznany</span>
                            )}
                        </div>
                    </div>
                  ) : <p className="text-xs text-stone-500 italic flex-1 flex items-center justify-center py-4">Setlista jest pusta.</p>}
                </div>

                {/* 4. Crew Widget */}
                <div onClick={() => openPanel(project, 'CREW')} className="bg-white border border-stone-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#002395]/40 hover:shadow-md transition-all group min-h-[220px]">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors"><Wrench size={16} className="text-[#002395] group-hover:scale-110 transition-transform" /> Ekipa (Crew)</h4>
                    <button className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity">Edytuj</button>
                  </div>
                  <div className="flex-1 flex flex-col justify-center items-center py-2">
                    <div className="flex flex-wrap justify-center gap-2 mb-2">
                        {projectCrew.slice(0, 9).map(assign => {
                            const person = crew.find(c => String(c.id) === String(assign.collaborator));
                            if (!person) return null;
                            return (
                                <span key={assign.id} className="px-2.5 py-1 bg-stone-50 text-stone-700 text-[10px] font-bold antialiased uppercase tracking-widest rounded-md border border-stone-200 shadow-sm">
                                    {person.first_name} {person.last_name.charAt(0)}. <span className="text-stone-400 lowercase tracking-normal">({assign.role_description || person.specialty.substring(0,4)})</span>
                                </span>
                            );
                        })}
                        {projectCrew.length > 9 && (
                            <span className="px-2.5 py-1 bg-blue-50 text-[#002395] text-[10px] font-bold antialiased uppercase tracking-widest rounded-md border border-blue-200 shadow-sm">
                                +{projectCrew.length - 9}
                            </span>
                        )}
                        {projectCrew.length === 0 && (
                            <span className="text-xs text-stone-400 italic">Brak przypisanej ekipy.</span>
                        )}
                    </div>
                  </div>
                  <div className="text-center text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-auto border-t border-stone-100 pt-3">Zatrudnionych: {projectCrew.length}</div>
                </div>

                {/* 5. Budget Access */}
                <div onClick={() => openPanel(project, 'BUDGET')} className="bg-white border border-stone-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between cursor-pointer hover:border-[#002395]/40 hover:shadow-md transition-all group min-h-[220px]">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 group-hover:text-[#002395] transition-colors"><Banknote size={16} className="text-[#002395] group-hover:scale-110 transition-transform" /> Kosztorys</h4>
                    <button className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] opacity-0 group-hover:opacity-100 transition-opacity">Edytuj</button>
                  </div>
                  <div className="flex-1 flex flex-col justify-center items-center py-4">
                    <div className="text-4xl font-bold text-[#002395] mb-2 tracking-tight">{totalBudget.toLocaleString('pl-PL')} PLN</div>
                    <div className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">Estymowany Koszt</div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}