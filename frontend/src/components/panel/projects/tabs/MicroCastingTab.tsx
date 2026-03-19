/**
 * @file MicroCastingTab.tsx
 * @description Advanced Kanban Board for Divisi and Micro-casting orchestration.
 * @architecture
 * Implements Optimistic UI state mutations for high-performance drag-and-drop.
 * Consumes pre-fetched roster data directly from the parent ProjectDataContext (RAM)
 * to ensure 0ms component mounting and to bypass N+1 network request flooding.
 * Employs Hash Maps O(1) for artist data lookups to prevent render-cycle bottlenecking.
 * @module project/tabs/MicroCastingTab
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  GripVertical, AlertCircle, CheckCircle2, 
  Users, MicVocal, PlayCircleIcon, ListOrdered 
} from 'lucide-react';

import api from '../../../../utils/api';
import { ProjectDataContext, IProjectDataContext } from '../ProjectDashboard';
import type { Participation, Artist, Piece, PieceCasting, VoiceLineOption } from '../../../../types';

interface MicroCastingTabProps {
  projectId: string;
  voiceLines: VoiceLineOption[];
}

interface ProgramItem {
  id: string | number;
  order: number;
  piece: string;
  piece_title: string;
}

// --- Static Configurations & Styles ---
const STYLE_SOLID_CARD = "bg-white/95 border border-stone-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";

/**
 * MicroCastingTab Component
 * @param {MicroCastingTabProps} props - Component properties.
 * @returns {React.JSX.Element | null}
 */
export default function MicroCastingTab({ projectId, voiceLines }: MicroCastingTabProps): React.JSX.Element | null {
  const context = useContext(ProjectDataContext) as IProjectDataContext;

  if (!context) {
    console.error("[MicroCastingTab] Must be used within a ProjectDataContext.Provider");
    return null;
  }

  const { participations, artists, pieces, pieceCastings, fetchGlobal } = context;

  // --- Local UI State ---
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [localCastings, setLocalCastings] = useState<PieceCasting[]>([]); 

  // --- Derived Core Data (Memoized) ---
  const projectParticipations = useMemo<Participation[]>(() => {
    return participations.filter((p) => String(p.project) === String(projectId));
  }, [participations, projectId]);

  // O(1) Lookup Map for Artist Details
  const artistMap = useMemo<Map<string, Artist>>(() => {
    const map = new Map<string, Artist>();
    projectParticipations.forEach((p) => {
      const artist = artists.find((a) => String(a.id) === String(p.artist));
      if (artist) map.set(String(p.id), artist);
    });
    return map;
  }, [projectParticipations, artists]);

  // --- Data Fetching: Program Setup ---
  const { data: program = [] } = useQuery<ProgramItem[]>({
    queryKey: ['program', projectId],
    queryFn: async () => {
      const progRes = await api.get(`/api/program-items/?project=${projectId}`);
      return Array.isArray(progRes.data) 
        ? progRes.data.sort((a, b) => a.order - b.order) 
        : [];
    }
  });

  // Auto-select the first piece when program loads
  useEffect(() => {
    if (program.length > 0 && !selectedPieceId) {
      setSelectedPieceId(String(program[0].piece));
    }
  }, [program, selectedPieceId]);

  // --- State Synchronization (Global -> Local for Optimistic UI) ---
  const globalCastingsForPiece = useMemo<PieceCasting[]>(() => {
    if (!selectedPieceId) return [];
    return pieceCastings.filter((c) => 
      String(c.piece) === String(selectedPieceId) && 
      projectParticipations.some((p) => String(p.id) === String(c.participation))
    );
  }, [pieceCastings, selectedPieceId, projectParticipations]);

  useEffect(() => {
    setLocalCastings(globalCastingsForPiece);
  }, [globalCastingsForPiece]);

  // --- Event Handlers ---

  const handleDragEnd = async (result: DropResult): Promise<void> => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const partId = draggableId; 
    const targetVoiceLine = destination.droppableId; 
    const existingCasting = localCastings.find((c) => String(c.participation) === String(partId));

    // Snapshot for rollback
    const prevCastings = [...localCastings];
    
    // Optimistic UI Update
    let newCastings = [...localCastings];
    if (targetVoiceLine === 'UNASSIGNED') {
      newCastings = newCastings.filter((c) => String(c.participation) !== String(partId));
    } else {
      if (existingCasting) {
        newCastings = newCastings.map((c) => 
          String(c.participation) === String(partId) ? { ...c, voice_line: targetVoiceLine } : c
        );
      } else {
        newCastings.push({ 
          id: `temp-${Date.now()}`, 
          participation: partId, 
          piece: selectedPieceId as string, 
          voice_line: targetVoiceLine 
        } as PieceCasting);
      }
    }
    setLocalCastings(newCastings);

    // Network Mutation
    try {
      if (targetVoiceLine === 'UNASSIGNED') {
        if (existingCasting?.id) await api.delete(`/api/piece-castings/${existingCasting.id}/`);
      } else {
        if (existingCasting?.id) {
          await api.patch(`/api/piece-castings/${existingCasting.id}/`, { voice_line: targetVoiceLine });
        } else {
          await api.post('/api/piece-castings/', { 
            participation: partId, 
            piece: selectedPieceId, 
            voice_line: targetVoiceLine 
          });
        }
      }
      await fetchGlobal(); 
    } catch (err) { 
      console.error("[MicroCastingTab] Drag-and-drop sync failed:", err);
      setLocalCastings(prevCastings); 
      toast.error("Błąd synchronizacji", {
        description: "Nie udało się zaktualizować obsady. Zmiany zostały cofnięte."
      });
    }
  };

  // --- Early Return (Przeniesiony PO wszystkich Hookach!) ---
  if (program.length === 0) {
    return (
      <div className={`${STYLE_SOLID_CARD} p-12 text-center text-stone-500 border border-dashed border-stone-300/50 flex flex-col justify-center items-center`}>
        <ListOrdered size={32} className="mb-4 opacity-30 text-stone-400" aria-hidden="true" />
        <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak utworów</span>
        <span className="text-xs max-w-sm leading-relaxed">Zbuduj strukturę koncertu w module "Setlista", zanim przejdziesz do podziału ról (divisi).</span>
      </div>
    );
  }

  // --- Derived View Data ---
  const currentPiece = pieces.find((p) => String(p.id) === String(selectedPieceId));
  const requirements = currentPiece?.voice_requirements || [];
  const isFreeMode = requirements.length === 0;
  
  const unassignedParticipations = projectParticipations.filter((p) => 
    !localCastings.some((c) => String(c.participation) === String(p.id))
  );

  const voiceGroups = [
    { label: 'Soprany', filter: 'S' }, 
    { label: 'Alty', filter: 'A' },
    { label: 'Tenory', filter: 'T' }, 
    { label: 'Basy', filter: 'B' }
  ];

  // --- Render Helpers (Zwykłe funkcje, usunięto useCallback) ---
  const renderHealthCheckBanner = () => {
      if (!currentPiece) return null;
      
      if (isFreeMode) {
          return (
              <div className="mb-6 p-4 bg-stone-100 border border-stone-200/80 rounded-xl flex items-center gap-3 text-stone-500 text-xs shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                  <AlertCircle size={18} className="text-stone-400 flex-shrink-0" aria-hidden="true" /> 
                  <span className="leading-relaxed"><strong>Tryb Swobodny:</strong> Ten utwór nie posiada zdefiniowanych wymagań. Poniżej wygenerowano wszystkie standardowe partie.</span>
              </div>
          );
      }
      
      let missingTotal = 0;
      requirements.forEach((req) => {
          const assigned = localCastings.filter((c) => c.voice_line === req.voice_line).length;
          if (assigned < req.quantity) missingTotal += (req.quantity - assigned);
      });

      if (missingTotal > 0) return (
        <div className="mb-6 p-4 bg-red-50 border border-red-200/80 rounded-xl flex items-center gap-3 text-red-700 text-xs shadow-sm">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" aria-hidden="true" /> 
          <span className="leading-relaxed">Wykryto braki w partiach! Zrekrutuj <strong>{missingTotal} osób</strong>, by spełnić wymogi kompozytora.</span>
        </div>
      );
      
      return (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center gap-3 text-emerald-700 text-xs shadow-sm">
          <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" aria-hidden="true" /> 
          <span className="leading-relaxed">Obsada zoptymalizowana! Wszystkie zapotrzebowania wokalne zostały spełnione.</span>
        </div>
      );
  };

  const renderBucket = (voiceValue: string, voiceLabel: string, targetQuantity: number | null = null) => {
    const artistsInLine = localCastings.filter((c) => c.voice_line === voiceValue);
    const assignedCount = artistsInLine.length;

    let bucketStyle = "bg-stone-50/50 border-stone-200/80";
    let titleStyle = "text-[#002395]";
    let countStyle = "text-[#002395] bg-blue-50 border-blue-100";

    if (targetQuantity !== null) {
        const isDeficit = assignedCount < targetQuantity;
        bucketStyle = isDeficit ? "bg-red-50/30 border-red-200/80" : "bg-emerald-50/30 border-emerald-200/80";
        titleStyle = isDeficit ? "text-red-700" : "text-emerald-700";
        countStyle = isDeficit ? "text-red-700 bg-red-100 border-red-200" : "text-emerald-700 bg-emerald-100 border-emerald-200";
    }

    return (
      <div key={voiceValue} className={`border rounded-2xl p-4 min-h-[140px] flex flex-col transition-colors ${bucketStyle}`}>
          <div className="flex justify-between items-start mb-3 border-b pb-3 border-stone-200/50">
              <div className="flex flex-col gap-1">
                  <span className={`text-[9px] font-bold antialiased uppercase tracking-widest ${titleStyle}`}>{voiceLabel}</span>
                  {targetQuantity !== null && (
                    <span className={`text-[8px] uppercase tracking-widest font-bold antialiased ${assignedCount < targetQuantity ? 'text-red-500' : 'text-emerald-600'}`}>
                      Wymagane: {targetQuantity}
                    </span>
                  )}
              </div>
              <span className={`text-[9px] font-bold antialiased px-2 py-1 rounded-md flex items-center gap-1.5 border shadow-sm ${countStyle}`}>
                  <Users size={10} aria-hidden="true" /> {assignedCount} {targetQuantity !== null ? `/ ${targetQuantity}` : ''}
              </span>
          </div>

          <Droppable droppableId={voiceValue}>
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef} 
                {...provided.droppableProps}
                className={`flex-1 flex flex-col min-h-[60px] pt-1 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-white/60 shadow-inner' : ''}`}
              >
                  {artistsInLine.length === 0 && (
                    <div className={`text-[9px] uppercase tracking-widest font-bold antialiased text-center mt-4 pointer-events-none ${targetQuantity !== null && assignedCount < targetQuantity ? 'text-red-400' : 'text-stone-300'}`}>
                      Przeciągnij tutaj
                    </div>
                  )}
                  
                  {artistsInLine.map((c, index) => {
                      const artist = artistMap.get(String(c.participation));
                      if (!artist) return null;
                      
                      const isDeficit = targetQuantity !== null && assignedCount < targetQuantity;
                      const voiceTypeInitial = (artist as any).voice_type_display?.substring(0, 1) || '?';
                      
                      return (
                        <Draggable key={String(c.participation)} draggableId={String(c.participation)} index={index}>
                          {(provided, snapshot) => {
                            const style = {
                                ...provided.draggableProps.style,
                                ...(snapshot.isDragging ? { zIndex: 9999 } : {})
                            };
                            return (
                                <div 
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={style}
                                    className={`mb-2 px-3 py-2.5 text-[10px] font-bold antialiased uppercase tracking-wider rounded-xl flex items-center justify-between transition-colors ${targetQuantity !== null ? (isDeficit ? 'bg-red-500 text-white border border-red-600' : 'bg-emerald-500 text-white border border-emerald-600') : 'bg-[#002395] text-white border border-[#001766]'} ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-white scale-105' : 'shadow-sm'}`}
                                >
                                    <span className="truncate pr-2">
                                      {artist.first_name} {artist.last_name} <span className="opacity-70 font-medium">({voiceTypeInitial})</span>
                                    </span> 
                                    <GripVertical size={14} className="opacity-50 flex-shrink-0" aria-hidden="true" />
                                </div>
                            );
                          }}
                        </Draggable>
                      );
                  })}
                  {provided.placeholder}
              </div>
            )}
          </Droppable>
      </div>
    );
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6 max-w-6xl mx-auto">
        
        {/* --- HORIZONTAL SETLIST TRACK --- */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-stone-200/60">
          {program.map((item, idx) => (
            <button 
              key={item.id} 
              onClick={() => setSelectedPieceId(String(item.piece))}
              className={`px-5 py-3.5 text-[10px] font-bold antialiased uppercase tracking-widest whitespace-nowrap rounded-t-xl transition-all border-b-2 ${String(selectedPieceId) === String(item.piece) ? 'border-[#002395] text-[#002395] bg-blue-50/50' : 'border-transparent text-stone-400 hover:text-stone-800 hover:bg-stone-50/50'}`}
            >
              {idx + 1}. {item.piece_title}
            </button>
          ))}
        </div>

        <div className={`${STYLE_SOLID_CARD} p-6 md:p-8`}>
          
          {/* --- PIECE METADATA CONTEXT BANNER --- */}
          {currentPiece && ((currentPiece as any).reference_recording || (currentPiece as any).voicing) && (
              <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-stone-50 border border-stone-200/80 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                  {(currentPiece as any).voicing && (
                      <span className="flex items-center gap-1.5 text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                          <MicVocal size={14} aria-hidden="true" /> Oryginalna Obsada: {(currentPiece as any).voicing}
                      </span>
                  )}
                  {(currentPiece as any).reference_recording && (
                      <a 
                        href={(currentPiece as any).reference_recording} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1.5 text-[9px] font-bold antialiased uppercase tracking-widest text-red-600 bg-white hover:bg-red-50 hover:text-red-700 px-4 py-1.5 rounded-lg border border-red-100 transition-all shadow-sm active:scale-95"
                      >
                          <PlayCircleIcon size={14} aria-hidden="true" /> Posłuchaj Referencji
                      </a>
                  )}
              </div>
          )}

          {renderHealthCheckBanner()}

          {/* --- THE BENCH (UNASSIGNED ROSTER POOL) --- */}
          <div className="mb-10">
            <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3 flex items-center gap-2 ml-1">
              Rezerwa Personalna
            </h4>
            
            <Droppable droppableId="UNASSIGNED" direction="horizontal">
              {(provided, snapshot) => (
                <div 
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-[90px] p-4 border-2 border-dashed rounded-2xl flex flex-wrap items-start transition-colors ${snapshot.isDraggingOver ? 'border-[#002395]/40 bg-blue-50/20' : 'bg-stone-50/50 border-stone-300/50 shadow-sm'}`}
                >
                    {unassignedParticipations.length === 0 && (
                      <span className="text-[11px] text-stone-400 italic font-medium w-full text-center py-2">
                        Wszyscy uczestnicy wydarzenia zostali przydzieleni.
                      </span>
                    )}
                    
                    {unassignedParticipations.map((p, index) => {
                        const artist = artistMap.get(String(p.id));
                        if (!artist) return null;
                        
                        const voiceTypeInitial = (artist as any).voice_type_display?.substring(0, 1) || '?';
                        
                        return (
                          <Draggable key={String(p.id)} draggableId={String(p.id)} index={index}>
                            {(provided, snapshot) => {
                                const style = {
                                    ...provided.draggableProps.style,
                                    ...(snapshot.isDragging ? { zIndex: 9999 } : {})
                                };
                                return (
                                    <div 
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        style={style}
                                        className={`mr-3 mb-3 flex-shrink-0 px-4 py-2.5 text-[10px] font-bold antialiased uppercase tracking-wider rounded-xl flex items-center gap-2.5 transition-colors ${snapshot.isDragging ? 'bg-white shadow-2xl border border-stone-300 text-[#002395] scale-105' : 'bg-white border border-stone-200/80 text-stone-700 shadow-sm hover:border-[#002395]/40 hover:text-[#002395]'}`}
                                    >
                                        <GripVertical size={14} className={snapshot.isDragging ? "text-[#002395]" : "text-stone-300"} aria-hidden="true" /> 
                                        <span>
                                          {artist.first_name} {artist.last_name} <span className="text-stone-400 font-medium">({voiceTypeInitial})</span>
                                        </span>
                                    </div>
                                );
                            }}
                          </Draggable>
                        );
                    })}
                    {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* --- KANBAN BINS ROUTING --- */}
          {isFreeMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {voiceGroups.map((group) => (
                      <div key={group.label} className="space-y-3">
                          <h5 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800 border-b border-stone-200/60 pb-2.5 ml-1">
                            {group.label}
                          </h5>
                          {voiceLines.filter((vl) => String(vl.value).startsWith(group.filter)).map((vl) => 
                              renderBucket(String(vl.value), vl.label || String(vl.value), null)
                          )}
                      </div>
                  ))}
              </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {requirements.map((req) => 
                      renderBucket(req.voice_line, (req as any).voice_line_display || req.voice_line, req.quantity)
                  )}
              </div>
          )}
        </div>
      </div>
    </DragDropContext>
  );
}