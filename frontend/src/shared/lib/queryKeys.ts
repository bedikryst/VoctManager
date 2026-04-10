/**
 * @file queryKeys.ts
 * @description Centralized query key factory for React Query.
 * @architecture Enterprise SaaS 2026
 * Prevents magic strings, removes duplication, and keeps cache synchronization consistent
 * across isolated feature domains.
 */

export const queryKeys = {
  // --- PEOPLE AND ROSTER ---
  artists: {
    all: ["artists"] as const,
    details: (id: string | number) => ["artists", String(id)] as const,
  },
  collaborators: {
    all: ["collaborators"] as const,
    details: (id: string | number) => ["collaborators", String(id)] as const,
  },
  options: {
    voiceTypes: ["voiceTypes"] as const,
    voiceLines: ["voiceLines"] as const,
  },

  // --- PROJECTS AND LOGISTICS ---
  projects: {
    all: ["projects"] as const,
    active: ["projects", { status: "ACTIVE" }] as const,
    details: (id: string | number) => ["projects", String(id)] as const,
  },
  participations: {
    all: ["participations"] as const,
    byProject: (projectId: string | number) =>
      ["participations", { project: String(projectId) }] as const,
    byArtist: (artistId: string | number) =>
      ["participations", { artist: String(artistId) }] as const,
  },
  crewAssignments: {
    all: ["crewAssignments"] as const,
    byProject: (projectId: string | number) =>
      ["crewAssignments", { project: String(projectId) }] as const,
  },
  program: {
    all: ["program"] as const,
    byProject: (projectId: string | number) =>
      ["program", { project: String(projectId) }] as const,
  },
  pieceCastings: {
    all: ["pieceCastings"] as const,
    byProject: (projectId: string | number) =>
      ["pieceCastings", { project: String(projectId) }] as const,
    byProjectPiece: (projectId: string | number, pieceId: string | number) =>
      [
        "pieceCastings",
        { project: String(projectId), piece: String(pieceId) },
      ] as const,
  },

  // --- REHEARSALS AND ATTENDANCE ---
  rehearsals: {
    all: ["rehearsals"] as const,
    byProject: (projectId: string | number) =>
      ["rehearsals", { project: String(projectId) }] as const,
    byArtist: (artistId: string | number) =>
      ["rehearsals", { artist: String(artistId) }] as const,
  },
  attendances: {
    all: ["attendances"] as const,
    byRehearsal: (rehearsalId: string | number) =>
      ["attendances", { rehearsal: String(rehearsalId) }] as const,
    byArtist: (artistId: string | number) =>
      ["attendances", { artist: String(artistId) }] as const,
    byProject: (projectId: string | number) =>
      ["attendances", { project: String(projectId) }] as const,
  },

  // --- USER PREFERENCES & SETTINGS ---
  settings: {
    data: ["settings-data"] as const,
  },

  // --- ARCHIVE AND MUSIC LIBRARY ---
  pieces: {
    all: ["pieces"] as const,
    details: (id: string | number) => ["pieces", String(id)] as const,
  },
  composers: {
    all: ["composers"] as const,
    details: (id: string | number) => ["composers", String(id)] as const,
  },
  tracks: {
    all: ["tracks"] as const,
    byPiece: (pieceId: string | number) =>
      ["tracks", { piece: String(pieceId) }] as const,
  },
};
