/**
 * @file project.query-keys.ts
 * @description Stable React Query cache keys for the Project feature.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/api
 */

import { DICTIONARY_VERSION } from "@/shared/api/options.queries";

export const projectKeys = {
  dictionaries: {
    artists: ["artists"] as const,
    pieces: ["pieces"] as const,
    collaborators: ["collaborators"] as const,
    /** Deliberately identical to `OPTIONS_QUERY_KEYS.voiceLines` — the board and
     *  the archive read the same endpoint and must share one cached copy. */
    voiceLines: (language: string) =>
      ["options", "voiceLines", DICTIONARY_VERSION, language] as const,
    /** Keyed by language on purpose: the vocabulary is served already
     *  translated and is then held for the session, so the language is the only
     *  thing that can make the cached copy wrong. */
    liturgicalSlots: (language: string) =>
      ["options", "liturgicalSlots", language] as const,
  },
  projects: {
    all: ["projects"] as const,
    active: ["projects", { status: "ACTIVE" }] as const,
    details: (id: string | number) => ["projects", String(id)] as const,
  },
  publication: {
    preview: (projectId: string | number) =>
      ["projects", String(projectId), "publication"] as const,
  },
  announcements: {
    /** The review sheet's preview. Keyed by the selection it describes — held
     *  lines and whether a note is present both change the counts, so a stale
     *  key would show a number the confirm button then contradicts. */
    review: (
      projectId: string | number,
      exclude: readonly string[] = [],
      hasNote = false,
    ) =>
      [
        "projects",
        String(projectId),
        "announcements",
        { exclude: [...exclude].sort().join(","), note: hasNote },
      ] as const,
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
  scorePackage: {
    byProject: (projectId: string | number) =>
      ["scorePackage", { project: String(projectId) }] as const,
    thumbnails: (
      projectId: string | number,
      itemId: string,
      editionId: string | null,
    ) =>
      [
        "scorePackage",
        "thumbnails",
        { project: String(projectId), item: itemId, edition: editionId ?? "auto" },
      ] as const,
  },
};
