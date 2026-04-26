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
} as const;
