/**
 * @file DetailsTab.tsx
 * @description Handles creation and editing of base project metadata and production timelines.
 * @architecture
 * Includes a dynamic "Run-sheet" (Agenda) builder that auto-sorts chronologically.
 * Employs strict TypeScript interfaces for form data and Sonner for mutation feedback.
 * Static styles are extracted to prevent memory reallocation during rapid form state updates.
 * @module project/tabs/DetailsTab
 * @author Krystian Bugalski
 */

import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Clock, Plus, Trash2, ListOrdered, Briefcase } from 'lucide-react';

import api from '../../../../utils/api';
import type { Project, RunSheetItem } from '../../../../types';

interface DetailsTabProps {
  project: Project | null;
  onSuccess: (updatedProject?: Project) => void;
}

interface ProjectFormData {
  title: string;
  date_time: string;
  call_time: string;
  location: string;
  dress_code: string;
  description: string;
}

// --- Static Configurations & Styles ---
const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
const STYLE_LABEL = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

/**
 * Converts an ISO date string to a local datetime-local input format.
 * @param {string | undefined | null} dateString - The raw date string.
 * @returns {string} Formatted date string or empty string.
 */
const toLocalISOString = (dateString?: string | null): string => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

/**
 * DetailsTab Component
 * @param {DetailsTabProps} props - Component properties.
 * @returns {React.JSX.Element}
 */
export default function DetailsTab({ project, onSuccess }: DetailsTabProps): React.JSX.Element {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  const [formData, setFormData] = useState<ProjectFormData>({
    title: project?.title || '', 
    date_time: project?.date_time ? toLocalISOString(project.date_time) : '',
    call_time: project?.call_time ? toLocalISOString(project.call_time) : '',
    location: project?.location || '',
    dress_code: project?.dress_code || '',
    description: project?.description || ''
  });

  const [runSheet, setRunSheet] = useState<RunSheetItem[]>(project?.run_sheet || []);

  // --- Event Handlers ---

  const handleAddRunSheetItem = useCallback((): void => {
    setRunSheet((prev) => [
      ...prev, 
      { id: Date.now().toString(), time: '', title: '', description: '' }
    ]);
  }, []);

  const handleUpdateRunSheetItem = useCallback((id: string | number, field: keyof RunSheetItem, value: string): void => {
    setRunSheet((prev) => {
      const updatedSheet = prev.map((item) => 
        String(item.id) === String(id) ? { ...item, [field]: value } : item
      );
      
      // Auto-sort chronologically if time is updated
      if (field === 'time') {
          updatedSheet.sort((a, b) => a.time.localeCompare(b.time));
      }
      return updatedSheet;
    });
  }, []);

  const handleRemoveRunSheetItem = useCallback((id: string | number): void => {
    setRunSheet((prev) => prev.filter((item) => String(item.id) !== String(id)));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const actionLabel = project?.id ? "Aktualizowanie projektu..." : "Tworzenie projektu...";
    const toastId = toast.loading(actionLabel);

    try {
      const payload = { ...formData, run_sheet: runSheet };
      let res;
      
      if (project?.id) {
        res = await api.patch(`/api/projects/${project.id}/`, payload);
        toast.success("Zaktualizowano projekt i harmonogram", { id: toastId });
      } else {
        res = await api.post('/api/projects/', payload);
        toast.success("Utworzono nowy projekt z harmonogramem", { id: toastId });
      }
      
      onSuccess(res.data);
    } catch (err) {
      console.error("[DetailsTab] Form submission failed:", err);
      toast.error("Błąd zapisu", { 
        id: toastId, 
        description: "Wystąpił problem podczas zapisywania danych. Sprawdź połączenie." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render ---

  return (
    <form onSubmit={handleSubmit} className={`${STYLE_GLASS_CARD} space-y-8 p-6 md:p-10 max-w-4xl mx-auto`}>
      
      {/* 1. Basic Information Section */}
      <div className="space-y-6">
          <div className="flex items-center gap-2.5 border-b border-stone-200/60 pb-3">
              <Briefcase size={16} className="text-[#002395]" aria-hidden="true" />
              <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800">
                Dane Podstawowe
              </h3>
          </div>

          <div>
            <label className={STYLE_LABEL}>Tytuł Projektu *</label>
            <input 
              type="text" 
              required 
              value={formData.title} 
              onChange={(e) => setFormData({...formData, title: e.target.value})} 
              className={`${STYLE_GLASS_INPUT} font-bold text-stone-900 text-base`} 
              placeholder="np. Koncert Noworoczny 2026" 
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={STYLE_LABEL}>Data i Godzina Koncertu *</label>
              <input 
                type="datetime-local" 
                required 
                value={formData.date_time} 
                onChange={(e) => setFormData({...formData, date_time: e.target.value})} 
                className={STYLE_GLASS_INPUT} 
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-orange-600 mb-2 ml-1">
                Call Time (Zbiórka)
              </label>
              <input 
                type="datetime-local" 
                value={formData.call_time} 
                onChange={(e) => setFormData({...formData, call_time: e.target.value})} 
                className="w-full px-4 py-3 text-sm text-stone-800 bg-orange-50/30 backdrop-blur-sm border border-orange-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]" 
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className={STYLE_LABEL}>Miejsce / Obiekt</label>
              <input 
                type="text" 
                value={formData.location} 
                onChange={(e) => setFormData({...formData, location: e.target.value})} 
                className={STYLE_GLASS_INPUT} 
                placeholder="np. Filharmonia Narodowa, Warszawa" 
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className={STYLE_LABEL}>Dress Code</label>
              <input 
                type="text" 
                value={formData.dress_code} 
                onChange={(e) => setFormData({...formData, dress_code: e.target.value})} 
                className={STYLE_GLASS_INPUT} 
                placeholder="np. Czarne teczki, strój galowy" 
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className={STYLE_LABEL}>Ogólny opis projektu (Notatki)</label>
            <textarea 
              rows={3} 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})} 
              className={`${STYLE_GLASS_INPUT} resize-none`}
              disabled={isSubmitting}
            />
          </div>
      </div>

      {/* 2. Run-sheet Builder Section */}
      <div className="space-y-5 pt-6 border-t border-stone-200/60">
          <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
              <div className="flex items-center gap-2.5">
                  <ListOrdered size={16} className="text-[#002395]" aria-hidden="true" />
                  <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800">
                    Harmonogram Dnia (Run-sheet)
                  </h3>
              </div>
              <button 
                type="button" 
                onClick={handleAddRunSheetItem} 
                disabled={isSubmitting}
                className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 border border-transparent hover:border-blue-100 disabled:opacity-50"
              >
                  <Plus size={14} aria-hidden="true" /> Dodaj punkt
              </button>
          </div>

          <div className="space-y-3 bg-stone-50/30 p-5 rounded-2xl border border-stone-100/50 shadow-inner">
              {runSheet.length > 0 ? runSheet.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl border border-stone-200/60 shadow-sm relative group transition-all focus-within:border-[#002395]/40 focus-within:ring-2 focus-within:ring-[#002395]/10"
                  >
                      
                      <div className="flex items-center gap-2.5 w-full sm:w-36 flex-shrink-0">
                          <Clock size={14} className="text-stone-400" aria-hidden="true" />
                          <input 
                              type="time" 
                              required 
                              value={item.time} 
                              onChange={(e) => handleUpdateRunSheetItem(item.id!, 'time', e.target.value)}
                              className="w-full text-sm font-bold text-[#002395] bg-transparent outline-none border-b border-dashed border-stone-300 focus:border-[#002395] pb-0.5" 
                              disabled={isSubmitting}
                          />
                      </div>

                      <div className="flex-1 w-full space-y-2.5 border-l border-stone-100 pl-4">
                          <input 
                              type="text" 
                              required 
                              placeholder="Tytuł (np. Próba Akustyczna)" 
                              value={item.title} 
                              onChange={(e) => handleUpdateRunSheetItem(item.id!, 'title', e.target.value)}
                              className="w-full text-sm font-bold text-stone-800 bg-transparent outline-none placeholder-stone-300" 
                              disabled={isSubmitting}
                          />
                          <input 
                              type="text" 
                              placeholder="Dodatkowe uwagi (np. tylko soliści i orkiestra)..." 
                              value={item.description || ''} 
                              onChange={(e) => handleUpdateRunSheetItem(item.id!, 'description', e.target.value)}
                              className="w-full text-[11px] text-stone-500 italic bg-transparent outline-none placeholder-stone-300" 
                              disabled={isSubmitting}
                          />
                      </div>

                      <button 
                        type="button" 
                        onClick={() => handleRemoveRunSheetItem(item.id!)} 
                        disabled={isSubmitting}
                        className="absolute top-3 right-3 sm:relative sm:top-0 sm:right-0 p-2.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 disabled:opacity-50"
                        aria-label="Usuń punkt harmonogramu"
                      >
                          <Trash2 size={16} aria-hidden="true" />
                      </button>
                  </div>
              )) : (
                  <div className="text-center py-8 text-stone-400">
                      <Clock size={32} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
                      <p className="text-[10px] antialiased uppercase tracking-widest font-bold">Brak agendy</p>
                      <p className="text-xs mt-1 max-w-xs mx-auto opacity-70">Zbuduj szczegółowy rozkład jazdy na dzień koncertu.</p>
                  </div>
              )}
          </div>
      </div>

      {/* 3. Submit Action */}
      <div className="pt-4">
        <button 
          type="submit" 
          disabled={isSubmitting} 
          className="w-full md:w-auto md:min-w-[240px] md:mx-auto flex items-center justify-center gap-2 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] antialiased uppercase tracking-[0.15em] font-bold py-4 px-8 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.2)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.3)] disabled:shadow-none active:scale-95"
        >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
            {project?.id ? 'Zapisz Zmiany' : 'Utwórz Projekt'}
        </button>
      </div>
      
    </form>
  );
}