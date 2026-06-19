/**
 * @file SpotifyWidget.tsx
 * @description Spotify reference player — RODO/GDPR-aware. The third-party embed
 * (which sets Spotify cookies and phones home) is NEVER loaded until the user
 * explicitly consents; a link-out to open the playlist in Spotify is always
 * available without loading anything. Consent is remembered (localStorage) so
 * the choice is asked once. Wrapped in the shared WidgetCard.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/SpotifyWidget
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Music, ExternalLink, PlayCircle, ShieldCheck } from "lucide-react";

import { WidgetCard } from "@/shared/ui/composites/WidgetCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import {
  setSpotifyConsent,
  useSpotifyConsent,
} from "@/shared/lib/consent/spotifyConsent";

interface SpotifyWidgetProps {
  playlistUrl?: string | null;
}

const normalizeUrl = (url?: string | null): string | null => {
  if (!url) return null;
  return url.startsWith("http") ? url : `https://${url}`;
};

const getSpotifyEmbedUrl = (url?: string | null): string | null => {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return null;

  try {
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
  const externalUrl = normalizeUrl(playlistUrl);
  // Shared, revocable consent — withdrawing it in Settings → Privacy flips this
  // back to the gate live (RODO art. 7 ust. 3).
  const consented = useSpotifyConsent();

  return (
    <WidgetCard
      title={t("projects.spotify.title", "Referencje do odsłuchu")}
      icon={<Music size={15} aria-hidden="true" />}
      bodyClassName="gap-3"
    >
      {!embedUrl ? (
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
      ) : consented ? (
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
          {externalUrl && (
            <Button asChild variant="secondary" fullWidth>
              <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} aria-hidden="true" />
                {t("projects.spotify.open_app", "Otwórz w aplikacji")}
              </a>
            </Button>
          )}
        </>
      ) : (
        // RODO consent gate — nothing reaches Spotify until the user acts.
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-ethereal-ink/10 bg-ethereal-alabaster/50 p-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck
              size={18}
              className="mt-0.5 shrink-0 text-ethereal-incense/60"
              aria-hidden="true"
            />
            <Text size="sm" color="muted">
              {t(
                "projects.spotify.consent_note",
                "Wbudowany odtwarzacz łączy się z serwerami Spotify (pliki cookie i dane). Załaduje się dopiero po Twojej zgodzie.",
              )}
            </Text>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="primary"
              size="touch"
              onClick={() => setSpotifyConsent(true)}
              leftIcon={<PlayCircle size={14} aria-hidden="true" />}
              className="sm:flex-1"
            >
              {t("projects.spotify.load_player", "Załaduj odtwarzacz")}
            </Button>
            {externalUrl && (
              <Button asChild variant="outline" size="touch" className="sm:flex-1">
                <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} aria-hidden="true" />
                  {t("projects.spotify.open_external", "Otwórz w Spotify")}
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
