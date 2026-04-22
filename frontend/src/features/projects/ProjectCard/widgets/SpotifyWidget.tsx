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
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Text } from "@/shared/ui/primitives/typography";

interface SpotifyWidgetProps {
  /** The raw Spotify URL provided by the user/API */
  playlistUrl?: string | null;
  /** Adaptive theming for cross-module usage */
  theme?: "light" | "dark";
}

const getSpotifyEmbedUrl = (url?: string | null): string | null => {
  if (!url) return null;

  try {
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const spotifyUrl = new URL(normalizedUrl);
    if (spotifyUrl.hostname !== "open.spotify.com") {
      return null;
    }

    const [, resourceType = "", resourceId = ""] =
      spotifyUrl.pathname.split("/");
    const supportedResourceTypes = new Set([
      "album",
      "episode",
      "playlist",
      "show",
      "track",
    ]);

    if (!supportedResourceTypes.has(resourceType) || !resourceId) {
      return null;
    }

    return `https://open.spotify.com/embed/${resourceType}/${resourceId}?utm_source=generator`;
  } catch {
    return null;
  }
};

export function SpotifyWidget({
  playlistUrl,
  theme = "light",
}: SpotifyWidgetProps): React.JSX.Element {
  const { t } = useTranslation();
  const embedUrl = getSpotifyEmbedUrl(playlistUrl);

  const isDark = theme === "dark";

  return (
    <GlassCard
      variant={isDark ? "dark" : "solid"}
      padding="md"
      isHoverable={false}
      className="flex flex-col gap-4"
    >
      <SectionHeader
        title={t("projects.spotify.title", "Referencje do odsłuchu")}
        icon={<Music size={16} aria-hidden="true" />}
        className="mb-0 pb-0"
      />

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
            className="block rounded-xl shadow-sm"
          />
          <Button asChild variant="secondary" fullWidth>
            <a
              href={playlistUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} aria-hidden="true" />
              {t("projects.spotify.open_app", "Otwórz w aplikacji")}
            </a>
          </Button>
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-ethereal-incense/20 bg-ethereal-alabaster/45">
          <Text color="muted" className="italic">
            {t("projects.spotify.empty", "Brak przypisanej playlisty.")}
          </Text>
        </div>
      )}
    </GlassCard>
  );
}
