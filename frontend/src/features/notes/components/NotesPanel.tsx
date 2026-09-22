/**
 * @file NotesPanel.tsx
 * @description The panel body composed into both surfaces (the desktop rail
 * and the mobile bottom sheet) — one component, two anchorings. Ordering
 * (open notes first, then newest) is the server's `Meta.ordering` on `Note`;
 * this never re-sorts, only partitions the already-correct order into open
 * vs completed for the disclosure below.
 * @module features/notes/components
 * @architecture Enterprise SaaS 2026
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, CloudOff } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Eyebrow } from "@/shared/ui/primitives/typography";
import { useNotes } from "../api/notes.queries";
import { NoteComposer } from "./NoteComposer";
import { NoteRow } from "./NoteRow";
import { NotesEmptyState } from "./NotesEmptyState";

export const NotesPanel = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useNotes();
  const [showCompleted, setShowCompleted] = useState(false);

  const notes = data ?? [];
  const openNotes = notes.filter((note) => !note.is_done);
  const doneNotes = notes.filter((note) => note.is_done);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <NoteComposer />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <EtherealLoader fullHeight={false} />
        ) : isError && notes.length === 0 ? (
          /* A failed read must never render as an empty notepad: "nothing here"
             is a statement about the reader's own notes, and a scratchpad that
             says it once stops being trusted with anything. No retry button —
             `RECONCILING_REFETCH` re-reads on focus, reconnect and next mount. */
          <StatePanel
            icon={<CloudOff size={22} strokeWidth={1.5} aria-hidden="true" />}
            title={t("notes.error.title", "Nie udało się wczytać notatek")}
            description={t(
              "notes.error.description",
              "Twoje wpisy są bezpieczne. Spróbujemy ponownie, gdy wróci połączenie.",
            )}
            tone="danger"
            variant="inline"
            align="left"
          />
        ) : notes.length === 0 ? (
          <NotesEmptyState />
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              {openNotes.map((note) => (
                <NoteRow key={note.id} note={note} />
              ))}
            </div>

            {doneNotes.length > 0 && (
              <div className="mt-3 border-t border-ethereal-incense/10 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompleted((previous) => !previous)}
                  aria-expanded={showCompleted}
                  className="flex w-full items-center gap-1.5 rounded-chip px-2 py-1.5 text-left transition-colors hover:bg-ethereal-ink/[0.03]"
                >
                  <ChevronDown
                    size={13}
                    strokeWidth={2.5}
                    aria-hidden="true"
                    className={cn(
                      "text-ethereal-graphite/50 transition-transform duration-200",
                      showCompleted && "rotate-180",
                    )}
                  />
                  <Eyebrow color="muted">
                    {t("notes.completed.toggle", {
                      count: doneNotes.length,
                      defaultValue: "Ukończone ({{count}})",
                    })}
                  </Eyebrow>
                </button>

                {showCompleted && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {doneNotes.map((note) => (
                      <NoteRow key={note.id} note={note} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
