/**
 * @file ArtistEditorPanel.tsx
 * @description Slide-over panel and form for creating or editing Artist profiles.
 * @architecture
 * Implements "Dirty State Tracking" to prevent accidental data loss.
 * Encapsulates form mutations and validation, keeping the parent controller clean.
 * Uses React Portal to break out of the layout stacking context.
 * @module hr/ArtistEditorPanel
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; // <--- DODANE
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query'; // <--- DODANE

import api from '../../utils/api';
import ConfirmModal from '../../components/ui/ConfirmModal';
import type { Artist } from '../../types';

interface VoiceTypeOption {
  value: string;
  label: string;
}

interface ArtistEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  artist: Artist | null;
  voiceTypes: VoiceTypeOption[];
  // Usunięto przestarzałe refreshGlobal
}

interface ArtistFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  voice_type: string;
  is_active: boolean;
  sight_reading_skill: string;
  vocal_range_bottom: string;
  vocal_range_top: string;
}

// --- Static Styles ---
const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
const STYLE_LABEL = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

export default function ArtistEditorPanel({ 
  isOpen, onClose, artist, voiceTypes 
}: ArtistEditorPanelProps): React.ReactPortal | null { // <--- ZMIANA TYPU
  
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  
  // Zabezpieczenie przed błędem hydratacji przy portalach
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // --- Form Initialization & Dirty Tracking ---
  const initialFormData = useMemo<ArtistFormData>(() => ({
    first_name: artist?.first_name || '', 
    last_name: artist?.last_name || '',
    email: artist?.email || '', 
    phone_number: artist?.phone_number || '',
    voice_type: artist?.voice_type || (voiceTypes.length > 0 ? voiceTypes[0].value : 'SOP'), 
    is_active: artist?.is_active ?? true,
    sight_reading_skill: artist?.sight_reading_skill ? String(artist.sight_reading_skill) : '',
    vocal_range_bottom: artist?.vocal_range_bottom || '', 
    vocal_range_top: artist?.vocal_range_top || ''
  }), [artist, voiceTypes]);

  const [formData, setFormData] = useState<ArtistFormData>(initialFormData);

  // Sync state when panel opens/changes artist
  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  const isFormDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  }, [formData, initialFormData]);

  // --- Handlers ---
  const handleCloseRequest = () => {
    if (isFormDirty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const forceClose = () => {
    setShowExitConfirm(false);
    onClose();
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => { // <--- SYNTHETIC EVENT
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading(artist?.id ? "Aktualizowanie profilu..." : "Tworzenie konta artysty...");

    const payload: any = { ...formData };
    payload.sight_reading_skill = payload.sight_reading_skill ? parseInt(payload.sight_reading_skill) : null;

    try {
      if (artist?.id) {
        await api.patch(`/api/artists/${artist.id}/`, payload);
        toast.success("Zaktualizowano profil artysty.", { id: toastId });
      } else {
        await api.post('/api/artists/', payload);
        toast.success("Dodano artystę. Konto wygenerowane!", { id: toastId });
      }
      
      // ZAMIAST refreshGlobal() używamy React Query
      await queryClient.invalidateQueries({ queryKey: ['artists'] }); 
      setFormData(payload); // Reset dirty state technically
      onClose(); // Auto close on success
    } catch (err: any) {
      console.error("[ArtistEditor] Form submission failed:", err);
      const isEmailTaken = err.response?.data?.email;
      toast.error(isEmailTaken ? "Ten adres e-mail jest już zajęty." : "Wystąpił błąd zapisu.", { 
        id: toastId,
        description: "Sprawdź poprawność danych i spróbuj ponownie."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <React.Fragment key="artist-panel-wrapper">
          <motion.div 
            key="artist-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleCloseRequest} 
            style={{ zIndex: 9998 }} // <--- TWARDY Z-INDEX
            className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm"
            aria-hidden="true"
          />
          
          <motion.div 
            key="artist-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ zIndex: 9999 }} // <--- TWARDY Z-INDEX
            className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#f4f2ee] shadow-2xl flex flex-col border-l border-white/60"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center p-6 md:p-8 border-b border-stone-200/50 bg-white/80 backdrop-blur-xl flex-shrink-0 z-20">
              <h3 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
                {artist?.id ? 'Edycja Profilu' : 'Nowy Artysta'}
              </h3>
              <button 
                onClick={handleCloseRequest} 
                className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-2.5 rounded-2xl active:scale-95"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 relative">
              
              <form onSubmit={handleSubmit} className="space-y-8 bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] relative flex flex-col min-h-full">
                
                <div className="flex-1 space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-5">
                        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">Dane Podstawowe</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                            <label className={STYLE_LABEL}>Imię *</label>
                            <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className={`${STYLE_GLASS_INPUT} font-bold`} disabled={isSubmitting} />
                            </div>
                            <div>
                            <label className={STYLE_LABEL}>Nazwisko *</label>
                            <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className={`${STYLE_GLASS_INPUT} font-bold`} disabled={isSubmitting} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                            <label className={STYLE_LABEL}>E-mail *</label>
                            <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={STYLE_GLASS_INPUT} disabled={isSubmitting} />
                            </div>
                            <div>
                            <label className={STYLE_LABEL}>Telefon</label>
                            <input type="tel" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} className={STYLE_GLASS_INPUT} disabled={isSubmitting} />
                            </div>
                        </div>
                    </div>

                    {/* Vocal Profile */}
                    <div className="space-y-5 pt-4">
                        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">Profil Wokalny</h4>
                        
                        <div>
                            <label className={STYLE_LABEL}>Rodzaj Głosu *</label>
                            <select value={formData.voice_type} onChange={e => setFormData({...formData, voice_type: e.target.value})} className={`${STYLE_GLASS_INPUT} font-bold appearance-none`} disabled={isSubmitting}>
                            {voiceTypes.length > 0 ? voiceTypes.map(vt => <option key={vt.value} value={vt.value}>{vt.label}</option>) : <option value="SOP">Ładowanie...</option>}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div>
                            <label className={STYLE_LABEL} title="Najniższy dźwięk">Skala (Dół)</label>
                            <input type="text" placeholder="np. G2" value={formData.vocal_range_bottom} onChange={e => setFormData({...formData, vocal_range_bottom: e.target.value})} className={`${STYLE_GLASS_INPUT} text-center font-bold text-[#002395]`} disabled={isSubmitting} />
                            </div>
                            <div>
                            <label className={STYLE_LABEL} title="Najwyższy dźwięk">Skala (Góra)</label>
                            <input type="text" placeholder="np. C5" value={formData.vocal_range_top} onChange={e => setFormData({...formData, vocal_range_top: e.target.value})} className={`${STYLE_GLASS_INPUT} text-center font-bold text-[#002395]`} disabled={isSubmitting} />
                            </div>
                        </div>

                        <div>
                            <label className={STYLE_LABEL}>Czytanie a vista (Ocena)</label>
                            <select value={formData.sight_reading_skill} onChange={e => setFormData({...formData, sight_reading_skill: e.target.value})} className={`${STYLE_GLASS_INPUT} font-bold appearance-none`} disabled={isSubmitting}>
                            <option value="">— Brak oceny —</option>
                            {[1, 2, 3, 4, 5].map(num => <option key={num} value={num}>{num} Gwiazdki</option>)}
                            </select>
                        </div>
                    </div>

                    {/* System Account Flag */}
                    <div className="pt-6 border-t border-stone-200/60">
                        <label className="flex items-center gap-4 p-4 border border-stone-200/80 rounded-xl bg-white/50 backdrop-blur-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] cursor-pointer hover:border-[#002395]/40 transition-colors">
                        <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 text-[#002395] focus:ring-[#002395]/20 border-stone-300 rounded-md cursor-pointer" disabled={isSubmitting} />
                        <div>
                            <span className="block text-sm font-bold text-stone-800">Aktywny dostęp do platformy</span>
                            <span className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mt-1">Zablokuje logowanie w przypadku odznaczenia.</span>
                        </div>
                        </label>
                    </div>
                </div>

                {/* Sticky Action Bar */}
                <div className="sticky bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-stone-200/60 p-4 md:p-6 -mx-6 md:-mx-8 -mb-8 mt-8 flex flex-col sm:flex-row gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-b-2xl">
                    <button 
                        type="submit" disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-2.5 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3.5 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] disabled:shadow-none active:scale-95"
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                        {artist?.id ? 'Zapisz Profil' : 'Utwórz Artystę'}
                    </button>
                </div>

              </form>
            </div>
            
            {/* Modal bezpieczeństwa: Niezapisane zmiany */}
            <ConfirmModal 
              isOpen={showExitConfirm}
              title="Masz niezapisane zmiany!"
              description="Wprowadziłeś zmiany w formularzu, które nie zostały zapisane. Zamknięcie panelu spowoduje ich utratę."
              onConfirm={forceClose}
              onCancel={() => setShowExitConfirm(false)}
            />

          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>,
    document.body
  );
}