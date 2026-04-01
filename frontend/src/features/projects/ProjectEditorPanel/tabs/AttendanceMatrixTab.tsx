/**
 * @file AttendanceMatrixTab.tsx
 * @description Advanced Attendance Matrix for Directors and Choir Inspectors.
 * Delegates caching and mutation execution to useAttendanceMatrix.
 * Uses aggressive UI memoization to prevent cascading structural re-renders.
 * @module panel/projects/ProjectEditorPanel/tabs/AttendanceMatrixTab
 */

import React from 'react';
import { Loader2, Check, X, Clock, ShieldAlert, Users } from 'lucide-react';
import { useAttendanceMatrix, AttendanceRecord } from '../hooks/useAttendanceMatrix';

interface AttendanceMatrixTabProps {
    projectId: string;
}

const STATUS_DEF: Record<string, { label: string, color: string, icon: React.ReactNode }> = {
    'null': { label: 'Brak wpisu', color: 'bg-stone-50 hover:bg-stone-100 text-stone-200 border border-stone-200/60', icon: <span className="w-1.5 h-1.5 rounded-full bg-stone-300" aria-hidden="true"></span> },
    'PRESENT': { label: 'Obecny', color: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_2px_10px_rgba(16,185,129,0.3)] border border-emerald-600', icon: <Check size={16} strokeWidth={3} aria-hidden="true" /> },
    'ABSENT': { label: 'Nieobecny', color: 'bg-red-500 hover:bg-red-600 text-white shadow-[0_2px_10px_rgba(239,68,68,0.3)] border border-red-600', icon: <X size={16} strokeWidth={3} aria-hidden="true" /> },
    'LATE': { label: 'Spóźniony', color: 'bg-orange-400 hover:bg-orange-500 text-white shadow-[0_2px_10px_rgba(249,115,22,0.3)] border border-orange-500', icon: <Clock size={14} strokeWidth={3} aria-hidden="true" /> },
    'EXCUSED': { label: 'Zwolniony', color: 'bg-purple-500 hover:bg-purple-600 text-white shadow-[0_2px_10px_rgba(168,85,247,0.3)] border border-purple-600', icon: <ShieldAlert size={14} strokeWidth={3} aria-hidden="true" /> }
};

const VOICE_GROUPS = [
    { filter: 'S', label: 'Soprany' },
    { filter: 'A', label: 'Alty' },
    { filter: 'T', label: 'Tenory' },
    { filter: 'B', label: 'Basy' }
];

interface MatrixCellProps {
    rehearsalId: string | number;
    participationId: string | number;
    record: AttendanceRecord | undefined;
    onToggle: (rehearsalId: string | number, participationId: string | number, record: AttendanceRecord | undefined) => void;
    isMutating: boolean;
}

const MatrixCell = React.memo(({ rehearsalId, participationId, record, onToggle, isMutating }: MatrixCellProps) => {
    const currentStatus = record?.status || 'null';
    const currentStatusObj = STATUS_DEF[String(currentStatus)] || STATUS_DEF['null'];

    return (
        <td className="p-1 border-b border-stone-200/60 text-center">
            <button 
                onClick={() => onToggle(rehearsalId, participationId, record)}
                disabled={isMutating}
                className={`w-full h-10 flex items-center justify-center rounded-lg transition-all active:scale-90 ${currentStatusObj.color} ${isMutating ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={currentStatusObj.label}
                aria-label={`Oznacz obecność: ${currentStatusObj.label}`}
            >
                {isMutating ? <Loader2 size={12} className="animate-spin opacity-50" aria-hidden="true" /> : currentStatusObj.icon}
            </button>
        </td>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.record?.status === nextProps.record?.status &&
        prevProps.record?.id === nextProps.record?.id &&
        prevProps.isMutating === nextProps.isMutating
    );
});

MatrixCell.displayName = 'MatrixCell';

export default function AttendanceMatrixTab({ projectId }: AttendanceMatrixTabProps): React.JSX.Element | null {
    const {
        isLoading, projectRehearsals, enrichedParticipations,
        attendanceMap, mutatingCells, handleToggleStatus
    } = useAttendanceMatrix(projectId);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white/40 rounded-2xl border border-stone-200/60">
                <Loader2 size={32} className="animate-spin text-[#002395] mb-4" aria-hidden="true" />
                <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">Wczytywanie macierzy...</span>
            </div>
        );
    }

    if (projectRehearsals.length === 0 || enrichedParticipations.length === 0) {
        return (
            <div className="text-center py-16 bg-white/40 rounded-2xl border border-dashed border-stone-300/60">
                <Users size={32} className="mx-auto mb-3 opacity-30 text-stone-400" aria-hidden="true" />
                <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 block mb-1">Macierz Niedostępna</span>
                <span className="text-xs text-stone-400 max-w-sm mx-auto block">Aby wyświetlić dziennik obecności, dodaj do projektu przynajmniej jedną próbę oraz przypisz obsadę wokalną.</span>
            </div>
        );
    }

    return (
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] rounded-2xl overflow-hidden flex flex-col h-[75vh]">
            
            <div className="bg-stone-50/50 backdrop-blur-sm p-4 border-b border-stone-200/60 flex flex-wrap gap-4 items-center justify-center sm:justify-start flex-shrink-0">
                <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mr-2">Legenda:</span>
                {Object.entries(STATUS_DEF).filter(([k]) => k !== 'null').map(([key, def]) => (
                    <div key={key} className="flex items-center gap-2">
                        <span className={`w-5 h-5 flex items-center justify-center rounded text-white ${def.color}`}>{def.icon}</span>
                        <span className="text-xs font-medium text-stone-600">{def.label}</span>
                    </div>
                ))}
                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-stone-400 italic font-medium">Kliknij w komórkę, aby zmienić status.</span>
                </div>
            </div>

            <div className="overflow-auto flex-1 relative scrollbar-hide">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr>
                            <th className="p-4 border-b border-stone-200/60 bg-stone-50/90 sticky top-0 left-0 z-30 w-48 backdrop-blur-md shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">
                                <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">Artysta</span>
                            </th>
                            
                            {projectRehearsals.map((reh, idx) => (
                                <th key={reh.id} className="p-3 border-b border-stone-200/60 text-center min-w-[60px] max-w-[80px] sticky top-0 z-20 bg-stone-50/90 backdrop-blur-md shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-1">P{idx + 1}</span>
                                        <span className="text-xs font-bold text-stone-800">
                                            {new Date(reh.date_time).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                    </div>
                                </th>
                            ))}
                            
                            <th className="p-4 border-b border-l border-stone-200/60 text-center w-24 sticky top-0 z-20 bg-stone-50/90 backdrop-blur-md shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">
                                <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">Frekw.</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white/40">
                        {VOICE_GROUPS.map((group) => {
                            const groupParticipations = enrichedParticipations.filter(p => (p.artistData.voice_type || '').startsWith(group.filter));
                            if (groupParticipations.length === 0) return null;

                            return (
                                <React.Fragment key={group.filter}>
                                    <tr>
                                        <td colSpan={projectRehearsals.length + 2} className="bg-stone-50/80 px-4 py-2 border-b border-stone-200/60 sticky left-0 z-10">
                                            <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395]">{group.label}</span>
                                        </td>
                                    </tr>
                                    {groupParticipations.map(part => {
                                        const totalRehearsals = projectRehearsals.length;
                                        const presentCount = projectRehearsals.filter(r => {
                                            const st = attendanceMap.get(`${r.id}-${part.id}`)?.status;
                                            return st === 'PRESENT' || st === 'LATE';
                                        }).length;
                                        const attendanceRate = totalRehearsals > 0 ? Math.round((presentCount / totalRehearsals) * 100) : 0;

                                        return (
                                            <tr key={part.id} className="hover:bg-stone-50/50 transition-colors group/row">
                                                <td className="p-3 border-b border-stone-200/60 sticky left-0 z-10 bg-white/80 backdrop-blur-md group-hover/row:bg-stone-50/80 transition-colors">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-stone-800 whitespace-nowrap">{part.artistData.first_name} {part.artistData.last_name}</span>
                                                    </div>
                                                </td>
                                                
                                                {projectRehearsals.map(reh => {
                                                    const cellKey = `${reh.id}-${part.id}`;
                                                    const record = attendanceMap.get(cellKey);
                                                    const isMutating = mutatingCells.has(cellKey);

                                                    return (
                                                        <MatrixCell 
                                                            key={cellKey}
                                                            rehearsalId={reh.id}
                                                            participationId={part.id}
                                                            record={record}
                                                            onToggle={handleToggleStatus}
                                                            isMutating={isMutating}
                                                        />
                                                    );
                                                })}

                                                <td className="p-4 border-b border-l border-stone-200/60 text-center">
                                                    <span className={`text-[10px] font-bold antialiased tracking-widest px-2.5 py-1.5 rounded-lg border ${
                                                        attendanceRate >= 80 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                                                        attendanceRate >= 50 ? 'bg-orange-50 border-orange-100 text-orange-700' : 'bg-red-50 border-red-100 text-red-700'
                                                    }`}>
                                                        {attendanceRate}%
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}