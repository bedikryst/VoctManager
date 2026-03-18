/**
 * @file Schedule.jsx
 * @description Artist Schedule & Timeline Module with Self-Service Absence Reporting.
 * ENTERPRISE FEATURE: Interactive cards reveal granular Event Run-sheets and 
 * Director's Notes directly from the timeline feed.
 * UI UPGRADE 2026: Glassmorphism Event Feed, Antialiased Micro-Typography, 
 * Soft Modal Overlays, and seamless Accordion Expansions.
 * @module schedule/Schedule
 * @author Krystian Bugalski
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, MapPin, Clock, Briefcase, AlertCircle, 
  Users, MicVocal, History, CheckCircle2, XCircle, 
  ShieldAlert, Send, X, Loader2, Music, ChevronDown, ChevronUp, ListOrdered, AlignLeft, Sparkles
} from 'lucide-react';
import api from '../../utils/api';

export default function Schedule() {
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [userParticipations, setUserParticipations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('UPCOMING'); 

  // Accordion state for expanded event details
  const [expandedEventId, setExpandedEventId] = useState(null);

  // Modal States
  const [reportModal, setReportModal] = useState({ isOpen: false, event: null });
  const [reportForm, setReportForm] = useState({ status: 'ABSENT', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [castModal, setCastModal] = useState({ isOpen: false, event: null, artists: [], isLoading: false });

  const fetchScheduleData = async () => {
    setIsLoading(true);
    try {
      const [rehRes, projRes, partRes, attRes] = await Promise.all([
        api.get('/api/rehearsals/'),
        api.get('/api/projects/'),
        api.get('/api/participations/'),
        api.get('/api/attendances/')
      ]);

      const myParticipations = Array.isArray(partRes.data) ? partRes.data : [];
      setUserParticipations(myParticipations);

      const events = [];
      const now = new Date();

      // Parse Rehearsals
      if (Array.isArray(rehRes.data)) {
        rehRes.data.forEach(reh => {
          const isInvited = reh.invited_participations?.length === 0 || 
                            myParticipations.some(p => reh.invited_participations?.includes(p.id) && p.project === reh.project);
          
          if (isInvited) {
            const project = projRes.data.find(p => p.id === reh.project);
            const myPart = myParticipations.find(p => p.project === reh.project);
            const myAttendance = attRes.data.find(a => a.rehearsal === reh.id && a.participation === myPart?.id);

            events.push({
              id: `REH-${reh.id}`,
              type: 'REHEARSAL',
              rawObj: reh,
              date_time: new Date(reh.date_time),
              title: `Próba: ${project?.title || 'Nieznany Projekt'}`,
              location: reh.location,
              focus: reh.focus,
              is_mandatory: reh.is_mandatory,
              status: myAttendance ? myAttendance.status : null,
              project_id: reh.project
            });
          }
        });
      }

      // Parse Main Projects (Concerts)
      if (Array.isArray(projRes.data)) {
        projRes.data.forEach(proj => {
          const isParticipating = myParticipations.some(p => p.project === proj.id);
          if (isParticipating) {
            events.push({
              id: `PROJ-${proj.id}`,
              type: 'PROJECT',
              rawObj: proj,
              date_time: new Date(proj.date_time),
              title: `Wydarzenie: ${proj.title}`,
              location: proj.location,
              call_time: proj.call_time,
              run_sheet: proj.run_sheet,
              description: proj.description,
              status: null,
              project_id: proj.id
            });
          }
        });
      }

      setTimelineEvents(events.sort((a, b) => a.date_time - b.date_time));
    } catch (err) {
      console.error("Failed to load schedule:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchScheduleData(); }, []);

  // Filter events based on viewMode
  const filteredEvents = useMemo(() => {
    const now = new Date();
    return timelineEvents.filter(e => {
      if (viewMode === 'UPCOMING') return e.date_time >= now;
      return e.date_time < now;
    }).sort((a, b) => viewMode === 'UPCOMING' ? a.date_time - b.date_time : b.date_time - a.date_time);
  }, [timelineEvents, viewMode]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PRESENT': return <span className="px-2.5 py-1 text-[9px] font-bold antialiased uppercase tracking-widest bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 shadow-sm flex items-center gap-1"><CheckCircle2 size={10}/> Obecny</span>;
      case 'LATE': return <span className="px-2.5 py-1 text-[9px] font-bold antialiased uppercase tracking-widest bg-orange-50 text-orange-700 rounded-md border border-orange-200 shadow-sm flex items-center gap-1"><Clock size={10}/> Spóźnienie</span>;
      case 'ABSENT': return <span className="px-2.5 py-1 text-[9px] font-bold antialiased uppercase tracking-widest bg-red-50 text-red-700 rounded-md border border-red-200 shadow-sm flex items-center gap-1"><XCircle size={10}/> Nieobecny</span>;
      case 'EXCUSED': return <span className="px-2.5 py-1 text-[9px] font-bold antialiased uppercase tracking-widest bg-purple-50 text-purple-700 rounded-md border border-purple-200 shadow-sm flex items-center gap-1"><ShieldAlert size={10}/> Usprawiedliwiony</span>;
      default: return null;
    }
  };

  // Handles absence/lateness report submission
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportModal.event) return;
    setIsSubmitting(true);

    try {
      const myPart = userParticipations.find(p => p.project === reportModal.event.project_id);
      if (!myPart) throw new Error("No participation found.");

      const payload = {
        rehearsal: reportModal.event.rawObj.id,
        participation: myPart.id,
        status: reportForm.status,
        excuse_note: reportForm.notes
      };

      const existingAt = timelineEvents.find(ev => ev.id === reportModal.event.id)?.status;

      if (existingAt) {
          // If we had a mechanism to fetch attendance ID, we would patch. 
          // For now, rely on backend or recreate it. We assume POST overwrites/creates correctly based on view/logic.
          await api.post('/api/attendances/', payload); 
      } else {
          await api.post('/api/attendances/', payload);
      }

      await fetchScheduleData();
      setReportModal({ isOpen: false, event: null });
      setReportForm({ status: 'ABSENT', notes: '' });
      alert("Twoje zgłoszenie zostało przekazane inspektorowi.");
    } catch (err) {
      console.error(err);
      alert("Błąd podczas wysyłania zgłoszenia.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetches full roster for the selected project
  const handleFetchCast = async (project_id, eventTitle) => {
      setCastModal({ isOpen: true, event: eventTitle, artists: [], isLoading: true });
      try {
          const res = await api.get(`/api/projects/${project_id}/roster/`);
          setCastModal(prev => ({ ...prev, artists: Array.isArray(res.data) ? res.data : [], isLoading: false }));
      } catch (err) {
          console.error(err);
          setCastModal(prev => ({ ...prev, isLoading: false }));
      }
  };

  const toggleExpand = (id) => {
      setExpandedEventId(prev => prev === id ? null : id);
  };

  // UI Theme Classes
  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl relative overflow-hidden";
  const glassInputStyle = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
  const labelStyle = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-4xl mx-auto">
      
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                  <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                          <Calendar size={12} className="text-[#002395]" />
                          <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                              Osobisty Kalendarz
                          </p>
                      </div>
                      <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                          Mój <span className="italic text-[#002395]">Harmonogram</span>.
                      </h1>
                  </div>
              </div>
          </motion.div>
      </header>

      {/* --- SEGMENTED CONTROL FILTERS --- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="inline-flex items-center p-1.5 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-xl overflow-x-auto max-w-full scrollbar-hide">
            {[{ id: 'UPCOMING', label: 'Nadchodzące' }, { id: 'PAST', label: 'Historia' }].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setViewMode(tab.id)} 
                className={`px-5 py-2 text-[9px] font-bold antialiased uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${viewMode === tab.id ? 'bg-white text-[#002395] shadow-sm border border-stone-100' : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
      </div>

      {/* --- TIMELINE FEED --- */}
      <div className="space-y-4 relative z-10">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-stone-100/50 rounded-2xl w-full border border-white/50"></div>)}
          </div>
        ) : filteredEvents.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {filteredEvents.map((ev) => {
              const isExpanded = expandedEventId === ev.id;
              const isProject = ev.type === 'PROJECT';
              const IconComp = isProject ? Briefcase : Calendar;
              
              return (
                <motion.div 
                  key={ev.id} layout
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
                  className={`${glassCardStyle} transition-all duration-300 ${isExpanded ? 'border-[#002395]/30 shadow-[0_10px_30px_rgba(0,35,149,0.05)]' : 'hover:border-[#002395]/20 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)]'}`}
                >
                  {/* Subtle Background Watermark */}
                  <div className={`absolute -right-8 -top-8 opacity-[0.02] pointer-events-none transition-transform duration-700 ${isProject ? 'text-[#002395]' : 'text-stone-500'}`}>
                      <IconComp size={150} strokeWidth={1} />
                  </div>

                  <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 cursor-pointer relative z-10 hover:bg-white/40 transition-colors" onClick={() => toggleExpand(ev.id)}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6">
                      
                      {/* Date Badge */}
                      <div className={`w-16 h-16 rounded-2xl border flex flex-col items-center justify-center flex-shrink-0 shadow-sm ${isProject ? 'bg-blue-50/50 border-blue-100/50 text-[#002395]' : 'bg-white border-stone-100 text-stone-700'}`}>
                        <span className="text-[9px] font-bold antialiased uppercase tracking-widest">{ev.date_time.toLocaleString('pl-PL', { month: 'short' })}</span>
                        <span className="text-2xl font-black leading-none my-0.5">{ev.date_time.getDate()}</span>
                        <span className="text-[8px] font-bold antialiased opacity-75">{ev.date_time.toLocaleString('pl-PL', { weekday: 'short' })}</span>
                      </div>
                      
                      {/* Event Details */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={`px-2 py-0.5 text-[8px] font-bold antialiased uppercase tracking-widest rounded-md border shadow-sm ${isProject ? 'bg-[#002395] text-white border-[#001766]' : 'bg-stone-50 text-stone-500 border-stone-200'}`}>
                            {isProject ? 'Koncert / Wydarzenie' : 'Próba'}
                          </span>
                          {!isProject && !ev.is_mandatory && <span className="px-2 py-0.5 text-[8px] font-bold antialiased uppercase tracking-widest bg-orange-50 text-orange-600 rounded-md border border-orange-200 shadow-sm">Opcjonalna</span>}
                          {getStatusBadge(ev.status)}
                        </div>
                        
                        <h3 className="text-lg md:text-xl font-bold text-stone-900 tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>{ev.title}</h3>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
                          <span className="flex items-center gap-1.5"><Clock size={12}/> {ev.date_time.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="flex items-center gap-1.5 truncate max-w-[200px]"><MapPin size={12} className="flex-shrink-0"/> <span className="truncate">{ev.location || 'Brak danych'}</span></span>
                        </div>
                      </div>
                    </div>

                    <div className="text-stone-400 self-end md:self-auto hidden sm:block bg-white shadow-sm p-2 rounded-full border border-stone-100 transition-transform duration-300">
                        {isExpanded ? <ChevronUp size={20} className="text-[#002395]" /> : <ChevronDown size={20} />}
                    </div>
                  </div>

                  {/* Accordion Content */}
                  <AnimatePresence>
                    {isExpanded && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="bg-stone-50/40 border-t border-white/60 overflow-hidden relative z-0"
                        >
                            <div className="p-6 md:p-8 space-y-6">
                                
                                {/* Production Details */}
                                {isProject ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-4 border-b border-stone-200/60 pb-2">Informacje Produkcyjne</h4>
                                            <div className="space-y-3">
                                                <div className="bg-white/60 p-3 rounded-xl border border-stone-100/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                                                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-orange-500 mb-1">Zbiórka (Call Time)</p>
                                                    <p className="text-sm font-bold text-stone-800 tracking-tight">{ev.call_time ? new Date(ev.call_time).toLocaleString('pl-PL', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit'}) : 'Nie ustalono'}</p>
                                                </div>
                                                {ev.description && (
                                                    <div className="bg-white/60 p-4 rounded-xl border border-stone-100/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                                                        <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 flex items-center gap-1.5"><AlignLeft size={12}/> Opis / Notatki</p>
                                                        <p className="text-sm text-stone-700 leading-relaxed font-serif whitespace-pre-wrap">{ev.description}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Run Sheet Timeline */}
                                        {ev.run_sheet && ev.run_sheet.length > 0 && (
                                            <div>
                                                <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-4 border-b border-stone-200/60 pb-2">Harmonogram Dnia</h4>
                                                <div className="relative pl-5 border-l-2 border-stone-200/80 space-y-4 ml-2">
                                                    {[...ev.run_sheet].sort((a,b) => a.time.localeCompare(b.time)).map((item, idx) => (
                                                        <div key={item.id || idx} className="relative">
                                                            <div className="absolute -left-[27px] top-1 w-4 h-4 bg-white border-[3px] border-[#002395] rounded-full shadow-sm"></div>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[10px] font-bold antialiased text-[#002395] bg-blue-50 self-start px-2 py-0.5 rounded-md border border-blue-100/50 shadow-sm">{item.time}</span>
                                                                <div className="bg-white/60 p-3 rounded-xl border border-stone-100/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] mt-1">
                                                                    <p className="text-sm font-bold text-stone-800">{item.title}</p>
                                                                    {item.description && <p className="text-xs text-stone-500 italic mt-1 leading-relaxed">{item.description}</p>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Rehearsal Notes */
                                    ev.focus && (
                                        <div>
                                            <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 mb-3 border-b border-stone-200/60 pb-2 flex items-center gap-1.5"><AlignLeft size={14}/> Notatki Dyrygenta</h4>
                                            <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-stone-200/80 shadow-sm">
                                                <p className="text-sm text-stone-700 italic leading-relaxed font-serif">{ev.focus}</p>
                                            </div>
                                        </div>
                                    )
                                )}

                                {/* Action Buttons Panel */}
                                <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-stone-200/60">
                                    {!isProject && viewMode === 'UPCOMING' && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setReportModal({ isOpen: true, event: ev }); }}
                                            className="flex-1 flex items-center justify-center gap-2.5 bg-white border border-stone-200/80 text-stone-600 text-[10px] uppercase tracking-[0.15em] font-bold antialiased py-3.5 rounded-xl transition-all shadow-sm hover:shadow-md hover:border-orange-300 hover:text-orange-600 active:scale-95"
                                        >
                                            <AlertCircle size={14} /> Zgłoś Nieobecność
                                        </button>
                                    )}
                                    {isProject && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleFetchCast(ev.project_id, ev.title); }}
                                            className="flex-1 flex items-center justify-center gap-2.5 bg-white border border-stone-200/80 text-stone-600 text-[10px] uppercase tracking-[0.15em] font-bold antialiased py-3.5 rounded-xl transition-all shadow-sm hover:shadow-md hover:border-[#002395]/40 hover:text-[#002395] active:scale-95"
                                        >
                                            <Users size={14} /> Zobacz Obsadę
                                        </button>
                                    )}
                                </div>

                            </div>
                        </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${glassCardStyle} p-16 flex flex-col items-center justify-center text-center`}>
             <Calendar size={48} className="text-stone-300 mb-4 opacity-50" />
            <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak wpisów w kalendarzu</span>
            <span className="text-xs text-stone-400 max-w-sm">W tym widoku nie masz przypisanych żadnych spotkań ani koncertów.</span>
          </motion.div>
        )}
      </div>

      {/* --- REPORT ABSENCE MODAL --- */}
      <AnimatePresence>
        {reportModal.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white/90 backdrop-blur-2xl w-full max-w-lg rounded-[2rem] shadow-2xl border border-white/60 overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 md:p-8 border-b border-stone-200/50 bg-stone-50/50">
                <h3 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">Zgłoszenie Obecności</h3>
                <button onClick={() => setReportModal({ isOpen: false, event: null })} className="text-stone-400 hover:text-stone-900 bg-white border border-stone-200 shadow-sm p-2.5 rounded-xl transition-all active:scale-95"><X size={18} /></button>
              </div>
              
              <div className="p-6 md:p-8">
                <div className="mb-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] mb-1">Dotyczy:</p>
                  <p className="text-sm font-bold text-stone-800 tracking-tight">{reportModal.event?.title}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{reportModal.event?.date_time.toLocaleString('pl-PL')}</p>
                </div>

                <form onSubmit={handleReportSubmit} className="space-y-6">
                  <div>
                    <label className={labelStyle}>Status *</label>
                    <select value={reportForm.status} onChange={e => setReportForm({...reportForm, status: e.target.value})} className={`${glassInputStyle} font-bold appearance-none`}>
                      <option value="ABSENT">Zgłaszam Nieobecność</option>
                      <option value="LATE">Będę Spóźniony/a</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelStyle}>Powód / Uwagi *</label>
                    <textarea 
                        required rows="3" placeholder="Podaj powód dla inspektora..."
                        value={reportForm.notes} onChange={e => setReportForm({...reportForm, notes: e.target.value})} 
                        className={`${glassInputStyle} resize-none font-medium`}
                    />
                  </div>
                  <div className="pt-4 border-t border-stone-100">
                      <button 
                        type="submit" disabled={isSubmitting} 
                        className="w-full flex items-center justify-center gap-2 bg-stone-900 hover:bg-[#002395] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] font-bold antialiased uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.3)] disabled:shadow-none active:scale-95"
                      >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} Wyślij Zgłoszenie
                      </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- CAST VIEW MODAL --- */}
      <AnimatePresence>
        {castModal.isOpen && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4"
            >
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-[#f4f2ee] w-full max-w-2xl rounded-[2rem] shadow-2xl border border-white/60 overflow-hidden max-h-[85vh] flex flex-col"
                >
                    <div className="flex justify-between items-center p-6 md:p-8 border-b border-stone-200/50 bg-white/80 backdrop-blur-xl flex-shrink-0 z-20">
                        <div>
                            <h3 className="font-serif text-2xl md:text-3xl font-bold text-stone-900 tracking-tight">Obsada Koncertu</h3>
                            <p className="text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395] mt-1.5">{castModal.event}</p>
                        </div>
                        <button onClick={() => setCastModal({ isOpen: false, event: null, artists: [], isLoading: false })} className="text-stone-400 hover:text-stone-900 bg-white border border-stone-200 shadow-sm p-2.5 rounded-xl transition-all active:scale-95"><X size={18} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-stone-50/50">
                        {castModal.isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 size={32} className="animate-spin text-stone-300 mb-4" />
                                <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500">Pobieranie listy...</span>
                            </div>
                        ) : castModal.artists.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {Object.entries(castModal.artists.reduce((acc, artist) => {
                                    const group = artist.voice_type || 'Inne';
                                    if (!acc[group]) acc[group] = [];
                                    acc[group].push(artist);
                                    return acc;
                                }, {})).map(([group, artists]) => (
                                    <div key={group} className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-5 shadow-sm">
                                        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-400 border-b border-stone-200/60 pb-2.5 mb-3">{group}</h4>
                                        <ul className="space-y-2">
                                            {artists.map(artist => (
                                                <li key={artist.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-stone-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-[#002395]/20 hover:shadow-sm">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#002395] flex items-center justify-center text-[10px] font-bold antialiased tracking-widest border border-blue-100 flex-shrink-0 shadow-sm">
                                                        {artist.name.split(' ').map(n => n[0]).join('')}
                                                    </div>
                                                    <span className="text-sm font-bold text-stone-800 truncate tracking-tight">{artist.name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white/60 rounded-2xl border border-dashed border-stone-300/60">
                                <Users size={32} className="mx-auto mb-3 opacity-30 text-stone-400"/>
                                <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">Brak zatwierdzonej obsady.</span>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}