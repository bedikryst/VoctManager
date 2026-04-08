/**
 * @file SpotifyWidget.tsx
 * @description Embedded media player widget interfacing with the Spotify Embed API.
 * Implements strict dimension constraints to bypass iframe responsive reflow issues.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/components/SpotifyWidget
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Music, ExternalLink } from "lucide-react";

interface SpotifyWidgetProps {
  /** The raw Spotify URL provided by the user/API */
  playlistUrl?: string | null;
  /** Adaptive theming for cross-module usage */
  theme?: "light" | "dark";
}

const getSpotifyEmbedUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const playlistIdMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if (playlistIdMatch && playlistIdMatch[1]) {
    return `https://open.spotify.com/embed/playlist/${playlistIdMatch[1]}?utm_source=generator`;
  }
  return null;
};

export default function SpotifyWidget({
  playlistUrl,
  theme = "light",
}: SpotifyWidgetProps): React.JSX.Element {
  const { t } = useTranslation();
  const embedUrl = getSpotifyEmbedUrl(playlistUrl);

  const isDark = theme === "dark";
  const containerStyle = isDark
    ? "bg-white/5 border border-white/10 rounded-2xl p-5 shadow-sm flex flex-col gap-4"
    : "bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm flex flex-col gap-4";

  const headerStyle = isDark
    ? "flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-400 flex-shrink-0"
    : "flex items-center gap-2.5 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 flex-shrink-0";

  const buttonStyle = isDark
    ? "flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors border border-emerald-500/20"
    : "flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors border border-emerald-200/50";

  return (
    <div className={containerStyle}>
      <h4 className={headerStyle}>
        <Music size={16} className="text-emerald-500" aria-hidden="true" />{" "}
        {t("projects.spotify.title", "Referencje do odsłuchu")}
      </h4>

      {embedUrl ? (
        <div className="flex flex-col gap-3">
          <iframe
            src={embedUrl}
            title={t("projects.spotify.iframe_title", "Playlista Spotify")}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            style={{
              minHeight: "152px",
              border: "none",
              background: "transparent",
            }}
            className="rounded-xl shadow-sm block"
          />
          <a
            href={playlistUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonStyle}
          >
            <ExternalLink size={14} aria-hidden="true" />{" "}
            {t("projects.spotify.open_app", "Otwórz w aplikacji")}
          </a>
        </div>
      ) : (
        <div
          className={`h-[152px] flex items-center justify-center border border-dashed rounded-xl ${isDark ? "border-white/10 bg-white/5 text-stone-500" : "border-stone-200 bg-stone-50/50 text-stone-400"}`}
        >
          <p className="text-xs italic">
            {t("projects.spotify.empty", "Brak przypisanej playlisty.")}
          </p>
        </div>
      )}
    </div>
  );
}
