/**
 * @file ArtistPreviewPage.tsx
 * @description "Co widzi Kasia" — a member's own four surfaces, rendered inside
 * the manager's session. Default export required for React.lazy route loading.
 *
 * The page owns almost nothing. It resolves who is being looked at, opens the
 * gate, and then hands the screen to the ARTIST components — `ArtistDashboard`,
 * `Schedule`, `Materials`, `ChoristerHubPage` — unchanged and unwrapped. That is
 * the whole design: a second composition would drift from the real one within a
 * sprint, and then the preview would answer for a screen that no longer exists.
 * What differs is `ArtistPreviewProvider`, which the read-model hooks and the
 * controls below read for themselves.
 *
 * Two of those surfaces bring their own layout: the Songbook normally sits under
 * `MaterialsLayout` (the practice player + docked mini-player), so the preview
 * mounts the provider itself — without it `usePracticePlayer` throws. The
 * mini-player is deliberately NOT mounted: a bar that keeps playing another
 * person's rehearsal tracks after the manager has left the preview is a docked
 * control with nobody's session behind it.
 *
 * Gate: one query — the schedule read-model with `?artist=` — decides whether
 * there is a view at all. Every one of the five endpoints passes through the
 * same `core/preview.py::resolve_preview_target`, so they refuse or admit
 * together; asking once and keying the answer the way the Pulpit keys it means
 * React Query serves the same request to both.
 *
 * @module features/artist-preview/ArtistPreviewPage
 */

import React, { Suspense, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookMarked, CalendarClock, LayoutDashboard, Music2 } from "lucide-react";

import {
  ArtistPreviewProvider,
  type PreviewArtistIdentity,
} from "@/app/providers/ArtistPreviewProvider";
import { artistKeys } from "@/features/artists/api/artist.queries";
import { ArtistService } from "@/features/artists/api/artist.service";
import { useScheduleDashboard } from "@/features/schedule/api/schedule.queries";
import { PracticePlayerProvider } from "@/features/materials/player/PracticePlayerProvider";

import ArtistDashboard from "@/features/dashboard/ArtistDashboard";
import Schedule from "@/features/schedule/Schedule";
import { Materials } from "@/features/materials/Materials";
import ChoristerHubPage from "@/features/chorister-hub/ChoristerHubPage";

import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";

import { PreviewIdentityBar } from "./components/PreviewIdentityBar";
import { PreviewRefusal } from "./components/PreviewRefusal";

type PreviewTab = "desk" | "schedule" | "materials" | "card";

export default function ArtistPreviewPage(): React.JSX.Element {
  const { artistId } = useParams<{ artistId: string }>();

  if (!artistId) return <Navigate to="/panel/artists" replace />;

  return <ArtistPreviewResolver artistId={artistId} />;
}

/**
 * Resolves the member before anything below can name them. The roster row is a
 * manager-side read the panel already caches, and it carries the one thing the
 * artist read-models never send about their own reader: a name and a face to put
 * at the top of somebody else's screen.
 */
const ArtistPreviewResolver = ({
  artistId,
}: {
  artistId: string;
}): React.JSX.Element => {
  const { t } = useTranslation();

  const {
    data: artist,
    isLoading,
    error,
  } = useQuery({
    queryKey: artistKeys.artists.details(artistId),
    queryFn: () => ArtistService.getById(artistId),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const identity = useMemo<PreviewArtistIdentity | null>(() => {
    if (!artist) return null;
    const fullName = `${artist.first_name} ${artist.last_name}`.trim();
    return {
      id: String(artist.id),
      firstName: artist.first_name,
      lastName: artist.last_name,
      fullName,
      avatarUrl: artist.avatar_thumb_url ?? null,
      voiceLabel: artist.voice_type_display ?? null,
    };
  }, [artist]);

  if (isLoading) {
    return (
      <EtherealLoader
        message={t("artist_preview.loading", "Otwieram widok chórzysty...")}
      />
    );
  }

  if (error || !identity) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-3xl pb-6 pt-6">
          <PreviewRefusal error={error} />
        </div>
      </PageTransition>
    );
  }

  return (
    <ArtistPreviewProvider artist={identity}>
      <ArtistPreviewShell artist={identity} />
    </ArtistPreviewProvider>
  );
};

const ArtistPreviewShell = ({
  artist,
}: {
  artist: PreviewArtistIdentity;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<PreviewTab>("desk");

  // The gate. Its key and its query function are the Pulpit's own, so this is
  // not a second request — it is the first one, asked early enough to answer
  // "is there a view here at all" before four surfaces try to draw one.
  const { isLoading, error } = useScheduleDashboard(artist.id);

  const tabs = useMemo(
    () => [
      {
        id: "desk" as const,
        label: t("artist_preview.tabs.desk", "Pulpit"),
        Icon: LayoutDashboard,
      },
      {
        id: "schedule" as const,
        label: t("artist_preview.tabs.schedule", "Harmonogram"),
        Icon: CalendarClock,
      },
      {
        id: "materials" as const,
        label: t("artist_preview.tabs.materials", "Materiały"),
        Icon: Music2,
      },
      {
        id: "card" as const,
        label: t("artist_preview.tabs.card", "Kartoteka"),
        Icon: BookMarked,
      },
    ],
    [t],
  );

  return (
    <PageTransition>
      <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-6 pt-6">
        <PreviewIdentityBar artist={artist} />

        {error ? (
          <PreviewRefusal error={error} />
        ) : isLoading ? (
          <EtherealLoader
            fullHeight={false}
            message={t("artist_preview.loading", "Otwieram widok chórzysty...")}
          />
        ) : (
          <>
            <SegmentedTabs
              ariaLabel={t(
                "artist_preview.tabs.aria_label",
                "Powierzchnie chórzysty",
              )}
              items={tabs}
              value={tab}
              onChange={setTab}
            />

            {/* The artist surfaces, verbatim. Each brings its own page
                transition and its own gutter; the shell adds neither. */}
            <Suspense fallback={<EtherealLoader fullHeight={false} />}>
              {tab === "desk" && <ArtistDashboard />}
              {tab === "schedule" && <Schedule />}
              {tab === "materials" && (
                <PracticePlayerProvider>
                  <Materials />
                </PracticePlayerProvider>
              )}
              {tab === "card" && <ChoristerHubPage />}
            </Suspense>
          </>
        )}
      </div>
    </PageTransition>
  );
};
