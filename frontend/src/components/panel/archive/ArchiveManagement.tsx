/**
 * @file ArchiveManagement.tsx
 * @description Core Database Controller for the Sheet Music & Repertoire Archive.
 * @architecture Enterprise 2026 (Feature-Sliced Design)
 * BUGFIX: Implemented `extractData` to gracefully handle DRF paginated responses.
 * LOGIC UPGRADE: Performs "Data Enrichment" (Composer mapping) at the controller level
 * to eliminate prop-drilling into child components.
 * UX: Hyper-modern OLED Dashboard metrics and Actionable Empty States.
 * @module archive/ArchiveManagement
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, FileText, Headphones, Search, Filter, Library, Clock, Layers } from 'lucide-react';

import api from '../../../utils/api';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import PieceCard from './components/PieceCard';
import ArchiveEditorPanel from './components/ArchiveEditorPanel';

import type { Piece, Composer } from '../../../types';
import { EPOCHS } from './components/PieceDetailsForm';
import { queryKeys } from '../../../utils/queryKeys';

const extractData = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.results && Array.isArray(payload.results)) return payload.results;
    return [];
};

// --- Rozszerzony interfejs (Data Enrichment) ---
export interface EnrichedPiece extends Piece {
    composerData: Composer | null;
}

const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
const STYLE_GLASS_INPUT = "w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function ArchiveManagement(): React.JSX.Element {
  const queryClient = useQueryClient();
  const closeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [composerFilter, setComposerFilter] = useState<string>('');
  const [epochFilter, setEpochFilter] = useState<string>(''); 

  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'TRACKS'>('DETAILS');
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null);
  const [initialSearchContext, setInitialSearchContext] = useState<string>('');

  const [pieceToDelete, setPieceToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const results = useQueries({
    queries: [
      { queryKey: queryKeys.pieces.all, queryFn: async () => (await api.get('/api/pieces/')).data },
      { queryKey: queryKeys.composers.all, queryFn: async () => (await api.get('/api/composers/')).data },
      { queryKey: queryKeys.options.voiceLines, queryFn: async () => (await api.get('/api/options/voice-lines/')).data }
    ]
  });

  const isLoading = results.some(query => query.isLoading);
  const isError = results.some(query => query.isError);

  useEffect(() => {
    if (isError) toast.error("Ostrzeżenie synchronizacji", { description: "Nie udało się pobrać wszystkich danych archiwum." });
  }, [isError]);

  useEffect(() => {
    document.body.style.overflow = isPanelOpen || pieceToDelete ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isPanelOpen, pieceToDelete]);

  useEffect(() => () => {
    if (closeResetTimeoutRef.current) {
      clearTimeout(closeResetTimeoutRef.current);
    }
  }, []);

  const data = useMemo(() => ({
    pieces: extractData(results[0].data) as Piece[],
    composers: extractData(results[1].data) as Composer[],
    voiceLines: extractData(results[2].data)
  }), [results[0].data, results[1].data, results[2].data]);

  const composerMap = useMemo<Map<string, Composer>>(() => {
    const map = new Map<string, Composer>();
    data.composers.forEach(c => map.set(String(c.id), c));
    return map;
  }, [data.composers]);

  const libraryStats = useMemo(() => {
      const totalPieces = data.pieces.length;
      const withPdf = data.pieces.filter(p => p.sheet_music).length;
      const totalAudio = data.pieces.reduce((acc, piece) => acc + (piece.tracks?.length || 0), 0);
      return { totalPieces, withPdf, totalAudio };
  }, [data.pieces]);

  // ENTERPRISE: Wzbogacamy dane PRZED renderowaniem, by uniknąć Prop-Drilling w kartach
  const displayPieces = useMemo<EnrichedPiece[]>(() => {
      return data.pieces.filter(p => {
          const searchMatch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
          const compId = typeof p.composer === 'object' ? (p.composer as any)?.id : p.composer;
          const composerMatch = composerFilter ? String(compId) === String(composerFilter) : true;
          const epochMatch = epochFilter ? p.epoch === epochFilter : true;
          return searchMatch && composerMatch && epochMatch;
      }).map(p => {
          const compId = typeof p.composer === 'object' ? (p.composer as any)?.id : p.composer;
          return { ...p, composerData: composerMap.get(String(compId)) || null };
      });
  }, [data.pieces, searchTerm, composerFilter, epochFilter, composerMap]);

  const openPanel = useCallback((piece: Piece | null = null, tab: 'DETAILS' | 'TRACKS' = 'DETAILS', context: string = '') => { 
      if (closeResetTimeoutRef.current) {
          clearTimeout(closeResetTimeoutRef.current);
          closeResetTimeoutRef.current = null;
      }
      setEditingPiece(piece); 
      setActiveTab(tab);
      setInitialSearchContext(context);
      setIsPanelOpen(true); 
  }, []);
  
  const closePanel = useCallback(() => { 
      setIsPanelOpen(false); 
      if (closeResetTimeoutRef.current) {
          clearTimeout(closeResetTimeoutRef.current);
      }
      closeResetTimeoutRef.current = setTimeout(() => {
          setEditingPiece(null);
          setInitialSearchContext('');
          closeResetTimeoutRef.current = null;
      }, 300); 
  }, []);

  const executeDelete = useCallback(async () => {
    if (!pieceToDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading("Usuwanie utworu...");

    try {
      await api.delete(`/api/pieces/${pieceToDelete}/`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.pieces.all }),
      ]);
      if (editingPiece?.id === pieceToDelete) closePanel();
      toast.success("Utwór usunięty z bazy", { id: toastId });
    } catch (err) { 
        toast.error("Błąd usuwania", { id: toastId, description: "Utwór może być przypisany do setlisty projektu." }); 
    } finally {
        setIsDeleting(false);
        setPieceToDelete(null);
    }
  }, [pieceToDelete, queryClient, editingPiece, closePanel]);

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      <header className="relative pt-8 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                  <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                          <Library size={12} className="text-[#002395]" aria-hidden="true" />
                          <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">Zasoby Repertuarowe</p>
                      </div>
                      <h1 className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                          Archiwum <span className="italic text-[#002395] font-bold">Nut</span>.
                      </h1>
                  </div>
                  <button 
                    onClick={() => openPanel()} 
                    className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3.5 px-8 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] hover:-translate-y-0.5 active:scale-95 flex-shrink-0"
                  >
                      <Plus size={16} aria-hidden="true" /> Nowy Utwór
                  </button>
              </div>
          </motion.div>
      </header>

      {/* OLED BENTO METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="bg-[#0a0a0a] rounded-[2rem] p-6 md:p-8 relative overflow-hidden group shadow-[0_20px_40px_rgba(0,0,0,0.3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] text-white border border-stone-800">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#002395] rounded-full blur-[80px] opacity-40 pointer-events-none transition-transform duration-1000 group-hover:scale-125"></div>
              <div className="relative z-10 flex items-center justify-between">
                  <div>
                      <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-blue-300 mb-1.5 flex items-center gap-2"><Library size={12}/> Pozycje w bazie</p>
                      <p className="text-4xl font-black text-white tracking-tight">{libraryStats.totalPieces}</p>
                  </div>
              </div>
          </div>
          <div className={`${STYLE_GLASS_CARD} p-6 md:p-8 flex items-center justify-between`}>
              <div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395]/70 mb-1.5">Dostępne Partytury (PDF)</p>
                  <p className="text-3xl font-black text-[#002395] tracking-tight">{libraryStats.withPdf}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                  <FileText size={24} className="text-[#002395]" aria-hidden="true" />
              </div>
          </div>
          <div className={`${STYLE_GLASS_CARD} p-6 md:p-8 flex items-center justify-between`}>
              <div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-emerald-600/70 mb-1.5">Ścieżki Audio (MIDI/MP3)</p>
                  <p className="text-3xl font-black text-emerald-700 tracking-tight">{libraryStats.totalAudio}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
                  <Headphones size={24} className="text-emerald-600" aria-hidden="true" />
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-8">
          <div className="relative sm:col-span-5">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={16} className="text-stone-400" aria-hidden="true" />
              </div>
              <input 
                  type="text" placeholder="Szukaj utworu po tytule..." 
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                  className={STYLE_GLASS_INPUT} 
              />
          </div>
          <div className="relative sm:col-span-4">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Filter size={16} className="text-stone-400" /></div>
              <select value={composerFilter} onChange={(e) => setComposerFilter(e.target.value)} className={`${STYLE_GLASS_INPUT} font-bold text-stone-600 appearance-none`}>
                  <option value="">Wszyscy Kompozytorzy</option>
                  {data.composers.map(c => <option key={c.id} value={c.id}>{c.last_name} {c.first_name || ''}</option>)}
              </select>
          </div>
          <div className="relative sm:col-span-3">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Clock size={16} className="text-stone-400" /></div>
              <select value={epochFilter} onChange={(e) => setEpochFilter(e.target.value)} className={`${STYLE_GLASS_INPUT} font-bold text-stone-600 appearance-none`}>
                  <option value="">Wszystkie Epoki</option>
                  {EPOCHS.map(ep => <option key={ep.value} value={ep.value}>{ep.label}</option>)}
              </select>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-stone-100/50 rounded-[2rem] w-full border border-white/50"></div>)}
          </div>
        ) : displayPieces.length > 0 ? (
          displayPieces.map((piece) => (
            <PieceCard 
              key={piece.id} 
              piece={piece} 
              isExpanded={expandedPieceId === String(piece.id)}
              onToggleExpand={() => setExpandedPieceId(expandedPieceId === String(piece.id) ? null : String(piece.id))} 
              onOpenPanel={openPanel} 
              onDelete={() => setPieceToDelete(String(piece.id))} 
            />
          ))
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${STYLE_GLASS_CARD} p-16 flex flex-col items-center justify-center text-center`}>
              <Layers size={48} className="mb-4 text-stone-300 opacity-50" aria-hidden="true" />
              <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak wyników</span>
              
              {searchTerm ? (
                  <div className="flex flex-col items-center gap-3 mt-2">
                      <span className="text-xs text-stone-400 max-w-sm">Nie znaleźliśmy kompozycji "{searchTerm}".</span>
                      <button 
                          onClick={() => openPanel(null, 'DETAILS', searchTerm)} 
                          className="mt-2 bg-stone-100 hover:bg-[#002395] hover:text-white border border-stone-200/80 text-stone-600 text-[10px] font-bold antialiased uppercase tracking-widest py-2.5 px-5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2"
                      >
                          <Plus size={14} aria-hidden="true" /> Dodaj utwór: {searchTerm}
                      </button>
                  </div>
              ) : (
                  <span className="text-xs text-stone-400 max-w-sm">Zmień parametry filtrowania lub dodaj nową kompozycję do bazy.</span>
              )}
          </motion.div>
        )}
      </div>

      <ArchiveEditorPanel 
        isOpen={isPanelOpen}
        onClose={closePanel}
        piece={editingPiece}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        composers={data.composers}
        voiceLines={data.voiceLines}
        initialSearchContext={initialSearchContext}
      />

      <ConfirmModal 
        isOpen={!!pieceToDelete}
        title="Usunąć utwór z archiwum?"
        description="Ten krok usunie bezpowrotnie metadane utworu, nuty oraz przypisane materiały ćwiczeniowe. Jeśli utwór był elementem dawnych projektów, serwer zablokuje tę operację."
        onConfirm={executeDelete}
        onCancel={() => setPieceToDelete(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}
