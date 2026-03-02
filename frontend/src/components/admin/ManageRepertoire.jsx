/**
 * ManageRepertoire Component
 * @author Krystian Bugalski
 * * Administrative module for maintaining the ensemble's musical library.
 * Allows adding composers, uploading sheet music (PDFs), and attaching 
 * isolated voice-part audio tracks (MP3/MIDI) to specific pieces.
 * Utilizes FormData for handling multipart/form-data (binary file uploads).
 */
import { useState, useEffect } from 'react';

// Resolve API URL securely via Vite environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ManageRepertoire({ token }) {
  const [composers, setComposers] = useState([]);
  const [pieces, setPieces] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });

  // --- COMPOSER STATE ---
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // --- PIECE (SHEET MUSIC) STATE ---
  const [title, setTitle] = useState('');
  const [composerId, setComposerId] = useState('');
  const [sheetMusicFile, setSheetMusicFile] = useState(null);

  // --- AUDIO TRACK STATE ---
  const [selectedPieceId, setSelectedPieceId] = useState('');
  const [trackVoicePart, setTrackVoicePart] = useState('SOPRAN');
  const [audioFile, setAudioFile] = useState(null);

  // Initial data hydration
  useEffect(() => {
    fetchComposers();
    fetchPieces();
  }, [token]);

  const fetchComposers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/composers/`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) setComposers(await res.json());
    } catch (err) { 
      console.error("Failed to fetch composers", err); 
    }
  };

  const fetchPieces = async () => {
    try {
      const res = await fetch(`${API_URL}/api/pieces/`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) setPieces(await res.json());
    } catch (err) { 
      console.error("Failed to fetch pieces", err); 
    }
  };

  const handleAddComposer = async (e) => {
    e.preventDefault();
    setStatus({ type: 'info', message: 'Zapisywanie kompozytora...' });
    
    try {
      const res = await fetch(`${API_URL}/api/composers/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ first_name: firstName, last_name: lastName })
      });
      
      if (!res.ok) throw new Error('Nie udało się dodać kompozytora.');
      
      setStatus({ type: 'success', message: `Dodano kompozytora do bazy: ${firstName} ${lastName}` });
      setFirstName(''); setLastName('');
      fetchComposers(); // Refresh dropdowns
    } catch (err) { 
      setStatus({ type: 'error', message: err.message }); 
    }
  };

  const handleAddPiece = async (e) => {
    e.preventDefault();
    if (!composerId) { 
      setStatus({ type: 'error', message: 'Wybierz kompozytora z listy.' }); 
      return; 
    }
    
    setStatus({ type: 'info', message: 'Trwa wgrywanie pliku i indeksowanie utworu...' });

    // FormData is required here instead of JSON to handle the PDF file binary payload
    const formData = new FormData();
    formData.append('title', title);
    formData.append('composer', composerId);
    if (sheetMusicFile) formData.append('sheet_music', sheetMusicFile);

    try {
      const res = await fetch(`${API_URL}/api/pieces/`, {
        method: 'POST',
        // Note: Do NOT set 'Content-Type' manually when using FormData, 
        // the browser automatically sets the correct multipart boundary.
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) throw new Error('Błąd wgrywania utworu.');
      
      setStatus({ type: 'success', message: `Utwór "${title}" został zarchiwizowany poprawnie.` });
      
      // Reset form and file inputs
      setTitle(''); setComposerId(''); setSheetMusicFile(null);
      document.getElementById('file-upload').value = '';
      fetchPieces(); 
    } catch (err) { 
      setStatus({ type: 'error', message: err.message }); 
    }
  };

  const handleAddTrack = async (e) => {
    e.preventDefault();
    if (!selectedPieceId) { 
      setStatus({ type: 'error', message: 'Wybierz utwór docelowy.' }); 
      return; 
    }
    if (!audioFile) { 
      setStatus({ type: 'error', message: 'Dołącz plik audio (MIDI/MP3).' }); 
      return; 
    }
    
    setStatus({ type: 'info', message: 'Wgrywanie ścieżki dźwiękowej...' });

    const formData = new FormData();
    formData.append('piece', selectedPieceId);
    formData.append('voice_part', trackVoicePart);
    formData.append('audio_file', audioFile);

    try {
      const res = await fetch(`${API_URL}/api/tracks/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) throw new Error('Błąd podczas wgrywania ścieżki audio.');
      
      setStatus({ type: 'success', message: 'Ścieżka dźwiękowa powiązana poprawnie.' });
      
      // Cleanup
      setAudioFile(null);
      document.getElementById('audio-upload').value = '';
    } catch (err) { 
      setStatus({ type: 'error', message: err.message }); 
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end border-b border-stone-200 pb-2 mb-6">
        <h2 className="text-xl font-serif font-bold text-stone-800">Biblioteka Repertuarowa</h2>
      </div>
      
      {status.message && (
        <div className={`p-4 rounded-sm text-sm font-medium mb-6 border whitespace-pre-line leading-relaxed ${status.type === 'success' ? 'bg-stone-50 text-stone-800 border-stone-300' : status.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-stone-100 text-stone-600 border-stone-300'}`}>
          {status.message}
        </div>
      )}

      {/* ROW 1: ADD PIECE & COMPOSER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PIECE UPLOAD FORM */}
        <div className="bg-white p-6 rounded-sm border border-stone-200 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 mb-4 border-b border-stone-100 pb-2">Dodaj utwór do archiwum</h3>
          <form onSubmit={handleAddPiece} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Tytuł dzieła</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Autor (Kompozytor)</label>
              <select required value={composerId} onChange={e => setComposerId(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none bg-stone-50 font-medium transition-all">
                <option value="">-- Wybierz z bazy --</option>
                {composers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div className="pt-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Plik z partyturą (PDF)</label>
              <input 
                id="file-upload" 
                type="file" 
                accept=".pdf" 
                onChange={e => setSheetMusicFile(e.target.files[0])} 
                className="w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200 transition-all cursor-pointer border border-stone-200 p-1 bg-stone-50" 
              />
            </div>
            <button type="submit" className="w-full bg-stone-900 hover:bg-stone-800 text-stone-100 font-bold text-xs uppercase tracking-widest py-3 rounded-sm mt-2 transition-colors">
              Zarchiwizuj Utwór
            </button>
          </form>
        </div>

        {/* COMPOSER DIRECTORY FORM */}
        <div className="bg-stone-50 p-6 rounded-sm border border-stone-200 shadow-sm h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 mb-4 border-b border-stone-200 pb-2">Rejestr Kompozytorów</h3>
          <form onSubmit={handleAddComposer} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Imię</label>
                <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Nazwisko</label>
                <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all" />
              </div>
            </div>
            <button type="submit" className="w-full bg-white border border-stone-300 hover:border-stone-500 text-stone-800 font-bold text-xs uppercase tracking-widest py-2.5 rounded-sm transition-all shadow-sm">
              Zapisz w Rejestrze
            </button>
          </form>
        </div>
      </div>

      {/* ROW 2: AUDIO TRACK UPLOAD */}
      <div className="bg-white p-6 rounded-sm border border-stone-200 shadow-sm mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 mb-4 border-b border-stone-100 pb-2">
          Powiązanie materiałów pomocniczych (Audio / MIDI)
        </h3>
        <form onSubmit={handleAddTrack} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Powiązany utwór</label>
              <select required value={selectedPieceId} onChange={e => setSelectedPieceId(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none bg-stone-50 font-medium transition-all">
                <option value="">-- Wybierz z archiwum --</option>
                {pieces.map(p => (
                  <option key={p.id} value={p.id}>{p.title} ({p.composer_name})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Dedykowana sekcja (Głos)</label>
              <select value={trackVoicePart} onChange={e => setTrackVoicePart(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none bg-white transition-all">
                <option value="SOPRAN">Sopran</option><option value="SOPRAN_1">Sopran 1</option><option value="SOPRAN_2">Sopran 2</option>
                <option value="ALT">Alt</option><option value="ALT_1">Alt 1</option><option value="ALT_2">Alt 2</option>
                <option value="TENOR">Tenor</option><option value="TENOR_1">Tenor 1</option><option value="TENOR_2">Tenor 2</option>
                <option value="BAS">Bas</option><option value="BAS_1">Bas 1</option><option value="BAS_2">Bas 2</option>
                <option value="TUTTI">Tutti (Wszyscy)</option>
                <option value="ACC">Akompaniament (Pianino)</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Plik Audio (.mid, .mp3)</label>
            <input 
              id="audio-upload" 
              type="file" 
              accept="audio/*,.mid,.midi" 
              onChange={e => setAudioFile(e.target.files[0])} 
              className="w-full text-sm text-stone-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-sm file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:bg-stone-800 file:text-stone-100 hover:file:bg-stone-900 transition-all cursor-pointer border border-stone-200 p-1 bg-stone-50"
            />
          </div>

          <button type="submit" className="w-full bg-white border border-stone-300 hover:border-stone-500 text-stone-800 font-bold text-xs uppercase tracking-widest py-3 rounded-sm transition-all shadow-sm mt-2">
            Załącz Ścieżkę Dźwiękową
          </button>
        </form>
      </div>

    </div>
  );
}