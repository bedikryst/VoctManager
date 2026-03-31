/**
 * @file MicroCastingTab.tsx
 * @description Advanced Kanban Board for Divisi and Micro-casting orchestration.
 * @architecture
 * Implements a @dnd-kit/core drag-and-drop interface with isolated drag handles.
 * Utilizes optimistic UI mutations for high-performance state transitions and note saving.
 * Features a dynamic Heat-Map navigation track for setlist overview.
 * BUGFIX: Implemented "Wide Invalidation" strategy to sync project-level statuses and counters.
 * @module project/ProjectEditorPanel/tabs/MicroCastingTab
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  DndContext, DragOverlay, useDraggable, useDroppable, 
  PointerSensor, KeyboardSensor, useSensor, useSensors, DragStartEvent, DragEndEvent 
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  GripVertical, AlertCircle, CheckCircle2, 
  Users, MicVocal, PlayCircleIcon, ListOrdered, Pencil, Loader2 
} from 'lucide-react';

import api from '../../../../../utils/api';
import { queryKeys } from '../../../../../utils/queryKeys';
import { getPrimaryReferenceRecording } from '../../../../../utils/referenceRecordings';
import { ProjectDataContext, IProjectDataContext } from '../../ProjectDashboard';
import type { Participation, Artist, PieceCasting, VoiceLineOption, ProgramItem } from '../../../../../types';

interface MicroCastingTabProps {
  projectId: string;
  voiceLines: VoiceLineOption[];
}

const STYLE_SOLID_CARD = "bg-white/95 border border-stone-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";

const extractData = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.results && Array.isArray(payload.results)) return payload.results;
    return [];
};

// --- Draggable & Droppable Components ---

function DraggableArtist({ 
  participationId, artist, isOverlay = false, casting, onUpdateNote 
}: { 
  participationId: string; artist: Artist; isOverlay?: boolean;
  casting?: PieceCasting; onUpdateNote?: (id: string, note: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: participationId });
  const voiceTypeInitial = artist.voice_type_display?.substring(0, 1) || '?';

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [noteValue, setNoteValue] = useState<string>(casting?.notes || '');

  const isTemp = casting && String(casting.id).startsWith('temp-');

  const handleSaveNote = () => {
    setIsEditing(false);
    const finalNote = noteValue.trim();
    
    if (casting?.id && finalNote !== (casting.notes || '') && !isTemp) {
        onUpdateNote?.(String(casting.id), finalNote);
    }
  };

  return (
    <div 
      ref={setNodeRef}
      className={`group px-2 py-1.5 text-[10px] font-bold antialiased uppercase tracking-wider rounded-xl flex items-center justify-between gap-2 transition-all 
        ${isOverlay ? 'bg-[#002395] text-white shadow-2xl scale-105 rotate-2 border border-[#001766]' : 'bg-white border border-stone-200/80 text-stone-700 shadow-sm hover:border-[#002395]/40'} 
        ${isDragging && !isOverlay ? 'opacity-30' : ''}
      `}
    >
        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
            <div 
                {...listeners}
                {...attributes}
                className={`cursor-grab active:cursor-grabbing p-1 -mr-2 -ml-1 rounded transition-colors ${isOverlay ? 'text-white/70' : 'text-stone-300 hover:text-[#002395] hover:bg-stone-100/50'}`}
                aria-label={`Przeciągnij ${artist.first_name}`}
            >
                <GripVertical size={14} aria-hidden="true" />
            </div>

            <span className="truncate max-w-[100px] sm:max-w-[140px] flex-shrink-0">
              <span className={isOverlay ? "text-white/80" : "text-stone-400"}>({voiceTypeInitial})</span> {artist.first_name} {artist.last_name}
            </span>

            {casting && !isOverlay && (
                isEditing ? (
                    <input 
                        autoFocus
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        onBlur={handleSaveNote}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
                        className="w-16 sm:w-20 px-1.5 py-0.5 text-[9px] bg-blue-50 text-[#002395] border border-blue-200 rounded outline-none focus:ring-1 focus:ring-[#002395] ml-1 placeholder-blue-300"
                        placeholder="Notatka"
                    />
                ) : casting.notes ? (
                    <button 
                        onClick={() => !isTemp && setIsEditing(true)}
                        disabled={isTemp}
                        className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold truncate max-w-[60px] sm:max-w-[80px] transition-colors
                            ${isTemp ? 'bg-stone-100 text-stone-400' : 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'}
                        `}
                        title={casting.notes}
                    >
                        {casting.notes}
                    </button>
                ) : null
            )}
        </div>

        {casting && !casting.notes && !isEditing && !isOverlay && (
            <button 
                onClick={() => setIsEditing(true)}
                disabled={isTemp}
                className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${isTemp ? 'text-stone-300' : 'text-stone-400 hover:text-[#002395] hover:bg-stone-100'}`}
                title="Dodaj notatkę (np. Góra/Dół)"
            >
                {isTemp ? <Loader2 size={12} className="animate-spin" /> : <Pencil size={12} />}
            </button>
        )}
    </div>
  );
}

function DroppableBucket({ 
  id, children, isDeficit, targetQuantity 
}: { 
  id: string; children: React.ReactNode; isDeficit: boolean; targetQuantity: number | null 
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div 
      ref={setNodeRef} 
      className={`flex-1 flex flex-col min-h-[70px] pt-2 pb-2 gap-2 rounded-xl transition-colors 
        ${isOver ? (isDeficit || targetQuantity === null ? 'bg-blue-50/50 shadow-inner' : 'bg-emerald-50/50 shadow-inner') : ''}
      `}
    >
      {children}
    </div>
  );
}

export default function MicroCastingTab({ projectId, voiceLines }: MicroCastingTabProps): React.JSX.Element | null {
  const queryClient = useQueryClient();
  
  const context = useContext(ProjectDataContext) as IProjectDataContext;
  if (!context) return null;
  const { artists, pieces } = context;

  // --- Data Synchronization ---
  const { data: rawParticipations = [] } = useQuery({
    queryKey: queryKeys.participations.byProject(projectId),
    queryFn: async () => {
      const res = await api.get(`/api/participations/?project=${projectId}`);
      return extractData(res.data);
    },
    staleTime: 60000
  });
  const participations = extractData(rawParticipations) as Participation[];

  const { data: rawProgram = [] } = useQuery({
    queryKey: queryKeys.program.byProject(projectId),
    queryFn: async () => {
      const res = await api.get(`/api/program-items/?project=${projectId}`);
      const extracted = extractData(res.data);
      return extracted.sort((a: ProgramItem, b: ProgramItem) => a.order - b.order);
    },
    staleTime: 60000
  });
  const program = extractData(rawProgram) as ProgramItem[];

  const { data: rawPieceCastings = [] } = useQuery({
    queryKey: queryKeys.pieceCastings.byProject(projectId),
    queryFn: async () => {
      const res = await api.get(`/api/piece-castings/?participation__project=${projectId}`);
      return extractData(res.data);
    },
    staleTime: 60000
  });
  const pieceCastings = extractData(rawPieceCastings) as PieceCasting[];

  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [localCastings, setLocalCastings] = useState<PieceCasting[]>([]); 
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const projectParticipations = useMemo(() => {
    return participations.filter((p) => String(p.project) === String(projectId));
  }, [participations, projectId]);

  const artistMap = useMemo(() => {
    const map = new Map<string, Artist>();
    projectParticipations.forEach((p) => {
      const artist = artists.find((a) => String(a.id) === String(p.artist));
      if (artist) map.set(String(p.id), artist);
    });
    return map;
  }, [projectParticipations, artists]);

  useEffect(() => {
    if (program.length > 0 && !selectedPieceId) {
      setSelectedPieceId(String(program[0].piece));
    }
  }, [program, selectedPieceId]);

  const globalCastingsForPiece = useMemo(() => {
    if (!selectedPieceId) return [];
    return pieceCastings.filter((c) => 
      String(c.piece) === String(selectedPieceId) && 
      projectParticipations.some((p) => String(p.id) === String(c.participation))
    );
  }, [pieceCastings, selectedPieceId, projectParticipations]);

  useEffect(() => {
    setLocalCastings(globalCastingsForPiece);
  }, [globalCastingsForPiece]);

  const pieceStatuses = useMemo(() => {
    const statuses: Record<string, 'FREE' | 'OK' | 'DEFICIT'> = {};
    
    program.forEach(item => {
        const pieceId = String(item.piece);
        const pieceObj = pieces.find(p => String(p.id) === pieceId);
        const reqs = pieceObj?.voice_requirements || [];
        
        if (reqs.length === 0) {
            statuses[pieceId] = 'FREE';
        } else {
            let missing = 0;
            reqs.forEach(req => {
                const assigned = pieceCastings.filter(c => 
                    String(c.piece) === pieceId && c.voice_line === req.voice_line
                ).length;
                if (assigned < req.quantity) missing += (req.quantity - assigned);
            });
            statuses[pieceId] = missing > 0 ? 'DEFICIT' : 'OK';
        }
    });
    
    return statuses;
  }, [program, pieces, pieceCastings]);

  const handleUpdateNote = async (castingId: string, newNote: string): Promise<void> => {
    const prevCastings = [...localCastings];
    
    setLocalCastings(prev => prev.map(c => 
        String(c.id) === castingId ? { ...c, notes: newNote } : c
    ));

    try {
        await api.patch(`/api/piece-castings/${castingId}/`, { notes: newNote });
        await queryClient.invalidateQueries({ queryKey: queryKeys.pieceCastings.all });
    } catch (err) {
        setLocalCastings(prevCastings);
        toast.error("Błąd zapisu", { description: "Nie udało się zaktualizować notatki." });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveDragId(null);
    const { over, active } = event;

    if (!over) return; 
    
    const partId = String(active.id); 
    const targetVoiceLine = String(over.id); 
    const existingCasting = localCastings.find((c) => String(c.participation) === partId);

    if (targetVoiceLine !== 'UNASSIGNED' && existingCasting?.voice_line === targetVoiceLine) return;
    if (targetVoiceLine === 'UNASSIGNED' && !existingCasting) return;

    const prevCastings = [...localCastings];
    
    let newCastings = [...localCastings];
    if (targetVoiceLine === 'UNASSIGNED') {
      newCastings = newCastings.filter((c) => String(c.participation) !== partId);
    } else {
      if (existingCasting) {
        newCastings = newCastings.map((c) => 
          String(c.participation) === partId ? { ...c, voice_line: targetVoiceLine } : c
        );
      } else {
        newCastings.push({ 
          id: `temp-${Date.now()}`, 
          participation: partId, 
          piece: selectedPieceId as string, 
          voice_line: targetVoiceLine,
          gives_pitch: false 
        } as PieceCasting);
      }
    }
    setLocalCastings(newCastings);

    try {
      if (targetVoiceLine === 'UNASSIGNED') {
        if (existingCasting?.id) await api.delete(`/api/piece-castings/${existingCasting.id}/`);
      } else {
        if (existingCasting?.id && !String(existingCasting.id).startsWith('temp-')) {
          await api.patch(`/api/piece-castings/${existingCasting.id}/`, { voice_line: targetVoiceLine });
        } else {
          await api.post('/api/piece-castings/', { 
            participation: partId, 
            piece: selectedPieceId, 
            voice_line: targetVoiceLine,
            gives_pitch: false
          });
        }
      }
      
      // ENTERPRISE FIX: Wide invalidation to sync Setlist and Project Stats
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.pieceCastings.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.program.all })
      ]);
      
    } catch (err) { 
      setLocalCastings(prevCastings);
      toast.error("Błąd synchronizacji", { description: "Nie udało się zaktualizować obsady." });
    }
  };

  if (program.length === 0) {
    return (
      <div className={`${STYLE_SOLID_CARD} p-12 text-center text-stone-500 border border-dashed border-stone-300/50 flex flex-col justify-center items-center`}>
        <ListOrdered size={32} className="mb-4 opacity-30 text-stone-400" aria-hidden="true" />
        <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak utworów</span>
        <span className="text-xs max-w-sm leading-relaxed">Zbuduj strukturę koncertu w module "Setlista", zanim przejdziesz do podziału ról (divisi).</span>
      </div>
    );
  }

  const currentPiece = pieces.find((p) => String(p.id) === String(selectedPieceId));
  const currentReferenceRecording = currentPiece ? getPrimaryReferenceRecording(currentPiece) : null;
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

  const renderHealthCheckBanner = () => {
      if (!currentPiece) return null;
      if (isFreeMode) return null;
      
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

          <DroppableBucket id={voiceValue} isDeficit={targetQuantity !== null && assignedCount < targetQuantity} targetQuantity={targetQuantity}>
              {artistsInLine.length === 0 && (
                <div className={`text-[9px] uppercase tracking-widest font-bold antialiased text-center mt-4 pointer-events-none ${targetQuantity !== null && assignedCount < targetQuantity ? 'text-red-400' : 'text-stone-300'}`}>
                  Przeciągnij tutaj
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                {artistsInLine.map((c) => {
                    const artist = artistMap.get(String(c.participation));
                    if (!artist) return null;
                    
                    return (
                        <DraggableArtist 
                            key={String(c.participation)} 
                            participationId={String(c.participation)} 
                            artist={artist} 
                            casting={c}
                            onUpdateNote={handleUpdateNote}
                        />
                    );
                })}
              </div>
          </DroppableBucket>
      </div>
    );
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6 max-w-6xl mx-auto">
        
        {/* --- Setlist Navigation Track --- */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-stone-200/60">
          {program.map((item, idx) => {
            const pieceId = String(item.piece);
            const status = pieceStatuses[pieceId];
            const isSelected = selectedPieceId === pieceId;
            
            let tabStyle = "";
            if (status === 'FREE') {
              tabStyle = isSelected ? 'border-stone-400 text-stone-800 bg-stone-200/50' : 'border-transparent text-stone-400 hover:text-stone-600 hover:bg-stone-50/50';
            } else if (status === 'OK') {
              tabStyle = isSelected ? 'border-emerald-500 text-emerald-800 bg-emerald-100/50' : 'border-transparent text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50';
            } else { // DEFICIT
              tabStyle = isSelected ? 'border-red-500 text-red-800 bg-red-100/50' : 'border-transparent text-red-500 hover:text-red-700 hover:bg-red-50';
            }

            return (
              <button 
                key={item.id} 
                onClick={() => setSelectedPieceId(pieceId)}
                className={`px-5 py-3.5 text-[10px] font-bold antialiased uppercase tracking-widest whitespace-nowrap rounded-t-xl transition-all border-b-2 ${tabStyle}`}
              >
                {idx + 1}. {item.piece_title}
              </button>
            );
          })}
        </div>

        <div className={`${STYLE_SOLID_CARD} p-6 md:p-8`}>
          
          {/* --- Metadata Banner --- */}
          {currentPiece && (currentReferenceRecording || (currentPiece as any).voicing) && (
              <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-stone-50 border border-stone-200/80 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                  {(currentPiece as any).voicing && (
                      <span className="flex items-center gap-1.5 text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                          <MicVocal size={14} aria-hidden="true" /> Oryginalna Obsada: {(currentPiece as any).voicing}
                      </span>
                  )}
                  {currentReferenceRecording && (
                      <a 
                        href={currentReferenceRecording.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={`flex items-center gap-1.5 text-[9px] font-bold antialiased uppercase tracking-widest px-4 py-1.5 rounded-lg border transition-all shadow-sm active:scale-95 ${currentReferenceRecording.platform === 'youtube' ? 'text-red-600 bg-white hover:bg-red-50 hover:text-red-700 border-red-100' : 'text-emerald-700 bg-white hover:bg-emerald-50 hover:text-emerald-800 border-emerald-100'}`}
                      >
                          <PlayCircleIcon size={14} aria-hidden="true" /> Posłuchaj Referencji
                      </a>
                  )}
              </div>
          )}

          {renderHealthCheckBanner()}

          {/* --- Unassigned Roster Pool --- */}
          <div className="mb-10">
            <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3 flex items-center gap-2 ml-1">
              Rezerwa Personalna
            </h4>
            
            <div className="bg-stone-50/50 border-stone-300/50 shadow-sm border-2 border-dashed rounded-2xl">
              <DroppableBucket id="UNASSIGNED" isDeficit={false} targetQuantity={null}>
                <div className="flex flex-wrap gap-2 px-4 py-3 min-h-[60px] items-center">
                  {unassignedParticipations.length === 0 && (
                    <span className="text-[11px] text-stone-400 italic font-medium w-full text-center py-2">
                      Wszyscy uczestnicy wydarzenia zostali przydzieleni.
                    </span>
                  )}
                  
                  {unassignedParticipations.map((p) => {
                      const artist = artistMap.get(String(p.id));
                      if (!artist) return null;
                      
                      return (
                        <DraggableArtist 
                          key={String(p.id)} 
                          participationId={String(p.id)} 
                          artist={artist} 
                        />
                      );
                  })}
                </div>
              </DroppableBucket>
            </div>
          </div>

          {/* --- Kanban Bins Rendering --- */}
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

      {/* --- Drag Overlay --- */}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.38, 1)' }}>
        {activeDragId && artistMap.has(activeDragId) ? (
          <DraggableArtist 
            participationId={activeDragId} 
            artist={artistMap.get(activeDragId)!} 
            isOverlay={true} 
            casting={localCastings.find(c => String(c.participation) === activeDragId)}
          />
        ) : null}
      </DragOverlay>

    </DndContext>
  );
}