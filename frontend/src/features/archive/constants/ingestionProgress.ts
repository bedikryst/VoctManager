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
  preparing: { key: "archive.progress.preparing", pl: "Przygotowuję dokument…" },
  analyzing: {
    key: "archive.progress.analyzing",
    pl: "Czytam partyturę (AI) — tytuł, części, tekst, IPA, tłumaczenia…",
  },
  resolving: {
    key: "archive.progress.resolving",
    pl: "Szukam w MusicBrainz i Wikidata…",
  },
  persisting: {
    key: "archive.progress.persisting",
    pl: "Zapisuję wyniki…",
  },
  program_note: {
    key: "archive.progress.program_note",
    pl: "Piszę notkę programową…",
  },
  recordings: {
    key: "archive.progress.recordings",
    pl: "Szukam nagrań (Spotify, YouTube)…",
  },
  waiting_overload: {
    key: "archive.progress.waiting_overload",
    pl: "Usługa AI jest przeciążona — ponawiam za chwilę…",
  },
};

/** True while the pipeline is waiting out an AI-service overload (529). The UI
 *  shows this distinctly so a long, legitimate pause never looks like a freeze. */
export const isOverloadWait = (progress?: IngestionProgressCode): boolean =>
  progress === "waiting_overload";

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
      return t("archive.progress.preparing", "Przygotowuję dokument…");
    case "ENRI":
      return t("archive.progress.resolving", "Szukam w MusicBrainz i Wikidata…");
    case "GENR":
      return t("archive.progress.analyzing", "Czytam partyturę (AI)…");
    default:
      return t("archive.progress.working", "Pracuję…");
  }
};
