/**
 * @file ProjectScoreBook.tsx
 * @description One entrance to a concert's score book, wherever it is opened
 * from — the schedule hero, a timeline card, the songbook. Fetches the binder's
 * page map, streams the gated PDF and hands both to the stand.
 *
 * This exists so the three surfaces stop each wiring their own viewer: they were
 * already drifting (three titles, three doc keys), and every capability added to
 * the book would otherwise have to be added three times.
 *
 * The reader's marks are LIVE here — drawn, moved and erased on the page — so
 * the "compose my marks into the file" switch is deliberately absent: two ways
 * to see one set of marks, one of them uneditable, is a worse answer than one.
 * That switch belongs on the full document viewer, which is where a reader goes
 * for a copy to keep or to print.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components
 */

import React, { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import {
  buildScoreBook,
  EMPTY_SCORE_BOOK,
  ScoreBookModal,
  type ScoreBook,
} from "@/features/annotations";
import { RECONCILING_REFETCH } from "@/shared/api/queryPolicy";

import { projectKeys } from "../api/project.query-keys";
import { ProjectService } from "../api/project.service";

interface ProjectScoreBookProps {
  readonly projectId: string;
  readonly projectTitle: string;
  readonly isOpen: boolean;
  /**
   * Identity of the stored BYTES. A book regenerated under the same name is a
   * different document, so the caller passes whatever it knows moves with it
   * (`updated_at`, a build version). The map's own stamp supersedes it wherever
   * the server has one; this remains the fallback for a book with no package
   * row behind it.
   */
  readonly version?: string;
  /**
   * conductor → managers draw the shared/conductor layers; personal →
   * choristers write their own private pencil over the read-only shared marks.
   */
  readonly mode?: "conductor" | "personal";
  readonly onClose: () => void;
}

export const ProjectScoreBook = ({
  projectId,
  projectTitle,
  isOpen,
  version = "",
  mode = "personal",
  onClose,
}: ProjectScoreBookProps): React.JSX.Element => {
  const { t } = useTranslation();

  const { data, isPending } = useQuery({
    queryKey: projectKeys.scorePackage.map(projectId),
    queryFn: () => ProjectService.getScoreMap(projectId),
    // Only while the book is on screen: a songbook listing four concerts must
    // not fetch four page maps nobody asked to read.
    enabled: isOpen && !!projectId,
    // It describes a built file, but the titles beside it come from the live
    // programme — a piece renamed between two rehearsals has to read correctly
    // in the binder's own navigation.
    ...RECONCILING_REFETCH,
  });

  const book: ScoreBook = useMemo(
    () =>
      data?.available ? buildScoreBook(data.pages, data.items) : EMPTY_SCORE_BOOK,
    [data],
  );

  const title = t("score_book.title", "Książka nutowa");
  const fileName = `Score_${projectTitle.replace(/\s+/g, "_")}.pdf`;

  const stamp = data?.stamp ?? "";
  // The map answers first, and only then are the bytes asked for. Not an
  // ordering whim: the map carries the stamp that names the build, and a phone
  // with no signal can only find its stored copy of the book by that name. The
  // wait ends whether the map arrives or fails — an error just means an
  // unstamped request, which is the behaviour that existed before.
  const fetchBlob = useCallback(
    // The clean binder, never the server-composed one: the marks are drawn live
    // on top of it here, and asking for a copy with them baked in would print
    // every one of them twice.
    () => ProjectService.fetchScorePdfBlob(projectId, false, stamp),
    [projectId, stamp],
  );

  return (
    <ScoreBookModal
      isOpen={isOpen}
      book={book}
      fetchBlob={isPending ? null : fetchBlob}
      docKey={`score-book-${projectId}-${stamp || version}`}
      title={title}
      subtitle={projectTitle}
      fileName={fileName}
      mode={mode}
      fullView={{
        type: "project-score",
        id: projectId,
        hint: { title, subtitle: projectTitle, fileName },
      }}
      onClose={onClose}
    />
  );
};
