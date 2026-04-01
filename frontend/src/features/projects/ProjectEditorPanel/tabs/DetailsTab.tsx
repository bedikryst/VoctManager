/**
 * @file DetailsTab.tsx
 * @description Handles creation and editing of base project metadata and production timelines.
 * Features "Dirty State Tracking" with a Floating Action Bar (FAB) to defer API syncing.
 * @module panel/projects/ProjectEditorPanel/tabs/DetailsTab
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, Trash2, ListOrdered, Briefcase, PlayCircle, Save } from 'lucide-react';

import type { Project } from '../../../../shared/types';
import { useDetailsForm } from '../hooks/useDetailsForm';
import { Input } from '../../../../shared/ui/Input';
import { Button } from '../../../../shared/ui/Button';

interface DetailsTabProps {
    project: Project | null;
    onSuccess: (updatedProject?: Project) => void;
}

const STYLE_LABEL = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";
const STYLE_GLASS_TEXTAREA = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] resize-none";

export default function DetailsTab({ project, onSuccess }: DetailsTabProps): React.JSX.Element {
    const {
        formData, setFormData, sortedRunSheet, isDirty, isSubmitting,
        handleAddRunSheetItem, handleUpdateRunSheetItem, handleRemoveRunSheetItem, handleSubmit
    } = useDetailsForm(project, onSuccess);

    return (
        <>
            <form id="details-form" onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl space-y-8 p-6 md:p-10 max-w-4xl mx-auto mb-24">
                
                <div className="space-y-6">
                    <div className="flex items-center gap-2.5 border-b border-stone-200/60 pb-3">
                        <Briefcase size={16} className="text-[#002395]" aria-hidden="true" />
                        <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800">
                            Dane Podstawowe
                        </h3>
                    </div>

                    <div>
                        <label className={STYLE_LABEL}>Tytuł Projektu *</label>
                        <Input 
                            type="text" 
                            required 
                            value={formData.title} 
                            onChange={(e) => setFormData({...formData, title: e.target.value})} 
                            placeholder="np. Koncert Noworoczny 2026" 
                            disabled={isSubmitting}
                            className="font-bold text-base"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={STYLE_LABEL}>Data i Godzina Koncertu *</label>
                            <Input 
                                type="datetime-local" 
                                required 
                                value={formData.date_time} 
                                onChange={(e) => setFormData({...formData, date_time: e.target.value})} 
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
                            <Input 
                                type="text" 
                                value={formData.location} 
                                onChange={(e) => setFormData({...formData, location: e.target.value})} 
                                placeholder="np. Filharmonia Narodowa, Warszawa" 
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 ml-1">Ubiór (Panowie)</label>
                            <Input 
                                type="text" 
                                value={formData.dress_code_male}
                                onChange={e => setFormData({...formData, dress_code_male: e.target.value})}
                                placeholder="np. Czarna koszula, mucha"
                            />
                        </div>
                        
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 ml-1">Ubiór (Panie)</label>
                            <Input 
                                type="text" 
                                value={formData.dress_code_female}
                                onChange={e => setFormData({...formData, dress_code_female: e.target.value})}
                                placeholder="np. Długa czarna suknia"
                            />
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 ml-1">Playlista Spotify (Link)</label>
                            <Input 
                                type="url" 
                                value={formData.spotify_playlist_url}
                                onChange={e => setFormData({...formData, spotify_playlist_url: e.target.value})}
                                placeholder="Wklej link do playlisty Spotify..."
                                leftIcon={<PlayCircle className="w-4 h-4 text-emerald-500" aria-hidden="true" />}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={STYLE_LABEL}>Ogólny opis projektu (Notatki)</label>
                        <textarea 
                            rows={3} 
                            value={formData.description} 
                            onChange={(e) => setFormData({...formData, description: e.target.value})} 
                            className={STYLE_GLASS_TEXTAREA}
                            disabled={isSubmitting}
                        />
                    </div>
                </div>

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
                        {sortedRunSheet.length > 0 ? sortedRunSheet.map((item, idx) => (
                            <div 
                                key={item.id || idx} 
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
                        
                        <Button 
                            form="details-form"
                            type="submit" 
                            variant="primary"
                            disabled={isSubmitting} 
                            isLoading={isSubmitting}
                            leftIcon={!isSubmitting ? <Save size={16} aria-hidden="true" /> : undefined}
                            className="flex-shrink-0"
                        >
                            Zapisz
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}