/**
 * @file ingestionProgress.ts
 * @description Maps the backend's fine-grained ingestion step
 * (`ScoreEdition.ingestion_progress`) to a live, human-facing label — the
 * "what is the AI doing right now?" line shown while a freshly uploaded PDF is
 * processed. Mirrors the i18n-key + Polish-default pattern used across the
 * Archive UI (e.g. EditionStatusBadge), so the copy is localizable but reads in
 * Polish by default.
 * @module features/archive/constants/ingestionProgress
 */

import type { TFunction } from "i18next";

import type { IngestionProgressCode, IngestionStatusCode } from "@/shared/types";

const PROGRESS_LABEL: Record<
  Exclude<IngestionProgressCode, "">,
  { readonly key: string; readonly pl: string }
> = {
  extracting: { key: "archive.progress.extracting", pl: "Czytam PDF…" },
  identifying: {
    key: "archive.progress.identifying",
    pl: "Rozpoznaję tytuł i kompozytora…",
  },
  resolving: {
    key: "archive.progress.resolving",
    pl: "Szukam w MusicBrainz i Wikidata…",
  },
  movements: {
    key: "archive.progress.movements",
    pl: "Wykrywam części utworu…",
  },
  lyrics: {
    key: "archive.progress.lyrics",
    pl: "Wyciągam tekst, IPA i tłumaczenia…",
  },
  program_note: {
    key: "archive.progress.program_note",
    pl: "Piszę notkę programową…",
  },
  recordings: {
    key: "archive.progress.recordings",
    pl: "Szukam nagrań (Spotify, YouTube)…",
  },
};

/**
 * Best live label for an in-progress edition. Prefers the fine-grained step;
 * falls back to a coarse, phase-based message for the brief window before the
 * first step is stamped (just-dispatched PEND) or if a step is ever absent.
 */
export const liveIngestionLabel = (
  t: TFunction,
  status: IngestionStatusCode,
  progress?: IngestionProgressCode,
): string => {
  if (progress && progress in PROGRESS_LABEL) {
    const entry = PROGRESS_LABEL[progress as Exclude<IngestionProgressCode, "">];
    return t(entry.key, entry.pl);
  }
  switch (status) {
    case "PEND":
      return t("archive.progress.queued", "W kolejce…");
    case "EXTR":
      return t("archive.progress.extracting", "Czytam PDF…");
    case "ENRI":
      return t("archive.progress.resolving", "Szukam w MusicBrainz i Wikidata…");
    case "GENR":
      return t("archive.progress.generating", "Generuję materiały…");
    default:
      return t("archive.progress.working", "Pracuję…");
  }
};
