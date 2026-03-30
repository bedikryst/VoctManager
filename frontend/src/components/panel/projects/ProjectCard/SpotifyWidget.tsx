/**
 * @file SpotifyWidget.tsx
 * @description Embedded media player widget interfacing with the Spotify Embed API.
 * @architecture
 * Implements strict dimension constraints to bypass iframe responsive reflow issues 
 * during Framer Motion expansion phases. Injects layout-specific URL parameters 
 * (`utm_source=generator`) to force deterministic player rendering and prevent 
 * fallback to the compact layout variant.
 * @module project/ProjectCard/SpotifyWidget
 * @author Krystian Bugalski
 */

import React from 'react';
import { Music, ExternalLink } from 'lucide-react';
import { getSpotifyEmbedUrl } from './utils/formatters';

interface SpotifyWidgetProps {
  /** The raw Spotify URL provided by the user/API */
  playlistUrl?: string;
}

export default function SpotifyWidget({ playlistUrl }: SpotifyWidgetProps): React.JSX.Element {
  const embedUrl = getSpotifyEmbedUrl(playlistUrl);

  return (
    <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <h4 className="flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 flex-shrink-0">
        <Music size={16} className="text-emerald-500"/> Referencje do odsłuchu
      </h4>
      
      {embedUrl ? (
        <div className="flex flex-col gap-3">
          <iframe 
            src={embedUrl} 
            title="Playlista Spotify"
            width="100%" 
            height="152" 
            frameBorder="0" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            style={{ minHeight: '152px', border: 'none', background: 'transparent' }}
            className="rounded-xl shadow-sm block"
          />
          <a 
            href={playlistUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors border border-emerald-200/50"
          >
            <ExternalLink size={14} /> Otwórz w aplikacji
          </a>
        </div>
      ) : (
        <div className="h-[352px] flex items-center justify-center border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
          <p className="text-xs text-stone-400 italic">Brak przypisanej playlisty.</p>
        </div>
      )}
    </div>
  );
}