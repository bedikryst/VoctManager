/**
 * @file CrewEditorPanel.tsx
 * @description Slide-over panel and form for creating or editing crew profiles.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2 } from 'lucide-react';

import ConfirmModal from '../../../shared/ui/ConfirmModal';
import { Input } from '../../../shared/ui/Input';
import { Button } from '../../../shared/ui/Button';
import type { Collaborator } from '../../../shared/types';
import { useCrewForm } from '../hooks/useCrewForm';
import type { CrewFormData } from '../types/crew.dto';
import { SPECIALTY_CHOICES } from '../types/crew.dto';

interface CrewEditorPanelProps {
    isOpen: boolean;
    onClose: () => void;
    person: Collaborator | null;
    initialSearchContext?: string;
}

const STYLE_LABEL = "block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2 ml-1";
const STYLE_SELECT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function CrewEditorPanel({
    isOpen,
    onClose,
    person,
    initialSearchContext = '',
}: CrewEditorPanelProps): React.ReactPortal | null {
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const {
        formData,
        setFormData,
        initialFormData,
        isFormDirty,
        isSubmitting,
        handleSubmit,
    } = useCrewForm(person, initialSearchContext, onClose);

    useEffect(() => {
        if (isOpen) {
            setFormData(initialFormData);
        }
    }, [initialFormData, isOpen, setFormData]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen && !showExitConfirm) {
                handleCloseRequest();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => window.removeEventListener('keydown', handleKeyDown);
    });

    const handleCloseRequest = () => {
        if (isFormDirty) {
            setShowExitConfirm(true);
            return;
        }

        onClose();
    };

    const forceClose = () => {
        setShowExitConfirm(false);
        onClose();
    };

    if (!mounted) {
        return null;
    }

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <React.Fragment key="crew-panel-wrapper">
                    <motion.div
                        key="crew-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleCloseRequest}
                        style={{ zIndex: 9998 }}
                        className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm"
                        aria-hidden="true"
                    />

                    <motion.div
                        key="crew-panel"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
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
                            <form
                                onSubmit={handleSubmit}
                                className="space-y-6 bg-white/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-white/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] relative flex flex-col min-h-full"
                            >
                                <div className="flex-1 space-y-5">
                                    <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">
                                        Osoba Kontaktowa
                                    </h4>
                                    <div className="grid grid-cols-2 gap-5">
                                        <div>
                                            <label className={STYLE_LABEL}>Imię *</label>
                                            <Input
                                                type="text"
                                                required
                                                value={formData.first_name}
                                                onChange={(event) => setFormData({ ...formData, first_name: event.target.value })}
                                                disabled={isSubmitting}
                                                className="font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className={STYLE_LABEL}>Nazwisko *</label>
                                            <Input
                                                type="text"
                                                required
                                                value={formData.last_name}
                                                onChange={(event) => setFormData({ ...formData, last_name: event.target.value })}
                                                disabled={isSubmitting}
                                                className="font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-5">
                                        <div>
                                            <label className={STYLE_LABEL}>E-mail</label>
                                            <Input
                                                type="email"
                                                value={formData.email}
                                                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                        <div>
                                            <label className={STYLE_LABEL}>Telefon</label>
                                            <Input
                                                type="tel"
                                                value={formData.phone_number}
                                                onChange={(event) => setFormData({ ...formData, phone_number: event.target.value })}
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-5 pt-4 border-t border-stone-200/60">
                                        <h4 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-[#002395] border-b border-stone-200/60 pb-2">
                                            Profil Działalności
                                        </h4>

                                        <div>
                                            <label className={STYLE_LABEL}>Specjalizacja *</label>
                                            <select
                                                value={formData.specialty}
                                                onChange={(event) =>
                                                    setFormData({
                                                        ...formData,
                                                        specialty: event.target.value as CrewFormData['specialty'],
                                                    })
                                                }
                                                className={`${STYLE_SELECT} font-bold text-stone-700 appearance-none`}
                                                disabled={isSubmitting}
                                            >
                                                {SPECIALTY_CHOICES.map((specialty) => (
                                                    <option key={specialty.value} value={specialty.value}>
                                                        {specialty.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className={STYLE_LABEL}>Firma / Marka (Opcjonalnie)</label>
                                            <Input
                                                type="text"
                                                placeholder="np. SoundTech Pro Sp. z o.o."
                                                value={formData.company_name}
                                                onChange={(event) => setFormData({ ...formData, company_name: event.target.value })}
                                                disabled={isSubmitting}
                                                className="font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="sticky bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-stone-200/60 p-4 md:p-6 -mx-6 md:-mx-8 -mb-8 mt-8 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-b-2xl">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={isSubmitting}
                                        isLoading={isSubmitting}
                                        leftIcon={!isSubmitting ? <CheckCircle2 size={16} aria-hidden="true" /> : undefined}
                                        className="w-full"
                                    >
                                        Zapisz do bazy
                                    </Button>
                                </div>
                            </form>
                        </div>

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
        document.body,
    );
}
