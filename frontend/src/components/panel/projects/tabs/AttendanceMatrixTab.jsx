/**
 * @file AttendanceMatrixTab.jsx
 * @description Advanced Attendance Matrix for Directors and Choir Inspectors.
 * Implements a High-Density Data Grid with Optimistic UI mutations (One-Click status cycling).
 * ENTERPRISE OPTIMIZATION: Context API integration reduces API calls by 75% on mount.
 * UI UPGRADE: 2026 Enterprise Standards (Glassmorphism, antialiased micro-typography, soft table borders).
 * @module project/tabs/AttendanceMatrix
 * @author Krystian Bugalski
 */

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { Loader2, Check, X, Clock, ShieldAlert, Users } from 'lucide-react';
import api from '../../../../utils/api';
import { ProjectDataContext } from '../ProjectDashboard';

const STATUS_CYCLE = [
    { value: null, color: 'bg-stone-100/50 hover:bg-stone-200/80 border-stone-200/60 text-transparent', icon: null, label: 'Brak' },
    { value: 'PRESENT', color: 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]', icon: <Check size={14}/>, label: 'Obecny' },
    { value: 'ABSENT', color: 'bg-red-500 hover:bg-red-600 border-red-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]', icon: <X size={14}/>, label: 'Nieobecny' },
    { value: 'LATE', color: 'bg-orange-500 hover:bg-orange-600 border-orange-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]', icon: <Clock size={12}/>, label: 'Spóźniony' },
    { value: 'EXCUSED', color: 'bg-purple-500 hover:bg-purple-600 border-purple-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]', icon: <ShieldAlert size={12}/>, label: 'Uspraw.' }
];

export default function AttendanceMatrixTab({ projectId }) {
  const { rehearsals, participations, artists } = useContext(ProjectDataContext);

  const [attendances, setAttendances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const projectRehearsals = useMemo(() => {
      return rehearsals.filter(r => r.project === projectId).sort((a,b) => new Date(a.date_time) - new Date(b.date_time));
  }, [rehearsals, projectId]);

  const projectParticipations = useMemo(() => {
      return participations.filter(p => p.project === projectId);
  }, [participations, projectId]);

  useEffect(() => {
    const fetchAttendancesOnly = async () => {
      setIsLoading(true);
      try {
        const attRes = await api.get('/api/attendances/');
        const projectRehearsalIds = projectRehearsals.map(r => r.id);
        setAttendances(Array.isArray(attRes.data) ? attRes.data.filter(a => projectRehearsalIds.includes(a.rehearsal)) : []);
      } catch (err) {
        console.error("Matrix attendance data load failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (projectRehearsals.length > 0) {
        fetchAttendancesOnly();
    } else {
        setIsLoading(false);
    }
  }, [projectRehearsals, projectId]);

  const groupedRoster = useMemo(() => {
      const groups = { 'Soprany': [], 'Alty': [], 'Tenory': [], 'Basy': [], 'Inne': [] };
      
      projectParticipations.forEach(part => {
          const artist = artists.find(a => String(a.id) === String(part.artist));
          if (artist) {
              const vt = artist.voice_type || '';
              const enrichedPart = { ...part, artistData: artist };
              
              if (vt.startsWith('S')) groups['Soprany'].push(enrichedPart);
              else if (vt.startsWith('A') || vt === 'MEZ') groups['Alty'].push(enrichedPart);
              else if (vt.startsWith('T') || vt === 'CT') groups['Tenory'].push(enrichedPart);
              else if (vt.startsWith('B')) groups['Basy'].push(enrichedPart);
              else groups['Inne'].push(enrichedPart);
          }
      });

      Object.keys(groups).forEach(k => {
          groups[k].sort((a, b) => a.artistData.last_name.localeCompare(b.artistData.last_name));
      });

      return groups;
  }, [projectParticipations, artists]);

  const handleCellClick = async (rehearsalId, participationId, currentRecord) => {
      const currentIndex = STATUS_CYCLE.findIndex(s => s.value === (currentRecord?.status || null));
      const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
      const nextStatus = STATUS_CYCLE[nextIndex].value;

      const previousAttendances = [...attendances];
      let newAttendances = [...attendances];
      
      if (nextStatus === null) {
          newAttendances = newAttendances.filter(a => a.id !== currentRecord.id);
      } else {
          if (currentRecord) {
              newAttendances = newAttendances.map(a => a.id === currentRecord.id ? { ...a, status: nextStatus } : a);
          } else {
              newAttendances.push({ id: `temp-${Date.now()}`, rehearsal: rehearsalId, participation: participationId, status: nextStatus });
          }
      }
      setAttendances(newAttendances);

      try {
          if (nextStatus === null && currentRecord) {
              await api.delete(`/api/attendances/${currentRecord.id}/`);
          } else if (nextStatus !== null && currentRecord) {
              await api.patch(`/api/attendances/${currentRecord.id}/`, { status: nextStatus });
          } else if (nextStatus !== null && !currentRecord) {
              const res = await api.post('/api/attendances/', { rehearsal: rehearsalId, participation: participationId, status: nextStatus });
              setAttendances(prev => prev.map(a => a.id.toString().startsWith('temp-') && a.rehearsal === rehearsalId && a.participation === participationId ? res.data : a));
          }
      } catch (err) {
          console.error("Cell mutation failed, rolling back.", err);
          setAttendances(previousAttendances); 
      }
  };

  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden";

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-stone-400" /></div>;

  if (projectRehearsals.length === 0 || projectParticipations.length === 0) {
      return (
          <div className={`${glassCardStyle} p-12 text-center text-stone-500 flex flex-col items-center justify-center`}>
            <Users size={32} className="mx-auto mb-4 opacity-50" />
            <p className="font-bold antialiased uppercase tracking-widest text-[11px] text-stone-500 mb-2">Brakuje danych do macierzy</p>
            <p className="text-xs text-stone-400 max-w-sm leading-relaxed">Aby wygenerować dziennik, musisz zdefiniować próby oraz przypisać artystów w module Casting.</p>
          </div>
      );
  }

  return (
    <div className={glassCardStyle}>
      <div className="bg-stone-50/40 p-5 border-b border-white/60 flex flex-wrap items-center gap-6">
          <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">Legenda kliknięć:</span>
          {STATUS_CYCLE.filter(s => s.value !== null).map(status => (
              <div key={status.value} className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shadow-sm ${status.color}`}>
                      {status.icon}
                  </div>
                  <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-600">{status.label}</span>
              </div>
          ))}
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-white/80 backdrop-blur-md p-4 border-b border-r border-stone-200/60 w-48 min-w-[220px] shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                  <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">Chórzysta</span>
              </th>
              {projectRehearsals.map((reh) => (
                <th key={reh.id} className="p-3 border-b border-stone-200/60 min-w-[64px] text-center bg-white/40 group relative">
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold antialiased text-stone-400 uppercase tracking-widest">{new Date(reh.date_time).toLocaleDateString('pl-PL', { month: 'short' })}</span>
                        <span className="text-sm font-bold text-stone-800 leading-none mt-1 tracking-tight">{new Date(reh.date_time).getDate()}</span>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-stone-900/90 backdrop-blur-md text-white text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap shadow-xl">
                        {new Date(reh.date_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}<br/>
                        <span className="opacity-75">{reh.location}</span>
                    </div>
                </th>
              ))}
              <th className="p-4 border-b border-l border-stone-200/60 text-center bg-white/40 w-28">
                  <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">Frekwencja</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedRoster).map(([groupName, groupParticipations]) => {
                if (groupParticipations.length === 0) return null;

                return (
                    <React.Fragment key={groupName}>
                        <tr>
                            <td colSpan={projectRehearsals.length + 2} className="bg-stone-50/50 p-3 border-y border-stone-200/60">
                                <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395] ml-3 flex items-center gap-2">
                                    {groupName} <span className="px-1.5 py-0.5 bg-blue-50 rounded-md opacity-70">{groupParticipations.length}</span>
                                </span>
                            </td>
                        </tr>
                        
                        {groupParticipations.map(part => {
                            const artistRecords = attendances.filter(a => a.participation === part.id);
                            const presents = artistRecords.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
                            const attendanceRate = projectRehearsals.length > 0 ? Math.round((presents / projectRehearsals.length) * 100) : 0;

                            return (
                                <tr key={part.id} className="hover:bg-white/60 transition-colors group">
                                    <td className="sticky left-0 z-10 bg-white/80 backdrop-blur-md group-hover:bg-white p-4 border-b border-r border-stone-200/60 shadow-[2px_0_10px_rgba(0,0,0,0.02)] transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-stone-800 truncate tracking-tight">{part.artistData.first_name} {part.artistData.last_name}</span>
                                        </div>
                                    </td>
                                    
                                    {projectRehearsals.map(reh => {
                                        const record = attendances.find(a => a.rehearsal === reh.id && a.participation === part.id);
                                        const currentStatusObj = STATUS_CYCLE.find(s => s.value === (record?.status || null));

                                        return (
                                            <td key={`${part.id}-${reh.id}`} className="p-2 border-b border-stone-100/50 text-center">
                                                <button 
                                                    onClick={() => handleCellClick(reh.id, part.id, record)}
                                                    className={`w-8 h-8 mx-auto rounded-lg border flex items-center justify-center transition-all transform active:scale-90 shadow-sm ${currentStatusObj.color}`}
                                                    title={currentStatusObj.label}
                                                >
                                                    {currentStatusObj.icon}
                                                </button>
                                            </td>
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