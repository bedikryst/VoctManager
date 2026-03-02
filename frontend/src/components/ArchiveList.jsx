/**
 * ArchiveList Component
 * @author Krystian Bugalski
 * * Displays the complete musical repertoire available to the choir.
 * Includes client-side filtering (search) and handles the presentation
 * of sheet music PDFs and isolated audio practice tracks.
 */
import { useState } from 'react';

export default function ArchiveList({ pieces, user }) {

  const [searchTerm, setSearchTerm] = useState('');

  // Derived state: Filter the pieces array based on the search input
  // Checks both the title of the piece and the composer's name
  const filteredPieces = pieces.filter(piece => 
    piece.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    piece.composer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in p-6">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end mb-6 border-b border-stone-200 pb-2">
        <h2 className="text-xl font-serif font-bold text-stone-800">Pełne Archiwum Utworów</h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
          W bazie: {pieces.length}
        </span>
      </div>

      {/* SEARCH BAR */}
      <div className="mb-6">
        <input 
          type="text" 
          placeholder="Szukaj po tytule lub nazwisku kompozytora..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2.5 text-sm border border-stone-300 rounded-sm focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none transition-all shadow-sm bg-stone-50 hover:bg-white focus:bg-white"
        />
      </div>

      {/* PIECES LISTING */}
      <div className="space-y-4">
        {filteredPieces.map(piece => (
          <ArchivePieceCard key={piece.id} piece={piece} user={user} />
        ))}
        
        {/* Empty state feedback when search yields no results */}
        {filteredPieces.length === 0 && (
          <p className="text-sm text-stone-500 italic text-center py-10 border border-dashed border-stone-200 bg-stone-50 rounded-sm">
            Brak wyników w archiwum dla podanego hasła.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Sub-component representing a single musical piece in the archive.
 * Extracts local state (showAllVoices) so expanding tracks on one piece
 * doesn't affect the UI state of other pieces in the list.
 */
function ArchivePieceCard({ piece, user }) {
  // Toggles visibility between showing only the user's specific voice part vs all available tracks
  const [showAllVoices, setShowAllVoices] = useState(false);

  return (
    <div className="bg-white border border-stone-200 rounded-sm shadow-sm overflow-hidden transition-all hover:border-stone-300">
      
      {/* PIECE HEADER (Title, Composer, PDF Link) */}
      <div className="bg-stone-50 px-5 py-4 flex flex-col sm:flex-row justify-between sm:items-center border-b border-stone-100 gap-3">
        <div>
          <h3 className="text-base font-bold text-stone-900">{piece.title}</h3>
          <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-0.5">{piece.composer_name}</p>
        </div>
        {piece.sheet_music && (
          <a 
            href={piece.sheet_music} 
            target="_blank" 
            rel="noreferrer" 
            className="inline-block text-[10px] font-bold uppercase tracking-wider bg-white border border-stone-300 text-stone-700 hover:text-stone-900 hover:border-stone-500 px-4 py-2 rounded-sm transition-colors shadow-sm text-center"
          >
            📄 Otwórz Nuty (PDF)
          </a>
        )}
      </div>

      {/* AUDIO TRACKS SECTION */}
      {piece.tracks && piece.tracks.length > 0 && (
        <div className="p-5">
          
          <div className="flex justify-between items-center mb-4 border-b border-stone-100 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Materiały Szkoleniowe (Audio)</span>
            <label className="flex items-center space-x-2 text-[10px] uppercase tracking-wider font-bold text-stone-500 cursor-pointer hover:text-stone-800 transition-colors">
              <input 
                type="checkbox" 
                checked={showAllVoices}
                onChange={() => setShowAllVoices(!showAllVoices)}
                className="rounded-sm border-stone-300 text-stone-800 focus:ring-stone-800 w-3.5 h-3.5"
              />
              <span>Pokaż wszystkie sekcje</span>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {piece.tracks
              // Filter tracks dynamically based on the checkbox state and the user's assigned voice part
              .filter(track => showAllVoices || track.voice_part === user?.voice_part)
              .map(track => (
                <div key={track.id} className="flex items-center justify-between bg-stone-50 border border-stone-200 p-2.5 rounded-sm">
                  <div className="flex flex-col mr-3 min-w-[80px]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-800 truncate">
                      {track.voice_part_display}
                    </span>
                    {/* Highlight badge for the user's specific track */}
                    {track.voice_part === user?.voice_part && (
                      <span className="text-[8px] bg-stone-800 text-stone-100 px-1.5 py-0.5 mt-1 rounded-sm uppercase tracking-widest text-center w-fit">
                        Twój głos
                      </span>
                    )}
                  </div>
                  {/* Native HTML5 Audio Player */}
                  <audio controls className="h-8 w-full max-w-sm grayscale opacity-90" src={track.audio_file}>
                    Brak obsługi formatu audio.
                  </audio>
                </div>
            ))}
          </div>

          {/* Feedback when the user's specific track is missing and they haven't toggled 'Show All' */}
          {!showAllVoices && piece.tracks.filter(t => t.voice_part === user?.voice_part).length === 0 && (
            <p className="text-[11px] text-stone-500 italic mt-3 bg-stone-50 p-3 rounded-sm border border-stone-100 text-center">
              W systemie brak wyodrębnionych ścieżek dla Twojego głosu w tym utworze.
            </p>
          )}
        </div>
      )}
    </div>
  );
}