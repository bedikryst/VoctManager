/**
 * @file SpotifyWidget.tsx
 * @description Embedded Spotify reference player for the Overview. Wrapped in the
 * shared WidgetCard so its title sits a consistent distance from the embed.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/SpotifyWidget
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Music, ExternalLink } from "lucide-react";

import { WidgetCard } from "@/shared/ui/composites/WidgetCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";

interface SpotifyWidgetProps {
  playlistUrl?: string | null;
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
}: SpotifyWidgetProps): React.JSX.Element {
  const { t } = useTranslation();
  const embedUrl = getSpotifyEmbedUrl(playlistUrl);

  return (
    <WidgetCard
      title={t("projects.spotify.title", "Referencje do odsłuchu")}
      icon={<Music size={15} aria-hidden="true" />}
      bodyClassName="gap-3"
    >
      {embedUrl ? (
        <>
          <iframe
            src={embedUrl}
            title={t("projects.spotify.iframe_title", "Playlista Spotify")}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            style={{ minHeight: "152px", border: "none", background: "transparent" }}
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
        </>
      ) : (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ethereal-ink/8 bg-ethereal-alabaster/45 text-center">
          <Music
            size={26}
            className="text-ethereal-incense/30"
            aria-hidden="true"
          />
          <Text color="muted" className="italic">
            {t("projects.spotify.empty", "Brak przypisanej playlisty.")}
          </Text>
        </div>
      )}
    </WidgetCard>
  );
}
