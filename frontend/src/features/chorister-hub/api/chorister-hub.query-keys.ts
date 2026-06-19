// chorister-hub/api/chorister-hub.query-keys.ts

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
} as const;
