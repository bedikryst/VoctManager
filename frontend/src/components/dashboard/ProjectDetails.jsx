/**
 * ProjectDetails Component
 * @author Krystian Bugalski
 * * Presentational component displaying the full scope of a single concert.
 * Renders the event metadata, the assigned cast (sorted by traditional choir voice order),
 * and the specific repertoire pieces with their associated practice tracks.
 * * @param {Object} project - The selected project data object.
 * @param {Array} pieces - The global array of repertoire pieces to cross-reference.
 * @param {Object} user - The current logged-in user object (for highlighting their voice part).
 * @param {Function} onBack - Callback function to return to the project list view.
 */
import { useState } from 'react';

export default function ProjectDetails({ project, pieces, user, onBack }) {
  // Derive the specific pieces required for this project by matching IDs
  const projectPieces = pieces.filter(p => project.repertoire.includes(p.id));

  // Defines the traditional classical music hierarchy for sorting choir members
  const voiceOrder = { 
    'SOPRAN': 10, 'SOPRAN_1': 11, 'SOPRAN_2': 12, 
    'ALT': 20, 'ALT_1': 21, 'ALT_2': 22, 
    'TENOR': 30, 'TENOR_1': 31, 'TENOR_2': 32, 
    'BAS': 40, 'BAS_1': 41, 'BAS_2': 42,
    'TUTTI': 50, 'ACC': 60 
  };
  
  // Sort the cast array safely. Fallback to 99 for unknown voice parts.
  const sortedCast = project.cast?.sort(
    (a, b) => (voiceOrder[a.voice_part] || 99) - (voiceOrder[b.voice_part] || 99)
  ) || [];

  return (
    <div className="animate-fade-in flex flex-col h-full bg-white">
      
      {/* TOOLBAR */}
      <div className="bg-stone-100 border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <button 
          onClick={onBack} 
          className="text-xs font-bold uppercase tracking-wider text-stone-600 hover:text-stone-900 transition-colors flex items-center"
        >
          ← Wróć do listy
        </button>
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
          Teczka Projektowa ID: {project.id}
        </span>
      </div>
      
      <div className="p-6 md:p-8 flex-1 overflow-y-auto">
        
        {/* DOCUMENT HEADER */}
        <div className="mb-8">
          <h2 className="text-3xl font-serif font-bold text-stone-900 mb-2">{project.title}</h2>
          <div className="flex flex-col md:flex-row md:space-x-6 text-sm text-stone-600 font-medium border-b border-stone-200 pb-4">
            <p>Data: <span className="text-stone-900">{project.start_date}</span></p>
            <p>Lokalizacja: <span className="text-stone-900">{project.location || 'Brak'}</span></p>
          </div>
          {project.description && (
            <div className="mt-4 text-sm text-stone-600 italic border-l-2 border-amber-600 pl-4 py-1 bg-stone-50">
              {project.description}
            </div>
          )}
        </div>

        {/* CAST DIRECTORY (High-density layout) */}
        <div className="mb-10">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 mb-3">Zatwierdzona Obsada</h3>
          {sortedCast.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sortedCast.map(member => {
                // Highlight the currently logged-in user in the cast list
                const isMe = user && member.id === user.id;
                return (
                  <div key={member.id} className={`px-2.5 py-1 text-xs border rounded-sm flex items-center ${isMe ? 'bg-stone-800 text-stone-100 border-stone-800' : 'bg-stone-50 text-stone-700 border-stone-200'}`}>
                    <span className="mr-2 opacity-60 font-bold w-4 text-center">{member.voice_part?.charAt(0) || '-'}</span>
                    <span className="font-medium">{member.first_name} {member.last_name}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-stone-500 italic">Brak przypisanej obsady.</p>
          )}
        </div>

        {/* REPERTOIRE LIST */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 mb-3">Materiały Robocze</h3>
          <div className="space-y-3">
            {projectPieces.map(piece => (
              <ProjectPieceCard key={piece.id} piece={piece} user={user} />
            ))}
            {projectPieces.length === 0 && (
              <p className="text-xs text-stone-500 italic border border-dashed border-stone-200 p-4 text-center">
                Brak przypisanych utworów.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * Sub-component representing a single repertoire piece inside a specific project.
 * Maintains isolated state for expanding all audio tracks vs. just the user's part.
 */
function ProjectPieceCard({ piece, user }) {
  const [showAllVoices, setShowAllVoices] = useState(false);

  return (
    <div className="border border-stone-200 rounded-sm bg-white overflow-hidden">
      
      {/* PIECE HEADER */}
      <div className="bg-stone-50 px-4 py-3 flex justify-between items-center border-b border-stone-200">
        <div>
          <h4 className="text-sm font-bold text-stone-900">{piece.title}</h4>
          <p className="text-[10px] uppercase tracking-wider text-stone-500">{piece.composer_name}</p>
        </div>
        {piece.sheet_music && (
          <a 
            href={piece.sheet_music} 
            target="_blank" 
            rel="noreferrer" 
            className="text-[10px] font-bold uppercase tracking-wider bg-stone-800 border border-stone-300 text-stone-100 hover:text-stone-50 hover:bg-stone-950 px-3 py-1.5 rounded-sm transition-colors shadow-sm"
          >
            PDF
          </a>
        )}
      </div>
      
      {/* AUDIO SECTION */}
      {piece.tracks && piece.tracks.length > 0 && (
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Audio (Midi/MP3)</span>
            <label className="flex items-center space-x-2 text-[10px] uppercase tracking-wider font-bold text-stone-500 cursor-pointer hover:text-stone-800">
              <input 
                type="checkbox" 
                checked={showAllVoices} 
                onChange={() => setShowAllVoices(!showAllVoices)} 
                className="rounded-sm border-stone-300 text-stone-800 focus:ring-stone-800 w-3 h-3" 
              />
              <span>Wszystkie ścieżki</span>
            </label>
          </div>

          <div className="space-y-2">
            {piece.tracks
              .filter(track => showAllVoices || track.voice_part === user?.voice_part)
              .map(track => (
                <div key={track.id} className="flex items-center justify-between bg-stone-50 border border-stone-100 p-2 rounded-sm">
                  <span className="text-xs font-bold text-stone-700 w-24 truncate">
                    {track.voice_part_display}
                  </span>
                  <audio controls className="h-8 w-full max-w-md" src={track.audio_file}>
                    Brak obsługi.
                  </audio>
                </div>
            ))}
          </div>
          
          {!showAllVoices && piece.tracks.filter(t => t.voice_part === user?.voice_part).length === 0 && (
            <p className="text-[10px] text-stone-400 italic mt-2">Brak ścieżki dla Twojego głosu.</p>
          )}
        </div>
      )}
    </div>
  );
}