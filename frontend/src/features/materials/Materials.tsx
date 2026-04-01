/**
 * @file Materials.tsx
 * @description Master view for the Artist Rehearsal Materials Module.
 * Facilitates access to sheet music, isolated audio tracks, and casting assignments.
 * @module panel/materials/Materials
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
    Search, Music, FileText, ChevronDown, ChevronUp, 
    Download, Headphones, Briefcase, Clock, Youtube, 
    AlignLeft, Loader2, Lock, User, Users
} from 'lucide-react';

import { getReferenceRecordingLinks } from '../../shared/lib/referenceRecordings';
import { useMaterialsData } from './hooks/useMaterialsData';

import { GlassCard } from '../../shared/ui/GlassCard';
import { Input } from '../../shared/ui/Input';
import { EducationalAudioPlayer } from './EducationalAudioPlayer';

export default function Materials(): React.JSX.Element {
    const { user } = useAuth(); 
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
    const [showLyricsFor, setShowLyricsFor] = useState<string | null>(null);

    const { isLoading, isError, filteredGroups } = useMaterialsData(user?.id, searchQuery);

    useEffect(() => {
        if (isError) {
            toast.error("Błąd synchronizacji", { description: "Nie udało się załadować materiałów. Odśwież stronę." });
        }
    }, [isError]);

    const togglePieceExpand = (pieceId: string) => {
        setExpandedPieceId(prev => prev === pieceId ? null : pieceId);
    };

    const handleAudioPlay = (e: React.SyntheticEvent<HTMLAudioElement>) => {
        const target = e.currentTarget;
        document.querySelectorAll('audio').forEach(audioEl => { 
            if (audioEl !== target) audioEl.pause(); 
        });
    };

    if (isLoading && !!user?.id) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="animate-spin text-[#002395]/40" size={32} aria-hidden="true" />
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002395]/60">Synchronizacja biblioteki...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in relative cursor-default pb-24 max-w-5xl mx-auto px-4 sm:px-0">
            
            <header className="relative pt-6 mb-8">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                        <Headphones size={12} className="text-[#002395]" aria-hidden="true" />
                        <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                            Strefa Artysty
                        </p>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                        Materiały do <span className="italic text-[#002395] font-bold">ćwiczeń</span>.
                    </h1>
                    <p className="text-stone-500 mt-2 font-medium tracking-wide text-sm max-w-xl">
                        Pobieraj nuty, ćwicz z wykorzystaniem odtwarzacza MIDI z kontrolą tempa i sprawdzaj swoją rolę w zespole.
                    </p>
                </motion.div>
            </header>

            <div className="max-w-xl mb-10">
                <Input 
                    leftIcon={<Search size={16} />}
                    type="text" 
                    placeholder="Szukaj utworu lub kompozytora..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="space-y-12">
                <AnimatePresence mode="popLayout">
                    {filteredGroups.length > 0 ? (
                        filteredGroups.map((group) => {
                            const isArchived = group.project.status === 'DONE';

                            return (
                                <motion.div 
                                    key={group.project.id}
                                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                                    className="space-y-5"
                                >
                                    <div className={`flex items-center gap-3 border-b border-stone-200/60 pb-3 ml-2 ${isArchived ? 'opacity-70' : ''}`}>
                                        <Briefcase size={18} className={isArchived ? "text-stone-400" : "text-[#002395]"} aria-hidden="true" />
                                        <div>
                                            <h2 className={`text-sm font-bold antialiased uppercase tracking-widest ${isArchived ? 'text-stone-600' : 'text-stone-800'}`}>
                                                Wydarzenie: {group.project.title}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-[10px] font-bold antialiased text-stone-500 uppercase tracking-widest flex items-center gap-1">
                                                    <Clock size={10} aria-hidden="true" /> {new Date(group.project.date_time).toLocaleDateString('pl-PL')}
                                                </p>
                                                {isArchived && (
                                                    <span className="px-2 py-0.5 bg-stone-200 text-stone-600 text-[8px] font-bold antialiased uppercase tracking-widest rounded shadow-sm">
                                                        Projekt Zarchiwizowany
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {group.pieces.map((piece, idx) => {
                                        const isExpanded = expandedPieceId === String(piece.id);
                                        const referenceLinks = getReferenceRecordingLinks(piece);
                                        
                                        // Re-formatting divisi bindings dynamically
                                        const divisiGroups = piece.allCastings.reduce<Record<string, any[]>>((acc, c) => {
                                            const vl = (c as any).voice_line_display || c.voice_line || 'Inne';
                                            if (!acc[vl]) acc[vl] = [];
                                            acc[vl].push(c);
                                            return acc;
                                        }, {});
                                        
                                        return (
                                            <motion.div key={piece.id} layout>
                                                <GlassCard 
                                                    noPadding 
                                                    className={`transition-all duration-300 ${isExpanded ? 'border-[#002395]/30 shadow-[0_10px_30px_rgba(0,35,149,0.05)]' : 'hover:border-[#002395]/20 shadow-sm hover:shadow-md'} ${isArchived ? 'grayscale-[0.5]' : ''}`}
                                                >
                                                    <div 
                                                        onClick={() => togglePieceExpand(String(piece.id))}
                                                        className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-white/40 transition-colors"
                                                    >
                                                        <div className="flex items-start sm:items-center gap-4">
                                                            <div className={`w-12 h-12 rounded-xl bg-white border border-stone-100 flex items-center justify-center flex-shrink-0 shadow-sm font-bold text-base ${isArchived ? 'text-stone-400' : 'text-[#002395]'}`}>
                                                                {idx + 1}
                                                            </div>
                                                            <div>
                                                                <h3 className="text-xl font-bold text-stone-900 tracking-tight leading-tight" style={{ fontFamily: "'Cormorant', serif" }}>{piece.title}</h3>
                                                                <p className="text-[10px] font-bold antialiased text-stone-500 uppercase tracking-widest mt-1">
                                                                    {piece.composerData ? `${piece.composerData.first_name || ''} ${piece.composerData.last_name}` : 'Tradycyjny / Nieznany'}
                                                                </p>
                                                                {piece.myCasting && (
                                                                    <p className="text-[10px] font-bold antialiased text-[#002395] bg-blue-50/80 px-2 py-0.5 rounded border border-blue-100/50 mt-2 inline-block shadow-sm">
                                                                        Śpiewasz: {(piece.myCasting as any).voice_line_display || piece.myCasting.voice_line}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0">
                                                            <div className="flex gap-2">
                                                                {!isArchived && piece.sheet_music && <span className="px-2.5 py-1.5 bg-blue-50 text-[#002395] text-[9px] tracking-widest font-bold antialiased uppercase rounded-lg border border-blue-100">PDF</span>}
                                                                {!isArchived && piece.tracks.length > 0 && <span className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-[9px] tracking-widest font-bold antialiased uppercase rounded-lg border border-emerald-100">Audio</span>}
                                                                {isArchived && <span className="px-2.5 py-1.5 bg-stone-100 text-stone-400 text-[9px] tracking-widest font-bold antialiased uppercase rounded-lg border border-stone-200 flex items-center gap-1.5"><Lock size={12}/> Chronione</span>}
                                                            </div>
                                                            
                                                            <div className="text-stone-400 bg-white shadow-sm p-1.5 rounded-full border border-stone-100 transition-transform duration-300">
                                                                {isExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div 
                                                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                                className="bg-stone-50/40 border-t border-white/60 overflow-hidden"
                                                            >
                                                                {isArchived ? (
                                                                    <div className="p-8 md:p-12 flex flex-col items-center justify-center text-center bg-stone-50/30">
                                                                        <div className="w-16 h-16 bg-white border border-stone-200 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                                                            <Lock size={24} className="text-stone-400" aria-hidden="true" />
                                                                        </div>
                                                                        <h4 className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-600 mb-2">Dostęp Zablokowany</h4>
                                                                        <p className="text-xs text-stone-500 max-w-md leading-relaxed">
                                                                            Projekt został zakończony. Materiały ćwiczeniowe oraz partytury nie są już dostępne ze względu na ochronę własności intelektualnej i aranżacji dyrygenta.
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-5 md:p-8 space-y-8">
                                                                        
                                                                        <div className="flex flex-wrap gap-4 pb-6 border-b border-stone-200/60">
                                                                            {piece.sheet_music ? (
                                                                                <a href={piece.sheet_music} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-8 py-3.5 bg-[#002395] hover:bg-[#001766] text-white rounded-xl text-[10px] uppercase tracking-widest font-bold antialiased transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] active:scale-95">
                                                                                    <Download size={16} aria-hidden="true" /> Pobierz Partyturę (PDF)
                                                                                </a>
                                                                            ) : (
                                                                                <span className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-8 py-3.5 bg-stone-100 border border-stone-200/50 rounded-xl text-[10px] uppercase tracking-widest font-bold antialiased text-stone-400 cursor-not-allowed">
                                                                                    <FileText size={16} aria-hidden="true" /> Nuty niedostępne
                                                                                </span>
                                                                            )}

                                                                            {referenceLinks.length > 0 && (
                                                                                <a href={referenceLinks[0].url} target="_blank" rel="noopener noreferrer" className={`flex-1 sm:flex-none flex items-center justify-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-[0.15em] px-8 py-3.5 rounded-xl transition-colors border shadow-sm active:scale-95 ${referenceLinks[0].platform === 'youtube' ? 'text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border-red-200' : 'text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-50 border-emerald-200'}`}>
                                                                                    <Youtube size={16} aria-hidden="true" /> Posłuchaj Referencji
                                                                                </a>
                                                                            )}
                                                                        </div>

                                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                                            {piece.myCasting && (
                                                                                <div className="bg-blue-50/50 border border-blue-100/50 p-5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] h-full">
                                                                                    <div className="flex items-center gap-3 mb-3">
                                                                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-blue-100 text-[#002395] flex-shrink-0 shadow-sm">
                                                                                            <User size={16} aria-hidden="true" />
                                                                                        </div>
                                                                                        <div>
                                                                                            <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395]">Twoje wytyczne do utworu</h4>
                                                                                            <p className="text-sm font-bold text-stone-800">Partia: {(piece.myCasting as any).voice_line_display || piece.myCasting.voice_line}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    {piece.myCasting.notes ? (
                                                                                        <p className="text-xs text-stone-600 italic leading-relaxed bg-white/60 p-3 rounded-lg border border-blue-50">"{piece.myCasting.notes}"</p>
                                                                                    ) : (
                                                                                        <p className="text-xs text-stone-400 italic">Dyrygent nie dodał specjalnych uwag.</p>
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            <div className="bg-white/50 backdrop-blur-sm border border-stone-200/80 p-5 rounded-2xl shadow-sm h-full">
                                                                                <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3 flex items-center gap-1.5 border-b border-stone-200/60 pb-2">
                                                                                    <Users size={14} aria-hidden="true" /> Obsada utworu (Divisi)
                                                                                </h4>
                                                                                {piece.allCastings.length > 0 ? (
                                                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-h-[160px] overflow-y-auto pr-2 scrollbar-hide">
                                                                                        {Object.entries(divisiGroups).map(([vl, groupCastings]) => (
                                                                                            <div key={vl} className="space-y-1.5">
                                                                                                <h5 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">{vl}</h5>
                                                                                                <ul className="space-y-1">
                                                                                                    {groupCastings.map((c: any) => {
                                                                                                        const isMe = piece.myCasting?.id === c.id;
                                                                                                        return (
                                                                                                            <li key={c.id} className={`text-xs flex items-center gap-1.5 ${isMe ? 'text-[#002395] font-bold' : 'text-stone-600 font-medium'}`}>
                                                                                                                {isMe && <span className="w-1.5 h-1.5 bg-[#002395] rounded-full animate-pulse shadow-sm"></span>}
                                                                                                                {(c as any).artist_name || 'Artysta'}
                                                                                                            </li>
                                                                                                        )
                                                                                                    })}
                                                                                                </ul>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <p className="text-xs text-stone-400 italic">Brak zdefiniowanego podziału głosów.</p>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {piece.tracks.length > 0 && (
                                                                            <div>
                                                                                <h4 className="flex items-center gap-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-4 ml-1 border-b border-stone-200/60 pb-2">
                                                                                    <Headphones size={14} className="text-emerald-600" aria-hidden="true" /> Ścieżki Ćwiczeniowe (Midi / MP3)
                                                                                </h4>
                                                                                <div className="grid grid-cols-1 gap-4">
                                                                                    {piece.tracks.map((track) => (
                                                                                        <EducationalAudioPlayer 
                                                                                            key={track.id} 
                                                                                            track={track} 
                                                                                            isMyTrack={piece.myCasting?.voice_line === track.voice_part} 
                                                                                            isLocked={isArchived} 
                                                                                            onPlay={handleAudioPlay} 
                                                                                        />
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {(piece.lyrics_original || piece.lyrics_translation) && (
                                                                            <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl shadow-sm overflow-hidden">
                                                                                <button onClick={() => setShowLyricsFor(showLyricsFor === piece.id ? null : String(piece.id))} className="w-full flex items-center justify-between p-5 text-left hover:bg-white/80 transition-colors">
                                                                                    <span className="flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-600">
                                                                                        <AlignLeft size={16} className="text-[#002395]" aria-hidden="true" /> Tekst Utworu i Tłumaczenie
                                                                                    </span>
                                                                                    <span className="text-stone-400 bg-white shadow-sm p-1.5 rounded-full border border-stone-100">
                                                                                        {showLyricsFor === piece.id ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                                                                                    </span>
                                                                                </button>
                                                                                
                                                                                <AnimatePresence>
                                                                                    {showLyricsFor === piece.id && (
                                                                                        <motion.div initial={{height:0}} animate={{height:'auto'}} exit={{height:0}} className="overflow-hidden border-t border-stone-100/50">
                                                                                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-stone-50/30">
                                                                                                {piece.lyrics_original && (
                                                                                                    <div>
                                                                                                        <h5 className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-200/60 pb-2">Oryginał</h5>
                                                                                                        <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed font-serif">{piece.lyrics_original}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {piece.lyrics_translation && (
                                                                                                    <div>
                                                                                                        <h5 className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-200/60 pb-2">Tłumaczenie (Notatki)</h5>
                                                                                                        <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed font-serif italic opacity-90">{piece.lyrics_translation}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </motion.div>
                                                                                    )}
                                                                                </AnimatePresence>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </GlassCard>
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>
                            );
                        })
                    ) : (
                        <motion.div key="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <GlassCard className="text-center flex flex-col items-center justify-center p-16">
                                <Music size={48} className="text-stone-300 mb-4 opacity-50" aria-hidden="true" />
                                <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-600 mb-2">
                                    Brak przypisanych materiałów
                                </span>
                                <span className="text-xs text-stone-400 max-w-md leading-relaxed">
                                    W tej chwili nie masz nadchodzących projektów lub dyrygent nie zatwierdził jeszcze żadnego programu koncertu.
                                </span>
                            </GlassCard>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}