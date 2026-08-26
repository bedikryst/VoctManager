/**
 * @file annotations.prefetch.ts
 * @description Pulls a concert's markings down with the rest of the concert.
 *
 * "Pobierz na offline" caches audio and score PDFs through the service worker,
 * but the marks are JSON on a different path — so a singer who downloaded a
 * programme and never happened to OPEN a given piece online arrived at rehearsal
 * with clean paper and no cue on it, which is the one thing the download was
 * supposed to prevent. Reading each edition's marks here fixes that, and the
 * read lands in two places at once: the query cache paints instantly from the
 * persister's snapshot, and the service worker keeps the response itself — which
 * is the half that is still there on the third day, once the snapshot has aged
 * out (`ANNOTATIONS_PATH` in `shared/offline/swProtocol`).
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
            // The trip to the network IS the download. `prefetchQuery` honours
            // the client's five-minute default, so a score the singer happened
            // to open just before tapping "download" would be considered fresh,
            // the request skipped — and the copy the worker keeps on disk never
            // written. A deliberate act must not depend on cache luck.
            staleTime: 0,
          })
          .catch(() => {}),
      ),
    );
  }
};
