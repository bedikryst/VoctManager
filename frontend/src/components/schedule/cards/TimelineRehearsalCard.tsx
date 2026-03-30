/**
 * @file TimelineRehearsalCard.tsx
 * @description Isolated component for rendering a Rehearsal on the Artist Timeline.
 * @architecture Enterprise 2026
 * UX UPGRADE: "Always-Visible Actions". Confirm Presence & Report Absence buttons 
 * are accessible without expanding the card. 
 * LOGIC UPGRADE: "Status Masking" renders EXCUSED as ABSENT to protect HR privacy.
 * @module schedule/cards/TimelineRehearsalCard
 * @author Krystian Bugalski
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  MapPin, Clock, AlertCircle, CheckCircle2, 
  XCircle, Send, Loader2, ChevronDown, 
  ChevronUp, AlignLeft, UserMinus, Music, ArrowRight, Check
} from 'lucide-react';
import type { TimelineEvent } from '../Schedule';

interface TimelineRehearsalCardProps {
  event: TimelineEvent;
  isExpanded: boolean;
  onToggle: () => void;
  onSubmitReport: (eventId: string, projectId: string | number, status: string, notes: string) => Promise<boolean>;
  viewMode: 'UPCOMING' | 'PAST';
}

const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-300/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-sm";
const STYLE_LABEL = "block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

export default function TimelineRehearsalCard({ event, isExpanded, onToggle, onSubmitReport, viewMode }: TimelineRehearsalCardProps) {
  const [reportingMode, setReportingMode] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // STATUS MASKING: Traktujemy EXCUSED jako ABSENT dla chórzysty
  const currentMaskedStatus = event.status === 'EXCUSED' ? 'ABSENT' : event.status;
  
  const [reportForm, setReportForm] = useState({ 
      status: (currentMaskedStatus === 'ABSENT' || currentMaskedStatus === 'LATE') ? currentMaskedStatus : 'ABSENT', 
      notes: event.excuse_note || '' 
  });

  useEffect(() => {
      const masked = event.status === 'EXCUSED' ? 'ABSENT' : event.status;
      setReportForm({
          status: (masked === 'ABSENT' || masked === 'LATE') ? masked : 'ABSENT',
          notes: event.excuse_note || ''
      });
  }, [event.status, event.excuse_note]);

  const isExcusedOrLate = currentMaskedStatus === 'ABSENT' || currentMaskedStatus === 'LATE';

  const getStatusBadge = (status: string | null | undefined) => {
    const masked = status === 'EXCUSED' ? 'ABSENT' : status;
    switch (masked) {
      case 'PRESENT': return <span className="px-2.5 py-1 text-[9px] font-bold antialiased uppercase tracking-widest bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 shadow-sm flex items-center gap-1"><CheckCircle2 size={10}/> Obecność potwierdzona</span>;
      case 'LATE': return <span className="px-2.5 py-1 text-[9px] font-bold antialiased uppercase tracking-widest bg-orange-50 text-orange-700 rounded-md border border-orange-200 shadow-sm flex items-center gap-1"><Clock size={10}/> Zgłoszono Spóźnienie</span>;
      case 'ABSENT': return <span className="px-2.5 py-1 text-[9px] font-bold antialiased uppercase tracking-widest bg-red-50 text-red-700 rounded-md border border-red-200 shadow-sm flex items-center gap-1"><XCircle size={10}/> Zgłoszono Nieobecność</span>;
      default: return null;
    }
  };

  const handleConfirmPresence = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsSubmitting(true);
      await onSubmitReport(event.rawObj.id, event.project_id, 'PRESENT', 'Obecność potwierdzona');
      setIsSubmitting(false);
      setReportingMode(false);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await onSubmitReport(event.rawObj.id, event.project_id, reportForm.status, reportForm.notes);
    setIsSubmitting(false);
    if (success) {
        setReportingMode(false);
    }
  };

  return (
    <motion.div 
      layout initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
      className="relative sm:pl-16 transition-all duration-300 group"
    >
      <div className={`hidden sm:block absolute left-4 md:left-[27px] top-6 w-3 h-3 rounded-full border-[3px] ring-4 ring-[#f4f2ee] z-10 transition-all duration-500 ${isExcusedOrLate ? 'bg-orange-500 border-orange-500' : currentMaskedStatus === 'PRESENT' ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-stone-300 group-hover:border-[#002395]'}`} />
      
      <div className={`bg-white/70 backdrop-blur-xl rounded-[2rem] relative overflow-hidden transition-all duration-300 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] border ${isExpanded ? 'border-[#002395]/30 shadow-[0_10px_30px_rgba(0,35,149,0.05)]' : 'border-white/60 hover:border-[#002395]/20 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)]'}`}>
          
          {/* HEADER TOP ROW (Klikalne rozwijanie notatek) */}
          <div className="p-5 md:p-6 lg:p-8 pb-2 cursor-pointer relative z-10 hover:bg-white/40 transition-colors" onClick={() => { if(!reportingMode) onToggle(); }}>
              
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 md:gap-6">
                      <div className={`w-16 h-16 rounded-2xl border flex flex-col items-center justify-center flex-shrink-0 shadow-sm transition-colors ${currentMaskedStatus === 'PRESENT' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : isExcusedOrLate ? 'bg-stone-100 border-stone-200 text-stone-500' : 'bg-white border-stone-100 text-stone-700'}`}>
                          <span className="text-[9px] font-bold antialiased uppercase tracking-widest">{event.date_time.toLocaleString('pl-PL', { month: 'short' })}</span>
                          <span className="text-2xl font-black leading-none my-0.5">{event.date_time.getDate()}</span>
                          <span className="text-[8px] font-bold antialiased opacity-75">{event.date_time.toLocaleString('pl-PL', { weekday: 'short' })}</span>
                      </div>
                      
                      <div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="px-2.5 py-1 text-[8px] font-bold antialiased uppercase tracking-widest rounded-md border shadow-sm bg-stone-50 text-stone-500 border-stone-200">
                                  Próba Muzyczna
                              </span>
                              {!event.is_mandatory && <span className="px-2.5 py-1 text-[8px] font-bold antialiased uppercase tracking-widest bg-orange-50 text-orange-600 rounded-md border border-orange-200 shadow-sm">Opcjonalna</span>}
                              {getStatusBadge(event.status)}
                          </div>
                          
                          <h3 className={`text-xl md:text-2xl font-bold tracking-tight leading-tight ${isExcusedOrLate ? 'text-stone-500' : 'text-stone-900'}`} style={{ fontFamily: "'Cormorant', serif" }}>
                              {event.title}
                          </h3>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
                              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white/60 border-stone-200/60 shadow-sm">
                                  <Clock size={12} aria-hidden="true" /> {event.date_time.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border truncate max-w-[220px] bg-white/60 border-stone-200/60 shadow-sm">
                                  <MapPin size={12} className="flex-shrink-0" aria-hidden="true" /> <span className="truncate">{event.location || 'Brak lokalizacji'}</span>
                              </span>
                          </div>

                          {/* ENTERPRISE UX: Absence Alert visible before expanding */}
                          {(event.absences || 0) > 0 && (
                              <div className="mt-3">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-red-50/50 text-red-600 border-red-200/60 shadow-sm text-[10px] font-bold uppercase tracking-widest">
                                      <UserMinus size={12} /> Braki w zespole: {event.absences} os.
                                  </span>
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="flex items-center self-end md:self-auto flex-shrink-0">
                      <div className="bg-white border-stone-100 text-stone-400 shadow-sm p-2 rounded-full border transition-transform duration-300">
                          {isExpanded ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
                      </div>
                  </div>
              </div>
          </div>

          {/* ALWAYS VISIBLE ACTION AREA (Przyciski zgłoszeń na wierzchu) */}
          {viewMode === 'UPCOMING' && (
             <div className="px-5 md:px-6 lg:px-8 pb-5 md:pb-6 lg:pb-8 relative z-20">
                 {!reportingMode ? (
                     <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t border-stone-200/60 mt-3">
                         {currentMaskedStatus !== 'PRESENT' && (
                             <button 
                                 onClick={handleConfirmPresence} disabled={isSubmitting}
                                 className="flex-1 px-5 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] uppercase tracking-[0.15em] font-bold antialiased rounded-xl transition-all shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                             >
                                 {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} />} 
                                 Potwierdź Obecność
                             </button>
                         )}
                         
                         <button 
                             onClick={(e) => { e.stopPropagation(); setReportingMode(true); if(isExpanded) onToggle(); }}
                             className={`flex-1 px-5 py-3.5 bg-white border border-stone-200/80 hover:bg-stone-50 text-[10px] uppercase tracking-[0.15em] font-bold antialiased rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 ${isExcusedOrLate ? 'text-stone-700' : 'text-orange-600 hover:text-orange-700 hover:border-orange-300'}`}
                         >
                             <AlertCircle size={14} /> 
                             {currentMaskedStatus ? 'Zmień / Edytuj zgłoszenie' : 'Zgłoś problem / Nieobecność'}
                         </button>
                     </div>
                 ) : (
                     <div className="bg-white border border-orange-200 shadow-sm rounded-2xl p-6 mt-4">
                         <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-orange-600 mb-4 flex items-center gap-2">
                             <UserMinus size={14} /> Formularz dla Inspektora
                         </h4>
                         <form onSubmit={handleSubmitReport} className="space-y-5">
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                 <div className="sm:col-span-1">
                                     <label className={STYLE_LABEL}>Status *</label>
                                     <select value={reportForm.status} onChange={e => setReportForm({...reportForm, status: e.target.value})} className={`${STYLE_GLASS_INPUT} font-bold appearance-none bg-stone-50`} disabled={isSubmitting}>
                                         <option value="ABSENT">Nie będę obecny</option>
                                         <option value="LATE">Spóźnię się</option>
                                     </select>
                                 </div>
                                 <div className="sm:col-span-2">
                                     <label className={STYLE_LABEL}>Powód / Przewidywany czas przybycia *</label>
                                     <input 
                                         required type="text" placeholder="np. Korki (będę ok. 18:30) / Choroba..."
                                         value={reportForm.notes} onChange={e => setReportForm({...reportForm, notes: e.target.value})} 
                                         className={`${STYLE_GLASS_INPUT} font-medium bg-stone-50`}
                                         disabled={isSubmitting}
                                     />
                                 </div>
                             </div>
                             <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-stone-100">
                                 <button type="button" onClick={() => setReportingMode(false)} disabled={isSubmitting} className="w-full sm:w-auto px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:text-stone-800 transition-colors rounded-xl border border-transparent hover:border-stone-200">
                                     Anuluj
                                 </button>
                                 <button 
                                     type="submit" disabled={isSubmitting || !reportForm.notes.trim()} 
                                     className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] disabled:shadow-none active:scale-95"
                                 >
                                     {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Zapisz zgłoszenie
                                 </button>
                             </div>
                         </form>
                     </div>
                 )}
             </div>
          )}

          {/* EXPANDED CONTENT (Notatki dyrygenta i link do nut) */}
          <AnimatePresence>
              {isExpanded && !reportingMode && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-stone-200/60 bg-stone-50/40 relative z-0">
                      <div className="p-5 md:p-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Notatki Dyrygenta */}
                              <div className="flex flex-col h-full">
                                  <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-3 border-b border-stone-200/60 pb-2 flex items-center gap-1.5"><AlignLeft size={14} /> Plan Pracy</h4>
                                  <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-stone-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] flex-1">
                                      {event.focus ? (
                                          <p className="text-sm text-stone-700 italic leading-relaxed font-serif whitespace-pre-wrap">{event.focus}</p>
                                      ) : (
                                          <p className="text-xs text-stone-400 italic">Brak szczegółowego planu dla tej próby.</p>
                                      )}
                                  </div>
                              </div>

                              {/* Szybki Link do Materiałów */}
                              <div className="flex flex-col h-full">
                                  <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-3 border-b border-stone-200/60 pb-2 flex items-center gap-1.5"><Music size={14} /> Twoje Nuty</h4>
                                  <div className="bg-gradient-to-br from-blue-50 to-white backdrop-blur-sm p-5 rounded-2xl border border-blue-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] flex-1 flex flex-col justify-center items-center text-center">
                                      <p className="text-xs font-bold text-stone-700 mb-1">Przygotuj się do próby</p>
                                      <p className="text-[10px] text-stone-500 mb-4 px-4">Pobierz nuty PDF i przećwicz swoje partie z wirtualnym odtwarzaczem.</p>
                                      <Link to="/panel/materials" className="bg-white border border-blue-200 text-[#002395] hover:bg-[#002395] hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 group/mat">
                                          Przejdź do materiałów <ArrowRight size={14} className="group-hover/mat:translate-x-1 transition-transform"/>
                                      </Link>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </motion.div>
              )}
          </AnimatePresence>
      </div>
    </motion.div>
  );
}