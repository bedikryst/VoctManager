/**
 * Artist Materials Module
 * Author: Krystian Bugalski
 * * Mobile-first widok materiałów do ćwiczeń.
 * Wyświetla tylko te utwory, które są aktualnie w repertuarze
 * przypisanych artyście projektów.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Music, FileText, Download, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../utils/api';

export default function Materials() {
  const [pieces, setPieces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPieceId, setExpandedPieceId] = useState(null);

  // W prawdziwej implementacji ten endpoint (/api/pieces/my-materials/) 
  // powinien zwracać tylko utwory z projektów artysty. 
  // Na razie używamy standardowego endpointu pieces.
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const response = await api.get('/api/pieces/');
        setPieces(response.data);
      } catch (err) {
        console.error("Błąd pobierania materiałów:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMaterials();
  }, []);

  const toggleExpand = (id) => {
    setExpandedPieceId(prev => prev === id ? null : id);
  };

  const filteredPieces = pieces.filter(piece => 
    piece.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (typeof piece.composer === 'object' ? piece.composer?.last_name?.toLowerCase() : piece.composer?.toLowerCase())?.includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-6 cursor-default">
      <div className="flex flex-col md:flex-row justify-between md:items-end border-b border-stone-200 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-800">Materiały do prób</h2>
          <p className="text-xs font-medium text-stone-500 mt-1">Nuty i ścieżki audio</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-stone-400" />
          </div>
          <input
            type="text"
            placeholder="Szukaj utworu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-3 border border-stone-300 rounded-lg leading-5 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#002395] focus:border-[#002395] sm:text-sm shadow-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-stone-100 rounded-xl w-full"></div>)}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredPieces.length > 0 ? filteredPieces.map(piece => (
              <motion.div 
                key={piece.id}
                layout
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden"
              >
                {/* Mobile-friendly Touch Target */}
                <div 
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer active:bg-stone-50 transition-colors"
                  onClick={() => toggleExpand(piece.id)}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Music className="w-5 h-5 text-[#002395]" />
                    </div>
                    <div className="truncate">
                      <h3 className="text-base font-bold text-stone-900 truncate">{piece.title}</h3>
                      <p className="text-[10px] font-medium text-stone-500 uppercase tracking-widest truncate">
                        {typeof piece.composer === 'object' ? piece.composer.last_name : piece.composer}
                      </p>
                    </div>
                  </div>
                  <div className="text-stone-400 flex-shrink-0">
                    {expandedPieceId === piece.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {expandedPieceId === piece.id && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="px-4 pb-4 pt-1 bg-stone-50 border-t border-stone-100"
                  >
                    {/* Nuty */}
                    <div className="mt-3">
                      {piece.sheet_music ? (
                        <a 
                          href={piece.sheet_music} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-stone-300 rounded-lg text-sm font-bold text-stone-700 hover:bg-stone-100 hover:text-[#002395] transition-colors shadow-sm active:scale-[0.98]"
                        >
                          <FileText size={18} /> Otwórz / Pobierz PDF
                        </a>
                      ) : (
                        <p className="text-xs text-stone-400 italic text-center py-2">Brak partytury w systemie.</p>
                      )}
                    </div>

                    {/* Ścieżki Audio */}
                    {piece.tracks && piece.tracks.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 ml-1">Ścieżki Audio:</p>
                        {piece.tracks.map(track => (
                          <div key={track.id} className="bg-white p-3 rounded-lg border border-stone-200 shadow-sm">
                            <span className="block text-xs font-bold text-stone-700 mb-2">{track.title || track.voice_line_display}</span>
                            {/* Stylizacja audio pod mobile */}
                            <audio 
                              controls 
                              controlsList="nodownload" 
                              className="w-full h-10"
                              preload="none"
                              onPlay={(e) => {
                                document.querySelectorAll('audio').forEach(audioEl => {
                                  if (audioEl !== e.target) audioEl.pause();
                                });
                              }}
                            >
                              <source src={track.audio_file} type="audio/mpeg" />
                            </audio>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )) : (
              <div className="text-center p-8 border border-dashed border-stone-300 rounded-xl bg-stone-50 text-stone-500 text-sm">
                Brak materiałów.
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}