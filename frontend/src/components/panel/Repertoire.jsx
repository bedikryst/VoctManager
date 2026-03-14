/**
 * @file Repertoire.jsx
 * @description Repertoire & Archive Module.
 * Manages the ensemble's musical library. Allows for quick searching, 
 * downloading of PDF sheet music, and exclusive inline audio playback for rehearsal tracks.
 * @author Krystian Bugalski
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Music, FileText, Headphones, ChevronDown, ChevronUp, Download } from 'lucide-react';
import api from '../../utils/api';

export default function Repertoire() {
  const [pieces, setPieces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPieceId, setExpandedPieceId] = useState(null);

  // 1. Fetch repertoire data from Django API
  useEffect(() => {
    const fetchRepertoire = async () => {
      try {
        const response = await api.get('/api/pieces/');
        // Guard against non-array responses to prevent mapping crashes
        setPieces(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Failed to fetch repertoire:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepertoire();
  }, []);

  const toggleExpand = (id) => {
    setExpandedPieceId(prev => prev === id ? null : id);
  };

  // 2. Client-side search filtering (Title and Composer)
  const filteredPieces = pieces.filter(piece => {
    const term = searchQuery.toLowerCase();
    const title = piece.title?.toLowerCase() || '';
    
    // Safely handle composer object, string, or null values
    let composerName = '';
    if (piece.composer && typeof piece.composer === 'object') {
        composerName = piece.composer.last_name?.toLowerCase() || '';
    } else if (typeof piece.composer === 'string') {
        composerName = piece.composer.toLowerCase();
    }
    
    return title.includes(term) || composerName.includes(term);
  });

  return (
    <div className="space-y-6 animate-fade-in cursor-default">
      
      {/* HEADER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-stone-200 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-800">Archiwum Nuty i Nagrania</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mt-1">
            Dostępnych utworów: {pieces.length}
          </p>
        </div>
        
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-stone-400" />
          </div>
          <input
            type="text"
            placeholder="Szukaj utworu lub kompozytora..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-stone-300 rounded-md leading-5 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#002395] focus:border-[#002395] sm:text-sm transition-all shadow-sm cursor-text"
          />
        </div>
      </div>

      {/* REPERTOIRE LIST */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-stone-100 rounded-xl w-full"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence>
            {filteredPieces.length > 0 ? filteredPieces.map((piece) => (
              <motion.div 
                key={piece.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden"
              >
                {/* Collapsed Card (Always visible) */}
                <div 
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-stone-50 transition-colors"
                  onClick={() => toggleExpand(piece.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                      <Music className="w-5 h-5 text-[#002395]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-stone-900" style={{ fontFamily: "'Cormorant', serif" }}>
                        {piece.title}
                      </h3>
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                        {piece.composer && typeof piece.composer === 'object' 
                            ? `${piece.composer.first_name || ''} ${piece.composer.last_name}`.trim() 
                            : piece.composer || 'Kompozytor nieznany'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {piece.voicing && (
                      <span className="hidden md:inline-block px-2 py-1 bg-stone-100 text-stone-600 text-[10px] uppercase font-bold tracking-widest rounded-sm border border-stone-200">
                        {piece.voicing}
                      </span>
                    )}
                    <button className="text-stone-400 hover:text-stone-700 transition-colors">
                      {expandedPieceId === piece.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Card (Details & Media) */}
                {expandedPieceId === piece.id && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="px-5 pb-5 pt-2 bg-stone-50 border-t border-stone-100 grid grid-cols-1 md:grid-cols-2 gap-6 cursor-default"
                  >
                    
                    {/* SHEET MUSIC (PDF) */}
                    <div>
                      <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-3">
                        <FileText size={14} /> Partytura
                      </h4>
                      {piece.sheet_music ? (
                        <a 
                          href={piece.sheet_music}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 rounded-md text-sm font-bold text-stone-700 hover:bg-stone-100 hover:text-[#002395] transition-colors shadow-sm cursor-pointer"
                        >
                          <Download size={16} />
                          Pobierz PDF
                        </a>
                      ) : (
                        <p className="text-xs text-stone-400 italic">Brak pliku z nutami dla tego utworu.</p>
                      )}
                    </div>

                    {/* AUDIO TRACKS (Rehearsal Media) */}
                    <div>
                      <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-3">
                        <Headphones size={14} /> Ścieżki do ćwiczeń
                      </h4>
                      {piece.tracks && piece.tracks.length > 0 ? (
                        <div className="space-y-3">
                          {piece.tracks.map(track => (
                            <div key={track.id} className="bg-white p-3 rounded-md border border-stone-200 shadow-sm flex flex-col gap-2">
                              {/* FIXED: Uses voice_part_display matching the Django Serializer */}
                              <span className="text-xs font-bold text-stone-700">{track.title || track.voice_part_display}</span>
                              <audio 
                                controls 
                                controlsList="nodownload" 
                                className="w-full h-8 outline-none cursor-pointer"
                                preload="none"
                                onPlay={(e) => {
                                  // Exclusive playback: pauses all other audio elements on the page
                                  document.querySelectorAll('audio').forEach(audioEl => {
                                    if (audioEl !== e.target) {
                                      audioEl.pause();
                                    }
                                  });
                                }}
                              >
                                <source 
                                  src={track.audio_file} 
                                  type="audio/mpeg" 
                                />
                                Twoja przeglądarka nie obsługuje elementu audio.
                              </audio>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 italic">Brak ścieżek audio dla tego utworu.</p>
                      )}
                    </div>

                  </motion.div>
                )}
              </motion.div>
            )) : (
              <div className="p-8 text-center text-stone-500 border border-dashed border-stone-300 rounded-xl bg-stone-50">
                Brak utworów spełniających kryteria wyszukiwania.
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}