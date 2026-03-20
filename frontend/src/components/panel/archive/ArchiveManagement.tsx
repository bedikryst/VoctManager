/**
 * @file ArchiveManagement.tsx
 * @description Core Database Controller for the Sheet Music & Repertoire Archive.
 * @architecture
 * Implements React Query (useQueries) for parallel data fetching (Pieces, Composers, VoiceLines).
 * Delegates panel editing state to ArchiveEditorPanel.
 * Employs a custom ConfirmModal for destructive actions, replacing blocking native alerts.
 * Uses an O(1) Hash Map for fast Composer resolution during list rendering.
 * @module archive/ArchiveManagement
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Plus, FileText, Headphones, Search, 
  Filter, Library, Clock, Layers 
} from 'lucide-react';

import api from '../../../utils/api';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import PieceCard from './PieceCard';
import ArchiveEditorPanel from './ArchiveEditorPanel';

import type { Piece, Composer, VoiceLineOption } from '../../../types';
import { EPOCHS } from './PieceDetailsForm'; // Opcjonalnie przenieś EPOCHS do pliku constants

// --- Static Configurations & Styles ---
const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
const STYLE_GLASS_INPUT = "w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

/**
 * ArchiveManagement Component
 * @returns {React.JSX.Element}
 */
export default function ArchiveManagement(): React.JSX.Element {
  const queryClient = useQueryClient();

  // --- Filtering & Search State ---
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [composerFilter, setComposerFilter] = useState<string>('');
  const [epochFilter, setEpochFilter] = useState<string>(''); 

  // --- UI/Editor State ---
  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'TRACKS'>('DETAILS');
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null);

  const [pieceToDelete, setPieceToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // --- Data Fetching Engine (React Query) ---
  const results = useQueries({
    queries: [
      { queryKey: ['archivePieces'], queryFn: async () => (await api.get('/api/pieces/')).data },
      { queryKey: ['archiveComposers'], queryFn: async () => (await api.get('/api/composers/')).data },
      { queryKey: ['archiveVoiceLines'], queryFn: async () => (await api.get('/api/options/voice-lines/')).data }
    ]
  });

  const isLoading = results.some(query => query.isLoading);
  const isError = results.some(query => query.isError);

  const data = useMemo(() => ({
    pieces: Array.isArray(results[0].data) ? results[0].data : [],
    composers: Array.isArray(results[1].data) ? results[1].data : [],
    voiceLines: Array.isArray(results[2].data) ? results[2].data : []
  }), [results]);

  useEffect(() => {
    if (isError) {
      toast.error("Ostrzeżenie synchronizacji", {
        description: "Nie udało się pobrać wszystkich danych archiwum."
      });
    }
  }, [isError]);

  // Scroll Lock
  useEffect(() => {
    document.body.style.overflow = isPanelOpen || pieceToDelete ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isPanelOpen, pieceToDelete]);

  // --- O(1) Hash Maps ---
  const composerMap = useMemo<Map<string, Composer>>(() => {
    const map = new Map<string, Composer>();
    data.composers.forEach((c: Composer) => map.set(String(c.id), c));
    return map;
  }, [data.composers]);

  // --- Derived Data Metrics ---
  const libraryStats = useMemo(() => {
      const totalPieces = data.pieces.length;
      const withPdf = data.pieces.filter((p: Piece) => p.sheet_music).length;
      // Zakładam, że pole tracks może być dołączane przez API
      const totalAudio = data.pieces.reduce((acc: number, p: any) => acc + (p.tracks?.length || 0), 0);
      return { totalPieces, withPdf, totalAudio };
  }, [data.pieces]);

  const displayPieces = useMemo<Piece[]>(() => {
      return data.pieces.filter((p: Piece) => {
          const searchMatch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
          const compId = typeof p.composer === 'object' ? (p.composer as any)?.id : p.composer;
          const composerMatch = composerFilter ? String(compId) === String(composerFilter) : true;
          const epochMatch = epochFilter ? p.epoch === epochFilter : true;
          
          return searchMatch && composerMatch && epochMatch;
      });
  }, [data.pieces, searchTerm, composerFilter, epochFilter]);

  // --- Event Handlers ---
  
  const refreshGlobal = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['archivePieces'] });
    await queryClient.invalidateQueries({ queryKey: ['archiveComposers'] });
  }, [queryClient]);

  const toggleExpand = useCallback((id: string): void => {
    setExpandedPieceId(prev => prev === id ? null : id);
  }, []);
  
  const openPanel = useCallback((piece: Piece | null = null, tab: 'DETAILS' | 'TRACKS' = 'DETAILS'): void => { 
      setEditingPiece(piece); 
      setActiveTab(tab); 
      setIsPanelOpen(true); 
  }, []);
  
  const closePanel = useCallback((): void => { 
      setIsPanelOpen(false); 
      setTimeout(() => setEditingPiece(null), 300); 
  }, []);

  const handleDeleteRequest = useCallback((id: string | number): void => {
    setPieceToDelete(String(id));
  }, []);

  const executeDelete = useCallback(async (): Promise<void> => {
    if (!pieceToDelete) return;
    
    setIsDeleting(true);
    const toastId = toast.loading("Usuwanie utworu...");

    try {
      await api.delete(`/api/pieces/${pieceToDelete}/`);
      await refreshGlobal();
      
      if (editingPiece?.id === pieceToDelete) {
        closePanel();
      }
      toast.success("Utwór został trwale usunięty z bazy", { id: toastId });
    } catch (err) { 
        console.error("[ArchiveManagement] Deletion failed:", err);
        toast.error("Błąd usuwania", { 
          id: toastId, 
          description: "Utwór może być przypisany do historycznego projektu (Setlisty)." 
        }); 
    } finally {
        setIsDeleting(false);
        setPieceToDelete(null);
    }
  }, [pieceToDelete, refreshGlobal, editingPiece, closePanel]);

  // Utility to pass down to PieceCard without prop drilling full array constantly
  const getComposerInfo = useCallback((pieceComposerId: any): Composer | null => {
    if (!pieceComposerId) return null;
    const id = typeof pieceComposerId === 'object' ? pieceComposerId.id : pieceComposerId;
    return composerMap.get(String(id)) || null;
  }, [composerMap]);


  // --- Render ---

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-6xl mx-auto">
      
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                  <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                          <Library size={12} className="text-[#002395]" aria-hidden="true" />
                          <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                              Zasoby Repertuarowe
                          </p>
                      </div>
                      <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                          Archiwum <span className="italic text-[#002395]">Nuty</span>.
                      </h1>
                  </div>
                  <button 
                    onClick={() => openPanel()} 
                    className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] hover:-translate-y-0.5 active:scale-95"
                  >
                      <Plus size={16} aria-hidden="true" /> Nowy Utwór
                  </button>
              </div>
          </motion.div>
      </header>

      {/* --- BENTO METRICS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`${STYLE_GLASS_CARD} p-5 flex items-center justify-between`}>
              <div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-1">Pozycje Repertuarowe</p>
                  <p className="text-2xl font-black text-stone-800 tracking-tight">{libraryStats.totalPieces}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shadow-sm">
                  <Library size={20} className="text-stone-400" aria-hidden="true" />
              </div>
          </div>
          <div className={`${STYLE_GLASS_CARD} p-5 flex items-center justify-between`}>
              <div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395]/70 mb-1">Dostępne Partytury</p>
                  <p className="text-2xl font-black text-[#002395] tracking-tight">{libraryStats.withPdf}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                  <FileText size={20} className="text-[#002395]" aria-hidden="true" />
              </div>
          </div>
          <div className={`${STYLE_GLASS_CARD} p-5 flex items-center justify-between`}>
              <div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-emerald-600/70 mb-1">Ścieżki Audio (Midi)</p>
                  <p className="text-2xl font-black text-emerald-700 tracking-tight">{libraryStats.totalAudio}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
                  <Headphones size={20} className="text-emerald-600" aria-hidden="true" />
              </div>
          </div>
      </div>

      {/* --- GLASSMORPHISM FILTERS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-8">
          <div className="relative sm:col-span-5">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={16} className="text-stone-400" aria-hidden="true" />
              </div>
              <input 
                  type="text" 
                  placeholder="Szukaj utworu po tytule..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className={STYLE_GLASS_INPUT} 
              />
          </div>
          <div className="relative sm:col-span-4">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Filter size={16} className="text-stone-400" aria-hidden="true" />
              </div>
              <select 
                  value={composerFilter} 
                  onChange={(e) => setComposerFilter(e.target.value)} 
                  className={`${STYLE_GLASS_INPUT} font-bold text-stone-600 appearance-none`}
              >
                  <option value="">Wszyscy Kompozytorzy</option>
                  {data.composers.map((c: Composer) => (
                      <option key={c.id} value={c.id}>
                          {c.last_name} {c.first_name || ''}
                      </option>
                  ))}
              </select>
          </div>
          <div className="relative sm:col-span-3">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Clock size={16} className="text-stone-400" aria-hidden="true" />
              </div>
              <select 
                  value={epochFilter} 
                  onChange={(e) => setEpochFilter(e.target.value)} 
                  className={`${STYLE_GLASS_INPUT} font-bold text-stone-600 appearance-none`}
              >
                  <option value="">Wszystkie Epoki</option>
                  {EPOCHS.map(ep => <option key={ep.value} value={ep.value}>{ep.label}</option>)}
              </select>
          </div>
      </div>

      {/* --- REPERTOIRE FEED --- */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-stone-100/50 rounded-2xl w-full border border-white/50"></div>)}
          </div>
        ) : displayPieces.length > 0 ? (
          displayPieces.map((piece) => (
            <PieceCard 
              key={piece.id} 
              piece={piece} 
              isExpanded={expandedPieceId === String(piece.id)}
              onToggleExpand={() => toggleExpand(String(piece.id))} 
              onOpenPanel={openPanel} 
              onDelete={() => handleDeleteRequest(piece.id)} 
              getComposerInfo={getComposerInfo}
            />
          ))
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${STYLE_GLASS_CARD} p-16 flex flex-col items-center justify-center text-center`}>
              <Layers size={48} className="mb-4 text-stone-300 opacity-50" aria-hidden="true" />
              <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak wyników</span>
              <span className="text-xs text-stone-400 max-w-sm">Zmień parametry filtrowania lub dodaj nową kompozycję do bazy.</span>
          </motion.div>
        )}
      </div>

      {/* --- EXTERNAL COMPONENTS --- */}
      <ArchiveEditorPanel 
        isOpen={isPanelOpen}
        onClose={closePanel}
        piece={editingPiece}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        composers={data.composers}
        voiceLines={data.voiceLines}
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