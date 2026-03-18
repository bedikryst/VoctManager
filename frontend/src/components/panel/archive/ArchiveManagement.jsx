/**
 * @file ArchiveManagement.jsx
 * @description Core Database Controller for the Sheet Music & Repertoire Archive.
 * ENTERPRISE OPTIMIZATION: Advanced client-side search, filtering, and Context API ready.
 * UX UPGRADE 2026: Features Glassmorphism filters, Bento Box metrics, antialiased 
 * micro-typography, and seamless "Pill Switch" navigation for track/document management.
 * @module core/ArchiveManagement
 * @author Krystian Bugalski
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, FileText, Headphones, Search, Filter, Library, Clock, Layers } from 'lucide-react';
import api from '../../../utils/api';
import PieceCard from './PieceCard';
import PieceDetailsForm, { EPOCHS } from './PieceDetailsForm'; 
import TrackUploadManager from './TrackUploadManager';

export default function ArchiveManagement() {
  // --- STATE MANAGEMENT ---
  const [pieces, setPieces] = useState([]);
  const [composers, setComposers] = useState([]);
  const [voiceLines, setVoiceLines] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [composerFilter, setComposerFilter] = useState('');
  const [epochFilter, setEpochFilter] = useState(''); 

  // Slide-over Panel Configuration
  const [expandedPieceId, setExpandedPieceId] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('DETAILS');
  const [editingPiece, setEditingPiece] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [piecesRes, compRes, voiceRes] = await Promise.all([
        api.get('/api/pieces/'),
        api.get('/api/composers/'),
        api.get('/api/options/voice-lines/') 
      ]);
      setPieces(Array.isArray(piecesRes.data) ? piecesRes.data : []);
      setComposers(Array.isArray(compRes.data) ? compRes.data : []);
      setVoiceLines(Array.isArray(voiceRes.data) ? voiceRes.data : []);
    } catch (err) {
      console.error("Data orchestration failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- DATA METRICS & COMPUTATION ---
  const libraryStats = useMemo(() => {
      const totalPieces = pieces.length;
      const withPdf = pieces.filter(p => p.sheet_music).length;
      const totalAudio = pieces.reduce((acc, p) => acc + (p.tracks?.length || 0), 0);
      return { totalPieces, withPdf, totalAudio };
  }, [pieces]);

  const displayPieces = useMemo(() => {
      return pieces.filter(p => {
          const searchMatch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
          const compId = typeof p.composer === 'object' ? p.composer?.id : p.composer;
          const composerMatch = composerFilter ? String(compId) === String(composerFilter) : true;
          const epochMatch = epochFilter ? p.epoch === epochFilter : true;
          
          return searchMatch && composerMatch && epochMatch;
      });
  }, [pieces, searchTerm, composerFilter, epochFilter]);

  // --- EVENT HANDLERS ---
  const toggleExpand = (id) => setExpandedPieceId(prev => prev === id ? null : id);
  
  const openPanel = (piece = null, tab = 'DETAILS') => { 
      setEditingPiece(piece); 
      setActiveTab(tab); 
      setIsPanelOpen(true); 
      document.body.style.overflow = 'hidden'; // Scroll Lock
  };
  
  const closePanel = () => { 
      setIsPanelOpen(false); 
      setTimeout(() => setEditingPiece(null), 300); 
      document.body.style.overflow = ''; // Scroll Release
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Na pewno usunąć utwór z archiwum?")) return;
    try {
      await api.delete(`/api/pieces/${id}/`);
      fetchData();
      if (editingPiece?.id === id) closePanel();
    } catch (err) { 
        alert("Błąd integracji. Utwór może być zablokowany jako element historycznego koncertu."); 
    }
  };

  const getComposerInfo = (pieceComposerId) => {
    if (!pieceComposerId) return null;
    if (typeof pieceComposerId === 'object') return pieceComposerId; 
    return composers.find(c => c.id === pieceComposerId); 
  };

  // --- UI THEMES ---
  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
  const glassInputStyle = "w-full pl-11 pr-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

  return (
    <div className="space-y-6 animate-fade-in relative cursor-default pb-12 max-w-6xl mx-auto">
      
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                  <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                          <Library size={12} className="text-[#002395]" />
                          <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                              Zasoby Repertuarowe
                          </p>
                      </div>
                      <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                          Archiwum <span className="italic text-[#002395]">Nuty</span>.
                      </h1>
                  </div>
                  <button onClick={() => openPanel()} className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] hover:-translate-y-0.5 active:scale-95">
                      <Plus size={16} /> Nowy Utwór
                  </button>
              </div>
          </motion.div>
      </header>

      {/* --- BENTO METRICS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`${glassCardStyle} p-5 flex items-center justify-between`}>
              <div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-1">Pozycje Repertuarowe</p>
                  <p className="text-2xl font-black text-stone-800 tracking-tight">{libraryStats.totalPieces}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shadow-sm">
                  <Library size={20} className="text-stone-400" />
              </div>
          </div>
          <div className={`${glassCardStyle} p-5 flex items-center justify-between`}>
              <div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395]/70 mb-1">Dostępne Partytury</p>
                  <p className="text-2xl font-black text-[#002395] tracking-tight">{libraryStats.withPdf}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                  <FileText size={20} className="text-[#002395]" />
              </div>
          </div>
          <div className={`${glassCardStyle} p-5 flex items-center justify-between`}>
              <div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-emerald-600/70 mb-1">Ścieżki Audio (Midi)</p>
                  <p className="text-2xl font-black text-emerald-700 tracking-tight">{libraryStats.totalAudio}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
                  <Headphones size={20} className="text-emerald-600" />
              </div>
          </div>
      </div>

      {/* --- GLASSMORPHISM FILTERS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-8">
          <div className="relative sm:col-span-5">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search size={16} className="text-stone-400" /></div>
              <input type="text" placeholder="Szukaj utworu po tytule..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={glassInputStyle} />
          </div>
          <div className="relative sm:col-span-4">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Filter size={16} className="text-stone-400" /></div>
              <select value={composerFilter} onChange={e => setComposerFilter(e.target.value)} className={`${glassInputStyle} font-bold text-stone-600 appearance-none`}>
                  <option value="">Wszyscy Kompozytorzy</option>
                  {composers.map(c => <option key={c.id} value={c.id}>{c.last_name} {c.first_name || ''}</option>)}
              </select>
          </div>
          <div className="relative sm:col-span-3">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Clock size={16} className="text-stone-400" /></div>
              <select value={epochFilter} onChange={e => setEpochFilter(e.target.value)} className={`${glassInputStyle} font-bold text-stone-600 appearance-none`}>
                  <option value="">Wszystkie Epoki</option>
                  {EPOCHS.map(ep => <option key={ep.value} value={ep.value}>{ep.label}</option>)}
              </select>
          </div>
      </div>

      {/* --- REPERTOIRE FEED --- */}
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-stone-100/50 rounded-2xl w-full border border-white/50"></div>)}
          </div>
        ) : displayPieces.length > 0 ? (
          displayPieces.map((piece) => (
            <PieceCard 
              key={piece.id} piece={piece} isExpanded={expandedPieceId === piece.id}
              onToggleExpand={toggleExpand} onOpenPanel={openPanel} onDelete={handleDelete} getComposerInfo={getComposerInfo}
            />
          ))
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${glassCardStyle} p-16 flex flex-col items-center justify-center text-center`}>
              <Layers size={48} className="mb-4 text-stone-300 opacity-50" />
              <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-2">Brak wyników</span>
              <span className="text-xs text-stone-400 max-w-sm">Zmień parametry filtrowania lub dodaj nową kompozycję do bazy.</span>
          </motion.div>
        )}
      </div>

      {/* --- SLIDING PANEL OVERLAY --- */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closePanel} className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40" />
            
            <motion.div 
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
                className="fixed inset-y-0 right-0 w-full max-w-2xl bg-[#f4f2ee] shadow-2xl z-50 flex flex-col border-l border-white/60"
            >
              {/* Panel Header */}
              <div className="flex justify-between items-center px-6 md:px-10 pt-6 md:pt-10 pb-6 flex-shrink-0 z-20 bg-white/80 backdrop-blur-xl border-b border-stone-200/50">
                <h3 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">{editingPiece ? 'Edycja Utworu' : 'Nowy Utwór'}</h3>
                <button onClick={closePanel} className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-3 rounded-2xl active:scale-95"><X size={20} /></button>
              </div>

              {/* Navigation Tabs (Modern Pill Switches) */}
              {editingPiece && (
                <div className="flex-shrink-0 relative z-30 px-6 md:px-10 pb-6 bg-white/80 backdrop-blur-xl border-b border-stone-200/50">
                    <div className="inline-flex items-center p-1.5 bg-stone-200/40 backdrop-blur-xl border border-stone-200/60 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] overflow-x-auto scrollbar-hide max-w-full">
                        <button 
                            onClick={() => setActiveTab('DETAILS')} 
                            className={`px-5 py-2.5 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'DETAILS' ? 'bg-white text-[#002395] shadow-sm border border-white' : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'}`}
                        >
                            <FileText size={14} /> Dane i Nuty
                        </button>
                        <button 
                            onClick={() => setActiveTab('TRACKS')} 
                            className={`px-5 py-2.5 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'TRACKS' ? 'bg-white text-[#002395] shadow-sm border border-white' : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'}`}
                        >
                            <Headphones size={14} /> Ścieżki Audio
                        </button>
                    </div>
                </div>
              )}

              {/* Content Injection Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-10 relative">
                {activeTab === 'DETAILS' && (
                  <PieceDetailsForm 
                    /* REACT COMPONENT KEY ISOLATION: Forces full unmount and state wipe on un-selection */
                    key={editingPiece ? editingPiece.id : 'new-piece'} 
                    piece={editingPiece} 
                    composers={composers} 
                    voiceLines={voiceLines} 
                    refreshGlobal={fetchData} 
                    onSuccess={(updatedPiece, actionType) => { 
                        fetchData(); 
                        if (actionType === 'SAVE_AND_ADD') {
                            setEditingPiece(null); 
                        } else {
                            setEditingPiece(updatedPiece);
                        }
                    }} 
                  />
                )}
                {activeTab === 'TRACKS' && editingPiece && (
                  <TrackUploadManager pieceId={editingPiece.id} fetchGlobal={fetchData} voiceLines={voiceLines} />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}