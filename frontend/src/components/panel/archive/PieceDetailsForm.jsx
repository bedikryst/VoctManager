/**
 * @file PieceDetailsForm.jsx
 * @description Form component for creating or updating repertoire metadata.
 * ENTERPRISE UPGRADES: 
 * 1. Fully utilizes the Piece model (Duration, Voicing, Lyrics, YouTube links).
 * 2. Implements "Continuous Data Entry" (Save and add another).
 * 3. Native Smart Dropdown (Combobox) for composers to handle large databases.
 * UI UPGRADE 2026: Glassmorphism inputs, antialiased micro-labels, unified form grids.
 * @module archive/PieceDetailsForm
 * @author Krystian Bugalski
 */

import { useState, useEffect, useMemo, useRef} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, Plus, Minus, Trash2, Clock, Music, Youtube, AlignLeft, User } from 'lucide-react';
import api from '../../../utils/api';

export const EPOCHS = [
  { value: 'MED', label: 'Średniowiecze' }, { value: 'REN', label: 'Renesans' },
  { value: 'BAR', label: 'Barok' }, { value: 'CLA', label: 'Klasycyzm' },
  { value: 'ROM', label: 'Romantyzm' }, { value: 'M20', label: 'XX wiek' },
  { value: 'CON', label: 'Muzyka Współczesna' }, { value: 'POP', label: 'Rozrywka' },
  { value: 'FOLK', label: 'Folk / Ludowa' }
];

export default function PieceDetailsForm({ piece, composers, voiceLines, refreshGlobal, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitAction, setSubmitAction] = useState('SAVE_AND_CLOSE'); 
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

  // Composer Engine State
  const [isAddingComposer, setIsAddingComposer] = useState(false);
  const [isSubmittingComposer, setIsSubmittingComposer] = useState(false);
  const [newComposerData, setNewComposerData] = useState({ first_name: '', last_name: '', birth_year: '', death_year: '' });
  const [compSearchTerm, setCompSearchTerm] = useState('');
  const [isCompDropdownOpen, setIsCompDropdownOpen] = useState(false);

  // Time Conversion Logic
  const initialMinutes = piece?.estimated_duration ? Math.floor(piece.estimated_duration / 60) : '';
  const initialSeconds = piece?.estimated_duration ? piece.estimated_duration % 60 : '';

  const [formData, setFormData] = useState({
    title: piece?.title || '',
    composer: piece?.composer?.id || piece?.composer || '', 
    arranger: piece?.arranger || '',
    language: piece?.language || '',
    composition_year: piece?.composition_year || '',
    epoch: piece?.epoch || '',
    voicing: piece?.voicing || '',
    durationMins: initialMinutes,
    durationSecs: initialSeconds,
    reference_recording: piece?.reference_recording || '',
    lyrics_original: piece?.lyrics_original || '',
    lyrics_translation: piece?.lyrics_translation || '',
    description: piece?.description || ''
  });
  
  const [requirements, setRequirements] = useState(piece?.voice_requirements?.map(r => ({ ...r })) || []);
  const [selectedVoiceToAdd, setSelectedVoiceToAdd] = useState('');
  const [deletedReqIds, setDeletedReqIds] = useState([]); 
  const [selectedFile, setSelectedFile] = useState(null);

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

  const filteredComposers = useMemo(() => {
      if (!compSearchTerm) return composers;
      return composers.filter(c =>
          `${c.first_name || ''} ${c.last_name}`.toLowerCase().includes(compSearchTerm.toLowerCase())
      );
  }, [composers, compSearchTerm]);

  // Utility Handlers
  const handleAddRequirement = () => {
    if (!selectedVoiceToAdd) return;
    if (requirements.find(r => r.voice_line === selectedVoiceToAdd)) return; 
    const voiceLabel = voiceLines.find(vl => vl.value === selectedVoiceToAdd)?.label || selectedVoiceToAdd;
    setRequirements([...requirements, { voice_line: selectedVoiceToAdd, voice_line_display: voiceLabel, quantity: 1, isNew: true }]);
    setSelectedVoiceToAdd('');
  };

  const updateRequirementQuantity = (index, delta) => {
    const newReqs = [...requirements];
    newReqs[index].quantity = Math.max(1, newReqs[index].quantity + delta);
    newReqs[index].isModified = true;
    setRequirements(newReqs);
  };

  const handleRemoveRequirement = (index) => {
    const req = requirements[index];
    if (req.id) setDeletedReqIds([...deletedReqIds, req.id]);
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  // API Intersections
  const handleAddComposer = async () => {
    if (!newComposerData.last_name) return;
    setIsSubmittingComposer(true);
    try {
        const compPayload = {
            ...newComposerData,
            birth_year: newComposerData.birth_year ? parseInt(newComposerData.birth_year) : null,
            death_year: newComposerData.death_year ? parseInt(newComposerData.death_year) : null
        };
        const compRes = await api.post('/api/composers/', compPayload);
        await refreshGlobal(); 
        setFormData(prev => ({...prev, composer: compRes.data.id}));
        setIsAddingComposer(false);
        setNewComposerData({ first_name: '', last_name: '', birth_year: '', death_year: '' });
        setStatusMsg({ type: 'success', text: 'Kompozytor zapisany.' });
        setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
    } catch (err) {
        setStatusMsg({ type: 'error', text: 'Błąd podczas tworzenia kompozytora.' });
    } finally {
        setIsSubmittingComposer(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ type: '', text: '' });

    let finalComposerId = formData.composer;

    // Resolve inline composer addition
    if (isAddingComposer) {
        if (!newComposerData.last_name) {
            setStatusMsg({ type: 'error', text: 'Nazwisko kompozytora jest wymagane!' });
            setIsSubmitting(false); return;
        }
        const duplicate = composers.find(c => c.last_name.trim().toLowerCase() === newComposerData.last_name.trim().toLowerCase() && (c.first_name || '').trim().toLowerCase() === newComposerData.first_name.trim().toLowerCase());
        if (duplicate) {
            setStatusMsg({ type: 'error', text: `Kompozytor ${duplicate.first_name} ${duplicate.last_name} już istnieje w bazie! Wyszukaj go na liście zamiast dodawać na nowo.` });
            setIsSubmitting(false); return;
        }
        try {
            const compPayload = { ...newComposerData, birth_year: newComposerData.birth_year ? parseInt(newComposerData.birth_year) : null, death_year: newComposerData.death_year ? parseInt(newComposerData.death_year) : null };
            const compRes = await api.post('/api/composers/', compPayload);
            finalComposerId = compRes.data.id;
            await refreshGlobal(); 
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Błąd tworzenia kompozytora.' });
            setIsSubmitting(false); return;
        }
    }

    const payload = new FormData();
    payload.append('title', formData.title);
    if (finalComposerId) payload.append('composer', finalComposerId);
    payload.append('arranger', formData.arranger);
    payload.append('language', formData.language);
    if (formData.composition_year) payload.append('composition_year', formData.composition_year);
    if (formData.epoch) payload.append('epoch', formData.epoch);
    payload.append('voicing', formData.voicing);
    payload.append('reference_recording', formData.reference_recording);
    payload.append('lyrics_original', formData.lyrics_original);
    payload.append('lyrics_translation', formData.lyrics_translation);
    payload.append('description', formData.description);
    
    // Duration normalizer
    const totalSeconds = (parseInt(formData.durationMins || 0) * 60) + parseInt(formData.durationSecs || 0);
    if (totalSeconds > 0) payload.append('estimated_duration', totalSeconds);

    if (selectedFile) payload.append('sheet_music', selectedFile);

    try {
      const res = piece?.id 
        ? await api.patch(`/api/pieces/${piece.id}/`, payload, { headers: { 'Content-Type': 'multipart/form-data' }})
        : await api.post('/api/pieces/', payload, { headers: { 'Content-Type': 'multipart/form-data' }});
      
      const pieceId = res.data.id;
      const syncPromises = [];
      
      // Sync relational requirements
      deletedReqIds.forEach(id => syncPromises.push(api.delete(`/api/piece-voice-requirements/${id}/`)));

      requirements.forEach(req => {
        if (req.isNew) {
          syncPromises.push(api.post('/api/piece-voice-requirements/', { piece: pieceId, voice_line: req.voice_line, quantity: req.quantity }));
        } else if (req.isModified) {
          syncPromises.push(api.patch(`/api/piece-voice-requirements/${req.id}/`, { quantity: req.quantity }));
        }
      });

      if (syncPromises.length > 0) await Promise.all(syncPromises);
      
      setStatusMsg({ type: 'success', text: piece?.id ? 'Zaktualizowano dane utworu.' : 'Utwór dodany! Możesz wprowadzić kolejny.' });
      onSuccess(res.data, submitAction);
      
      if (submitAction !== 'SAVE_AND_ADD') {
          setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Wystąpił błąd podczas zapisu utworu.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // UI Theme Classes
  const glassInputStyle = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
  const labelStyle = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] relative pb-8">
      {statusMsg.text && (
        <div className={`p-4 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest mb-5 border shadow-sm ${statusMsg.type === 'success' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700' : 'bg-red-50/80 border-red-200 text-red-700'}`}>
          {statusMsg.text}
        </div>
      )}

      {/* --- SECTION 1: Core Metadata --- */}
      <div className="space-y-6">
        <div>
            <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395] mb-2 ml-1">Tytuł Utworu *</label>
            <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className={`${glassInputStyle} text-lg font-bold text-stone-900`} placeholder="np. Lacrimosa" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <div className="flex justify-between items-end mb-2">
                    <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 ml-1">Kompozytor</label>
                    <button type="button" onClick={() => setIsAddingComposer(!isAddingComposer)} className="text-[9px] text-[#002395] font-bold antialiased uppercase tracking-widest hover:underline">
                        {isAddingComposer ? 'Wróć do wyszukiwarki' : '+ Dodaj Nowego'}
                    </button>
                </div>
                
                {isAddingComposer ? (
                    <div className="flex flex-col gap-3 bg-white/50 backdrop-blur-sm p-5 border border-stone-200/80 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                        <div className="grid grid-cols-2 gap-3">
                            <input type="text" placeholder="Imię" value={newComposerData.first_name} onChange={e => setNewComposerData({...newComposerData, first_name: e.target.value})} className="w-full px-3 py-2.5 text-xs font-bold text-stone-800 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002395]/20" />
                            <input type="text" placeholder="Nazwisko *" required value={newComposerData.last_name} onChange={e => setNewComposerData({...newComposerData, last_name: e.target.value})} className="w-full px-3 py-2.5 text-xs font-bold text-stone-800 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002395]/20" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input type="number" placeholder="Rok ur." value={newComposerData.birth_year} onChange={e => setNewComposerData({...newComposerData, birth_year: e.target.value})} className="w-full px-3 py-2.5 text-xs font-bold text-stone-800 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002395]/20" />
                            <input type="number" placeholder="Rok śm." value={newComposerData.death_year} onChange={e => setNewComposerData({...newComposerData, death_year: e.target.value})} className="w-full px-3 py-2.5 text-xs font-bold text-stone-800 bg-white border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-[#002395]/20" />
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={14} className="text-stone-400" /></div>
                        <input 
                            type="text" placeholder="Szukaj na liście (lub zostaw puste)" value={compSearchTerm}
                            onChange={e => { setCompSearchTerm(e.target.value); setFormData(prev => ({...prev, composer: ''})); setIsCompDropdownOpen(true); }}
                            onFocus={() => setIsCompDropdownOpen(true)} onBlur={() => setTimeout(() => setIsCompDropdownOpen(false), 200)}
                            className={`${glassInputStyle} pl-10 font-bold`}
                        />
                        <AnimatePresence>
                            {isCompDropdownOpen && (
                                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute z-50 w-full mt-2 bg-white/90 backdrop-blur-xl border border-stone-200/60 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] max-h-48 overflow-y-auto overflow-hidden">
                                    <div onClick={() => { setFormData(prev => ({...prev, composer: ''})); setCompSearchTerm(''); setIsCompDropdownOpen(false); }} className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-stone-400 hover:bg-stone-50 cursor-pointer border-b border-stone-100">-- Tradycyjny / Nieznany --</div>
                                    {filteredComposers.map(c => (
                                        <div key={c.id} onClick={() => { setFormData(prev => ({...prev, composer: c.id})); setIsCompDropdownOpen(false); }} className="px-4 py-3 text-sm font-bold text-stone-800 hover:bg-[#002395] hover:text-white cursor-pointer transition-colors">
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
                <label className={labelStyle}>Aranżer</label>
                <input type="text" value={formData.arranger} onChange={e => setFormData({...formData, arranger: e.target.value})} className={`${glassInputStyle} font-bold`} placeholder="np. John Rutter" />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2">
                <label className={labelStyle}>Epoka Muzyczna</label>
                <select value={formData.epoch} onChange={e => setFormData({...formData, epoch: e.target.value})} className={`${glassInputStyle} font-bold appearance-none`}>
                    <option value="">-- Wybierz Epokę --</option>
                    {EPOCHS.map(ep => <option key={ep.value} value={ep.value}>{ep.label}</option>)}
                </select>
            </div>
            <div>
                <label className={labelStyle}>Rok Powstania</label>
                <input type="number" placeholder="np. 1741" value={formData.composition_year} onChange={e => setFormData({...formData, composition_year: e.target.value})} className={`${glassInputStyle} font-bold`} />
            </div>
            <div>
                <label className={labelStyle}>Język</label>
                <input type="text" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})} className={`${glassInputStyle} font-bold`} placeholder="np. Łacina" />
            </div>
        </div>
      </div>

      {/* --- SECTION 2: Execution & Planning --- */}
      <div className="border-t border-stone-200/60 pt-8 space-y-6">
          <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-800 flex items-center gap-2.5">
              <Music size={16} className="text-[#002395]" /> Wymagania Wykonawcze
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className={labelStyle}>Obsada Wokalna (Zapis Tradycyjny)</label>
                <input type="text" value={formData.voicing} onChange={e => setFormData({...formData, voicing: e.target.value})} className={`${glassInputStyle} font-bold`} placeholder="np. SSAATTBB, Chór + Soliści" />
            </div>
            <div>
                <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1 flex items-center gap-1.5"><Clock size={12}/> Szacowany Czas Trwania</label>
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <input type="number" min="0" placeholder="Minuty" value={formData.durationMins} onChange={e => setFormData({...formData, durationMins: e.target.value})} className={`${glassInputStyle} pr-12 text-right font-bold`} />
                        <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[9px] text-stone-400 font-bold uppercase tracking-widest">min</span>
                    </div>
                    <span className="text-stone-300 font-bold text-lg">:</span>
                    <div className="relative flex-1">
                        <input type="number" min="0" max="59" placeholder="Sekundy" value={formData.durationSecs} onChange={e => setFormData({...formData, durationSecs: e.target.value})} className={`${glassInputStyle} pr-12 text-right font-bold`} />
                        <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-[9px] text-stone-400 font-bold uppercase tracking-widest">sek</span>
                    </div>
                </div>
            </div>
          </div>

          <div className="border border-stone-200/60 rounded-2xl overflow-hidden shadow-sm mt-6 bg-white/40">
            <div className="bg-stone-50/50 backdrop-blur-sm p-5 border-b border-stone-200/60">
                <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 mb-1.5">Algorytm Obsady (Divisi)</h4>
                <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-stone-400 mb-4 leading-relaxed max-w-lg">Wybierz głosy i ustal minimalną ilość śpiewaków do weryfikacji braków kadrowych w trybie Mikro-Obsady.</p>
                
                <div className="flex flex-wrap gap-2.5">
                    {voiceLines.filter(vl => !requirements.some(r => r.voice_line === vl.value)).map(vl => (
                        <button 
                        key={vl.value} type="button" onClick={() => setRequirements([...requirements, { voice_line: vl.value, voice_line_display: vl.label, quantity: 1, isNew: true }])}
                        className="px-4 py-2 bg-white border border-stone-200/80 text-stone-600 hover:text-[#002395] hover:border-[#002395]/40 hover:bg-blue-50/50 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                        >
                        <Plus size={12} /> {vl.label}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="p-4 space-y-3">
            {requirements.length > 0 ? requirements.map((req, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white/80 border border-stone-200/60 px-5 py-3 rounded-xl shadow-sm transition-colors">
                <span className="text-[10px] font-bold antialiased text-[#002395] uppercase tracking-widest">{req.voice_line_display}</span>
                <div className="flex items-center gap-5">
                    <div className="flex items-center gap-2 bg-stone-50 border border-stone-200/80 rounded-lg shadow-inner px-1 py-1">
                        <button type="button" onClick={() => updateRequirementQuantity(idx, -1)} disabled={req.quantity <= 1} className="p-2 text-stone-400 hover:text-stone-800 disabled:opacity-30 transition-colors active:scale-95 bg-white rounded-md shadow-sm"><Minus size={12}/></button>
                        <span className="text-xs font-bold text-stone-800 w-6 text-center">{req.quantity}</span>
                        <button type="button" onClick={() => updateRequirementQuantity(idx, 1)} className="p-2 text-stone-400 hover:text-stone-800 transition-colors active:scale-95 bg-white rounded-md shadow-sm"><Plus size={12}/></button>
                    </div>
                    <button type="button" onClick={() => handleRemoveRequirement(idx)} className="text-stone-300 hover:text-red-500 p-2.5 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100 active:scale-95"><Trash2 size={16}/></button>
                </div>
                </div>
            )) : <p className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-400 italic text-center py-6">Brak zdefiniowanych wymagań.</p>}
            </div>
          </div>
      </div>

      {/* --- SECTION 3: Materials & Content --- */}
      <div className="border-t border-stone-200/60 pt-8 space-y-6">
          <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-800 flex items-center gap-2.5">
              <AlignLeft size={16} className="text-[#002395]" /> Materiały i Teksty
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                  <label className={labelStyle}>Tekst Oryginalny</label>
                  <textarea value={formData.lyrics_original} onChange={e => setFormData({...formData, lyrics_original: e.target.value})} rows={5} className={`${glassInputStyle} resize-none font-medium text-xs leading-relaxed`} placeholder="Wklej oryginalny tekst utworu..." />
              </div>
              <div>
                  <label className={labelStyle}>Tłumaczenie (Notatki)</label>
                  <textarea value={formData.lyrics_translation} onChange={e => setFormData({...formData, lyrics_translation: e.target.value})} rows={5} className={`${glassInputStyle} resize-none font-medium text-xs leading-relaxed`} placeholder="Wklej polskie tłumaczenie..." />
              </div>
          </div>

          <div>
              <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1 flex items-center gap-1.5"><Youtube size={14} className="text-red-600"/> Nagranie Referencyjne (URL)</label>
              <input type="url" value={formData.reference_recording} onChange={e => setFormData({...formData, reference_recording: e.target.value})} className={glassInputStyle} placeholder="https://youtube.com/watch?v=..." />
          </div>

          <div className="p-6 border border-stone-200/60 rounded-2xl bg-white/40 shadow-sm mt-4">
            <label className={labelStyle}>Partytura / Nuty (Opcjonalnie PDF)</label>
            {piece?.sheet_music && !selectedFile && (
            <p className="text-[9px] uppercase font-bold antialiased tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500"/> Dokument nutowy jest już załączony w bazie.
            </p>
            )}
            <input 
            type="file" accept="application/pdf" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files[0])}
            className="w-full mt-1 text-sm text-stone-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-[9px] file:font-bold file:antialiased file:uppercase file:tracking-widest file:bg-white file:text-[#002395] file:shadow-sm hover:file:bg-blue-50 hover:file:text-[#001766] cursor-pointer border border-stone-200/60 rounded-xl bg-white/50 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all"
            />
          </div>
      </div>

      {/* --- SUBMIT ACTIONS --- */}
      <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-4">
        {!piece?.id && (
            <button type="submit" onClick={() => setSubmitAction('SAVE_AND_ADD')} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2.5 bg-white/80 backdrop-blur-md border border-stone-200/80 hover:bg-white hover:shadow-md text-stone-600 text-[10px] uppercase tracking-widest font-bold antialiased py-4 rounded-xl transition-all shadow-sm disabled:opacity-50 active:scale-95">
                {isSubmitting && submitAction === 'SAVE_AND_ADD' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Zapisz i dodaj kolejny
            </button>
        )}
        <button type="submit" onClick={() => setSubmitAction('SAVE_AND_CLOSE')} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2.5 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-4 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] disabled:opacity-50 active:scale-95">
            {isSubmitting && submitAction === 'SAVE_AND_CLOSE' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {piece?.id ? 'Zapisz Zmiany' : 'Zapisz i zamknij'}
        </button>
      </div>

    </form>
  );
}