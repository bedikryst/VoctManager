/**
 * @file PieceDetailsForm.tsx
 * @description Form component for creating or updating repertoire metadata.
 * @architecture
 * Implements "Dirty State Tracking" communicating up to the parent panel to prevent data loss.
 * ENTERPRISE UPGRADE: Uses "Nested Writes" via JSON stringification to eliminate N+1 query flooding.
 * BUGFIX: Fully migrated to the global `queryKeys` factory. Eliminated redundant cross-module invalidations.
 * @module archive/PieceDetailsForm
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Plus, Minus, Trash2, Clock, Music, Youtube, AlignLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import api from '../../../../utils/api';
import type { Piece, Composer, VoiceLineOption } from '../../../../types';
import { queryKeys } from '../../../../utils/queryKeys';

export const EPOCHS: Array<{value: string, label: string}> = [
  { value: 'MED', label: 'Średniowiecze' }, { value: 'REN', label: 'Renesans' },
  { value: 'BAR', label: 'Barok' }, { value: 'CLA', label: 'Klasycyzm' },
  { value: 'ROM', label: 'Romantyzm' }, { value: 'M20', label: 'XX wiek' },
  { value: 'CON', label: 'Muzyka Współczesna' }, { value: 'POP', label: 'Rozrywka' },
  { value: 'FOLK', label: 'Folk / Ludowa' }
];

type SubmitAction = 'SAVE_AND_ADD' | 'SAVE_AND_CLOSE';

interface PieceDetailsFormProps {
  piece: Piece | null;
  composers: Composer[];
  voiceLines: VoiceLineOption[];
  onSuccess: (updatedPiece: Piece, actionType: SubmitAction) => void;
  onDirtyStateChange?: (isDirty: boolean) => void;
  initialSearchContext?: string;
}

interface RequirementState {
  voice_line: string;
  voice_line_display?: string;
  quantity: number;
}

interface PieceFormData {
  title: string;
  composer: string;
  arranger: string;
  language: string;
  composition_year: string;
  epoch: string;
  voicing: string;
  durationMins: string;
  durationSecs: string;
  reference_recording_youtube: string;
  reference_recording_spotify: string;
  lyrics_original: string;
  lyrics_translation: string;
  description: string;
}

// —- Static Styles —-
const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
const STYLE_LABEL = "block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

/**
 * PieceDetailsForm Component
 * @param {PieceDetailsFormProps} props
 * @returns {React.JSX.Element}
 */
export default function PieceDetailsForm({ 
  piece, composers, voiceLines, onSuccess, onDirtyStateChange, initialSearchContext = '' 
}: PieceDetailsFormProps): React.JSX.Element {
  
  const queryClient = useQueryClient();
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitAction, setSubmitAction] = useState<SubmitAction>('SAVE_AND_CLOSE'); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Composer Engine State
  const [isAddingComposer, setIsAddingComposer] = useState<boolean>(false);
  const [newComposerData, setNewComposerData] = useState({ first_name: '', last_name: '', birth_year: '', death_year: '' });
  const [compSearchTerm, setCompSearchTerm] = useState<string>('');
  const [isCompDropdownOpen, setIsCompDropdownOpen] = useState<boolean>(false);

  // Time Conversion Logic
  const initialMinutes = piece?.estimated_duration ? Math.floor(piece.estimated_duration / 60).toString() : '';
  const initialSeconds = piece?.estimated_duration ? (piece.estimated_duration % 60).toString() : '';

  // INITIAL STATE (For deep comparison)
  const initialFormData = useMemo<PieceFormData>(() => ({
    title: piece?.title || initialSearchContext || '',
    composer: piece?.composer ? String(typeof piece.composer === 'object' ? (piece.composer as any).id : piece.composer) : '', 
    arranger: piece?.arranger || '',
    language: piece?.language || '',
    composition_year: piece?.composition_year ? String(piece.composition_year) : '',
    epoch: piece?.epoch || '',
    voicing: piece?.voicing || '',
    durationMins: initialMinutes,
    durationSecs: initialSeconds,
    reference_recording_youtube: piece?.reference_recording_youtube || piece?.reference_recording || '',
    reference_recording_spotify: piece?.reference_recording_spotify || '',
    lyrics_original: piece?.lyrics_original || '',
    lyrics_translation: piece?.lyrics_translation || '',
    description: piece?.description || ''
  }), [piece, initialMinutes, initialSeconds, initialSearchContext]);

  const [formData, setFormData] = useState<PieceFormData>(initialFormData);
  
  const initialRequirements = useMemo(() => 
    piece?.voice_requirements?.map(r => ({ voice_line: r.voice_line, quantity: r.quantity, voice_line_display: (r as any).voice_line_display })) || [],
  [piece]);

  const [requirements, setRequirements] = useState<RequirementState[]>(initialRequirements);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // --- DIRTY STATE TRACKER ---
  const isDirty = useMemo(() => {
    const isFormChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    const areReqsChanged = JSON.stringify(requirements) !== JSON.stringify(initialRequirements);
    const isFileChanged = selectedFile !== null;
    const isComposerAddingActive = isAddingComposer && (newComposerData.first_name !== '' || newComposerData.last_name !== '');
    
    return isFormChanged || areReqsChanged || isFileChanged || isComposerAddingActive;
  }, [formData, initialFormData, requirements, initialRequirements, selectedFile, isAddingComposer, newComposerData]);

  // Report dirty state to parent panel
  useEffect(() => {
    if (onDirtyStateChange) {
      onDirtyStateChange(isDirty);
    }
  }, [isDirty, onDirtyStateChange]);

  // Smart Dropdown Effect hooks
  useEffect(() => {
    if (!isAddingComposer) {
        if (formData.composer) {
            const comp = composers.find(c => String(c.id) === String(formData.composer));
            setCompSearchTerm(comp ? `${comp.first_name || ''} ${comp.last_name}`.trim() : '');
        } else {
            setCompSearchTerm('');
        }
    }
  }, [formData.composer, composers, isAddingComposer]);

  const filteredComposers = useMemo<Composer[]>(() => {
      if (!compSearchTerm) return composers;
      return composers.filter(c =>
          `${c.first_name || ''} ${c.last_name}`.toLowerCase().includes(compSearchTerm.toLowerCase())
      );
  }, [composers, compSearchTerm]);

  // Utility Handlers
  const updateRequirementQuantity = (index: number, delta: number) => {
    const newReqs = [...requirements];
    newReqs[index].quantity = Math.max(1, newReqs[index].quantity + delta);
    setRequirements(newReqs);
  };

  const handleRemoveRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const appendField = (payload: FormData, key: string, value: string | number | null) => {
    payload.append(key, value === null ? '' : String(value));
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    let finalComposerId = formData.composer;

    // Resolve inline composer addition
    if (isAddingComposer) {
        if (!newComposerData.last_name) {
            toast.error('Nazwisko kompozytora jest wymagane!');
            setIsSubmitting(false); 
            return;
        }
        
        const duplicate = composers.find(c => 
            c.last_name.trim().toLowerCase() === newComposerData.last_name.trim().toLowerCase() && 
            (c.first_name || '').trim().toLowerCase() === newComposerData.first_name.trim().toLowerCase()
        );
        
        if (duplicate) {
            toast.warning(`Kompozytor ${duplicate.first_name || ''} ${duplicate.last_name} już istnieje. Wyszukaj go na liście.`);
            setIsSubmitting(false); 
            return;
        }

        const compToastId = toast.loading("Dodawanie kompozytora do bazy...");
        try {
            const compPayload = { 
                ...newComposerData, 
                birth_year: newComposerData.birth_year ? parseInt(newComposerData.birth_year) : null, 
                death_year: newComposerData.death_year ? parseInt(newComposerData.death_year) : null 
            };
            const compRes = await api.post('/api/composers/', compPayload);
            finalComposerId = compRes.data.id;
            
            // ENTERPRISE FIX: Unified cache invalidation
            await queryClient.invalidateQueries({ queryKey: queryKeys.composers.all });
            
            toast.success("Zapisano kompozytora", { id: compToastId });
        } catch (err) {
            toast.error("Błąd tworzenia kompozytora", { id: compToastId });
            setIsSubmitting(false); 
            return;
        }
    }

    const toastId = toast.loading(piece?.id ? "Aktualizowanie utworu..." : "Zapisywanie nowego utworu...");

    const payload = new FormData();
    appendField(payload, 'title', formData.title.trim());
    appendField(payload, 'composer', finalComposerId || null);
    appendField(payload, 'arranger', formData.arranger.trim() || null);
    appendField(payload, 'language', formData.language.trim() || null);
    appendField(payload, 'composition_year', formData.composition_year || null);
    appendField(payload, 'epoch', formData.epoch || null);
    appendField(payload, 'voicing', formData.voicing.trim());
    appendField(payload, 'reference_recording_youtube', formData.reference_recording_youtube.trim() || null);
    appendField(payload, 'reference_recording_spotify', formData.reference_recording_spotify.trim() || null);
    appendField(payload, 'lyrics_original', formData.lyrics_original.trim() || null);
    appendField(payload, 'lyrics_translation', formData.lyrics_translation.trim() || null);
    appendField(payload, 'description', formData.description.trim());
    
    const totalSeconds = (parseInt(formData.durationMins || '0') * 60) + parseInt(formData.durationSecs || '0');
    appendField(payload, 'estimated_duration', totalSeconds > 0 ? totalSeconds : null);

    if (selectedFile) payload.append('sheet_music', selectedFile);

    // ==========================================
    // ENTERPRISE UPGRADE: Nested Writes (Brak N+1)
    // ==========================================
    const requirementsPayload = requirements.map(req => ({
        voice_line: req.voice_line,
        quantity: req.quantity
    }));
    payload.append('requirements_data', JSON.stringify(requirementsPayload));

    try {
      const res = piece?.id 
        ? await api.patch(`/api/pieces/${piece.id}/`, payload, { headers: { 'Content-Type': 'multipart/form-data' }})
        : await api.post('/api/pieces/', payload, { headers: { 'Content-Type': 'multipart/form-data' }});
    
      // ENTERPRISE FIX: Unified cache invalidation for the entire application
      await queryClient.invalidateQueries({ queryKey: queryKeys.pieces.all });
      
      toast.success(piece?.id ? 'Zaktualizowano dane utworu.' : 'Utwór dodany do archiwum!', { id: toastId });
      
      // Reset dirty status before closing
      if (onDirtyStateChange) onDirtyStateChange(false);

      if (submitAction === 'SAVE_AND_ADD') {
          setFormData({
            title: '', composer: '', arranger: '', language: '', composition_year: '',
            epoch: '', voicing: '', durationMins: '', durationSecs: '', reference_recording_youtube: '',
            reference_recording_spotify: '',
            lyrics_original: '', lyrics_translation: '', description: ''
          });
          setRequirements([]);
          setSelectedFile(null);
          setCompSearchTerm('');
          setIsAddingComposer(false);
          setNewComposerData({ first_name: '', last_name: '', birth_year: '', death_year: '' });
          if (fileInputRef.current) fileInputRef.current.value = '';
      }

      onSuccess(res.data, submitAction);
      
    } catch (err) {
      console.error("[PieceDetailsForm] Failed to save piece:", err);
      toast.error("Wystąpił błąd podczas zapisu", { id: toastId, description: "Sprawdź poprawność danych i połączenie." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] relative flex flex-col min-h-full">
      
      <div className="flex-1 space-y-8">
        {/* —- SECTION 1: Core Metadata —- */}
        <div className="space-y-6">
          <div>
              <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395] mb-2 ml-1">Tytuł Utworu *</label>
              <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className={`${STYLE_GLASS_INPUT} text-lg font-medium text-stone-900`} placeholder="np. Lacrimosa" disabled={isSubmitting} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                  <div className="flex justify-between items-end mb-2">
                      <label className={STYLE_LABEL}>Kompozytor</label>
                      <button type="button" onClick={() => setIsAddingComposer(!isAddingComposer)} className="text-[9px] text-[#002395] font-medium antialiased uppercase tracking-widest hover:underline" disabled={isSubmitting}>
                          {isAddingComposer ? 'Wróć do wyszukiwarki' : '+ Dodaj Nowego'}
                      </button>
                  </div>
                  
                  {isAddingComposer ? (
                      <div className="flex flex-col gap-3 bg-white/50 backdrop-blur-sm p-5 border border-stone-200/80 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                          <div className="grid grid-cols-2 gap-3">
                              <input type="text" placeholder="Imię" value={newComposerData.first_name} onChange={e => setNewComposerData({...newComposerData, first_name: e.target.value})} className="w-full px-3 py-2.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002395]/20" disabled={isSubmitting} />
                              <input type="text" placeholder="Nazwisko *" required value={newComposerData.last_name} onChange={e => setNewComposerData({...newComposerData, last_name: e.target.value})} className="w-full px-3 py-2.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002395]/20" disabled={isSubmitting} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                              <input type="number" placeholder="Rok ur." value={newComposerData.birth_year} onChange={e => setNewComposerData({...newComposerData, birth_year: e.target.value})} className="w-full px-3 py-2.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002395]/20" disabled={isSubmitting} />
                              <input type="number" placeholder="Rok śm." value={newComposerData.death_year} onChange={e => setNewComposerData({...newComposerData, death_year: e.target.value})} className="w-full px-3 py-2.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002395]/20" disabled={isSubmitting} />
                          </div>
                      </div>
                  ) : (
                      <div className="relative">
                          <input 
                              type="text" placeholder="Szukaj na liście (lub zostaw puste)" value={compSearchTerm}
                              onChange={e => { setCompSearchTerm(e.target.value); setFormData(prev => ({...prev, composer: ''})); setIsCompDropdownOpen(true); }}
                              onFocus={() => setIsCompDropdownOpen(true)} onBlur={() => setTimeout(() => setIsCompDropdownOpen(false), 200)}
                              className={`${STYLE_GLASS_INPUT} font-medium`}
                              disabled={isSubmitting}
                          />
                          <AnimatePresence>
                              {isCompDropdownOpen && (
                                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-xl border border-stone-200/60 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] max-h-48 overflow-y-auto overflow-hidden">
                                      <div onMouseDown={() => { setFormData(prev => ({...prev, composer: ''})); setCompSearchTerm(''); setIsCompDropdownOpen(false); }} className="px-4 py-3 text-xs font-medium uppercase tracking-widest text-stone-400 hover:bg-stone-50 cursor-pointer border-b border-stone-100">— Tradycyjny / Nieznany —</div>
                                      {filteredComposers.map(c => (
                                          <div key={c.id} onMouseDown={() => { setFormData(prev => ({...prev, composer: c.id})); setIsCompDropdownOpen(false); }} className="px-4 py-3 text-sm font-medium text-stone-800 hover:bg-[#002395] hover:text-white cursor-pointer transition-colors">
                                              {c.last_name} {c.first_name} {c.birth_year ? <span className="opacity-60 font-medium ml-1">({c.birth_year}-{c.death_year||''})</span> : ''}
                                          </div>
                                      ))}
                                  </motion.div>
                              )}
                          </AnimatePresence>
                      </div>
                  )}
              </div>

              <div>
                  <label className={STYLE_LABEL}>Aranżer</label>
                  <input type="text" value={formData.arranger} onChange={e => setFormData({...formData, arranger: e.target.value})} className={`${STYLE_GLASS_INPUT} font-medium`} placeholder="np. John Rutter" disabled={isSubmitting} />
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2">
                  <label className={STYLE_LABEL}>Epoka Muzyczna</label>
                  <select value={formData.epoch} onChange={e => setFormData({...formData, epoch: e.target.value})} className={`${STYLE_GLASS_INPUT} font-medium appearance-none`} disabled={isSubmitting}>
                      <option value="">— Wybierz Epokę —</option>
                      {EPOCHS.map(ep => <option key={ep.value} value={ep.value}>{ep.label}</option>)}
                  </select>
              </div>
              <div>
                  <label className={STYLE_LABEL}>Rok Powstania</label>
                  <input type="number" placeholder="np. 1741" value={formData.composition_year} onChange={e => setFormData({...formData, composition_year: e.target.value})} className={`${STYLE_GLASS_INPUT} font-medium`} disabled={isSubmitting} />
              </div>
              <div>
                  <label className={STYLE_LABEL}>Język</label>
                  <input type="text" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})} className={`${STYLE_GLASS_INPUT} font-medium`} placeholder="np. Łacina" disabled={isSubmitting} />
              </div>
          </div>
        </div>

        {/* —- SECTION 2: Execution & Planning —- */}
        <div className="border-t border-stone-200/60 pt-8 space-y-6">
            <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-800 flex items-center gap-2.5">
                <Music size={16} className="text-[#002395]" aria-hidden="true" /> Wymagania Wykonawcze
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                  <label className={STYLE_LABEL}>Obsada Wokalna (Zapis Tradycyjny)</label>
                  <input type="text" value={formData.voicing} onChange={e => setFormData({...formData, voicing: e.target.value})} className={`${STYLE_GLASS_INPUT} font-medium`} placeholder="np. SSAATTBB, Chór + Soliści" disabled={isSubmitting} />
              </div>
              <div>
                  <label className="block text-[9px] font-medium antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1 flex items-center gap-1.5"><Clock size={12} aria-hidden="true"/> Szacowany Czas Trwania</label>
                  <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                          <input type="number" min="0" placeholder="Minuty" value={formData.durationMins} onChange={e => setFormData({...formData, durationMins: e.target.value})} className={`${STYLE_GLASS_INPUT} pr-12 text-right font-medium`} disabled={isSubmitting} />
                          <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[9px] text-stone-400 font-medium uppercase tracking-widest">min</span>
                      </div>
                      <span className="text-stone-300 font-medium text-lg">:</span>
                      <div className="relative flex-1">
                          <input type="number" min="0" max="59" placeholder="Sekundy" value={formData.durationSecs} onChange={e => setFormData({...formData, durationSecs: e.target.value})} className={`${STYLE_GLASS_INPUT} pr-12 text-right font-medium`} disabled={isSubmitting} />
                          <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[9px] text-stone-400 font-medium uppercase tracking-widest">sek</span>
                      </div>
                  </div>
              </div>
            </div>

            <div className="border border-stone-200/60 rounded-2xl overflow-hidden shadow-sm mt-6 bg-white/40">
              <div className="bg-stone-50/50 backdrop-blur-sm p-5 border-b border-stone-200/60">
                  <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 mb-1.5">Algorytm Obsady (Divisi)</h4>
                  <p className="text-[9px] uppercase tracking-widest font-medium antialiased text-stone-400 mb-4 leading-relaxed max-w-lg">Wybierz głosy i ustal minimalną ilość śpiewaków do weryfikacji braków kadrowych w trybie Mikro-Obsady.</p>
                  
                  <div className="flex flex-wrap gap-2.5">
                      {voiceLines.filter(vl => !requirements.some(r => r.voice_line === String(vl.value))).map(vl => (
                          <button 
                          key={String(vl.value)} type="button" onClick={() => {
                              setRequirements([...requirements, { voice_line: String(vl.value), voice_line_display: vl.label, quantity: 1 }]);
                          }}
                          className="px-4 py-2 bg-white border border-stone-200/80 text-stone-600 hover:text-[#002395] hover:border-[#002395]/40 hover:bg-blue-50/50 text-[9px] font-medium antialiased uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                          disabled={isSubmitting}
                          >
                          <Plus size={12} aria-hidden="true" /> {vl.label}
                          </button>
                      ))}
                  </div>
              </div>
              
              <div className="p-4 space-y-3">
              {requirements.length > 0 ? requirements.map((req, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white/80 border border-stone-200/60 px-5 py-3 rounded-xl shadow-sm transition-colors">
                  <span className="text-[10px] font-medium antialiased text-[#002395] uppercase tracking-widest">{req.voice_line_display || req.voice_line}</span>
                  <div className="flex items-center gap-5">
                      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200/80 rounded-lg shadow-inner px-1 py-1">
                          <button type="button" onClick={() => updateRequirementQuantity(idx, -1)} disabled={req.quantity <= 1 || isSubmitting} className="p-2 text-stone-400 hover:text-stone-800 disabled:opacity-30 transition-colors active:scale-95 bg-white rounded-md shadow-sm"><Minus size={12}/></button>
                          <span className="text-xs font-medium text-stone-800 w-6 text-center">{req.quantity}</span>
                          <button type="button" onClick={() => updateRequirementQuantity(idx, 1)} disabled={isSubmitting} className="p-2 text-stone-400 hover:text-stone-800 transition-colors active:scale-95 bg-white rounded-md shadow-sm"><Plus size={12}/></button>
                      </div>
                      <button type="button" onClick={() => handleRemoveRequirement(idx)} disabled={isSubmitting} className="text-stone-300 hover:text-red-500 p-2.5 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100 active:scale-95"><Trash2 size={16}/></button>
                  </div>
                  </div>
              )) : <p className="text-[10px] font-medium antialiased uppercase tracking-widest text-stone-400 italic text-center py-6">Brak zdefiniowanych wymagań.</p>}
              </div>
            </div>
        </div>

        {/* —- SECTION 3: Materials & Content —- */}
        <div className="border-t border-stone-200/60 pt-8 space-y-6">
            <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-800 flex items-center gap-2.5">
                <AlignLeft size={16} className="text-[#002395]" aria-hidden="true" /> Materiały i Teksty
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className={STYLE_LABEL}>Tekst Oryginalny</label>
                    <textarea value={formData.lyrics_original} onChange={e => setFormData({...formData, lyrics_original: e.target.value})} rows={5} className={`${STYLE_GLASS_INPUT} resize-none font-medium text-xs leading-relaxed`} placeholder="Wklej oryginalny tekst utworu..." disabled={isSubmitting} />
                </div>
                <div>
                    <label className={STYLE_LABEL}>Tłumaczenie (Notatki)</label>
                    <textarea value={formData.lyrics_translation} onChange={e => setFormData({...formData, lyrics_translation: e.target.value})} rows={5} className={`${STYLE_GLASS_INPUT} resize-none font-medium text-xs leading-relaxed`} placeholder="Wklej polskie tłumaczenie..." disabled={isSubmitting} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1 flex items-center gap-1.5"><Youtube size={14} className="text-red-600" aria-hidden="true" /> Referencja YouTube</label>
                    <input type="url" value={formData.reference_recording_youtube} onChange={e => setFormData({...formData, reference_recording_youtube: e.target.value})} className={STYLE_GLASS_INPUT} placeholder="https://youtube.com/watch?v=..." disabled={isSubmitting} />
                </div>
                <div>
                    <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1 flex items-center gap-1.5"><Music size={14} className="text-emerald-600" aria-hidden="true" /> Referencja Spotify</label>
                    <input type="url" value={formData.reference_recording_spotify} onChange={e => setFormData({...formData, reference_recording_spotify: e.target.value})} className={STYLE_GLASS_INPUT} placeholder="https://open.spotify.com/track/..." disabled={isSubmitting} />
                </div>
            </div>

            <div className="p-6 border border-stone-200/60 rounded-2xl bg-white/40 shadow-sm mt-4">
              <label className={STYLE_LABEL}>Partytura / Nuty (Opcjonalnie PDF)</label>
              {piece?.sheet_music && !selectedFile && (
              <p className="text-[9px] uppercase font-medium antialiased tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500" aria-hidden="true" /> Dokument nutowy jest już załączony w bazie.
              </p>
              )}
              <input 
              type="file" accept="application/pdf" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              className="w-full mt-1 text-sm text-stone-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-[9px] file:font-medium file:antialiased file:uppercase file:tracking-widest file:bg-white file:text-[#002395] file:shadow-sm hover:file:bg-blue-50 hover:file:text-[#001766] cursor-pointer border border-stone-200/60 rounded-xl bg-white/50 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all"
              disabled={isSubmitting}
              />
            </div>
        </div>
      </div>

      {/* —- STICKY BOTTOM ACTION BAR —- */}
      <div className="sticky bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-stone-200/60 p-4 md:p-6 -mx-6 md:-mx-8 -mb-8 mt-8 flex flex-col sm:flex-row gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-b-2xl">
        {!piece?.id && (
            <button type="submit" onClick={() => setSubmitAction('SAVE_AND_ADD')} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2.5 bg-white border border-stone-200/80 hover:bg-stone-50 text-stone-600 text-[10px] uppercase tracking-widest font-bold antialiased py-3.5 rounded-xl transition-all shadow-sm disabled:opacity-50 active:scale-95">
                {isSubmitting && submitAction === 'SAVE_AND_ADD' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                Zapisz i dodaj kolejny
            </button>
        )}
        <button type="submit" onClick={() => setSubmitAction('SAVE_AND_CLOSE')} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2.5 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3.5 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] disabled:opacity-50 active:scale-95">
            {isSubmitting && submitAction === 'SAVE_AND_CLOSE' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
            {piece?.id ? 'Zapisz Zmiany' : 'Zapisz i zamknij'}
        </button>
      </div>

    </form>
  );
}