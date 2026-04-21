/**
 * @file project.query-keys.ts
 * @description Stable React Query cache keys for the Project feature.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

export const projectKeys = {
  dictionaries: {
    artists: ["artists"] as const,
    pieces: ["pieces"] as const,
    collaborators: ["collaborators"] as const,
    voiceLines: ["options", "voiceLines"] as const,
  },
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
  rehearsals: {
    all: ["rehearsals"] as const,
    byProject: (projectId: string | number) =>
      ["rehearsals", { project: String(projectId) }] as const,
  },
  attendances: {
    all: ["attendances"] as const,
    byProject: (projectId: string | number) =>
      ["attendances", { project: String(projectId) }] as const,
  },
};
