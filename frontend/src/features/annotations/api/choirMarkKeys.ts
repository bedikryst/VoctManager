/**
 * @file choirMarkKeys.ts
 * @description Query keys for "Powiadom chór" and "Odłóż uwagi", apart from the
 * hooks that use them because the per-mark writes invalidate them too. Outside
 * `annotationKeys.all` on purpose: the offline queue's reconcile and the
 * fingerprint poll's "writing" guard must not count them.
 * @module features/annotations/api
 */

export const choirMarkKeys = {
  news: ["marksNews"] as const,
  newsFor: (projectId: string) => [...choirMarkKeys.news, projectId] as const,
  setAside: (editionId: string) => ["marksSetAside", editionId] as const,
};
