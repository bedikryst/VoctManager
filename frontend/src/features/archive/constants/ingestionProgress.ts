/**
 * @file ingestionProgress.ts
 * @description Maps the backend's fine-grained ingestion step
 * (`ScoreEdition.ingestion_progress`) to a live, human-facing label — the
 * "what is the AI doing right now?" line shown while a freshly uploaded PDF is
 * processed. Each label is an i18n key with a Polish default.
 *
 * Steps are named impersonally ("Zapis wyników"), with no trailing ellipsis:
 * the spinner beside them already says the work is running. The live sections
 * are nouns, because they join the facts line after the title and composer.
 * @module features/archive/constants/ingestionProgress
 */

import type { TFunction } from "i18next";

import type {
  IngestionProgressCode,
  IngestionStatusCode,
  LiveAnalysisPreview,
} from "@/shared/types";

const PROGRESS_LABEL: Record<
  Exclude<IngestionProgressCode, "">,
  { readonly key: string; readonly pl: string }
> = {
  preparing: { key: "archive.progress.preparing", pl: "Przygotowanie dokumentu" },
  analyzing: {
    key: "archive.progress.analyzing",
    pl: "Odczyt partytury: tytuł, części, tekst, IPA, tłumaczenia",
  },
  resolving: {
    key: "archive.progress.resolving",
    pl: "Wyszukiwanie w MusicBrainz i Wikidata",
  },
  persisting: {
    key: "archive.progress.persisting",
    pl: "Zapis wyników",
  },
  program_note: {
    key: "archive.progress.program_note",
    pl: "Pisanie notki programowej",
  },
  recordings: {
    key: "archive.progress.recordings",
    pl: "Wyszukiwanie nagrań w Spotify i YouTube",
  },
  waiting_overload: {
    key: "archive.progress.waiting_overload",
    pl: "Usługa AI jest przeciążona. Ponowienie za chwilę",
  },
};

/** True while the pipeline is waiting out an AI-service overload (529). The UI
 *  shows this distinctly so a long, legitimate pause never looks like a freeze. */
export const isOverloadWait = (progress?: IngestionProgressCode): boolean =>
  progress === "waiting_overload";

const LIVE_SECTION_LABEL: Record<
  LiveAnalysisPreview["section"],
  { readonly key: string; readonly pl: string }
> = {
  identity: {
    key: "archive.progress.live_identity",
    pl: "strona tytułowa",
  },
  movements: {
    key: "archive.progress.live_movements",
    pl: "podział na części",
  },
  sung_text: {
    key: "archive.progress.live_sung_text",
    pl: "tekst spod nut",
  },
  ipa: {
    key: "archive.progress.live_ipa",
    pl: "wymowa (IPA)",
  },
  translations: {
    key: "archive.progress.live_translations",
    pl: "tłumaczenia",
  },
};

/**
 * The materialising-record line for the `analyzing` step: what the model has
 * already read (title, composer, movement count) plus the section it is
 * writing right now — streamed live from the analysis call. Returns null when
 * no preview is available, so callers can fall back to {@link liveIngestionLabel}.
 */
export const liveAnalysisDetail = (
  t: TFunction,
  preview: LiveAnalysisPreview | null | undefined,
): string | null => {
  if (!preview) return null;
  const section = LIVE_SECTION_LABEL[preview.section];
  if (!section) return null;
  const parts: string[] = [];
  if (preview.title) parts.push(`„${preview.title}”`);
  if (preview.composer) parts.push(preview.composer);
  if (preview.section !== "identity" && (preview.movements ?? 0) > 1) {
    parts.push(
      t("archive.progress.live_movement_count", "{{count}} części", {
        count: preview.movements,
      }),
    );
  }
  parts.push(t(section.key, section.pl));
  return parts.join(" · ");
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
      return t("archive.progress.queued", "W kolejce");
    case "EXTR":
      return t(PROGRESS_LABEL.preparing.key, PROGRESS_LABEL.preparing.pl);
    case "ENRI":
      return t(PROGRESS_LABEL.resolving.key, PROGRESS_LABEL.resolving.pl);
    case "GENR":
      return t(PROGRESS_LABEL.analyzing.key, PROGRESS_LABEL.analyzing.pl);
    default:
      return t("archive.progress.working", "W toku");
  }
};
