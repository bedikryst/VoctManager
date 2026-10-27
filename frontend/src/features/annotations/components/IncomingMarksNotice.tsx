/**
 * @file IncomingMarksNotice.tsx
 * @description One line, low on the page, saying what is new on the score — and
 * which pages it is on. On open it sums up what changed since the reader's last
 * visit; while the stand is open it announces marks as they arrive. It names no
 * author: a leader writing for the choir lands on the same layer as the
 * conductor.
 *
 * The marks themselves are already drawn; this is not a permission slip. It
 * exists because a singer on page two has no way of noticing a cue that landed
 * on page five, and because a rehearsal is the worst possible moment for a
 * dialog. So: no backdrop, no focus steal, nothing to answer, and it retires on
 * its own.
 *
 * What a screen reader hears comes from a live region that is mounted for as
 * long as the stand is, with only its words swapped. A region that mounts
 * together with its text is often skipped by VoiceOver, so the chip the eye
 * reads carries no role of its own; its text names its button.
 * @module features/annotations/components
 */

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PencilLine, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

/** Long enough to read mid-phrase, short enough to stop being furniture. */
const LINGER_MS = 9000;

/** Pages named in the line; the sidebar's "Nowe" list carries the rest. */
const MAX_PAGES_NAMED = 4;

interface IncomingMarksNoticeProps {
  /** 0 keeps the notice off screen entirely. */
  count: number;
  /** Pages the marks are on, ascending, as the reader sees them numbered. */
  pages: readonly number[];
  /** `since`: what changed while the reader was away. `live`: what just arrived. */
  kind: "since" | "live";
  /** The concert binder floats its programme bar on this same centre line. */
  lifted?: boolean;
  /** Goes to the first of `pages`. */
  onGoToPage: () => void;
  onDismiss: () => void;
}

export const IncomingMarksNotice = ({
  count,
  pages,
  kind,
  lifted = false,
  onGoToPage,
  onDismiss,
}: IncomingMarksNoticeProps): React.JSX.Element => {
  const { t } = useTranslation();
  const named = pages.slice(0, MAX_PAGES_NAMED).join(", ");
  const pageList = pages.length > MAX_PAGES_NAMED ? `${named}…` : named;
  // Counted, so the key carries every Polish plural form — there is no honest
  // single wording for "1 oznaczenie" and "5 oznaczeń".
  const message =
    kind === "since"
      ? t("annotations.incoming.since", { count, pages: pageList })
      : t("annotations.incoming.line", { count, page: pages[0] ?? 1 });

  useEffect(() => {
    if (count === 0) return;
    const timer = window.setTimeout(onDismiss, LINGER_MS);
    return () => window.clearTimeout(timer);
    // The pages and kind are in the deps so a second arrival restarts the clock
    // rather than inheriting the tail of the first one's.
  }, [count, pageList, kind, onDismiss]);

  return (
    // Lifted clear of the viewer's own transient chip (bottom-8, z-30), which
    // occupies the same centre line and would otherwise land on top of this —
    // and clear of the programme bar too, wherever that is on screen.
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4",
        lifted ? "pb-40 sm:pb-44" : "pb-20",
      )}
    >
      <Text as="span" role="status" className="sr-only">
        {count > 0 ? message : ""}
      </Text>
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            initial={{ opacity: 0, transform: "translateY(12px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(12px)" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex min-w-0 max-w-full items-center gap-1 rounded-full border border-ethereal-gold/40 bg-surface-inverse/85 py-1.5 pl-3.5 pr-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <PencilLine
              size={15}
              aria-hidden="true"
              className="shrink-0 text-ethereal-gold"
            />
            <button
              type="button"
              onClick={onGoToPage}
              className="min-w-0 rounded-full px-1.5 py-1 text-left transition-colors hover:bg-ink-on-inverse/10"
            >
              <Text as="span" size="sm" color="ink-on-inverse" className="leading-snug">
                {message}
              </Text>
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t("common.close_aria", "Zamknij")}
              className="shrink-0 rounded-full p-1.5 text-ink-on-inverse/60 transition-colors hover:bg-ink-on-inverse/10 hover:text-ink-on-inverse"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
