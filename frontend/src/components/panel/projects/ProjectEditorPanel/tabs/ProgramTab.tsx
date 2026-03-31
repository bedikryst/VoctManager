/**
 * @file ProgramTab.tsx
 * @description Setlist Builder with Drag & Drop Reordering and Database search.
 * @architecture
 * ENTERPRISE 2026: 
 * - Replaced framer-motion reorder with `@dnd-kit` for strict accessibility (a11y), 
 * headless DOM control, and robust touch/keyboard sensor architecture.
 * - Implements unified Dirty State Tracking (FAB) consistent across the application.
 * - Canceling explicitly purges local mutations and restores the React Query baseline.
 * BUGFIX: Safe extraction of DRF paginated responses and synchronized `queryKeys`.
 * @module project/ProjectEditorPanel/tabs/ProgramTab
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query'; 
import { toast } from 'sonner';
import { 
  ListOrdered, GripVertical, Trash2, Loader2, Save, 
  Search, Plus, CheckCircle2, Star, Clock, Music 
} from 'lucide-react';

// Dnd-Kit Imports
import { 
  DndContext, closestCenter, KeyboardSensor, PointerSensor, 
  useSensor, useSensors, DragEndEvent 
} from '@dnd-kit/core';
import { 
  arrayMove, SortableContext, sortableKeyboardCoordinates, 
  verticalListSortingStrategy, useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import api from '../../../../../utils/api';
import { queryKeys } from '../../../../../utils/queryKeys';
import { ProjectDataContext, IProjectDataContext } from '../../ProjectDashboard';
import type { Piece } from '../../../../../types';

const extractData = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.results && Array.isArray(payload.results)) return payload.results;
    return [];
};

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
 * Sub-component to handle the specific Dnd-Kit sorting logic for individual rows.
 */
function SortablePieceItem({ 
  item, index, pieceObj, onToggleEncore, onDelete 
}: { 
  item: ProgramItem, index: number, pieceObj?: Piece, 
  onToggleEncore: (i: ProgramItem) => void, onDelete: (id: string | number) => void 
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`flex items-center justify-between bg-white/80 backdrop-blur-md border border-stone-200/60 rounded-xl shadow-sm group relative hover:border-[#002395]/40 hover:shadow-md transition-colors overflow-hidden ${isDragging ? 'shadow-lg ring-2 ring-[#002395]/20 scale-[1.02]' : ''}`}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="flex items-center gap-4 w-full p-4 pr-4 cursor-grab active:cursor-grabbing outline-none"
        aria-label={`Przeciągnij utwór ${item.piece_title}`}
      >
          <GripVertical size={16} className="text-stone-300 group-hover:text-[#002395] transition-colors flex-shrink-0" aria-hidden="true" />
          
          <span className="w-8 h-8 rounded-lg bg-stone-50 border border-stone-100 flex items-center justify-center text-[10px] font-bold antialiased text-[#002395] shadow-sm flex-shrink-0">
            {index + 1}
          </span>
          
          <div className="flex flex-col min-w-0">
              <p className={`text-sm font-bold truncate tracking-tight ${item.is_encore ? 'text-[#002395] italic' : 'text-stone-800'}`}>
                  {item.piece_title}
              </p>
              
              <div className="flex flex-wrap items-center gap-2 mt-1">
                  {pieceObj?.voicing && (
                      <span className="text-[8px] font-bold antialiased text-stone-500 uppercase tracking-widest bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/60">
                          🎤 {pieceObj.voicing}
                      </span>
                  )}
                  {pieceObj?.estimated_duration && (
                      <span className="text-[8px] font-bold antialiased text-stone-500 uppercase tracking-widest bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/60 flex items-center gap-1.5">
                          <Clock size={10} aria-hidden="true" /> {formatPieceDuration(pieceObj.estimated_duration)}
                      </span>
                  )}
              </div>
          </div>
      </div>
      
      <div className="flex items-center gap-1.5 flex-shrink-0 border-l border-stone-100/80 pl-4 pr-4 relative z-10 self-stretch bg-white/30 backdrop-blur-sm">
          <button 
              onClick={() => onToggleEncore(item)} 
              title={item.is_encore ? "Usuń jako BIS" : "Oznacz jako BIS"}
              className={`p-2.5 rounded-lg transition-colors flex items-center gap-1.5 text-[9px] font-bold antialiased uppercase tracking-widest ${item.is_encore ? 'bg-amber-50 text-amber-600 border border-amber-200 shadow-sm' : 'text-stone-400 hover:text-amber-500 hover:bg-stone-50 border border-transparent active:scale-95'}`}
          >
              <Star size={14} className={item.is_encore ? "fill-amber-500" : ""} aria-hidden="true" /> {item.is_encore && "BIS"}
          </button>
          <button 
            onClick={() => onDelete(item.id)} 
            title="Usuń z programu" 
            className="p-2.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100 active:scale-95"
          >
              <Trash2 size={16} aria-hidden="true" />
          </button>
      </div>
    </div>
  );
}

export default function ProgramTab({ projectId }: ProgramTabProps): React.JSX.Element | null {
  const queryClient = useQueryClient();
  const context = useContext(ProjectDataContext) as IProjectDataContext;
  
  if (!context) return null;
  const { pieces } = context;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [programItems, setProgramItems] = useState<ProgramItem[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: fetchedProgram, isLoading, refetch } = useQuery<ProgramItem[]>({
    queryKey: queryKeys.program.byProject(projectId),
    queryFn: async () => {
      const res = await api.get(`/api/program-items/?project=${projectId}`);
      const items = extractData(res.data);
      return items.sort((a: ProgramItem, b: ProgramItem) => a.order - b.order);
    }
  });

  useEffect(() => {
    if (fetchedProgram) setProgramItems(fetchedProgram);
  }, [fetchedProgram]);

  const isDirty = useMemo(() => {
    if (!fetchedProgram) return false;
    const currentOrderIds = programItems.map(i => i.id).join(',');
    const originalOrderIds = fetchedProgram.map(i => i.id).join(',');
    return currentOrderIds !== originalOrderIds;
  }, [programItems, fetchedProgram]);

  const totalConcertDurationSeconds = useMemo<number>(() => {
      return programItems.reduce((sum, item) => {
          const pieceId = item.piece_id || item.piece;
          const pieceObj = pieces.find((p) => String(p.id) === String(pieceId));
          return sum + (pieceObj?.estimated_duration || 0);
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

  const handleAddPiece = async (pieceId: string | number): Promise<void> => {
    if (addedPieceIds.includes(String(pieceId))) return; 
    
    const toastId = toast.loading("Dodawanie utworu...");
    try {
      const safeTimeOrder = Math.floor(Date.now() / 10) % 100000000;
      await api.post('/api/program-items/', { project: projectId, piece: pieceId, order: safeTimeOrder, is_encore: false });
      await refetch(); 
      toast.success("Dodano do setlisty", { id: toastId });
    } catch (err) { 
      toast.error("Błąd zapisu", { id: toastId, description: "Nie powiodło się dodanie utworu." }); 
    }
  };

  const handleToggleEncore = async (item: ProgramItem): Promise<void> => {
      try {
          await api.patch(`/api/program-items/${item.id}/`, { is_encore: !item.is_encore });
          await refetch();
          toast.success(`Utwór ${!item.is_encore ? 'oznaczony jako' : 'usunięty z'} BIS`);
      } catch (err) {
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
      toast.error("Błąd usuwania", { id: toastId, description: "Wystąpił problem z serwerem." });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setProgramItems((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleCancel = () => {
    if (fetchedProgram) setProgramItems(fetchedProgram);
  };

  const handleSaveChanges = async (): Promise<void> => {
    if (!isDirty) return;
    setIsSaving(true);
    const toastId = toast.loading("Zapisywanie nowego układu...");
    
    try {
      const baseSaveOrder = Math.floor(Date.now() / 10) % 100000000;
      const syncPromises = programItems.map((item, index) => 
        api.patch(`/api/program-items/${item.id}/`, { order: baseSaveOrder + index })
      );
      
      await Promise.all(syncPromises);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: queryKeys.pieceCastings.all });
      
      toast.success("Układ zapisany pomyślnie", { id: toastId });
    } catch (err) { 
      toast.error("Błąd zapisu", { id: toastId, description: "Serwer odrzucił część zmian. Odświeżam widok." });
      await refetch(); 
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 relative pb-24 max-w-6xl mx-auto">
      
      {/* ENTERPRISE FLOATING ACTION BAR (FAB) */}
      <AnimatePresence>
        {isDirty && (
          <motion.div 
            initial={{ y: 100, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 100, opacity: 0, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 md:bottom-10 left-1/2 z-[200] w-[90%] max-w-md bg-white/90 backdrop-blur-xl border border-white/60 shadow-[0_20px_40px_rgb(0,0,0,0.12)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl p-4 flex items-center justify-between"
          >
            <div className="flex flex-col ml-2">
              <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395]">
                Niezapisane Zmiany
              </span>
              <span className="text-xs text-stone-500">
                Zmodyfikowałeś kolejność programu.
              </span>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                  onClick={handleCancel} 
                  disabled={isSaving}
                  className="px-4 py-3 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  Anuluj
                </button>
                <button 
                  onClick={handleSaveChanges} 
                  disabled={isSaving} 
                  className="flex items-center justify-center gap-2 bg-[#002395] hover:bg-[#001766] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] antialiased uppercase tracking-[0.1em] font-bold py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.2)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.3)] disabled:shadow-none active:scale-95 flex-shrink-0"
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />} Zapisz
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
          
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={programItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {programItems.map((item, index) => {
                  const pieceObj = pieces.find((p) => String(p.id) === String(item.piece_id || item.piece));
                  return (
                    <SortablePieceItem 
                      key={item.id} 
                      item={item} 
                      index={index} 
                      pieceObj={pieceObj}
                      onToggleEncore={handleToggleEncore}
                      onDelete={handleDeleteItem}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

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
                            {(piece.estimated_duration || piece.voicing) && (
                                <span className="text-[8px] font-bold antialiased text-stone-400 uppercase tracking-widest mt-1 truncate">
                                    {piece.estimated_duration ? `${formatPieceDuration(piece.estimated_duration)} ` : ''} 
                                    {piece.voicing ? `| ${piece.voicing}` : ''}
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