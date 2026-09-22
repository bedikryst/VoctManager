/**
 * @file NotesPanel.tsx
 * @description The panel body composed into both surfaces (the desktop rail
 * and the mobile bottom sheet) — one component, two anchorings. Ordering
 * (open notes first, then newest) is the server's `Meta.ordering` on `Note`;
 * this never re-sorts, only partitions the already-correct order into open
 * vs completed for the disclosure below.
 *
 * Which row is open lives here rather than in the rows: one at a time, and any
 * click that reaches this element — the composer, the background, the gap
 * between two notes — folds it back to its two-line clamp. A row that has
 * something to say about a click stops it before it gets here.
 * @module features/notes/components
 * @architecture Enterprise SaaS 2026
 */

import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, CloudOff, Lock } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { useNotes } from "../api/notes.queries";
import { NoteComposer } from "./NoteComposer";
import { NoteRow } from "./NoteRow";
import { NotesEmptyState } from "./NotesEmptyState";

export const NotesPanel = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useNotes();
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const notes = data ?? [];
  const openNotes = notes.filter((note) => !note.is_done);
  const doneNotes = notes.filter((note) => note.is_done);

  const toggleExpanded = useCallback((id: string): void => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3"
      onClick={() => setExpandedId(null)}
    >
      <NoteComposer />

      {/* Stated in the panel body, not in the rail's header, so the phone gets
          it too — and visibly, not in a tooltip, since a touch device has no
          hover to reveal one. In a shell where every other surface shows the
          whole choir's data, "who else reads this" is the question a private
          scratchpad has to answer before anyone trusts it with the things it
          was built for. The claim is deliberately product-level: no manager and
          no superuser reads these through the API and `Note` is not registered
          in the admin — which is what "only you" can honestly mean. */}
      <div className="-mt-1 flex shrink-0 items-center gap-1.5 px-1 text-ethereal-graphite/45">
        <Lock size={11} strokeWidth={2} aria-hidden="true" />
        <Eyebrow color="inherit">
          {t("notes.privacy", "Widzisz tylko Ty")}
        </Eyebrow>
      </div>

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
                <NoteRow
                  key={note.id}
                  note={note}
                  isExpanded={expandedId === note.id}
                  onToggle={toggleExpanded}
                />
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
                    {/* Said here and nowhere else: this is the one spot where
                        "what happens to these" is a live question, and the
                        answer — a hard delete by `core.purge_completed_notes`,
                        no bin, no export — is the only thing about this feature
                        a reader cannot find out by using it until it has
                        already cost them. */}
                    <Text as="p" size="xs" color="muted" className="px-2 pb-1">
                      {t(
                        "notes.completed.retention",
                        "Po 30 dniach od odhaczenia znikają bezpowrotnie.",
                      )}
                    </Text>
                    {doneNotes.map((note) => (
                      <NoteRow
                        key={note.id}
                        note={note}
                        isExpanded={expandedId === note.id}
                        onToggle={toggleExpanded}
                      />
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
