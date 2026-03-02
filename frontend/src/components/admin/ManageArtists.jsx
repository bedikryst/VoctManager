/**
 * ManageArtists Component
 * @author Krystian Bugalski
 * * Handles the CRUD operations for Artists within the admin dashboard.
 * Supports adding new artists (which triggers user account creation on the backend)
 * and editing existing artist records.
 */
import { useState, useEffect } from 'react';

// Use environment variables for the API endpoint
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ManageArtists({ token }) {
  const [subTab, setSubTab] = useState('add_artist');
  const [status, setStatus] = useState({ type: '', message: '' });

  // --- States: NEW ARTIST ---
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [voicePart, setVoicePart] = useState('SOPRAN');

  // --- States: EDIT ARTIST ---
  const [artists, setArtists] = useState([]);
  const [editArtistId, setEditArtistId] = useState('');
  const [editArtistForm, setEditArtistForm] = useState({ first_name: '', last_name: '', voice_part: 'SOPRAN' });

  // Fetch artists list when switching to the 'edit_artist' tab
  useEffect(() => {
    if (subTab === 'edit_artist') {
      fetch(`${API_URL}/api/artists/`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      })
      .then(res => res.json())
      .then(data => setArtists(data))
      .catch(err => console.error("Failed to load artists:", err));
    }
  }, [subTab, token]);

  const handleAddArtist = async (e) => {
    e.preventDefault();
    setStatus({ type: 'info', message: 'Tworzenie konta chórzysty...' });
    
    try {
      const res = await fetch(`${API_URL}/api/artists/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          first_name: firstName, 
          last_name: lastName, 
          email, 
          voice_part: voicePart 
        })
      });
      
      if (!res.ok) throw new Error('Błąd (sprawdź, czy e-mail nie jest już zajęty).');
      
      setStatus({ 
        type: 'success', 
        message: `Utworzono profil: ${firstName} ${lastName}.\n\nDane logowania to:\nLogin: ${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()},\nHasło: domyślnie ustawione (zobacz instrukcję systemu).` 
      });
      
      // Clear form on success
      setFirstName(''); setLastName(''); setEmail('');
    } catch (err) { 
      setStatus({ type: 'error', message: err.message }); 
    }
  };

  const handleSelectEditArtist = (e) => {
    const aId = e.target.value;
    setEditArtistId(aId);
    setStatus({ type: '', message: '' });
    
    if (aId) {
      const a = artists.find(art => art.id === parseInt(aId));
      if (a) setEditArtistForm({ 
        first_name: a.first_name, 
        last_name: a.last_name, 
        voice_part: a.voice_part 
      });
    }
  };

  const handleEditArtist = async (e) => {
    e.preventDefault();
    if (!editArtistId) return;
    setStatus({ type: 'info', message: 'Zapisywanie zmian...' });
    
    try {
      const res = await fetch(`${API_URL}/api/artists/${editArtistId}/`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(editArtistForm)
      });
      
      if (!res.ok) throw new Error('Błąd podczas aktualizacji danych.');
      
      setStatus({ type: 'success', message: 'Dane chórzysty zostały zaktualizowane.' });
      const updatedArt = await res.json();
      
      // Update local state without re-fetching from API
      setArtists(prev => prev.map(a => a.id === updatedArt.id ? updatedArt : a));
    } catch (err) { 
      setStatus({ type: 'error', message: err.message }); 
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Tabs Menu */}
      <div className="flex border-b border-stone-200 mb-6 gap-6">
        <button onClick={() => { setSubTab('add_artist'); setStatus({}); }} className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${subTab === 'add_artist' ? 'border-amber-600 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
          Nowy Chórzysta
        </button>
        <button onClick={() => { setSubTab('edit_artist'); setStatus({}); }} className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${subTab === 'edit_artist' ? 'border-amber-600 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
          Modyfikuj Dane
        </button>
      </div>

      {status.message && (
        <div className={`p-4 rounded-sm text-sm font-medium mb-6 border whitespace-pre-line leading-relaxed ${status.type === 'success' ? 'bg-stone-50 text-stone-800 border-stone-300' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {status.message}
        </div>
      )}

      {/* TAB 1: NEW ARTIST */}
      {subTab === 'add_artist' && (
        <div className="bg-white p-6 rounded-sm border border-stone-200 shadow-sm max-w-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 mb-4 border-b border-stone-100 pb-2">Formularz rejestracyjny</h3>
          <form onSubmit={handleAddArtist} className="space-y-4">
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
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Domyślny Głos / Sekcja</label>
              <select value={voicePart} onChange={e => setVoicePart(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none bg-white transition-all">
                <option value="SOPRAN">Sopran</option><option value="SOPRAN_1">Sopran 1</option><option value="SOPRAN_2">Sopran 2</option>
                <option value="ALT">Alt</option><option value="ALT_1">Alt 1</option><option value="ALT_2">Alt 2</option>
                <option value="TENOR">Tenor</option><option value="TENOR_1">Tenor 1</option><option value="TENOR_2">Tenor 2</option>
                <option value="BAS">Bas</option><option value="BAS_1">Bas 1</option><option value="BAS_2">Bas 2</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-stone-900 hover:bg-stone-800 text-stone-100 font-bold text-xs uppercase tracking-widest py-3 rounded-sm mt-4 transition-colors">
              Zapisz w Bazie Personelu
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: EDIT ARTIST */}
      {subTab === 'edit_artist' && (
        <div className="bg-white p-6 rounded-sm border border-stone-200 shadow-sm max-w-2xl">
          <div className="mb-6">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Wybierz profil do edycji</label>
            <select value={editArtistId} onChange={handleSelectEditArtist} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none bg-stone-50 font-medium transition-all">
              <option value="">-- Wybierz członka zespołu --</option>
              {artists.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name} ({a.voice_part_display})</option>)}
            </select>
          </div>

          {editArtistId && (
            <form onSubmit={handleEditArtist} className="space-y-4 animate-fade-in border-t border-stone-100 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Imię</label>
                  <input type="text" required value={editArtistForm.first_name} onChange={e => setEditArtistForm({...editArtistForm, first_name: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Nazwisko</label>
                  <input type="text" required value={editArtistForm.last_name} onChange={e => setEditArtistForm({...editArtistForm, last_name: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Zmień Głos / Sekcję</label>
                <select value={editArtistForm.voice_part} onChange={e => setEditArtistForm({...editArtistForm, voice_part: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none bg-white transition-all">
                  <option value="SOPRAN">Sopran</option><option value="SOPRAN_1">Sopran 1</option><option value="SOPRAN_2">Sopran 2</option>
                  <option value="ALT">Alt</option><option value="ALT_1">Alt 1</option><option value="ALT_2">Alt 2</option>
                  <option value="TENOR">Tenor</option><option value="TENOR_1">Tenor 1</option><option value="TENOR_2">Tenor 2</option>
                  <option value="BAS">Bas</option><option value="BAS_1">Bas 1</option><option value="BAS_2">Bas 2</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-stone-900 hover:bg-stone-800 text-stone-100 font-bold text-xs uppercase tracking-widest py-3 rounded-sm mt-4 transition-colors">
                Zapisz Zmiany w Profilu
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}