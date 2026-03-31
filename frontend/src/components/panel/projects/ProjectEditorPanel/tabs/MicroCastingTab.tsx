/**
 * @file MicroCastingTab.tsx
 * @description Advanced Kanban Board for Divisi and Micro-casting orchestration.
 * Completely delegates complex drag-and-drop state, caching, and optimistic mutations 
 * to the useMicroCasting hook. Exclusively handles presentation and DnD routing.
 * @module panel/projects/ProjectEditorPanel/tabs/MicroCastingTab
 */

import React from 'react';
import { 
    DndContext, DragOverlay, PointerSensor, KeyboardSensor, 
    useSensor, useSensors 
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { AlertCircle, CheckCircle2, Users, MicVocal, PlayCircleIcon, ListOrdered } from 'lucide-react';

import { useMicroCasting } from '../hooks/useMicroCasting';
import { getPrimaryReferenceRecording } from '../../../../../utils/referenceRecordings';
import { DraggableArtist } from './components/DraggableArtist';
import { DroppableBucket } from './components/DroppableBucket';
import { GlassCard } from '../../../../ui/GlassCard';

interface MicroCastingTabProps {
    projectId: string;
}

const VOICE_GROUPS = [
    { label: 'Soprany', filter: 'S' }, 
    { label: 'Alty', filter: 'A' },
    { label: 'Tenory', filter: 'T' }, 
    { label: 'Basy', filter: 'B' }
];

export default function MicroCastingTab({ projectId }: MicroCastingTabProps): React.JSX.Element | null {
    const {
        program, voiceLines, pieces, selectedPieceId, setSelectedPieceId,
        localCastings, activeDragId, artistMap, pieceStatuses, projectParticipations,
        handleUpdateNote, handleDragStart, handleDragEnd
    } = useMicroCasting(projectId);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    if (program.length === 0) {
        return (
            <GlassCard variant="solid" className="p-12 text-center text-stone-500 border border-dashed border-stone-300/50 flex flex-col justify-center items-center">
                <ListOrdered size={32} className="mb-4 opacity-30 text-stone-400" aria-hidden="true" />
                <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak utworów</span>
                <span className="text-xs max-w-sm leading-relaxed">Zbuduj strukturę koncertu w module "Setlista", zanim przejdziesz do podziału ról (divisi).</span>
            </GlassCard>
        );
    }

    const currentPiece = pieces.find((p) => String(p.id) === String(selectedPieceId));
    const currentReferenceRecording = currentPiece ? getPrimaryReferenceRecording(currentPiece) : null;
    const requirements = currentPiece?.voice_requirements || [];
    const isFreeMode = requirements.length === 0;
    
    const unassignedParticipations = projectParticipations.filter((p) => 
        !localCastings.some((c) => String(c.participation) === String(p.id))
    );

    const renderHealthCheckBanner = () => {
        if (!currentPiece || isFreeMode) return null;
        
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
                
                {/* Setlist Navigation Track */}
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

                <GlassCard variant="solid" className="p-6 md:p-8">
                    
                    {/* Metadata Banner */}
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

                    {/* Unassigned Roster Pool */}
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

                    {/* Kanban Bins Rendering */}
                    {isFreeMode ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            {VOICE_GROUPS.map((group) => (
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
                </GlassCard>
            </div>

            {/* Drag Overlay */}
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