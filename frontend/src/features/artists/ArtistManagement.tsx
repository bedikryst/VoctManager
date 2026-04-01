/**
 * @file ArtistManagement.tsx
 * @description HR & Roster Management Module Controller.
 * Implements high-density Card Grid view for superior glanceability.
 * Delegates data fetching and filtering to useArtistData hook.
 * @module panel/artists/ArtistManagement
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { UserPlus, Search, Filter, Users, LayoutGrid } from 'lucide-react';

import { useArtistData } from './hooks/useArtistData';
import ConfirmModal from '../../shared/ui/ConfirmModal';
import { Button } from '../../shared/ui/Button';
import { Input } from '../../shared/ui/Input';
import { GlassCard } from '../../shared/ui/GlassCard';
import { VoiceFilterButton} from './components/VoiceFilterButton';
import { useBodyScrollLock } from '../../shared/lib/hooks/useBodyScrollLock';

import ArtistEditorPanel from './ArtistEditorPanel';
import { ArtistCard } from './ArtistCard';


export default function ArtistManagement(): React.JSX.Element {
    const {
        isLoading, isError, voiceTypes,
        searchTerm, setSearchTerm, voiceFilter, setVoiceFilter,
        ensembleBalance, displayArtists,
        isPanelOpen, editingArtist, initialSearchContext,
        artistToToggle, setArtistToToggle, isTogglingStatus,
        openPanel, closePanel, handleToggleRequest, executeStatusToggle
    } = useArtistData();

    useEffect(() => {
        if (isError) toast.error("Ostrzeżenie", { description: "Nie udało się pobrać danych o artystach." });
    }, [isError]);

    useBodyScrollLock(isPanelOpen || artistToToggle !== null);

    return (
        <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-7xl mx-auto px-4 sm:px-0">
            
            <header className="relative pt-2 mb-8">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                                <Users size={12} className="text-[#002395]" aria-hidden="true" />
                                <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">Zasoby Ludzkie</p>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                                Zarządzanie <span className="italic text-[#002395]">Zespołem</span>.
                            </h1>
                        </div>
                        <Button 
                            variant="primary"
                            onClick={() => openPanel(null)} 
                            leftIcon={<UserPlus size={16} aria-hidden="true" />}
                        >
                            Dodaj Artystę
                        </Button>
                    </div>
                </motion.div>
            </header>

            {/* --- FILTER BAR --- */}
            <div className="inline-flex flex-wrap items-center gap-2.5 p-2.5 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-3xl w-full sm:w-auto mb-2">
                <VoiceFilterButton 
                    voiceType="S" 
                    label="Soprany" 
                    count={ensembleBalance.S} 
                    isActive={voiceFilter === 'S'} 
                    onClick={() => setVoiceFilter(voiceFilter === 'S' ? '' : 'S')} 
                />
                <VoiceFilterButton 
                    voiceType="A" 
                    label="Alty" 
                    count={ensembleBalance.A} 
                    isActive={voiceFilter === 'A'} 
                    onClick={() => setVoiceFilter(voiceFilter === 'A' ? '' : 'A')} 
                />
                <VoiceFilterButton 
                    voiceType="T" 
                    label="Tenory" 
                    count={ensembleBalance.T} 
                    isActive={voiceFilter === 'T'} 
                    onClick={() => setVoiceFilter(voiceFilter === 'T' ? '' : 'T')} 
                />
                <VoiceFilterButton 
                    voiceType="B" 
                    label="Basy" 
                    count={ensembleBalance.B} 
                    isActive={voiceFilter === 'B'} 
                    onClick={() => setVoiceFilter(voiceFilter === 'B' ? '' : 'B')} 
                />
                <VoiceFilterButton 
                    voiceType="ALL" 
                    label="Tutti" 
                    count={ensembleBalance.Total} 
                    isActive={voiceFilter === ''} 
                    onClick={() => setVoiceFilter('')} 
                />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="flex-1">
                    <Input 
                        leftIcon={<Search size={16} />}
                        type="text" 
                        placeholder="Szukaj po nazwisku..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative w-full sm:w-72 flex-shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Filter size={16} className="text-stone-400" aria-hidden="true" />
                    </div>
                    <select 
                        value={voiceFilter} 
                        onChange={e => setVoiceFilter(e.target.value)} 
                        className="w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] font-bold appearance-none cursor-pointer"
                    >
                        <option value="">Wszystkie głosy</option>
                        {voiceTypes.map(vt => <option key={vt.value} value={vt.value}>{vt.label}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-64 bg-stone-100/50 rounded-[2rem] border border-white/50 animate-pulse"></div>
                    ))
                ) : displayArtists.length > 0 ? (
                    <AnimatePresence>
                        {displayArtists.map((artist) => (
                            <ArtistCard 
                                key={artist.id}
                                artist={artist}
                                onEdit={openPanel}
                                onToggleStatus={handleToggleRequest}
                            />
                        ))}
                    </AnimatePresence>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full">
                        <GlassCard className="p-16 flex flex-col items-center justify-center text-center">
                            <LayoutGrid size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
                            <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak wyników</span>
                            
                            {searchTerm ? (
                                <div className="flex flex-col items-center gap-3 mt-2">
                                    <span className="text-xs text-stone-400 max-w-sm">Nie znaleźliśmy chórzysty "{searchTerm}". Możesz dodać go teraz do bazy.</span>
                                    <Button 
                                        variant="outline"
                                        onClick={() => openPanel(null, searchTerm)} 
                                        leftIcon={<UserPlus size={14} aria-hidden="true" />}
                                        className="mt-2"
                                    >
                                        Dodaj: {searchTerm}
                                    </Button>
                                </div>
                            ) : (
                                <span className="text-xs text-stone-400 max-w-sm">Zmień kryteria wyszukiwania lub dodaj nową osobę do bazy.</span>
                            )}
                        </GlassCard>
                    </motion.div>
                )}
            </div>

            <ArtistEditorPanel 
                isOpen={isPanelOpen} 
                onClose={closePanel} 
                artist={editingArtist} 
                voiceTypes={voiceTypes} 
                initialSearchContext={initialSearchContext} 
            />

            <ConfirmModal 
                isOpen={!!artistToToggle}
                title={artistToToggle?.willBeActive ? "Aktywować profil?" : "Zarchiwizować artystę?"}
                description={artistToToggle?.willBeActive 
                    ? "Artysta odzyska możliwość logowania się do platformy i będzie widoczny w obsadzie nowych projektów." 
                    : "Artysta utraci dostęp do panelu. Jego dane historyczne w przeszłych projektach zostaną zachowane."}
                onConfirm={executeStatusToggle}
                onCancel={() => setArtistToToggle(null)}
                isLoading={isTogglingStatus}
            />
        </div>
    );
}