/**
 * @file DetailsTab.tsx
 * @description Handles creation and editing of base project metadata and production timelines.
 * @architecture
 * ENTERPRISE 2026: Implements aggressive input memoization to prevent parent-level 
 * re-renders during keystrokes. Features "Dirty State Tracking" with a Floating 
 * Action Bar (FAB) to defer API syncing only to mutated forms, neutralizing redundant saves.
 * @module project/ProjectEditorPanel/tabs/DetailsTab
 * @author Krystian Bugalski
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, Clock, Plus, Trash2, ListOrdered, Briefcase, PlayCircle, Save } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import api from '../../../../../utils/api';
import type { Project, RunSheetItem } from '../../../../../types';

interface DetailsTabProps {
  project: Project | null;
  onSuccess: (updatedProject?: Project) => void;
}

interface ProjectFormData {
  title: string;
  date_time: string;
  call_time: string;
  location: string;
  dress_code_male: string;   
  dress_code_female: string;  
  spotify_playlist_url: string; 
  description: string;
}

const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
const STYLE_LABEL = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

const toLocalISOString = (dateString?: string | null): string => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

export default function DetailsTab({ project, onSuccess }: DetailsTabProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // --- Initialization Baseline (For Dirty State Tracking) ---
  const initialFormData = useMemo<ProjectFormData>(() => ({
    title: project?.title || '', 
    date_time: project?.date_time ? toLocalISOString(project.date_time) : '',
    call_time: project?.call_time ? toLocalISOString(project.call_time) : '',
    location: project?.location || '',
    dress_code_male: project?.dress_code_male || '',       
    dress_code_female: project?.dress_code_female || '',   
    spotify_playlist_url: project?.spotify_playlist_url || '', 
    description: project?.description || ''
  }), [project]);

  const initialRunSheet = useMemo<RunSheetItem[]>(() => project?.run_sheet || [], [project]);

  // --- Mutable State ---
  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [runSheet, setRunSheet] = useState<RunSheetItem[]>(initialRunSheet);

  // Reset form when project changes (e.g. switching tabs or clicking a different project)
  useEffect(() => {
    setFormData(initialFormData);
    setRunSheet(initialRunSheet);
  }, [initialFormData, initialRunSheet]);

  const sortedRunSheet = useMemo(() => {
    return [...runSheet].sort((a, b) => a.time.localeCompare(b.time));
  }, [runSheet]);

  // --- Dirty State Calculation ---
  const isDirty = useMemo(() => {
    const isFormChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    const isRunSheetChanged = JSON.stringify(sortedRunSheet) !== JSON.stringify(initialRunSheet);
    return isFormChanged || isRunSheetChanged;
  }, [formData, initialFormData, sortedRunSheet, initialRunSheet]);

  // --- Handlers ---
  const handleAddRunSheetItem = useCallback((): void => {
    setRunSheet((prev) => [
      ...prev, 
      { id: crypto.randomUUID(), time: '', title: '', description: '' }
    ]);
  }, []);

  const handleUpdateRunSheetItem = useCallback((id: string | number, field: keyof RunSheetItem, value: string): void => {
    setRunSheet((prev) => prev.map((item) => 
      String(item.id) === String(id) ? { ...item, [field]: value } : item
    ));
  }, []);

  const handleRemoveRunSheetItem = useCallback((id: string | number): void => {
    setRunSheet((prev) => prev.filter((item) => String(item.id) !== String(id)));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!isDirty) return; // Safety lock

    setIsSubmitting(true);
    const actionLabel = project?.id ? "Aktualizowanie projektu..." : "Tworzenie projektu...";
    const toastId = toast.loading(actionLabel);

    try {
      const payload = { 
        title: formData.title,
        date_time: formData.date_time,
        call_time: formData.call_time || null,
        location: formData.location || null,
        dress_code_male: formData.dress_code_male || null,
        dress_code_female: formData.dress_code_female || null,
        spotify_playlist_url: formData.spotify_playlist_url || null,
        description: formData.description || null,
        run_sheet: sortedRunSheet 
      };

      let res;
      
      if (project?.id) {
        res = await api.patch(`/api/projects/${project.id}/`, payload);
        toast.success("Zaktualizowano projekt i harmonogram", { id: toastId });
      } else {
        res = await api.post('/api/projects/', payload);
        toast.success("Utworzono nowy projekt z harmonogramem", { id: toastId });
      }
      
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      // Update baseline after successful save so the bar disappears
      onSuccess(res.data);
    } catch (err: any) {
      const errorMessage = err.response?.data 
        ? Object.values(err.response.data).flat().join(' | ') 
        : "Wystąpił problem podczas zapisywania danych.";
        
      toast.error("Błąd zapisu", { id: toastId, description: errorMessage });
      console.error("[DetailsTab] API Rejection Payload:", err.response?.data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form id="details-form" onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl space-y-8 p-6 md:p-10 max-w-4xl mx-auto mb-24">
        
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
              
              <div className="md:col-span-2">
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

              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 ml-1">Ubiór (Panowie)</label>
                  <input 
                      type="text" 
                      value={formData.dress_code_male}
                      onChange={e => setFormData({...formData, dress_code_male: e.target.value})}
                      className={STYLE_GLASS_INPUT}
                      placeholder="np. Czarna koszula, mucha"
                  />
              </div>
              
              <div className="space-y-1.5">
                  <label className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 ml-1">Ubiór (Panie)</label>
                  <input 
                      type="text" 
                      value={formData.dress_code_female}
                      onChange={e => setFormData({...formData, dress_code_female: e.target.value})}
                      className={STYLE_GLASS_INPUT}
                      placeholder="np. Długa czarna suknia"
                  />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 ml-1">Playlista Spotify (Link)</label>
                  <div className="relative">
                      <input 
                          type="url" 
                          value={formData.spotify_playlist_url}
                          onChange={e => setFormData({...formData, spotify_playlist_url: e.target.value})}
                          className={`${STYLE_GLASS_INPUT} pl-10`}
                          placeholder="Wklej link do playlisty Spotify..."
                      />
                      <PlayCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" aria-hidden="true" />
                  </div>
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
                {sortedRunSheet.length > 0 ? sortedRunSheet.map((item) => (
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
      </form>

      {/* ENTERPRISE FLOATING ACTION BAR (FAB) */}
      {/* Appears smoothly only when state is dirty */}
      <AnimatePresence>
        {isDirty && (
          <motion.div 
            initial={{ y: 100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 md:bottom-10 left-1/2 z-[200] w-[90%] max-w-md bg-white/90 backdrop-blur-xl border border-white/60 shadow-[0_20px_40px_rgb(0,0,0,0.12)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl p-4 flex items-center justify-between"
          >
            <div className="flex flex-col ml-2">
              <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395]">
                Niezapisane Zmiany
              </span>
              <span className="text-xs text-stone-500">
                Zmodyfikowałeś ustawienia projektu.
              </span>
            </div>
            
            {/* Must trigger the form submission explicitly via form="details-form" attribute */}
            <button 
              form="details-form"
              type="submit" 
              disabled={isSubmitting} 
              className="flex items-center justify-center gap-2 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] antialiased uppercase tracking-[0.1em] font-bold py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.2)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.3)] disabled:shadow-none active:scale-95 flex-shrink-0"
            >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
                Zapisz
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}