/**
 * Contracts Module (HR & Payroll Dashboard)
 * @author Krystian Bugalski
 * * * Provides a dense, Excel-like interface for managing concert fees.
 * Features inline data editing, global fee assignment, and handles complex 
 * binary downloads (individual PDFs and batch ZIP files) from the Django API.
 */
import { useState, useEffect, useCallback } from 'react';

// Environment-aware API URL for seamless switching between Localhost and Production
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Contracts({ token }) {
  const [projects, setProjects] = useState([]);
  const [participations, setParticipations] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  
  const [globalFee, setGlobalFee] = useState('');
  const [isApplyingGlobal, setIsApplyingGlobal] = useState(false);

  // useCallback prevents infinite re-renders when this function is passed to useEffect
  const fetchParticipations = useCallback(() => {
    fetch(`${API_URL}/api/participations/`, { 
      headers: { 'Authorization': `Bearer ${token}` } 
    })
    .then(res => res.json())
    .then(data => setParticipations(data))
    .catch(err => console.error("Error fetching participations:", err));
  }, [token]);

  useEffect(() => {
    fetch(`${API_URL}/api/projects/`, { 
      headers: { 'Authorization': `Bearer ${token}` } 
    })
    .then(res => res.json())
    .then(data => setProjects(data))
    .catch(err => console.error("Error fetching projects:", err));

    fetchParticipations();
  }, [token, fetchParticipations]);

  // Derived state: Filter the cast list based on the currently selected dropdown value
  const currentCast = participations.filter(p => p.project === parseInt(selectedProjectId));

  // --- BATCH OPERATIONS ---
  const handleApplyGlobalFee = async () => {
    if (!globalFee) return;
    setIsApplyingGlobal(true);
    setStatus({ type: 'info', message: 'Trwa nadpisywanie stawek dla wszystkich...' });
    
    let successCount = 0;
    
    // Process patches sequentially to avoid overwhelming the server with simultaneous requests
    for (const p of currentCast) {
      try {
        const res = await fetch(`${API_URL}/api/participations/${p.id}/`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ fee: parseFloat(globalFee) })
        });
        if (res.ok) successCount++;
      } catch (e) { 
        console.error("Failed to patch participation ID:", p.id, e); 
      }
    }
    
    // Refresh the table UI with new data from the backend
    fetchParticipations();
    setStatus({ type: 'success', message: `Zapisano domyślną stawkę (${globalFee} PLN) dla ${successCount} osób.` });
    setIsApplyingGlobal(false);
  };

  // --- BINARY FILE DOWNLOADING ---
  /**
   * Helper function to fetch and download binary streams (PDF/ZIP) authenticated via JWT.
   * Workaround for standard <a href> tags which cannot pass Authorization headers.
   */
  const downloadFile = async (url, defaultFilename) => {
    const res = await fetch(url, { 
      method: 'GET', 
      headers: { 'Authorization': `Bearer ${token}` } 
    });
    
    if (!res.ok) throw new Error('Błąd podczas pobierania pliku.');
    
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    let finalFilename = defaultFilename;
    
    // Attempt to extract the exact filename provided by the Django backend
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match != null && match[1]) {
        finalFilename = match[1].replace(/['"]/g, '');
      }
    }
    
    // Create a temporary, invisible link to trigger the browser's native download dialog
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup RAM
    window.URL.revokeObjectURL(downloadUrl);
  };

  const handleDownloadSingle = async (participationId, artistName) => {
    setStatus({ type: 'info', message: `Generowanie umowy dla: ${artistName}...` });
    try {
      await downloadFile(`${API_URL}/api/participations/${participationId}/contract/`, `Umowa_${artistName}.pdf`);
      setStatus({ type: 'success', message: `Umowa dla ${artistName} pobrana pomyślnie.` });
    } catch (err) { 
      setStatus({ type: 'error', message: err.message }); 
    }
  };

  const handleDownloadZip = async () => {
    setStatus({ type: 'info', message: 'Trwa pakowanie wszystkich umów do pliku ZIP...' });
    try {
      await downloadFile(`${API_URL}/api/participations/project_zip/?project_id=${selectedProjectId}`, 'Umowy.zip');
      setStatus({ type: 'success', message: 'Paczka ZIP została pobrana pomyślnie.' });
    } catch (err) { 
      setStatus({ type: 'error', message: err.message }); 
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end border-b border-stone-200 pb-2 mb-6">
        <h2 className="text-xl font-serif font-bold text-stone-800">Moduł Kadrowo-Płacowy</h2>
      </div>

      {status.message && (
        <div className={`p-4 rounded-sm text-sm font-medium mb-6 border whitespace-pre-line leading-relaxed ${status.type === 'success' ? 'bg-stone-50 text-stone-800 border-stone-300' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {status.message}
        </div>
      )}

      <div className="bg-white p-6 rounded-sm border border-stone-200 shadow-sm">
        
        {/* EVENT SELECTOR */}
        <div className="mb-8 max-w-md">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Wybierz wydarzenie (Projekt)</label>
          <select 
            value={selectedProjectId} 
            onChange={e => { setSelectedProjectId(e.target.value); setStatus({}); }} 
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none bg-stone-50 font-medium transition-all"
          >
            <option value="">-- Wybierz z listy --</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title} ({p.start_date})</option>)}
          </select>
        </div>

        {selectedProjectId && (
          <div className="animate-fade-in border-t border-stone-100 pt-6">
            
            {/* ACTION TOOLBAR */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 bg-stone-50 p-4 rounded-sm border border-stone-200">
              <div className="mb-4 md:mb-0">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Masowe uzupełnianie stawek (PLN)</label>
                <div className="flex space-x-2">
                  <input 
                    type="number" 
                    value={globalFee} 
                    onChange={e => setGlobalFee(e.target.value)}
                    placeholder="Wartość..."
                    className="w-32 px-3 py-1.5 text-sm border border-stone-300 rounded-sm focus:border-stone-500 outline-none font-bold"
                  />
                  <button 
                    onClick={handleApplyGlobalFee}
                    disabled={isApplyingGlobal || !globalFee}
                    className="bg-stone-800 hover:bg-stone-900 disabled:bg-stone-400 text-white text-[10px] uppercase tracking-widest font-bold py-1.5 px-4 rounded-sm transition-colors shadow-sm"
                  >
                    Zastosuj
                  </button>
                </div>
              </div>

              {currentCast.length > 0 && (
                <button 
                  onClick={handleDownloadZip} 
                  className="bg-white border border-stone-300 hover:border-stone-500 text-stone-800 font-bold text-xs uppercase tracking-widest py-2 px-6 rounded-sm transition-all shadow-sm flex items-center"
                >
                  Drukuj Wszystkie (ZIP)
                </button>
              )}
            </div>
            
            <div className="flex justify-between items-end mb-2 mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">Tabela Wynagrodzeń</h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Rekordów: {currentCast.length}</span>
            </div>
            
            {/* DATA TABLE (Dense layout for quick data entry) */}
            {currentCast.length > 0 ? (
              <div className="overflow-x-auto border border-stone-200 rounded-sm">
                <table className="w-full text-left text-sm text-stone-600">
                  <thead className="bg-stone-100 text-[10px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-3">Wykonawca</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Głos</th>
                      <th className="px-4 py-3 hidden md:table-cell">Status</th>
                      <th className="px-4 py-3 w-48">Stawka (PLN)</th>
                      <th className="px-4 py-3 text-right">Dokument</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {currentCast.map(participation => (
                      <ContractRow 
                        key={`${participation.id}-${participation.fee}`} 
                        participation={participation} 
                        token={token} 
                        onDownload={handleDownloadSingle} 
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-stone-500 italic border border-dashed border-stone-200 p-6 text-center">Brak przypisanej obsady do tego projektu.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Sub-component representing a single row in the Contracts Data Table.
 * Encapsulates its own local state for inline editing and saving.
 */
function ContractRow({ participation, token, onDownload }) {
  const [fee, setFee] = useState(participation.fee || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const artistName = participation.artist_name || `Artysta ID: ${participation.artist}`;
  
  // Display fallback to dash if voice part is not properly serialized
  const voiceDisplay = participation.artist_voice_part_display || '-'; 

  const handleSaveFee = async () => {
    setIsSaving(true); 
    setSaveSuccess(false);
    
    try {
      const res = await fetch(`${API_URL}/api/participations/${participation.id}/`, {
        method: 'PATCH', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        // Parse float for valid DB format, send null to clear the field
        body: JSON.stringify({ fee: fee === '' ? null : parseFloat(fee) })
      });
      
      if (res.ok) {
        setSaveSuccess(true);
        // Visual feedback reset after 2 seconds
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) { 
      console.error("Save error:", err); 
    }
    
    setIsSaving(false);
  };

  return (
    <tr className="hover:bg-stone-50 transition-colors group">
      <td className="px-4 py-3 font-bold text-stone-800 whitespace-nowrap">{artistName}</td>
      <td className="px-4 py-3 hidden sm:table-cell text-xs text-stone-500">{voiceDisplay}</td>
      <td className="px-4 py-3 hidden md:table-cell text-[10px] uppercase tracking-widest text-stone-400">{participation.status}</td>
      
      {/* INLINE EDITING: Fee Column */}
      <td className="px-4 py-3">
        <div className="flex items-center space-x-1">
          <input 
            type="number" 
            value={fee} 
            onChange={e => setFee(e.target.value)} 
            className="w-20 px-2 py-1 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all" 
          />
          <button 
            onClick={handleSaveFee} 
            disabled={isSaving} 
            className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-sm transition-colors border ${saveSuccess ? 'bg-stone-100 text-stone-800 border-stone-300' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-stone-900'}`}
          >
            {saveSuccess ? 'Zapisano' : 'Zapisz'}
          </button>
        </div>
      </td>
      
      {/* ACTIONS COLUMN */}
      <td className="px-4 py-3 text-right">
        <button 
          onClick={() => onDownload(participation.id, artistName)} 
          className="text-[10px] font-bold uppercase tracking-wider bg-white border border-stone-300 text-stone-700 hover:text-stone-900 hover:border-stone-500 px-3 py-1.5 rounded-sm transition-colors shadow-sm"
        >
          PDF
        </button>
      </td>
    </tr>
  );
}