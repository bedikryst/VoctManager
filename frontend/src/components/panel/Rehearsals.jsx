/**
 * @file Rehearsals.jsx
 * @description Rehearsals & Attendance Module.
 * Manages rehearsal schedules and attendance logs. Features a sophisticated
 * Debounce Auto-Save mechanism to provide a seamless, click-free data entry experience.
 * Handles graceful degradation between POST (create) and PATCH (update) requests.
 * @author Krystian Bugalski
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../utils/api';

export default function Rehearsals() {
  const [projects, setProjects] = useState([]);
  const [rehearsals, setRehearsals] = useState([]);
  const [participations, setParticipations] = useState([]);
  const [attendances, setAttendances] = useState([]); // NEW: State for global attendances
  
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeRehearsalId, setActiveRehearsalId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Initial Data Fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, rehRes, partRes, attRes] = await Promise.all([
          api.get('/api/projects/'),
          api.get('/api/rehearsals/'),
          api.get('/api/participations/'),
          api.get('/api/attendances/') // We must fetch existing attendance logs!
        ]);
        
        setProjects(Array.isArray(projRes.data) ? projRes.data : []);
        setRehearsals(Array.isArray(rehRes.data) ? rehRes.data : []);
        setParticipations(Array.isArray(partRes.data) ? partRes.data : []);
        setAttendances(Array.isArray(attRes.data) ? attRes.data : []);
      } catch (err) {
        console.error("Data loading error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter and sort rehearsals chronologically
  const currentRehearsals = rehearsals
    .filter(r => r.project === parseInt(selectedProjectId))
    .sort((a, b) => new Date(a.date_time) - new Date(b.date_time));

  const currentCast = participations.filter(p => p.project === parseInt(selectedProjectId));

  const handleProjectChange = (e) => {
    setSelectedProjectId(e.target.value);
    setActiveRehearsalId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in cursor-default">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b border-stone-200 pb-2 mb-6">
        <h2 className="text-xl font-serif font-bold text-stone-800">Planowanie i Obecności</h2>
      </div>

      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        
        {/* PROJECT SELECTOR */}
        <div className="mb-8 max-w-md">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Wybierz wydarzenie (Projekt)</label>
          <select 
            value={selectedProjectId} 
            onChange={handleProjectChange} 
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:border-[#002395] outline-none bg-stone-50 font-medium transition-all disabled:opacity-50"
          >
            <option value="">-- Wybierz z listy --</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        {selectedProjectId && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 border-t border-stone-100 pt-6">
            
            {/* LEFT COLUMN: Rehearsal List */}
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-2 mb-4">
                <Calendar size={16} className="text-[#002395]" /> Harmonogram Prób
              </h3>
              
              {currentRehearsals.length > 0 ? currentRehearsals.map(rehearsal => {
                const dateObj = new Date(rehearsal.date_time);
                const isActive = activeRehearsalId === rehearsal.id;
                
                return (
                  <div 
                    key={rehearsal.id}
                    onClick={() => setActiveRehearsalId(rehearsal.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${isActive ? 'bg-[#002395] border-[#002395] text-white shadow-md transform scale-[1.02]' : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-md ${isActive ? 'bg-white/20' : 'bg-stone-100'}`}>
                        <span className="text-xs font-bold uppercase">{dateObj.toLocaleString('pl-PL', { month: 'short' })}</span>
                        <span className="text-lg font-black leading-none">{dateObj.getDate()}</span>
                      </div>
                      <div>
                        <p className={`font-bold ${isActive ? 'text-white' : 'text-stone-900'}`}>
                          {dateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className={`text-[10px] uppercase tracking-wider flex items-center gap-1 mt-1 ${isActive ? 'text-blue-100' : 'text-stone-500'}`}>
                          <MapPin size={10} /> {rehearsal.location}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-xs text-stone-500 italic p-4 border border-dashed border-stone-200 rounded-lg text-center">Brak zaplanowanych prób.</p>
              )}
            </div>

            {/* RIGHT COLUMN: Interactive Attendance List */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {activeRehearsalId ? (
                  <motion.div 
                    key={activeRehearsalId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-stone-50 border border-stone-200 rounded-xl p-6"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center justify-between mb-6 pb-4 border-b border-stone-200">
                      <span className="flex items-center gap-2"><Users size={16} className="text-[#002395]" /> Dziennik Obecności</span>
                      <span className="text-[10px] text-stone-500 bg-white px-2 py-1 rounded-sm border border-stone-200 shadow-sm">
                        Auto-zapis włączony
                      </span>
                    </h3>

                    <div className="space-y-3">
                      {currentCast.length > 0 ? currentCast.map(participation => {
                        // Locate existing record to prevent IntegrityErrors
                        const existingRecord = attendances.find(
                            a => a.rehearsal === activeRehearsalId && a.participation === participation.id
                        );

                        return (
                          <AttendanceRow 
                            key={participation.id} 
                            participation={participation} 
                            rehearsalId={activeRehearsalId}
                            existingRecord={existingRecord}
                          />
                        );
                      }) : (
                        <p className="text-sm text-stone-500 italic">Brak przypisanej obsady do tego projektu.</p>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-xl bg-stone-50">
                    <Calendar size={48} className="mb-4 text-stone-300" />
                    <p className="text-sm font-medium">Wybierz próbę z listy obok,</p>
                    <p className="text-xs">aby sprawdzić obecności artystów.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

/**
 * @component AttendanceRow
 * @description Sub-component representing a single artist's attendance record.
 * Uses a debounce pattern to automatically PATCH or POST data to the Django API
 * after the user stops interacting with the inputs.
 */
function AttendanceRow({ participation, rehearsalId, existingRecord }) {
  // Initialize state based on existing database records (if they exist)
  const [recordId, setRecordId] = useState(existingRecord?.id || null);
  const [status, setStatus] = useState(existingRecord?.status || 'PRESENT');
  const [minutesLate, setMinutesLate] = useState(existingRecord?.minutes_late || '');
  const [note, setNote] = useState(existingRecord?.excuse_note || '');
  
  // Visual states: 'idle', 'saving', 'success', 'error'
  const [saveState, setSaveState] = useState('idle');
  
  const isMounted = useRef(false);
  const timeoutRef = useRef(null);

  // Deep sync if activeRehearsal changes
  useEffect(() => {
    setRecordId(existingRecord?.id || null);
    setStatus(existingRecord?.status || 'PRESENT');
    setMinutesLate(existingRecord?.minutes_late || '');
    setNote(existingRecord?.excuse_note || '');
  }, [existingRecord]);

  // Debounced Auto-Save Logic
  useEffect(() => {
    // Prevent firing on the initial component mount
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    const autoSaveData = async () => {
      setSaveState('saving');
      try {
        const payload = {
          rehearsal: rehearsalId,
          participation: participation.id,
          status: status,
          minutes_late: status === 'LATE' && minutesLate ? parseInt(minutesLate) : null,
          excuse_note: status === 'EXCUSED' ? note : ''
        };

        if (recordId) {
            // If the record exists, perform a PATCH update
            await api.patch(`/api/attendances/${recordId}/`, payload);
        } else {
            // If it's a new record, perform a POST creation
            const res = await api.post('/api/attendances/', payload);
            setRecordId(res.data.id); // Save the new ID to prevent future POST duplicates
        }
        
        setSaveState('success');
        // Reset the visual feedback tick after 2 seconds
        setTimeout(() => setSaveState('idle'), 2000);
      } catch (err) {
        console.error("Auto-save error:", err);
        setSaveState('error');
      }
    };

    // Clear previous timeout to prevent spamming the API
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Wait 800ms after the last user interaction before firing the API request
    timeoutRef.current = setTimeout(() => {
      autoSaveData();
    }, 800);

    return () => clearTimeout(timeoutRef.current);
  }, [status, minutesLate, note, rehearsalId, participation.id, recordId]);

  return (
    <div className="bg-white p-3 md:p-4 rounded-lg border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-stone-300 relative group">
      
      {/* Artist Info & Save Indicator */}
      <div className="flex-1 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center flex-shrink-0 border border-stone-100">
           {saveState === 'saving' && <Loader2 size={14} className="text-[#002395] animate-spin" />}
           {saveState === 'success' && <CheckCircle2 size={16} className="text-emerald-500" />}
           {saveState === 'error' && <AlertCircle size={16} className="text-red-500" />}
           {saveState === 'idle' && <span className="text-xs font-bold text-stone-300">{participation.artist_name?.charAt(0) || '-'}</span>}
        </div>
        
        <div>
          <p className="font-bold text-stone-800 text-sm">{participation.artist_name || `Uczestnik #${participation.artist}`}</p>
          <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">{participation.artist_voice_type_display || 'Brak głosu'}</p>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select 
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={`text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-md outline-none border transition-all cursor-pointer ${
            status === 'PRESENT' ? 'bg-green-50 border-green-200 text-green-700' :
            status === 'LATE' ? 'bg-orange-50 border-orange-200 text-orange-700' :
            status === 'ABSENT' ? 'bg-red-50 border-red-200 text-red-700' :
            'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          <option value="PRESENT">Obecny</option>
          <option value="LATE">Spóźniony</option>
          <option value="ABSENT">Nieobecny</option>
          <option value="EXCUSED">Usprawiedliw.</option>
        </select>

        {/* Dynamic Fields based on Status */}
        <AnimatePresence>
          {status === 'LATE' && (
            <motion.input 
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: '80px' }}
              exit={{ opacity: 0, width: 0 }}
              type="number" 
              placeholder="Minuty"
              value={minutesLate}
              onChange={(e) => setMinutesLate(e.target.value)}
              className="text-xs px-2 py-2 border border-stone-200 rounded-md outline-none focus:border-orange-400 bg-white cursor-text"
            />
          )}

          {status === 'EXCUSED' && (
            <motion.input 
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: '120px' }}
              exit={{ opacity: 0, width: 0 }}
              type="text" 
              placeholder="Powód"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-xs px-2 py-2 border border-stone-200 rounded-md outline-none focus:border-[#002395] bg-white cursor-text"
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}