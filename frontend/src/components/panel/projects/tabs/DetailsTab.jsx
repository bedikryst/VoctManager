/**
 * @file DetailsTab.jsx
 * @description Handles creation and editing of base project metadata and production timelines.
 * ENTERPRISE FEATURE: Includes a dynamic "Run-sheet" (Agenda) builder that auto-sorts
 * chronologically, allowing stage managers to plan the event minute-by-minute.
 * UI UPGRADE: Glassmorphism container, premium input styling, and antialiased micro-copy.
 * @module project/tabs/DetailsTab
 * @author Krystian Bugalski
 */

import { useState } from 'react';
import { Loader2, CheckCircle2, Clock, Plus, Trash2, AlignLeft, ListOrdered, Briefcase } from 'lucide-react';
import api from '../../../../utils/api';

const toLocalISOString = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d)) return '';
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

export default function DetailsTab({ project, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  
  const [formData, setFormData] = useState({
    title: project?.title || '', 
    date_time: project?.date_time ? toLocalISOString(project.date_time) : '',
    call_time: project?.call_time ? toLocalISOString(project.call_time) : '',
    location: project?.location || '',
    dress_code: project?.dress_code || '',
    description: project?.description || ''
  });

  const [runSheet, setRunSheet] = useState(project?.run_sheet || []);

  const handleAddRunSheetItem = () => {
    setRunSheet([...runSheet, { id: Date.now().toString(), time: '', title: '', description: '' }]);
  };

  const handleUpdateRunSheetItem = (id, field, value) => {
    const updatedSheet = runSheet.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    if (field === 'time') {
        updatedSheet.sort((a, b) => a.time.localeCompare(b.time));
    }
    setRunSheet(updatedSheet);
  };

  const handleRemoveRunSheetItem = (id) => {
    setRunSheet(runSheet.filter(item => item.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ type: '', text: '' });

    try {
      const payload = { ...formData, run_sheet: runSheet };
      let res;
      if (project?.id) {
        res = await api.patch(`/api/projects/${project.id}/`, payload);
        setStatusMsg({ type: 'success', text: 'Zaktualizowano projekt i harmonogram.' });
      } else {
        res = await api.post('/api/projects/', payload);
        setStatusMsg({ type: 'success', text: 'Utworzono nowy projekt z harmonogramem.' });
      }
      setTimeout(() => { setStatusMsg({ type: '', text: '' }); onSuccess(res.data); }, 1500);
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Wystąpił błąd podczas zapisywania.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
  const glassInputStyle = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
  const labelStyle = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

  return (
    <form onSubmit={handleSubmit} className={`${glassCardStyle} space-y-8 p-6 md:p-10 max-w-4xl mx-auto`}>
      
      {statusMsg.text && (
        <div className={`p-4 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest border shadow-sm ${statusMsg.type === 'success' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700' : 'bg-red-50/80 border-red-200 text-red-700'}`}>
          {statusMsg.text}
        </div>
      )}

      <div className="space-y-6">
          <div className="flex items-center gap-2.5 border-b border-stone-200/60 pb-3">
              <Briefcase size={16} className="text-[#002395]"/>
              <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800">Dane Podstawowe</h3>
          </div>

          <div>
            <label className={labelStyle}>Tytuł Projektu *</label>
            <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className={`${glassInputStyle} font-bold text-stone-900 text-base`} placeholder="np. Koncert Noworoczny 2026" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelStyle}>Data i Godzina Koncertu *</label>
              <input type="datetime-local" required value={formData.date_time} onChange={e => setFormData({...formData, date_time: e.target.value})} className={glassInputStyle} />
            </div>
            <div>
              <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-orange-600 mb-2 ml-1">Call Time (Zbiórka)</label>
              <input type="datetime-local" value={formData.call_time} onChange={e => setFormData({...formData, call_time: e.target.value})} className="w-full px-4 py-3 text-sm text-stone-800 bg-orange-50/30 backdrop-blur-sm border border-orange-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]" />
            </div>
            <div>
              <label className={labelStyle}>Miejsce / Obiekt</label>
              <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className={glassInputStyle} placeholder="np. Filharmonia Narodowa, Warszawa" />
            </div>
            <div>
              <label className={labelStyle}>Dress Code</label>
              <input type="text" value={formData.dress_code} onChange={e => setFormData({...formData, dress_code: e.target.value})} className={glassInputStyle} placeholder="np. Czarne teczki, strój galowy" />
            </div>
          </div>

          <div>
            <label className={labelStyle}>Ogólny opis projektu (Notatki)</label>
            <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className={`${glassInputStyle} resize-none`}></textarea>
          </div>
      </div>

      <div className="space-y-5 pt-6 border-t border-stone-200/60">
          <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
              <div className="flex items-center gap-2.5">
                  <ListOrdered size={16} className="text-[#002395]"/>
                  <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800">Harmonogram Dnia (Run-sheet)</h3>
              </div>
              <button type="button" onClick={handleAddRunSheetItem} className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 border border-transparent hover:border-blue-100">
                  <Plus size={14}/> Dodaj punkt
              </button>
          </div>

          <div className="space-y-3 bg-stone-50/30 p-5 rounded-2xl border border-stone-100/50 shadow-inner">
              {runSheet.length > 0 ? runSheet.map((item) => (
                  <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl border border-stone-200/60 shadow-sm relative group transition-all focus-within:border-[#002395]/40 focus-within:ring-2 focus-within:ring-[#002395]/10">
                      
                      <div className="flex items-center gap-2.5 w-full sm:w-36 flex-shrink-0">
                          <Clock size={14} className="text-stone-400" />
                          <input 
                              type="time" required value={item.time} 
                              onChange={e => handleUpdateRunSheetItem(item.id, 'time', e.target.value)}
                              className="w-full text-sm font-bold text-[#002395] bg-transparent outline-none border-b border-dashed border-stone-300 focus:border-[#002395] pb-0.5" 
                          />
                      </div>

                      <div className="flex-1 w-full space-y-2.5 border-l border-stone-100 pl-4">
                          <input 
                              type="text" required placeholder="Tytuł (np. Próba Akustyczna)" value={item.title} 
                              onChange={e => handleUpdateRunSheetItem(item.id, 'title', e.target.value)}
                              className="w-full text-sm font-bold text-stone-800 bg-transparent outline-none placeholder-stone-300" 
                          />
                          <input 
                              type="text" placeholder="Dodatkowe uwagi (np. tylko soliści i orkiestra)..." value={item.description} 
                              onChange={e => handleUpdateRunSheetItem(item.id, 'description', e.target.value)}
                              className="w-full text-[11px] text-stone-500 italic bg-transparent outline-none placeholder-stone-300" 
                          />
                      </div>

                      <button type="button" onClick={() => handleRemoveRunSheetItem(item.id)} className="absolute top-3 right-3 sm:relative sm:top-0 sm:right-0 p-2.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">
                          <Trash2 size={16} />
                      </button>
                  </div>
              )) : (
                  <div className="text-center py-8 text-stone-400">
                      <Clock size={32} className="mx-auto mb-3 opacity-30" />
                      <p className="text-[10px] antialiased uppercase tracking-widest font-bold">Brak agendy</p>
                      <p className="text-xs mt-1 max-w-xs mx-auto opacity-70">Zbuduj szczegółowy rozkład jazdy na dzień koncertu.</p>
                  </div>
              )}
          </div>
      </div>

      <div className="pt-4">
        <button type="submit" disabled={isSubmitting} className="w-full md:w-auto md:min-w-[240px] md:mx-auto flex items-center justify-center gap-2 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] antialiased uppercase tracking-[0.15em] font-bold py-4 px-8 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.2)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.3)] disabled:shadow-none active:scale-95">
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {project?.id ? 'Zapisz Zmiany' : 'Utwórz Projekt'}
        </button>
      </div>
    </form>
  );
}