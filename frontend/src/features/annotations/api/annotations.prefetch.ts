/**
 * @file annotations.prefetch.ts
 * @description Pulls a concert's markings down with the rest of the concert.
 *
 * "Pobierz na offline" caches audio and score PDFs through the service worker,
 * but the marks are JSON on a different path — so a singer who downloaded a
 * programme and never happened to OPEN a given piece online arrived at rehearsal
 * with clean paper and no cue on it, which is the one thing the download was
 * supposed to prevent. Warming the query cache fixes that: the persister
 * dehydrates it to localStorage, and the stand paints from there with no network.
 *
 * Deliberately forgiving — a piece whose marks fail to load must never fail the
 * concert's download; the score and the audio are the larger promise.
 * @module features/annotations/api
 */

import type { QueryClient } from "@tanstack/react-query";

import { AnnotationsService } from "./annotations.service";
import { annotationKeys } from "./annotations.queries";

/** Fetched a few at a time: a long programme should not open forty sockets. */
const BATCH_SIZE = 4;

export const prefetchEditionAnnotations = async (
  queryClient: QueryClient,
  editionIds: readonly string[],
): Promise<void> => {
  const unique = [...new Set(editionIds.filter(Boolean))];
  for (let index = 0; index < unique.length; index += BATCH_SIZE) {
    await Promise.all(
      unique.slice(index, index + BATCH_SIZE).map((editionId) =>
        queryClient
          .prefetchQuery({
            queryKey: annotationKeys.byEdition(editionId),
            queryFn: () => AnnotationsService.list(editionId),
          })
          .catch(() => {}),
      ),
    );
  }
};
