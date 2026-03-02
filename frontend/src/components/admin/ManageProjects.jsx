/**
 * ManageProjects Component
 * @author Krystian Bugalski
 * * Handles the creation and modification of Concerts (Projects).
 * Includes a dense, scrollable UI for selecting repertoire pieces 
 * and integrates the AssignCast sub-module.
 */
import { useState, useEffect } from 'react';
import AssignCast from './AssignCast';

// Safely access the API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ManageProjects({ token, onProjectAdded }) {
  const [subTab, setSubTab] = useState('add_project'); 
  const [status, setStatus] = useState({ type: '', message: '' });

  // --- States: NEW CONCERT ---
  const [title, setTitle] = useState('');
  const [concertDate, setConcertDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  
  // --- States: EDIT CONCERT & REPERTOIRE ---
  const [projects, setProjects] = useState([]);
  const [pieces, setPieces] = useState([]);
  const [editProjectId, setEditProjectId] = useState('');
  const [editForm, setEditForm] = useState({ title: '', start_date: '', location: '', description: '', repertoire: [] });

  // Fetch projects and available repertoire when entering the edit tab
  useEffect(() => {
    if (subTab === 'edit_project') {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      fetch(`${API_URL}/api/projects/`, { headers })
        .then(res => res.json())
        .then(data => setProjects(data))
        .catch(err => console.error("Error fetching projects:", err));
        
      fetch(`${API_URL}/api/pieces/`, { headers })
        .then(res => res.json())
        .then(data => setPieces(data))
        .catch(err => console.error("Error fetching pieces:", err));
    }
  }, [subTab, token]);

  const handleAddProject = async (e) => {
    e.preventDefault();
    setStatus({ type: 'info', message: 'Tworzenie projektu...' });
    
    try {
      const res = await fetch(`${API_URL}/api/projects/`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        // We set end_date equal to start_date by default for single-day concerts
        body: JSON.stringify({ 
          title, 
          start_date: concertDate, 
          end_date: concertDate, 
          location, 
          description, 
          repertoire: [] 
        })
      });
      
      if (!res.ok) throw new Error('Błąd dodawania projektu.');
      
      setStatus({ type: 'success', message: 'Projekt utworzony poprawnie.' });
      setTitle(''); setConcertDate(''); setLocation(''); setDescription('');
      
      // Notify parent component (e.g., Dashboard) to refresh global state if needed
      if (onProjectAdded) onProjectAdded();
    } catch (err) { 
      setStatus({ type: 'error', message: err.message }); 
    }
  };

  const handleSelectEditProject = (e) => {
    const pId = e.target.value;
    setEditProjectId(pId);
    setStatus({ type: '', message: '' });
    
    if (pId) {
      const p = projects.find(proj => proj.id === parseInt(pId));
      if (p) {
        // Pre-fill the edit form with the selected project's data
        setEditForm({ 
          title: p.title, 
          start_date: p.start_date, 
          location: p.location || '', 
          description: p.description || '', 
          repertoire: p.repertoire || [] 
        });
      }
    }
  };

  // Toggles the presence of a piece ID in the project's repertoire array
  const handleTogglePiece = (pieceId) => {
    setEditForm(prev => {
      const isSelected = prev.repertoire.includes(pieceId);
      return { 
        ...prev, 
        repertoire: isSelected 
          ? prev.repertoire.filter(id => id !== pieceId) 
          : [...prev.repertoire, pieceId] 
      };
    });
  };

  const handleEditProject = async (e) => {
    e.preventDefault();
    if (!editProjectId) return;
    setStatus({ type: 'info', message: 'Zapisywanie zmian...' });
    
    try {
      const res = await fetch(`${API_URL}/api/projects/${editProjectId}/`, {
        method: 'PATCH', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          title: editForm.title, 
          start_date: editForm.start_date, 
          end_date: editForm.start_date, 
          location: editForm.location, 
          description: editForm.description, 
          repertoire: editForm.repertoire 
        })
      });
      
      if (!res.ok) throw new Error('Błąd podczas aktualizacji projektu.');
      
      setStatus({ type: 'success', message: 'Zmiany w projekcie zostały zapisane.' });
      const updatedProj = await res.json();
      
      // Update local state to reflect changes instantly
      setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
      
      if (onProjectAdded) onProjectAdded();
    } catch (err) { 
      setStatus({ type: 'error', message: err.message }); 
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Tabs Menu */}
      <div className="flex border-b border-stone-200 mb-6 gap-6">
        <button onClick={() => { setSubTab('add_project'); setStatus({}); }} className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${subTab === 'add_project' ? 'border-amber-600 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
          Nowy Koncert
        </button>
        <button onClick={() => { setSubTab('edit_project'); setStatus({}); }} className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${subTab === 'edit_project' ? 'border-amber-600 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
          Edycja i Repertuar
        </button>
        <button onClick={() => { setSubTab('assign_cast'); setStatus({}); }} className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${subTab === 'assign_cast' ? 'border-amber-600 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
          Przypisz Obsadę
        </button>
      </div>

      {/* Status messages are hidden when rendering the independent AssignCast module */}
      {status.message && subTab !== 'assign_cast' && (
        <div className={`p-3 rounded-sm text-xs font-bold uppercase tracking-wider mb-6 border ${status.type === 'success' ? 'bg-stone-50 text-stone-800 border-stone-300' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {status.message}
        </div>
      )}

      {/* TAB 1: NEW CONCERT */}
      {subTab === 'add_project' && (
        <div className="bg-white p-6 rounded-sm border border-stone-200 shadow-sm max-w-2xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 mb-4 border-b border-stone-100 pb-2">Kreator nowego wydarzenia</h3>
          <form onSubmit={handleAddProject} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Nazwa wydarzenia</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Data koncertu</label>
                <input type="date" required value={concertDate} onChange={e => setConcertDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Miejsce / Lokalizacja</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Opis (Opcjonalnie)</label>
              <textarea rows="3" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all"></textarea>
            </div>
            <button type="submit" className="w-full bg-stone-900 hover:bg-stone-800 text-stone-100 font-bold text-xs uppercase tracking-widest py-3 rounded-sm mt-4 transition-colors">
              Zapisz Koncert w Bazie
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: EDIT CONCERT & REPERTOIRE */}
      {subTab === 'edit_project' && (
        <div className="bg-white p-6 rounded-sm border border-stone-200 shadow-sm">
          <div className="mb-6">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Wybierz koncert do edycji</label>
            <select value={editProjectId} onChange={handleSelectEditProject} className="w-full max-w-md px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none bg-stone-50 font-medium">
              <option value="">-- Wybierz z listy --</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title} ({p.start_date})</option>)}
            </select>
          </div>
          
          {editProjectId && (
            <form onSubmit={handleEditProject} className="space-y-6 animate-fade-in border-t border-stone-100 pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* BASIC DATA COLUMN */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 mb-3 border-b border-stone-100 pb-2">Dane podstawowe</h3>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Nazwa</label>
                    <input type="text" required value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Data</label>
                      <input type="date" required value={editForm.start_date} onChange={e => setEditForm({...editForm, start_date: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Miejsce</label>
                      <input type="text" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Opis</label>
                    <textarea rows="3" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none"></textarea>
                  </div>
                </div>

                {/* REPERTOIRE LIST COLUMN (Dense layout) */}
                <div>
                  <div className="flex justify-between items-end mb-3 border-b border-stone-100 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">Repertuar</h3>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Wybrano: {editForm.repertoire.length}</span>
                  </div>
                  
                  <div className="border border-stone-200 rounded-sm max-h-[300px] overflow-y-auto bg-stone-50 p-1 space-y-[1px]">
                    {pieces.map(piece => {
                      const isSelected = editForm.repertoire.includes(piece.id);
                      return (
                        <label key={piece.id} className={`flex items-center p-2 rounded-sm cursor-pointer transition-colors border ${isSelected ? 'bg-stone-800 border-stone-800 text-stone-100' : 'bg-white border-transparent text-stone-700 hover:bg-stone-200/50'}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => handleTogglePiece(piece.id)} className="w-4 h-4 text-stone-900 rounded-sm border-stone-300 focus:ring-stone-900 mr-3" />
                          <div className="flex-1 flex justify-between items-center">
                            <p className="font-bold text-xs">{piece.title}</p>
                            <p className={`text-[10px] uppercase tracking-wider ${isSelected ? 'text-stone-400' : 'text-stone-500'}`}>{piece.composer_name}</p>
                          </div>
                        </label>
                      );
                    })}
                    {pieces.length === 0 && <p className="p-3 text-center text-xs text-stone-500 italic">Brak utworów w bibliotece.</p>}
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full bg-stone-900 hover:bg-stone-800 text-stone-100 font-bold text-xs uppercase tracking-widest py-3 rounded-sm transition-colors">
                Zapisz Zmiany w Teczce
              </button>
            </form>
          )}
        </div>
      )}

      {/* TAB 3: ASSIGN CAST */}
      {subTab === 'assign_cast' && (
        <AssignCast token={token} />
      )}

    </div>
  );
}