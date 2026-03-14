/**
 * @file ArchiveManagement.jsx
 * @description Archive & Repertoire Management Module.
 * Allows administrators to add new musical pieces, upload PDF sheet music,
 * and attach isolated audio tracks (MP3/MIDI) for rehearsal purposes.
 * Implements a tabbed slide-over panel with multipart/form-data handling.
 * @author Krystian Bugalski
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Edit2, Trash2, X, Music, FileText, Headphones, 
  Loader2, CheckCircle2, UploadCloud, AlertCircle
} from 'lucide-react';
import api from '../../utils/api';

// Voice lines mapping from core/constants.py for the audio track uploader
const VOICE_LINES = [
  { value: 'S1', label: 'Sopran 1' }, { value: 'S2', label: 'Sopran 2' },
  { value: 'A1', label: 'Alt 1' }, { value: 'A2', label: 'Alt 2' },
  { value: 'T1', label: 'Tenor 1' }, { value: 'T2', label: 'Tenor 2' },
  { value: 'B1', label: 'Bas 1' }, { value: 'B2', label: 'Bas 2' },
  { value: 'SOLO', label: 'Solo' }, { value: 'VP', label: 'Vocal Percussion' },
  { value: 'TUTTI', label: 'Tutti (Wszyscy)' }, { value: 'ACC', label: 'Akompaniament' }
];

export default function ArchiveManagement() {
  const [pieces, setPieces] = useState([]);
  const [composers, setComposers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Slide-over Panel State
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('DETAILS'); // 'DETAILS' | 'TRACKS'
  const [editingPiece, setEditingPiece] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [piecesRes, compRes] = await Promise.all([
        api.get('/api/pieces/'),
        api.get('/api/composers/')
      ]);
      setPieces(Array.isArray(piecesRes.data) ? piecesRes.data : []);
      setComposers(Array.isArray(compRes.data) ? compRes.data : []);
    } catch (err) {
      console.error("Failed to fetch archive data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openPanel = (piece = null) => {
    setEditingPiece(piece);
    setActiveTab('DETAILS');
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setEditingPiece(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć ten utwór? Usunięte zostaną również powiązane pliki (Nuty i Audio).")) return;
    try {
      await api.delete(`/api/pieces/${id}/`);
      fetchData();
      if (editingPiece?.id === id) closePanel();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Nie udało się usunąć utworu. Może być przypisany do istniejącego programu koncertu.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-stone-200 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-800">Zarządzanie Archiwum</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mt-1">
            Dodawanie nut i nagrań audio
          </p>
        </div>
        
        <button 
          onClick={() => openPanel()}
          className="flex items-center gap-2 bg-stone-900 hover:bg-[#002395] text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-5 rounded-sm transition-colors shadow-sm"
        >
          <Plus size={16} /> Dodaj Utwór
        </button>
      </div>

      {/* PIECES LIST */}
      <div className="bg-white rounded-sm border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-600">
            <thead className="bg-stone-50 text-[10px] uppercase font-bold tracking-wider text-stone-500 border-b border-stone-200">
              <tr>
                <th className="px-6 py-4">Tytuł Utworu</th>
                <th className="px-6 py-4 hidden md:table-cell">Kompozytor</th>
                <th className="px-6 py-4">Zasoby</th>
                <th className="px-6 py-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#002395]" /></td>
                </tr>
              ) : pieces.length > 0 ? pieces.map((piece) => (
                <tr key={piece.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-stone-900 text-base" style={{ fontFamily: "'Cormorant', serif" }}>{piece.title}</div>
                    {piece.arranger && <div className="text-[10px] uppercase text-stone-400 mt-1">Arr: {piece.arranger}</div>}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell text-xs font-bold text-stone-700">
                    {piece.composer && typeof piece.composer === 'object' 
                      ? `${piece.composer.first_name || ''} ${piece.composer.last_name}`.trim() 
                      : piece.composer || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <span className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase rounded-sm border ${piece.sheet_music ? 'bg-blue-50 text-[#002395] border-blue-200' : 'bg-stone-100 text-stone-400 border-stone-200'}`} title="Partytura PDF">
                        <FileText size={12} /> Nuty
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase rounded-sm border ${piece.tracks && piece.tracks.length > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-400 border-stone-200'}`} title="Ścieżki Audio">
                        <Headphones size={12} /> Audio ({piece.tracks?.length || 0})
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => openPanel(piece)} className="p-2 text-stone-400 hover:text-[#002395] transition-colors bg-white border border-stone-200 rounded-sm hover:border-[#002395]">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(piece.id)} className="p-2 text-stone-400 hover:text-red-600 hover:border-red-600 hover:bg-red-50 transition-colors bg-white border border-stone-200 rounded-sm">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-stone-500 italic border border-dashed border-stone-200 m-4 rounded-lg bg-stone-50">Brak utworów w archiwum.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MULTI-TAB SLIDE-OVER PANEL */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closePanel} className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40"
            />
            
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col border-l border-stone-200"
            >
              {/* Panel Header */}
              <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-stone-50">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-stone-800">
                    {editingPiece ? 'Edycja Utworu' : 'Nowy Utwór w Archiwum'}
                  </h3>
                </div>
                <button onClick={closePanel} className="text-stone-400 hover:text-stone-900 transition-colors p-2">
                  <X size={24} />
                </button>
              </div>

              {/* TABS NAVIGATION */}
              {editingPiece && (
                <div className="flex border-b border-stone-200 bg-white px-6">
                  <button onClick={() => setActiveTab('DETAILS')} className={`py-4 px-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'DETAILS' ? 'border-[#002395] text-[#002395]' : 'border-transparent text-stone-400 hover:text-stone-700'}`}>
                    <FileText size={16} /> Dane i Nuty
                  </button>
                  <button onClick={() => setActiveTab('TRACKS')} className={`py-4 px-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'TRACKS' ? 'border-[#002395] text-[#002395]' : 'border-transparent text-stone-400 hover:text-stone-700'}`}>
                    <Headphones size={16} /> Ścieżki Audio
                  </button>
                </div>
              )}

              {/* PANEL CONTENT AREA */}
              <div className="flex-1 overflow-y-auto p-6 bg-stone-50/50">
                {activeTab === 'DETAILS' && (
                  <PieceDetailsForm 
                    piece={editingPiece} 
                    composers={composers}
                    onSuccess={(updatedPiece) => {
                      setEditingPiece(updatedPiece);
                      fetchData();
                    }} 
                  />
                )}
                {activeTab === 'TRACKS' && editingPiece && (
                  <TrackUploadManager pieceId={editingPiece.id} />
                )}
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// SUB-COMPONENT: 1. Piece Details & PDF Form
// ==========================================
function PieceDetailsForm({ piece, composers, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: piece?.title || '',
    composer: piece?.composer?.id || piece?.composer || '', // Handles object or simple ID
    arranger: piece?.arranger || '',
    voicing: piece?.voicing || '',
    language: piece?.language || '',
    description: piece?.description || ''
  });
  
  const [selectedFile, setSelectedFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ type: '', text: '' });

    // We must use FormData instead of a standard JSON object to support file uploads
    const data = new FormData();
    data.append('title', formData.title);
    if (formData.composer) data.append('composer', formData.composer);
    data.append('arranger', formData.arranger);
    data.append('voicing', formData.voicing);
    data.append('language', formData.language);
    data.append('description', formData.description);

    // Only append the file if a new one was selected
    if (selectedFile) {
      data.append('sheet_music', selectedFile);
    }

    try {
      let res;
      if (piece?.id) {
        res = await api.patch(`/api/pieces/${piece.id}/`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setStatusMsg({ type: 'success', text: 'Zaktualizowano dane utworu.' });
      } else {
        res = await api.post('/api/pieces/', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setStatusMsg({ type: 'success', text: 'Utwór utworzony! Zakładka Audio odblokowana.' });
      }
      
      // Reset file input
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      onSuccess(res.data);
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Wystąpił błąd podczas zapisywania.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-lg border border-stone-200 shadow-sm">
      {statusMsg.text && (
        <div className={`p-4 rounded-sm text-xs font-bold uppercase tracking-wider mb-4 border ${statusMsg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {statusMsg.text}
        </div>
      )}

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Tytuł Utworu *</label>
        <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Kompozytor</label>
          <select value={formData.composer} onChange={e => setFormData({...formData, composer: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none bg-white">
            <option value="">-- Tradycyjny / Nieznany --</option>
            {composers.map(c => <option key={c.id} value={c.id}>{c.last_name} {c.first_name || ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Aranżer</label>
          <input type="text" value={formData.arranger} onChange={e => setFormData({...formData, arranger: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Obsada (Voicing)</label>
          <input type="text" value={formData.voicing} onChange={e => setFormData({...formData, voicing: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" placeholder="np. SSAATTBB" />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Język</label>
          <input type="text" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none" placeholder="np. Łacina" />
        </div>
      </div>

      {/* PDF UPLOAD FIELD */}
      <div className="p-4 border border-dashed border-stone-300 rounded-lg bg-stone-50 mt-2">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Partytura Nuty (Plik PDF)</label>
        {piece?.sheet_music && !selectedFile && (
          <p className="text-xs text-stone-500 mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-500"/> Aktualnie wgrany plik. Wgraj nowy, aby go nadpisać.
          </p>
        )}
        <input 
          type="file" 
          accept="application/pdf"
          ref={fileInputRef}
          onChange={(e) => setSelectedFile(e.target.files[0])}
          className="text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-widest file:bg-stone-200 file:text-stone-700 hover:file:bg-stone-300 cursor-pointer"
        />
      </div>

      <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-stone-900 hover:bg-[#002395] text-white text-[10px] uppercase tracking-widest font-bold py-3 px-5 rounded-sm transition-colors shadow-sm mt-4">
        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        Zapisz Dane Utworu
      </button>
    </form>
  );
}

// ==========================================
// SUB-COMPONENT: 2. Audio Tracks Manager
// ==========================================
function TrackUploadManager({ pieceId }) {
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [voicePart, setVoicePart] = useState('S1');
  const [audioFile, setAudioFile] = useState(null);

  const fetchTracks = async () => {
    try {
      // Pobieranie ścieżek z Django API. 
      // Filtracja odbywa się lokalnie dla bezpieczeństwa.
      const res = await api.get(`/api/tracks/`);
      const filtered = Array.isArray(res.data) ? res.data.filter(t => t.piece === pieceId) : [];
      setTracks(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTracks(); }, [pieceId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!audioFile) return;
    setIsUploading(true);

    const data = new FormData();
    data.append('piece', pieceId);
    data.append('voice_part', voicePart);
    data.append('audio_file', audioFile);

    try {
      await api.post('/api/tracks/', data, { headers: { 'Content-Type': 'multipart/form-data' }});
      
      // Reset form
      setAudioFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      fetchTracks();
    } catch (err) { 
      console.error(err); 
      alert("Błąd wgrywania pliku."); 
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Usunąć tę ścieżkę?")) return;
    try {
      await api.delete(`/api/tracks/${id}/`);
      fetchTracks();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6">
      
      {/* UPLOAD FORM */}
      <form onSubmit={handleUpload} className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="w-full md:w-1/3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Głos docelowy *</label>
          <select value={voicePart} onChange={e => setVoicePart(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-300 rounded-sm focus:border-[#002395] outline-none">
            {VOICE_LINES.map(vl => <option key={vl.value} value={vl.value}>{vl.label}</option>)}
          </select>
        </div>
        
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Plik MP3/MIDI *</label>
          <input 
            type="file" required accept="audio/*" ref={fileInputRef} onChange={e => setAudioFile(e.target.files[0])}
            className="w-full text-sm text-stone-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-sm file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-widest file:bg-stone-200 file:text-stone-700 hover:file:bg-stone-300 cursor-pointer"
          />
        </div>
        
        <button type="submit" disabled={isUploading || !audioFile} className="w-full md:w-auto h-[38px] px-6 bg-stone-900 hover:bg-[#002395] disabled:bg-stone-400 text-white text-[10px] uppercase font-bold tracking-widest rounded-sm transition-colors flex items-center justify-center gap-2 flex-shrink-0">
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Wgraj
        </button>
      </form>

      {/* TRACKS LIST */}
      <div className="space-y-2">
        {isLoading ? <Loader2 className="animate-spin text-stone-400 mx-auto" /> : 
         tracks.length > 0 ? tracks.map(track => (
          <div key={track.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-md border border-stone-200 shadow-sm gap-4">
            
            <div className="flex items-center gap-4">
              <div className="bg-stone-50 px-3 py-1.5 rounded-sm border border-stone-100 text-[#002395] font-bold text-xs uppercase tracking-widest w-24 text-center">
                {track.voice_part_display}
              </div>
              <audio controls controlsList="nodownload" className="h-8 max-w-[200px] md:max-w-xs outline-none">
                <source src={track.audio_file} type="audio/mpeg" />
              </audio>
            </div>
            
            <button onClick={() => handleDelete(track.id)} className="text-stone-400 hover:text-red-500 p-2 transition-colors self-end md:self-auto">
              <Trash2 size={16}/>
            </button>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center py-8 text-stone-400 bg-white border border-stone-200 rounded-md">
            <AlertCircle size={24} className="mb-2 opacity-50" />
            <p className="text-sm italic">Brak ścieżek dla tego utworu.</p>
            <p className="text-xs">Użyj formularza powyżej, aby dodać pierwsze nagranie.</p>
          </div>
        )}
      </div>
    </div>
  );
}