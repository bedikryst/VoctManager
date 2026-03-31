/**
 * @file TimelineProjectCard.tsx
 * @description Isolated component for rendering a Project/Concert on the Artist Timeline.
 * @architecture Enterprise 2026
 * Implements Localized Data Fetching (Setlist & Divisi) only when the card is expanded to save bandwidth.
 * UX: Upgraded tab navigation to high-visibility "Pill" buttons. Relocated SpotifyWidget 
 * to the Setlist tab for integrated audio-visual rehearsal workflow.
 * @module schedule/cards/TimelineProjectCard
 * @author Krystian Bugalski
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  MapPin, Clock, Briefcase, ChevronDown, ChevronUp, 
  Shirt, Download, Users, Loader2, Music, Wrench
} from 'lucide-react';

import api from '../../../../utils/api';
import { queryKeys } from '../../../../utils/queryKeys';
import SpotifyWidget from '../../projects/ProjectCard/SpotifyWidget';

interface TimelineProjectCardProps {
  event: any;
  isExpanded: boolean;
  onToggle: () => void;
  artistId?: string | number;
}

const extractData = (d: any) => (d?.results ? d.results : Array.isArray(d) ? d : []);

export default function TimelineProjectCard({ event, isExpanded, onToggle, artistId }: TimelineProjectCardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'LOGISTICS' | 'SETLIST'>('LOGISTICS');
  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const proj = event.rawObj;
  const combinedDressCode = [proj.dress_code_female, proj.dress_code_male].filter(Boolean).join(' / ');

  const { data: programData, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program.byProject(proj.id),
    queryFn: async () => (await api.get(`/api/program-items/?project=${proj.id}`)).data,
    enabled: isExpanded && activeSubTab === 'SETLIST'
  });
  const programItems = extractData(programData);

  const { data: castingsData, isLoading: isCastingsLoading } = useQuery({
    queryKey: [...queryKeys.pieceCastings.byProject(proj.id), { piece: expandedPieceId }],
    queryFn: async () => (await api.get(`/api/piece-castings/?piece=${expandedPieceId}&participation__project=${proj.id}`)).data,
    enabled: !!expandedPieceId
  });
  const castings = extractData(castingsData);

  const handleDownloadCallSheet = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDownloading(true);
      const toastId = toast.loading("Generowanie dokumentu Call-Sheet...");

      try {
          const response = await api.get(`/api/projects/${proj.id}/export_call_sheet/`, { 
              responseType: 'blob' 
          });
          
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `CallSheet_${proj.title.replace(/\s+/g, '_')}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.parentNode?.removeChild(link);
          
          toast.success("Plik został pobrany", { id: toastId });
      } catch (error) {
          toast.error("Błąd generowania", { id: toastId, description: "Nie udało się pobrać pliku." });
      } finally {
          setIsDownloading(false);
      }
  };

  return (
    <motion.div 
      layout initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
      className="relative sm:pl-16 transition-all duration-300 group"
    >
      <div className="hidden sm:block absolute left-4 md:left-[27px] top-6 w-3 h-3 rounded-full border-[3px] ring-4 ring-[#f4f2ee] z-10 bg-[#002395] border-[#002395] shadow-[0_0_10px_rgba(0,35,149,0.5)]" />
      
      <div className={`rounded-[2rem] relative overflow-hidden transition-all duration-300 bg-[#0a0a0a] text-white shadow-[0_20px_40px_rgba(0,0,0,0.3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] border ${isExpanded ? 'border-stone-700' : 'border-stone-800 hover:border-stone-700'}`}>
        
        <div className={`absolute -top-32 -right-32 w-80 h-80 bg-[#002395] rounded-full blur-[100px] pointer-events-none transition-all duration-1000 ${isExpanded ? 'opacity-60 scale-110' : 'opacity-30 group-hover:opacity-50'}`}></div>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

        {/* --- CARD HEADER --- */}
        <div className="p-5 md:p-6 lg:p-8 flex flex-col md:flex-row md:items-start justify-between gap-5 cursor-pointer relative z-10 hover:bg-white/5 transition-colors" onClick={onToggle}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 md:gap-6">
                <div className="w-16 h-16 rounded-2xl border flex flex-col items-center justify-center flex-shrink-0 shadow-sm bg-white/10 border-white/20 text-blue-100 backdrop-blur-md">
                    <span className="text-[9px] font-bold uppercase tracking-widest">{event.date_time.toLocaleString('pl-PL', { month: 'short' })}</span>
                    <span className="text-2xl font-black leading-none my-0.5">{event.date_time.getDate()}</span>
                </div>
                
                <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest bg-blue-500 text-white border border-blue-400 rounded-md shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                            Koncert / Wydarzenie
                        </span>
                    </div>
                    <h3 className="text-xl md:text-3xl font-bold tracking-tight text-white mb-3" style={{ fontFamily: "'Cormorant', serif" }}>
                        {event.title}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                        {proj.call_time && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                <Clock size={12} /> Zbiórka: {new Date(proj.call_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        {combinedDressCode && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 max-w-[200px] truncate" title={combinedDressCode}>
                                <Shirt size={12} /> {combinedDressCode}
                            </span>
                        )}
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-blue-200 truncate max-w-[200px]">
                            <MapPin size={12} className="flex-shrink-0" /> <span className="truncate">{event.location || 'Brak lok.'}</span>
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="bg-white/10 border border-white/10 text-white shadow-sm p-2 rounded-full transition-transform duration-300 relative z-10 self-end md:self-auto flex-shrink-0">
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
        </div>

        {/* --- CARD BODY (EXPANDED) --- */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/10 bg-black/20 relative z-0">
              
              <div className="p-5 md:p-8 pb-0">
                {/* NEW HIGH-VISIBILITY PILL TABS */}
                <div className="flex flex-wrap gap-3 p-1.5 bg-white/5 border border-white/10 rounded-2xl w-max mb-6">
                  <button 
                    onClick={() => setActiveSubTab('LOGISTICS')} 
                    className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all rounded-xl ${activeSubTab === 'LOGISTICS' ? 'bg-blue-500/20 text-blue-300 shadow-sm border border-blue-500/30' : 'text-stone-400 hover:text-stone-200 border border-transparent'}`}
                  >
                    <Wrench size={14} /> Logistyka & Plan
                  </button>
                  <button 
                    onClick={() => setActiveSubTab('SETLIST')} 
                    className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all rounded-xl ${activeSubTab === 'SETLIST' ? 'bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/30' : 'text-stone-400 hover:text-stone-200 border border-transparent'}`}
                  >
                    <Music size={14} /> Repertuar & Divisi
                  </button>
                </div>
              </div>

              <div className="px-5 md:px-8 pb-8 pt-2">
                  {/* --- TAB 1: LOGISTICS --- */}
                  {activeSubTab === 'LOGISTICS' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          <div className="space-y-6">
                              {(proj.dress_code_female || proj.dress_code_male) && (
                                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2"><Shirt size={14}/> Szczegóły ubioru</p>
                                      {proj.dress_code_female && <p className="text-sm text-stone-300 mb-1.5"><span className="text-stone-500 mr-2">Panie:</span> {proj.dress_code_female}</p>}
                                      {proj.dress_code_male && <p className="text-sm text-stone-300"><span className="text-stone-500 mr-2">Panowie:</span> {proj.dress_code_male}</p>}
                                  </div>
                              )}
                              
                              {proj.description ? (
                                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                      <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap font-serif">{proj.description}</p>
                                  </div>
                              ) : (
                                  <p className="text-sm text-stone-500 italic mt-2">Brak dodatkowych notatek produkcyjnych.</p>
                              )}
                          </div>
                          
                          <div>
                              <div className="flex justify-between items-center mb-4">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">Harmonogram Dnia</p>
                                  <button 
                                    onClick={handleDownloadCallSheet}
                                    disabled={isDownloading}
                                    className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/40 disabled:bg-stone-800 disabled:border-stone-700 text-blue-300 disabled:text-stone-500 border border-blue-500/30 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95"
                                  >
                                      {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12}/>} 
                                      Call-Sheet PDF
                                  </button>
                              </div>
                              
                              {event.run_sheet && event.run_sheet.length > 0 ? (
                                  <div className="relative pl-5 border-l border-white/10 space-y-5 ml-2 mt-6">
                                      {[...event.run_sheet].sort((a,b) => a.time.localeCompare(b.time)).map((item, idx) => (
                                          <div key={item.id || idx} className="relative group/run">
                                              <div className="absolute -left-[25px] top-1.5 w-3 h-3 bg-[#0a0a0a] border-2 border-blue-400 rounded-full shadow-[0_0_10px_rgba(96,165,250,0.5)] group-hover/run:scale-125 transition-transform"></div>
                                              <div className="flex flex-col gap-1.5">
                                                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 self-start px-2 py-0.5 rounded border border-blue-500/20 shadow-sm">{item.time}</span>
                                                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors shadow-sm">
                                                      <p className="text-sm font-bold text-white">{item.title}</p>
                                                      {item.description && <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">{item.description}</p>}
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              ) : <p className="text-sm text-stone-500 italic mt-6">Harmonogram dnia nie został jeszcze opublikowany przez menedżera.</p>}
                          </div>
                      </div>
                  )}

                  {/* --- TAB 2: SETLIST & DIVISI --- */}
                  {activeSubTab === 'SETLIST' && (
                      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                          
                          {/* Spotify Widget Side Column */}
                          <div className="xl:col-span-2 xl:order-last">
                              {proj.spotify_playlist_url ? (
                                  <SpotifyWidget playlistUrl={proj.spotify_playlist_url} theme="dark" />
                              ) : (
                                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center flex flex-col items-center justify-center h-full min-h-[150px]">
                                      <Music size={24} className="text-stone-600 mb-2 opacity-50" />
                                      <p className="text-xs text-stone-500 italic">Brak playlisty referencyjnej.</p>
                                  </div>
                              )}
                          </div>

                          {/* Setlist Column */}
                          <div className="xl:col-span-3 space-y-4">
                              {isProgramLoading ? (
                                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-400"/></div>
                              ) : programItems.length > 0 ? (
                                  programItems.sort((a: any, b: any) => a.order - b.order).map((pi: any, idx: number) => {
                                      const isPieceExpanded = expandedPieceId === String(pi.piece);
                                      
                                      return (
                                          <div key={pi.id} className={`bg-white/5 border rounded-2xl overflow-hidden transition-all ${isPieceExpanded ? 'border-emerald-500/30' : 'border-white/10 hover:border-white/20'}`}>
                                              <div 
                                                  onClick={() => setExpandedPieceId(isPieceExpanded ? null : String(pi.piece))}
                                                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                                              >
                                                  <div className="flex items-center gap-4">
                                                      <span className="text-emerald-500 font-black text-lg opacity-50 w-6 text-center">{idx + 1}.</span>
                                                      <div>
                                                          <p className="font-bold text-white text-base">{pi.piece_title}</p>
                                                          <p className="text-xs text-stone-400 flex items-center gap-1.5 mt-0.5">
                                                              <Users size={12} /> {isPieceExpanded ? 'Ukryj obsadę' : 'Rozwiń obsadę (divisi)'}
                                                          </p>
                                                      </div>
                                                  </div>
                                                  {isPieceExpanded ? <ChevronUp size={18} className="text-emerald-500"/> : <ChevronDown size={18} className="text-stone-500"/>}
                                              </div>

                                              <AnimatePresence>
                                                  {isPieceExpanded && (
                                                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-black/40 border-t border-white/5">
                                                          <div className="p-4 md:p-6">
                                                              {isCastingsLoading ? (
                                                                  <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-stone-500"/></div>
                                                              ) : castings.length > 0 ? (
                                                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                                                      {Object.entries(castings.reduce((acc: any, c: any) => {
                                                                          const vl = c.voice_line || 'Inne';
                                                                          if (!acc[vl]) acc[vl] = [];
                                                                          acc[vl].push(c);
                                                                          return acc;
                                                                      }, {})).map(([vl, groupCastings]: [string, any]) => (
                                                                          <div key={vl} className="space-y-3">
                                                                              <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest border-b border-white/10 pb-1.5 mb-2">{vl}</h5>
                                                                              <ul className="space-y-2">
                                                                                  {groupCastings.map((c: any) => {
                                                                                      const isMe = String(c.artist_id) === String(artistId) || String(c.participation?.artist) === String(artistId);
                                                                                      
                                                                                      return (
                                                                                          <li key={c.id} className={`text-xs flex flex-col gap-1 ${isMe ? 'text-white font-bold bg-white/10 p-2 rounded-lg border border-white/10 shadow-sm' : 'text-stone-400'}`}>
                                                                                              <span className="flex items-center gap-1.5">
                                                                                                  {isMe && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>}
                                                                                                  {c.artist_name || c.participation?.artist_name || 'Artysta'}
                                                                                              </span>
                                                                                              {c.notes && <span className="text-[9px] text-amber-400 italic bg-amber-500/10 px-1.5 py-0.5 rounded w-max">Notatka: {c.notes}</span>}
                                                                                          </li>
                                                                                      )
                                                                                  })}
                                                                              </ul>
                                                                          </div>
                                                                      ))}
                                                                  </div>
                                                              ) : <p className="text-xs text-stone-500 italic text-center py-4">Brak szczegółowego podziału (divisi) dla tego utworu.</p>}
                                                          </div>
                                                      </motion.div>
                                                  )}
                                              </AnimatePresence>
                                          </div>
                                      )
                                  })
                              ) : <p className="text-sm text-stone-500 text-center py-6">Repertuar nie został jeszcze ustalony.</p>}
                          </div>
                      </div>
                  )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}