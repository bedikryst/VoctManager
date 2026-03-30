/**
 * @file CrewEditorPanel.tsx
 * @description Slide-over panel and form for creating or editing Crew profiles.
 * @architecture Enterprise 2026
 * - Implements "Dirty State Tracking" with ESC key listener to prevent accidental data loss.
 * - Extracts `initialSearchContext` to pre-fill inputs intelligently based on empty state queries.
 * - Uses React Portal to break out of layout Stacking Contexts.
 * @module admin/crew/CrewEditorPanel
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import api from '../../../utils/api';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import type { Collaborator } from '../../../types';

export const SPECIALTY_CHOICES = [
  { value: 'SOUND', label: 'Reżyseria Dźwięku' },
  { value: 'LIGHT', label: 'Reżyseria Świateł' },
  { value: 'VISUALS', label: 'Sztuka Wizualna' },
  { value: 'INSTRUMENT', label: 'Instrumentalista' },
  { value: 'LOGISTICS', label: 'Logistyka' },
  { value: 'OTHER', label: 'Inne' }
];

interface CrewEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  person: Collaborator | null;
  initialSearchContext?: string;
}

interface CrewFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  company_name: string;
  specialty: string;
}

const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";
const STYLE_LABEL = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";

export default function CrewEditorPanel({ 
  isOpen, onClose, person, initialSearchContext 
}: CrewEditorPanelProps): React.ReactPortal | null {
  
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // --- Smart Form Initialization ---
  const initialFormData = useMemo<CrewFormData>(() => {
      let defaultCompany = '';
      let defaultLast = '';
      
      if (!person && initialSearchContext) {
          // Prosta heurystyka: Jeśli to jedno słowo pisane wielką literą bez polskich znaków w środku, 
          // to pewnie nazwa firmy (np. SoundTech, ProAudio). Jeśli ze spacją, wstaw w nazwisko.
          if (initialSearchContext.includes(' ')) {
              defaultLast = initialSearchContext;
          } else {
              defaultCompany = initialSearchContext;
          }
      }

      return {
        first_name: person?.first_name || '', 
        last_name: person?.last_name || defaultLast,
        email: person?.email || '', 
        phone_number: person?.phone_number || '',
        company_name: person?.company_name || defaultCompany, 
        specialty: person?.specialty || 'OTHER'
      };
  }, [person, initialSearchContext]);

  const [formData, setFormData] = useState<CrewFormData>(initialFormData);

  useEffect(() => {
    if (isOpen) setFormData(initialFormData);
  }, [initialFormData, isOpen]);

  const isFormDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialFormData);
  }, [formData, initialFormData]);

  // --- ESC Listener ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showExitConfirm) handleCloseRequest();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleCloseRequest = () => {
    if (isFormDirty) setShowExitConfirm(true);
    else onClose();
  };

  const forceClose = () => {
    setShowExitConfirm(false);
    onClose();
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading(person?.id ? "Aktualizowanie danych..." : "Dodawanie współpracownika...");

    try {
      if (person?.id) {
        await api.patch(`/api/collaborators/${person.id}/`, formData);
        toast.success("Zaktualizowano profil współpracownika.", { id: toastId });
      } else {
        await api.post('/api/collaborators/', formData);
        toast.success("Dodano nową osobę do bazy.", { id: toastId });
      }
      
      await queryClient.invalidateQueries({ queryKey: ['collaborators'] }); 
      setFormData(formData); // Clear dirty state technically
      onClose(); 
    } catch (err) {
      console.error("[CrewEditor] Form submission failed:", err);
      toast.error("Wystąpił błąd podczas zapisywania danych.", { 
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
        <React.Fragment key="crew-panel-wrapper">
          <motion.div 
            key="crew-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleCloseRequest} 
            style={{ zIndex: 9998 }}
            className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm"
            aria-hidden="true"
          />
          
          <motion.div 
            key="crew-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ zIndex: 9999 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-[#f4f2ee] shadow-2xl flex flex-col border-l border-white/60"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center p-6 md:p-8 border-b border-stone-200/50 bg-white/80 backdrop-blur-xl flex-shrink-0 z-20">
              <h3 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
                {person?.id ? 'Edycja Danych' : 'Nowy Współpracownik'}
              </h3>
              <button 
                onClick={handleCloseRequest} 
                className="text-stone-400 hover:text-stone-900 transition-colors p-2.5 bg-white rounded-xl border border-stone-200/60 shadow-sm active:scale-95"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 relative">
              <form onSubmit={handleSubmit} className="space-y-6 bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] relative flex flex-col min-h-full">
                
                <div className="flex-1 space-y-5">
                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">Osoba Kontaktowa</h4>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className={STYLE_LABEL}>Imię *</label>
                        <input type="text" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className={`${STYLE_GLASS_INPUT} font-bold`} disabled={isSubmitting} />
                      </div>
                      <div>
                        <label className={STYLE_LABEL}>Nazwisko *</label>
                        <input type="text" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className={`${STYLE_GLASS_INPUT} font-bold`} disabled={isSubmitting} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className={STYLE_LABEL}>E-mail</label>
                        <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={STYLE_GLASS_INPUT} disabled={isSubmitting} />
                      </div>
                      <div>
                        <label className={STYLE_LABEL}>Telefon</label>
                        <input type="tel" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} className={STYLE_GLASS_INPUT} disabled={isSubmitting} />
                      </div>
                    </div>

                    <div className="space-y-5 pt-4 border-t border-stone-200/60">
                      <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">Profil Działalności</h4>
                      
                      <div>
                        <label className={STYLE_LABEL}>Specjalizacja *</label>
                        <select value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} className={`${STYLE_GLASS_INPUT} font-bold text-stone-700 appearance-none`} disabled={isSubmitting}>
                          {SPECIALTY_CHOICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className={STYLE_LABEL}>Firma / Marka (Opcjonalnie)</label>
                        <input type="text" placeholder="np. SoundTech Pro Sp. z o.o." value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} className={`${STYLE_GLASS_INPUT} font-bold`} disabled={isSubmitting} />
                      </div>
                    </div>
                </div>
                
                {/* Sticky Action Bar */}
                <div className="sticky bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-stone-200/60 p-4 md:p-6 -mx-6 md:-mx-8 -mb-8 mt-8 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-b-2xl">
                    <button 
                      type="submit" disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2.5 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3.5 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] disabled:shadow-none active:scale-95"
                    >
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                      Zapisz do bazy
                    </button>
                </div>

              </form>
            </div>

            {/* Bezpieczny modal ostrzegający o utracie danych */}
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