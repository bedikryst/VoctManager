/**
 * @file CrewManagement.tsx
 * @description External Collaborators & Crew Management Module Controller.
 * Delegates data fetching and filtering to the useCrewData hook and isolates rendering to CrewCard.
 * @module panel/crew/CrewManagement
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Plus, Search, Filter, Wrench } from 'lucide-react';

import ConfirmModal from '../../shared/ui/ConfirmModal';
import { Button } from '../../shared/ui/Button';
import { Input } from '../../shared/ui/Input';
import { GlassCard } from '../../shared/ui/GlassCard';

import CrewEditorPanel, { SPECIALTY_CHOICES } from './CrewEditorPanel';
import { CrewCard } from './CrewCard';
import { useCrewData } from './hooks/useCrewData';

export default function CrewManagement(): React.JSX.Element {
    const {
        isLoading, isError, displayCrew,
        searchTerm, setSearchTerm, specialtyFilter, setSpecialtyFilter,
        isPanelOpen, editingPerson, initialSearchContext,
        personToDelete, setPersonToDelete, isDeleting,
        openPanel, closePanel, executeDelete
    } = useCrewData();

    useEffect(() => {
        if (isError) toast.error("Ostrzeżenie", { description: "Nie udało się pobrać listy współpracowników." });
    }, [isError]);

    useEffect(() => {
        document.body.style.overflow = isPanelOpen || personToDelete ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isPanelOpen, personToDelete]);

    return (
        <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-7xl mx-auto px-4 sm:px-0">
            
            <header className="relative pt-2 mb-8">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                                <Wrench size={12} className="text-[#002395]" aria-hidden="true" />
                                <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">Logistyka</p>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                                Ekipa <span className="italic text-[#002395]">Techniczna</span>.
                            </h1>
                        </div>
                        <Button 
                            variant="primary"
                            onClick={() => openPanel(null)} 
                            leftIcon={<Plus size={16} aria-hidden="true" />}
                        >
                            Dodaj Osobę / Firmę
                        </Button>
                    </div>
                </motion.div>
            </header>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="flex-1">
                    <Input 
                        leftIcon={<Search size={16} />}
                        type="text" 
                        placeholder="Szukaj po nazwisku lub firmie..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative w-full sm:w-72 flex-shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Filter size={16} className="text-stone-400" aria-hidden="true" />
                    </div>
                    <select 
                        value={specialtyFilter} 
                        onChange={e => setSpecialtyFilter(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] font-bold appearance-none cursor-pointer"
                    >
                        <option value="">Wszystkie specjalizacje</option>
                        {SPECIALTY_CHOICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-64 bg-stone-100/50 rounded-[2rem] border border-white/50 animate-pulse"></div>
                    ))
                ) : displayCrew.length > 0 ? (
                    <AnimatePresence>
                        {displayCrew.map((person) => (
                            <CrewCard 
                                key={person.id} 
                                person={person} 
                                onEdit={openPanel} 
                                onDelete={(id) => setPersonToDelete(id)} 
                            />
                        ))}
                    </AnimatePresence>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full">
                        <GlassCard className="p-16 text-center flex flex-col items-center justify-center">
                            <Wrench size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
                            <span className="text-[11px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-2">Brak wyników</span>
                            
                            {searchTerm ? (
                                <div className="flex flex-col items-center gap-3 mt-2">
                                    <span className="text-xs text-stone-400 max-w-sm">Nie znaleźliśmy firmy lub osoby "{searchTerm}". Możesz dodać ją teraz.</span>
                                    <Button 
                                        variant="outline"
                                        onClick={() => openPanel(null, searchTerm)} 
                                        leftIcon={<Plus size={14} aria-hidden="true" />}
                                        className="mt-2"
                                    >
                                        Dodaj do bazy: {searchTerm}
                                    </Button>
                                </div>
                            ) : (
                                <span className="text-xs text-stone-400 max-w-sm">Zmień filtry lub dodaj nową osobę / firmę do bazy.</span>
                            )}
                        </GlassCard>
                    </motion.div>
                )}
            </div>

            <CrewEditorPanel 
                isOpen={isPanelOpen}
                onClose={closePanel}
                person={editingPerson}
                initialSearchContext={initialSearchContext}
            />

            <ConfirmModal 
                isOpen={!!personToDelete}
                title="Usunąć tę osobę z bazy?"
                description="Zniknie ona bezpowrotnie ze spisu. Nie można usunąć osób powiązanych już z koncertami (w takim przypadku zaktualizuj jej dane)."
                onConfirm={executeDelete}
                onCancel={() => setPersonToDelete(null)}
                isLoading={isDeleting}
            />
        </div>
    );
}