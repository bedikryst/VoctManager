// chorister-hub/api/chorister-hub.query-keys.ts

import { previewQueryKey } from '@/shared/api/queryPolicy';

export const choristerHubKeys = {
  categories: {
    all: ['chorister-hub', 'categories'] as const,
    list: () => [...choristerHubKeys.categories.all, 'list'] as const,
  },
  artistMetrics: {
    all: ['chorister-hub', 'artist-metrics'] as const,
    mine: () => [...choristerHubKeys.artistMetrics.all, 'mine'] as const,
  },
  myEnsemble: {
    all: ['chorister-hub', 'my-ensemble'] as const,
    // 'v2' tags the concert-scoped response schema; it orphans any persisted
    // cache from the earlier section-directory shape so it can't rehydrate stale.
    mine: () => [...choristerHubKeys.myEnsemble.all, 'mine', 'v2'] as const,
  },
  /**
   * A manager reading a member's card. Rooted apart from everything above,
   * because `mine()` means "the caller" everywhere else in this file and a
   * preview would quietly redefine that word for the surfaces sharing the key.
   */
  preview: {
    categories: (artistId: string) => previewQueryKey('documents', 'categories', artistId),
    artistMetrics: (artistId: string) => previewQueryKey('documents', 'artist-metrics', artistId),
    myEnsemble: (artistId: string) => previewQueryKey('documents', 'my-ensemble', 'v2', artistId),
  },
} as const;
