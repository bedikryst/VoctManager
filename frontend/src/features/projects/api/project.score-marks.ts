/**
 * @file project.score-marks.ts
 * @description Which copy of the concert binder leaves the app, decided once
 * and used for everything that names it: the bytes shown in a preview, the
 * bytes downloaded, the file's name and the viewer's cache key. The stored book
 * is clean, because the stand draws every layer live over it; a copy carries
 * the layers asked for by name, composed by the server for that download.
 *
 * Two surfaces choose a copy. The cockpit picks by audience — the choir's copy,
 * the clean book, the conductor's desk copy, the rehearsal leader's — and the
 * full document viewer lets a reader switch each layer they may have on or off.
 * Both resolve to one list of layers, and that list is the only thing the
 * fetcher, the file name and the doc key ever read.
 *
 * The selection is per-viewer state, never a saved preference. Previewing a
 * different copy must not change what singers receive: only the book's own
 * `include_markings` switch does that.
 * @module features/projects/api
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";

import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";

import { projectKeys } from "./project.query-keys";
import {
  ProjectService,
  type ScoreMarkLayer,
  type ScoreMarksAvailability,
  type ScorePackageBookMarks,
} from "./project.service";

/**
 * The choir's copy while the book hands its marks out. A surface that knows
 * nothing of the switch may still ask for it: the server leaves the layer out
 * of a singer's copy while the switch is off, so asking never overrules it.
 */
export const BOOK_COPY_LAYERS: readonly ScoreMarkLayer[] = ["shared"];

/** Print order of the layers, and the order the viewer offers them in. */
const LAYER_ORDER: readonly ScoreMarkLayer[] = [
  "shared",
  "leader",
  "conductor",
  "personal",
];

const orderLayers = (layers: Iterable<ScoreMarkLayer>): ScoreMarkLayer[] => {
  const wanted = new Set(layers);
  return LAYER_ORDER.filter((layer) => wanted.has(layer));
};

/** Who a cockpit copy is for. */
export type BookCopyAudience = "choir" | "clean" | "conductor" | "leader";

/**
 * The layers a cockpit copy asks for. The choir's copy follows the switch
 * exactly — it is a preview of what singers get, so it never carries a layer
 * they do not. The desk and stand-in copies carry the choir layer whatever the
 * switch says: they are the manager's own, and the server serves him that
 * layer regardless. A book with the choir layer already in its pages is never
 * given it again.
 */
export const bookCopyLayers = (
  audience: BookCopyAudience,
  includeMarkings: boolean,
  bookMarks: ScorePackageBookMarks,
): ScoreMarkLayer[] => {
  const shared: ScoreMarkLayer[] =
    bookMarks.legacy_ink || (bookMarks.layers.shared?.marks ?? 0) === 0
      ? []
      : ["shared"];
  switch (audience) {
    case "clean":
      return [];
    case "choir":
      return includeMarkings ? shared : [];
    case "conductor":
      return [...shared, "conductor"];
    case "leader":
      return [...shared, "leader"];
  }
};

/**
 * The cockpit audiences worth offering for this stored book. A copy identical
 * to another is not a choice: no clean copy exists of a book with baked ink,
 * none at all of a hand-uploaded one, and the desk and stand-in copies appear
 * only where their own layer has something on the book.
 */
export const bookCopyAudiences = (
  bookMarks: ScorePackageBookMarks,
): BookCopyAudience[] => {
  if (!bookMarks.map_available) return ["choir"];
  const audiences: BookCopyAudience[] = ["choir"];
  if (!bookMarks.legacy_ink) audiences.push("clean");
  if ((bookMarks.layers.conductor?.marks ?? 0) > 0) audiences.push("conductor");
  if ((bookMarks.layers.leader?.marks ?? 0) > 0) audiences.push("leader");
  return audiences;
};

/**
 * The downloaded file's name. The choir's copy and the clean book carry the
 * plain title; a copy with a layer meant for one role or one reader says so,
 * because once it sits in a downloads folder nothing else tells it apart.
 */
export const bookCopyFileName = (
  stem: string,
  layers: readonly ScoreMarkLayer[],
  t: TFunction,
): string => {
  const suffix = layers.includes("conductor")
    ? t("projects.score_copy.suffix.conductor", "dyrygencka")
    : layers.includes("leader")
      ? t("projects.score_copy.suffix.leader", "prowadzacy")
      : layers.includes("personal")
        ? t("projects.score_copy.suffix.personal", "moje_oznaczenia")
        : "";
  return `${stem}${suffix ? `_${suffix}` : ""}.pdf`;
};

/**
 * Appended to a viewer's `docKey`. Each selection is different bytes under the
 * same URL, so without it a viewer would keep showing the copy it cached
 * before the selection changed.
 */
export const bookCopyKeySuffix = (layers: readonly ScoreMarkLayer[]): string =>
  layers.length ? `-${orderLayers(layers).join("+")}` : "-clean";

/** A layer the full viewer offers as a switch. */
export interface BookCopyLayerOption {
  layer: ScoreMarkLayer;
  count: number;
}

export interface BookCopyControl {
  /** Layers with something on this book that this reader may switch. */
  options: readonly BookCopyLayerOption[];
  /** The resolved selection: the one list every consumer reads. */
  layers: readonly ScoreMarkLayer[];
  toggle: (layer: ScoreMarkLayer) => void;
  fetchBlob: () => Promise<Blob>;
  docKeySuffix: string;
  /** The book has the choir layer in its pages; it cannot be switched off. */
  legacyInk: boolean;
  /**
   * The census has answered (or failed). Until then the starting copy is not
   * known, and fetching would download the clean book only to replace it.
   */
  ready: boolean;
}

const EMPTY_AVAILABILITY: ScoreMarksAvailability = {
  available: false,
  count: 0,
  map_available: false,
  legacy_ink: false,
  include_markings: false,
  layers: {},
};

/**
 * The full viewer's copy: every layer this reader may have, each a switch. The
 * choir layer starts on exactly when singers receive it, so the first thing a
 * reader sees is the copy the choir gets; everything else starts off.
 */
export const useBookCopy = (
  projectId: string | number | null | undefined,
  enabled = true,
): BookCopyControl => {
  const id = projectId == null ? "" : String(projectId);
  // Only the reader's departures from the default are held, so a census that
  // arrives after the first render still sets the starting copy.
  const [overrides, setOverrides] = useState<
    Partial<Record<ScoreMarkLayer, boolean>>
  >({});

  const { data = EMPTY_AVAILABILITY, isFetched } = useQuery({
    queryKey: projectKeys.scorePackage.myMarks(id),
    queryFn: () => ProjectService.getScoreMarksAvailability(id),
    enabled: Boolean(id) && enabled,
    ...RECONCILING_REFETCH,
  });

  const options = useMemo<BookCopyLayerOption[]>(
    () =>
      LAYER_ORDER.flatMap((layer) => {
        const entry = data.layers[layer];
        return entry && entry.servable && entry.count > 0
          ? [{ layer, count: entry.count }]
          : [];
      }),
    [data.layers],
  );

  const layers = useMemo<ScoreMarkLayer[]>(
    () =>
      options
        .filter(({ layer }) => {
          const fallback = layer === "shared" && data.include_markings;
          return overrides[layer] ?? fallback;
        })
        .map(({ layer }) => layer),
    [options, overrides, data.include_markings],
  );

  const toggle = useCallback(
    (layer: ScoreMarkLayer) =>
      setOverrides((current) => ({
        ...current,
        [layer]: !layers.includes(layer),
      })),
    [layers],
  );

  const fetchBlob = useCallback(
    () => ProjectService.fetchScorePdfBlob(id, layers),
    [id, layers],
  );

  return useMemo(
    () => ({
      options,
      layers,
      toggle,
      fetchBlob,
      docKeySuffix: bookCopyKeySuffix(layers),
      legacyInk: data.legacy_ink,
      ready: isFetched,
    }),
    [options, layers, toggle, fetchBlob, data.legacy_ink, isFetched],
  );
};
