/**
 * @file CastTab.jsx
 * @description Primary Casting Manager Module.
 * Assigns active artists to the project via the 'Participation' junction table.
 * ENTERPRISE OPTIMIZATION: Removed redundant API calls. Now consumes ProjectDataContext 
 * directly. Switching to this tab generates 0 network requests.
 * UI UPGRADE: Glassmorphism list views with antialiased typography and active button scales.
 * @module project/tabs/CastTab
 * @author Krystian Bugalski
 */

import { useContext } from 'react';
import { MicVocal, BookOpen, Users } from 'lucide-react';
import api from '../../../../utils/api';
import { ProjectDataContext } from '../ProjectDashboard';

export default function CastTab({ projectId }) {
  const { artists, participations, fetchGlobal } = useContext(ProjectDataContext);

  const allArtists = artists.filter(a => a.is_active);
  const projectParticipations = participations.filter(p => p.project === projectId);

  const toggleCasting = async (artistId, isCurrentlyCasted, participationId) => {
    try {
      if (isCurrentlyCasted && participationId) {
        await api.delete(`/api/participations/${participationId}/`);
      } else {
        await api.post('/api/participations/', { artist: artistId, project: projectId, status: 'INV' });
      }
      fetchGlobal(); 
    } catch (err) { 
      alert("Błąd integracji z bazą danych."); 
    }
  };

  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden";

  return (
    <div className={`${glassCardStyle} max-w-3xl mx-auto`}>
      
      <div className="p-5 bg-white/40 border-b border-white/60 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
                <Users size={14} className="text-[#002395]" />
            </div>
            <h4 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-700">Dostępni Chórzyści</h4>
        </div>
        <span className="text-[9px] uppercase font-bold antialiased tracking-widest text-[#002395] bg-white px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm">
          Zatrudniono: {projectParticipations.length}
        </span>
      </div>
      
      <div className="divide-y divide-stone-100/50 max-h-[600px] overflow-y-auto scrollbar-hide">
        {allArtists.map(artist => {
          const participation = projectParticipations.find(p => p.artist === artist.id);
          
          return (
            <div key={artist.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 transition-colors gap-4 ${participation ? 'bg-blue-50/20' : 'hover:bg-white/50'}`}>
              <div className="flex flex-col gap-2">
                
                <div className="flex items-center gap-3">
                  <p className="font-bold text-stone-900 text-sm tracking-tight">{artist.first_name} {artist.last_name}</p>
                  <span className="text-[8px] font-bold antialiased uppercase tracking-[0.2em] text-stone-500 bg-stone-100/80 px-2 py-1 rounded-md shadow-sm border border-stone-200/50">
                    {artist.voice_type_display}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">
                  {(artist.vocal_range_bottom || artist.vocal_range_top) && (
                    <span className="flex items-center gap-1.5" title="Skala wokalna artysty">
                      <MicVocal size={12} className="text-[#002395]/60" />
                      <span>Skala: <strong className="text-stone-600">{artist.vocal_range_bottom || '?'} - {artist.vocal_range_top || '?'}</strong></span>
                    </span>
                  )}
                  {artist.sight_reading_skill && (
                    <span className="flex items-center gap-1.5" title="Umiejętność czytania nut a vista">
                      <BookOpen size={12} className="text-[#002395]/60" />
                      <span>A vista: <strong className="text-stone-600">{artist.sight_reading_skill}/5</strong></span>
                    </span>
                  )}
                </div>

              </div>
              
              <button 
                onClick={() => toggleCasting(artist.id, !!participation, participation?.id)} 
                className={`flex justify-center items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] uppercase font-bold antialiased tracking-[0.15em] transition-all shadow-sm active:scale-95 ${
                  participation 
                  ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300' 
                  : 'bg-[#002395] border border-[#001766] text-white hover:bg-[#001766] shadow-[0_4px_10px_rgba(0,35,149,0.2)]'
                }`}
              >
                {participation ? 'Usuń z obsady' : 'Dodaj do projektu'}
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}