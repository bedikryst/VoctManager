/**
 * Rehearsals & Attendance Module
 * Author: Krystian Bugalski
 * * Zarządza harmonogramem prób i listami obecności.
 * Posiada wbudowany mechanizm Auto-Zapis (Debounce), eliminujący
 * konieczność ręcznego klikania przycisku zapisu dla każdego artysty.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../utils/api';

export default function Rehearsals() {
  const [projects, setProjects] = useState([]);
  const [rehearsals, setRehearsals] = useState([]);
  const [participations, setParticipations] = useState([]);
  
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeRehearsalId, setActiveRehearsalId] = useState(null);

  // Pobieranie danych początkowych
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, rehRes, partRes] = await Promise.all([
          api.get('/api/projects/'),
          api.get('/api/rehearsals/'),
          api.get('/api/participations/')
        ]);
        setProjects(projRes.data);
        setRehearsals(rehRes.data);
        setParticipations(partRes.data);
      } catch (err) {
        console.error("Błąd ładowania danych:", err);
      }
    };
    fetchData();
  }, []);

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
      <div className="flex justify-between items-end border-b border-stone-200 pb-2 mb-6">
        <h2 className="text-xl font-serif font-bold text-stone-800">Planowanie i Obecności</h2>
      </div>

      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        
        {/* SELECTOR PROJEKTU */}
        <div className="mb-8 max-w-md">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Wybierz wydarzenie (Projekt)</label>
          <select 
            value={selectedProjectId} 
            onChange={handleProjectChange} 
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none bg-stone-50 font-medium transition-all"
          >
            <option value="">-- Wybierz z listy --</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        {selectedProjectId && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 border-t border-stone-100 pt-6">
            
            {/* KOLUMNA LEWA: Lista Prób */}
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

            {/* KOLUMNA PRAWA: Lista Obecności */}
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
                      {currentCast.length > 0 ? currentCast.map(participation => (
                        <AttendanceRow 
                          key={participation.id} 
                          participation={participation} 
                          rehearsalId={activeRehearsalId} 
                        />
                      )) : (
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
 * AUTO-SAVE Sub-komponent dla wiersza obecności.
 */
function AttendanceRow({ participation, rehearsalId }) {
  const [status, setStatus] = useState('PRESENT');
  const [minutesLate, setMinutesLate] = useState('');
  const [note, setNote] = useState('');
  
  // Stan wizualny autozapisu: 'idle', 'saving', 'success', 'error'
  const [saveState, setSaveState] = useState('idle');
  
  // Refy chroniące przed niepotrzebnym pierwszym renderem i przechowujące timeout
  const isMounted = useRef(false);
  const timeoutRef = useRef(null);

  // useEffect reagujący na każdą zmianę stanu formularza
  useEffect(() => {
    // Pomijamy wykonanie przy początkowym załadowaniu komponentu
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
          excuse_note: note
        };

        await api.post('/api/attendances/', payload);
        
        setSaveState('success');
        // Po 2 sekundach zielony ptaszek znika i wraca do neutralnego stanu
        setTimeout(() => setSaveState('idle'), 2000);
      } catch (err) {
        console.error("Błąd auto-zapisu:", err);
        setSaveState('error');
      }
    };

    // Czyścimy poprzedni timeout (zapobiega to wysłaniu 10 zapytań przy szybkim klikaniu)
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Czekamy 600 milisekund od ostatniej interakcji użytkownika, zanim wyślemy do bazy
    timeoutRef.current = setTimeout(() => {
      autoSaveData();
    }, 600);

    return () => clearTimeout(timeoutRef.current);
  }, [status, minutesLate, note, rehearsalId, participation.id]);

  return (
    <div className="bg-white p-3 md:p-4 rounded-lg border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-stone-300 relative group">
      
      {/* Dane Artysty */}
      <div className="flex-1 flex items-center gap-3">
        {/* Wskaźnik auto-zapisu w miejscu avatara */}
        <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center flex-shrink-0 border border-stone-100">
           {saveState === 'saving' && <Loader2 size={14} className="text-[#002395] animate-spin" />}
           {saveState === 'success' && <CheckCircle2 size={16} className="text-green-500" />}
           {saveState === 'error' && <AlertCircle size={16} className="text-red-500" />}
           {saveState === 'idle' && <span className="text-xs font-bold text-stone-300">{participation.artist_name?.charAt(0) || '-'}</span>}
        </div>
        
        <div>
          <p className="font-bold text-stone-800 text-sm">{participation.artist_name || `Uczestnik #${participation.artist}`}</p>
          <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">{participation.artist_voice_type_display || 'Brak głosu'}</p>
        </div>
      </div>

      {/* Kontrolki Obecności */}
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

        {/* Pojawia się płynnie tylko przy spóźnieniu */}
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
              className="text-xs px-2 py-2 border border-stone-200 rounded-md outline-none focus:border-orange-400 bg-white"
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
              className="text-xs px-2 py-2 border border-stone-200 rounded-md outline-none focus:border-blue-400 bg-white"
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}