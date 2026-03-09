/**
 * AssignCast Component
 * @author Krystian Bugalski
 * * Provides an administrative interface to batch-assign multiple artists to a specific project.
 * Handles API interactions and provides immediate UX feedback upon success or failure.
 */
import { useState, useEffect } from 'react';

// Safely access the API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AssignCast({ token }) {
  const [allProjects, setAllProjects] = useState([]);
  const [allArtists, setAllArtists] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedArtistIds, setSelectedArtistIds] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });

  // Fetch initial data (Projects and Artists) for the dropdowns and grids
  useEffect(() => {
    const headers = { 'Authorization': `Bearer ${token}` };
    
    fetch(`${API_URL}/api/projects/`, { headers })
      .then(res => res.json())
      .then(data => setAllProjects(data))
      .catch(err => console.error("Failed to fetch projects:", err));
      
    fetch(`${API_URL}/api/artists/`, { headers })
      .then(res => res.json())
      .then(data => setAllArtists(data))
      .catch(err => console.error("Failed to fetch artists:", err));
  }, [token]);

  // Toggle selection state for the artist grid
  const toggleArtistSelection = (id) => {
    setSelectedArtistIds(prev => 
      prev.includes(id) ? prev.filter(artistId => artistId !== id) : [...prev, id]
    );
  };

  const handleAssignArtists = async (e) => {
    e.preventDefault();
    if (!selectedProjectId || selectedArtistIds.length === 0) {
      setStatus({ type: 'error', message: 'Wybierz projekt i co najmniej jednego chórzystę.' });
      return;
    }

    setStatus({ type: 'info', message: 'Trwa przypisywanie chórzystów...' });
    let successCount = 0;
    let errorCount = 0;

    // Batch process: Send a POST request for each selected artist
    for (const artistId of selectedArtistIds) {
      try {
        const response = await fetch(`${API_URL}/api/participations/`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({
            project: parseInt(selectedProjectId),
            artist: parseInt(artistId),
            status: 'INVITED', // Default status upon creation
            fee: null
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }

    setStatus({ 
      type: errorCount === 0 ? 'success' : 'info', 
      message: `Zakończono! Przypisano: ${successCount}. Pominięto: ${errorCount} (np. już przypisani).` 
    });
    // Reset selection after processing
    setSelectedArtistIds([]);
  };

  return (
    <div className="bg-white p-6 rounded-sm border border-stone-200 shadow-sm max-w-4xl animate-fade-in">
      <form onSubmit={handleAssignArtists} className="space-y-6">
        
        <div className="border-b border-stone-100 pb-3 mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">Formularz Obsady</h3>
          <p className="text-[10px] uppercase tracking-widest text-stone-500 mt-1">Wybierz projekt, a następnie zaznacz wykonawców</p>
        </div>
        
        {status.message && (
          <div className={`p-3 rounded-sm text-xs font-bold uppercase tracking-wider border ${status.type === 'success' ? 'bg-stone-50 text-stone-800 border-stone-300' : 'bg-stone-100 text-stone-600 border-stone-300'}`}>
            {status.message}
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">1. Teczka Projektowa</label>
          <select required value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="w-full max-w-md px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none bg-stone-50 font-medium">
            <option value="">-- Wybierz koncert z bazy --</option>
            {allProjects.map(proj => <option key={proj.id} value={proj.id}>{proj.title} ({proj.start_date})</option>)}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500">2. Baza Wykonawców</label>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Zaznaczono: {selectedArtistIds.length}</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-80 overflow-y-auto p-1 border border-stone-200 rounded-sm bg-stone-50">
            {allArtists.map(artist => {
              const isSelected = selectedArtistIds.includes(artist.id);
              return (
                <div 
                  key={artist.id} 
                  onClick={() => toggleArtistSelection(artist.id)} 
                  className={`cursor-pointer border rounded-sm p-2 flex flex-col justify-center transition-colors ${isSelected ? 'bg-stone-800 border-stone-800 text-stone-100' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'}`}
                >
                  <p className="font-bold text-xs truncate">{artist.first_name} {artist.last_name}</p>
                  <p className={`text-[9px] uppercase tracking-widest mt-0.5 ${isSelected ? 'text-stone-400' : 'text-stone-500'}`}>
                    {artist.voice_part_display}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <button type="submit" className="w-full bg-stone-900 hover:bg-stone-800 text-stone-100 font-bold text-xs uppercase tracking-widest py-3 rounded-sm transition-colors mt-2">
          Zatwierdź Obsadę
        </button>
      </form>
    </div>
  );
}