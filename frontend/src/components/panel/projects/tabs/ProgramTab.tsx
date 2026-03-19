/**
 * @file ProgramTab.tsx
 * @description Setlist Builder with Drag & Drop Reordering.
 * @architecture
 * Leverages framer-motion's <Reorder> components for 60FPS fluid list sorting.
 * Implements Optimistic UI for drag operations and buffers changes until manual commit.
 * Uses Promise.all() for concurrent bulk-updating of sequence orders in the database.
 * Powered by React Query for declarative data fetching.
 * @module project/tabs/ProgramTab
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  ListOrdered, GripVertical, Trash2, Loader2, Save, 
  AlertCircle, Search, Plus, CheckCircle2, Star, Clock, Music 
} from 'lucide-react';

import api from '../../../../utils/api';
import { ProjectDataContext, IProjectDataContext } from '../ProjectDashboard';
import type { Piece } from '../../../../types';

interface ProgramTabProps {
  projectId: string;
}

interface ProgramItem {
  id: string | number;
  order: number;
  piece: string | number;
  piece_id?: string | number;
  piece_title: string;
  is_encore: boolean;
}

// --- Static Functions & Styles ---
const STYLE_GLASS_CARD = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
const STYLE_GLASS_INPUT = "w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

const formatTotalDuration = (totalSeconds: number): string | null => {
  if (!totalSeconds || totalSeconds === 0) return null;
  const m = Math.floor(totalSeconds / 60);
  const h = Math.floor(m / 60);
  const remainingMins = m % 60;
  if (h > 0) return `~ ${h}h ${remainingMins}min muzyki`;
  return `~ ${m} min muzyki`;
};

const formatPieceDuration = (totalSeconds: number): string | null => {
  if (!totalSeconds) return null;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m > 0 ? `${m} min` : ''} ${s > 0 ? `${s} sek` : ''}`.trim();
};

/**
 * ProgramTab Component
 * @param {ProgramTabProps} props - Component properties.
 * @returns {React.JSX.Element | null}
 */
export default function ProgramTab({ projectId }: ProgramTabProps): React.JSX.Element | null {
  const context = useContext(ProjectDataContext) as IProjectDataContext;

  if (!context) {
    console.error("[ProgramTab] Must be used within a ProjectDataContext.Provider");
    return null;
  }

  const { pieces, fetchGlobal } = context;

  // --- Local UI State ---
  const [programItems, setProgramItems] = useState<ProgramItem[]>([]);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // --- Data Fetching (React Query) ---
  const { data: fetchedProgram, isLoading, refetch } = useQuery<ProgramItem[]>({
    queryKey: ['programItems', projectId],
    queryFn: async () => {
      const res = await api.get(`/api/program-items/?project=${projectId}`);
      return Array.isArray(res.data) ? res.data.sort((a, b) => a.order - b.order) : [];
    }
  });

  // Sync server state with local buffered state
  useEffect(() => {
    if (fetchedProgram) {
      setProgramItems(fetchedProgram);
      setHasChanges(false);
    }
  }, [fetchedProgram]);

  // --- Derived Metrics & Computations (Memoized) ---
  const totalConcertDurationSeconds = useMemo<number>(() => {
      return programItems.reduce((sum, item) => {
          const pieceId = item.piece_id || item.piece;
          const pieceObj = pieces.find((p) => String(p.id) === String(pieceId));
          return sum + ((pieceObj as any)?.estimated_duration || 0);
      }, 0);
  }, [programItems, pieces]);

  const addedPieceIds = useMemo<string[]>(() => {
      return programItems.map((item) => String(item.piece_id || item.piece));
  }, [programItems]);

  const filteredPieces = useMemo<Piece[]>(() => {
      if (!searchQuery) return pieces;
      const term = searchQuery.toLowerCase();
      return pieces.filter((p) => p.title.toLowerCase().includes(term));
  }, [pieces, searchQuery]);

  // --- Mutation Handlers ---

  const handleAddPiece = async (pieceId: string | number): Promise<void> => {
    if (addedPieceIds.includes(String(pieceId))) return; 
    
    const toastId = toast.loading("Dodawanie utworu...");
    try {
      const safeTimeOrder = Math.floor(Date.now() / 10) % 100000000;
      await api.post('/api/program-items/', { 
        project: projectId, 
        piece: pieceId, 
        order: safeTimeOrder, 
        is_encore: false 
      });
      
      await refetch(); 
      toast.success("Dodano do setlisty", { id: toastId });
    } catch (err) { 
      console.error("[ProgramTab] Failed to add piece:", err);
      toast.error("Błąd zapisu", { id: toastId, description: "Nie powiodło się dodanie utworu." }); 
    }
  };

  const handleToggleEncore = async (item: ProgramItem): Promise<void> => {
      try {
          await api.patch(`/api/program-items/${item.id}/`, { is_encore: !item.is_encore });
          await refetch();
          toast.success(`Utwór ${!item.is_encore ? 'oznaczony jako' : 'usunięty z'} BIS`);
      } catch (err) {
          console.error("[ProgramTab] Failed to toggle encore status:", err);
          toast.error("Błąd połączenia. Nie udało się zmienić statusu BIS.");
      }
  };

  const handleDeleteItem = async (itemId: string | number): Promise<void> => {
    const toastId = toast.loading("Usuwanie utworu...");
    try { 
      await api.delete(`/api/program-items/${itemId}/`); 
      await refetch(); 
      toast.success("Usunięto z programu", { id: toastId });
    } catch (err) { 
      console.error("[ProgramTab] Failed to delete program item:", err);
      toast.error("Błąd usuwania", { id: toastId, description: "Wystąpił problem z serwerem." });
    }
  };

  // Triggers when dragging ends
  const handleReorder = (newOrderList: ProgramItem[]): void => {
    setProgramItems(newOrderList);
    setHasChanges(true);
  };

  const handleSaveChanges = async (): Promise<void> => {
    setIsSaving(true);
    const toastId = toast.loading("Zapisywanie nowego układu...");
    
    try {
      // Parallel execution for massive speed boost on large setlists
      const baseSaveOrder = Math.floor(Date.now() / 10) % 100000000;
      const syncPromises = programItems.map((item, index) => 
        api.patch(`/api/program-items/${item.id}/`, { order: baseSaveOrder + index })
      );
      
      await Promise.all(syncPromises);
      
      await refetch();
      await fetchGlobal(); // Sync overarching context if pieceCastings rely on order
      
      toast.success("Układ zapisany pomyślnie", { id: toastId });
    } catch (err) { 
      console.error("[ProgramTab] Bulk order update failed:", err);
      toast.error("Błąd zapisu", { id: toastId, description: "Serwer odrzucił część zmian. Odświeżam widok." });
      await refetch(); // Revert to database state
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render ---

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 relative pb-12 max-w-6xl mx-auto">
      
      {/* --- FLOATING SAVE & NOTIFICATION BANNER --- */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -50 }} 
            className="fixed top-24 md:top-8 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[600px] bg-stone-900/95 backdrop-blur-2xl border border-stone-700 shadow-2xl p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 z-[100]"
          >
            <span className="text-[10px] font-bold antialiased text-white uppercase tracking-widest flex items-center gap-2.5">
                <AlertCircle size={16} className="text-orange-400" aria-hidden="true" /> Niezapisana kolejność
            </span>
            <div className="flex gap-2.5 w-full sm:w-auto">
                <button 
                  onClick={() => refetch()} 
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-stone-800 text-stone-300 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl border border-stone-700 hover:bg-stone-700 hover:text-white transition-all active:scale-95"
                >
                  Anuluj
                </button>
                <button 
                  onClick={handleSaveChanges} 
                  disabled={isSaving} 
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-[#002395] text-white disabled:bg-stone-600 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    {isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />} Zapisz Układ
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- ACTIVE SETLIST COLUMN --- */}
      <div className="lg:col-span-3">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-stone-200/60 pb-4 mb-5 gap-3">
            <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 flex items-center gap-2.5">
                <ListOrdered size={16} className="text-[#002395]" aria-hidden="true" /> Setlista Wydarzenia
            </h3>
            <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 bg-white/80 px-3 py-1.5 rounded-lg border border-stone-200/60 shadow-sm">
                    Utworów: {programItems.length}
                </span>
                {totalConcertDurationSeconds > 0 && (
                    <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm flex items-center gap-1.5">
                        <Clock size={12} aria-hidden="true" /> {formatTotalDuration(totalConcertDurationSeconds)}
                    </span>
                )}
            </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-stone-400" aria-hidden="true" /></div>
        ) : programItems.length > 0 ? (
          <Reorder.Group axis="y" values={programItems} onReorder={handleReorder} className="space-y-3">
            <AnimatePresence>
              {programItems.map((item, index) => {
                const pieceObj = pieces.find((p) => String(p.id) === String(item.piece_id || item.piece));
                
                return (
                    <Reorder.Item 
                      key={item.id} 
                      value={item} 
                      // CAUTION: Do not use generic transition-all here, it distorts GPU rendering during framer-motion drag
                      whileDrag={{ scale: 1.02, boxShadow: "0px 10px 30px rgba(0,0,0,0.1)", cursor: "grabbing" }}
                      className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border border-stone-200/60 rounded-xl shadow-sm cursor-grab group relative z-0 hover:border-[#002395]/40 hover:shadow-md transition-colors"
                    >
                      <div className="flex items-start gap-4 w-full pr-4 overflow-hidden pointer-events-none">
                          <GripVertical size={16} className="text-stone-300 group-hover:text-[#002395] transition-colors flex-shrink-0 mt-1.5" aria-hidden="true" />
                          <span className="w-8 h-8 rounded-lg bg-stone-50 border border-stone-100 flex items-center justify-center text-[10px] font-bold antialiased text-[#002395] shadow-sm flex-shrink-0">
                            {index + 1}
                          </span>
                          
                          <div className="flex flex-col min-w-0">
                              <p className={`text-sm font-bold truncate tracking-tight ${item.is_encore ? 'text-[#002395] italic' : 'text-stone-800'}`}>
                                  {item.piece_title}
                              </p>
                              
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {(pieceObj as any)?.voicing && (
                                      <span className="text-[8px] font-bold antialiased text-stone-500 uppercase tracking-widest bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/60">
                                          🎤 {(pieceObj as any).voicing}
                                      </span>
                                  )}
                                  {(pieceObj as any)?.estimated_duration && (
                                      <span className="text-[8px] font-bold antialiased text-stone-500 uppercase tracking-widest bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/60 flex items-center gap-1.5">
                                          <Clock size={10} aria-hidden="true" /> {formatPieceDuration((pieceObj as any).estimated_duration)}
                                      </span>
                                  )}
                              </div>
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 flex-shrink-0 border-l border-stone-100/80 pl-4">
                          <button 
                              onClick={() => handleToggleEncore(item)} 
                              title={item.is_encore ? "Usuń jako BIS" : "Oznacz jako BIS"}
                              className={`p-2.5 rounded-lg transition-colors flex items-center gap-1.5 text-[9px] font-bold antialiased uppercase tracking-widest ${item.is_encore ? 'bg-amber-50 text-amber-600 border border-amber-200 shadow-sm' : 'text-stone-400 hover:text-amber-500 hover:bg-stone-50 border border-transparent active:scale-95'}`}
                          >
                              <Star size={14} className={item.is_encore ? "fill-amber-500" : ""} aria-hidden="true" /> {item.is_encore && "BIS"}
                          </button>
                          <button 
                            onClick={() => handleDeleteItem(item.id)} 
                            title="Usuń z programu" 
                            className="p-2.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100 active:scale-95"
                          >
                              <Trash2 size={16} aria-hidden="true" />
                          </button>
                      </div>
                    </Reorder.Item>
                );
              })}
            </AnimatePresence>
          </Reorder.Group>
        ) : (
          <div className={`${STYLE_GLASS_CARD} p-10 text-center flex flex-col items-center justify-center`}>
            <Music size={32} className="text-stone-300 mb-3 opacity-50" aria-hidden="true" />
            <p className="text-[10px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-1">Setlista jest pusta</p>
            <p className="text-xs text-stone-400 max-w-xs leading-relaxed">Wybierz kompozycje z bazy po prawej stronie, aby zbudować program koncertu.</p>
          </div>
        )}
      </div>

      {/* --- DATABASE SEARCH COLUMN --- */}
      <div className={`${STYLE_GLASS_CARD} lg:col-span-2 p-6 h-[600px] flex flex-col`}>
        <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 mb-5 flex items-center gap-2">
            Baza Kompozycji
        </h3>
        
        <div className="relative mb-5 flex-shrink-0">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search size={16} className="text-stone-400" aria-hidden="true" />
            </div>
            <input 
                type="text" 
                placeholder="Szukaj utworu..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                className={STYLE_GLASS_INPUT}
            />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
            {filteredPieces.length > 0 ? filteredPieces.map((piece) => {
                const isAdded = addedPieceIds.includes(String(piece.id));

                return (
                    <div key={piece.id} className={`flex items-center justify-between p-3.5 border rounded-xl transition-colors ${isAdded ? 'bg-stone-50/50 border-stone-200/50 opacity-60' : 'bg-white/60 hover:bg-white border-stone-200/80 shadow-sm hover:border-[#002395]/30'}`}>
                        <div className="flex flex-col min-w-0 pr-3">
                            <span className={`text-sm font-bold truncate tracking-tight ${isAdded ? 'text-stone-500 line-through' : 'text-stone-800'}`}>
                                {piece.title}
                            </span>
                            {((piece as any).estimated_duration || (piece as any).voicing) && (
                                <span className="text-[8px] font-bold antialiased text-stone-400 uppercase tracking-widest mt-1 truncate">
                                    {(piece as any).estimated_duration ? `${formatPieceDuration((piece as any).estimated_duration)} ` : ''} 
                                    {(piece as any).voicing ? `| ${(piece as any).voicing}` : ''}
                                </span>
                            )}
                        </div>
                        
                        <button 
                            disabled={isAdded}
                            onClick={() => handleAddPiece(piece.id)}
                            className={`flex-shrink-0 p-2 rounded-lg transition-all active:scale-90 ${isAdded ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : 'text-white bg-stone-900 hover:bg-[#002395] shadow-sm'}`}
                            title={isAdded ? "Utwór jest już na setliście" : "Dodaj do programu"}
                        >
                            {isAdded ? <CheckCircle2 size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                        </button>
                    </div>
                );
            }) : (
                <div className="text-center py-12 text-stone-400 flex flex-col items-center">
                    <Search size={28} className="mb-3 opacity-30" aria-hidden="true" />
                    <span className="text-[10px] uppercase font-bold antialiased tracking-widest">Brak wyników</span>
                </div>
            )}
        </div>
      </div>

    </div>
  );
}