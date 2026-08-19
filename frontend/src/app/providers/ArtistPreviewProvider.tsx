/**
 * @file ArtistPreviewProvider.tsx
 * @description Names the member whose view the surrounding tree is rendering,
 * so the artist surfaces can be shown to a manager without being rebuilt.
 *
 * The whole preview is ONE composition: `/panel/artists/:id/preview` mounts the
 * real artist components, and this context is the only thing that differs. Two
 * consumers read it, and no third kind exists:
 *
 *  - the personal read-model hooks, which swap in their `["preview", …]` cache
 *    root and send `?artist=<id>` (see `shared/api/queryPolicy`);
 *  - the controls, which go inert.
 *
 * The controls matter more than they look. `?artist=` is honoured by GET
 * read-models alone, so a preview cannot produce a write *through the preview* —
 * but the manager is still signed in as themselves, and `AttendanceViewSet` lets
 * a manager set anybody's attendance. A live RSVP button inside Kasia's view
 * would therefore write Kasia's absence for real, with the manager's
 * credentials, from a screen whose entire promise is that it only looks.
 *
 * Outside a preview the context resolves to its default and every existing call
 * site behaves exactly as before — this is why the artist components need no
 * `isPreview` prop threaded through them.
 *
 * @module app/providers/ArtistPreviewProvider
 */

import React, { createContext, useContext, useMemo } from "react";

/** Who the preview is about — enough to identify them on their own surfaces. */
export interface PreviewArtistIdentity {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  voiceLabel: string | null;
}

export interface ArtistPreviewState {
  /** True only inside `/panel/artists/:id/preview`. */
  isPreview: boolean;
  /** The member being looked at; null outside a preview. */
  artist: PreviewArtistIdentity | null;
}

/**
 * Where the preview keeps its own state. The surface being shown and the piece
 * being read ride in the query string rather than in the path: the preview is
 * ONE route, and a nested route would remount the identity bar and the gate
 * query every time the manager opened a song.
 */
export const PREVIEW_TAB_PARAM = "tab";
export const PREVIEW_PROJECT_PARAM = "project";
export const PREVIEW_PIECE_PARAM = "piece";

/** The preview's songbook — where a previewed piece goes back to. */
export const previewSongbookPath = (artistId: string): string =>
  `/panel/artists/${artistId}/preview?${PREVIEW_TAB_PARAM}=materials`;

/**
 * One piece of somebody's songbook, read inside the preview. A row in a
 * member's songbook must never lead to `/panel/materials/…`: that is the
 * MANAGER's own copy of the same piece, with their casting, their guidelines
 * and their readiness on it.
 */
export const previewPiecePath = (
  artistId: string,
  projectId: string,
  pieceId: string,
): string =>
  `${previewSongbookPath(artistId)}` +
  `&${PREVIEW_PROJECT_PARAM}=${encodeURIComponent(projectId)}` +
  `&${PREVIEW_PIECE_PARAM}=${encodeURIComponent(pieceId)}`;

const RESTING_STATE: ArtistPreviewState = { isPreview: false, artist: null };

const ArtistPreviewContext = createContext<ArtistPreviewState>(RESTING_STATE);

/**
 * Whether this subtree is somebody else's view, and whose.
 *
 * Safe to call anywhere: with no provider above it answers "not a preview",
 * which is the truth on every artist's own screen.
 */
export const useArtistPreview = (): ArtistPreviewState =>
  useContext(ArtistPreviewContext);

interface ArtistPreviewProviderProps {
  artist: PreviewArtistIdentity;
  children: React.ReactNode;
}

export const ArtistPreviewProvider = ({
  artist,
  children,
}: ArtistPreviewProviderProps): React.JSX.Element => {
  const value = useMemo<ArtistPreviewState>(
    () => ({ isPreview: true, artist }),
    [artist],
  );

  return (
    <ArtistPreviewContext.Provider value={value}>
      {children}
    </ArtistPreviewContext.Provider>
  );
};
