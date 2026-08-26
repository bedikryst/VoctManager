/**
 * @file IncomingMarksNotice.tsx
 * @description One line, low on the page, saying the conductor just wrote
 * something — and which page it is on.
 *
 * The mark itself is already drawn; this is not a permission slip. It exists
 * because a singer on page two has no way of noticing a cue that landed on page
 * five, and because a rehearsal is the worst possible moment for a dialog. So:
 * no backdrop, no focus steal, nothing to answer, and it retires on its own.
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

interface IncomingMarksNoticeProps {
  /** 0 keeps the notice off screen entirely. */
  count: number;
  page: number;
  /** The concert binder floats its programme bar on this same centre line. */
  lifted?: boolean;
  onGoToPage: () => void;
  onDismiss: () => void;
}

export const IncomingMarksNotice = ({
  count,
  page,
  lifted = false,
  onGoToPage,
  onDismiss,
}: IncomingMarksNoticeProps): React.JSX.Element => {
  const { t } = useTranslation();

  useEffect(() => {
    if (count === 0) return;
    const timer = window.setTimeout(onDismiss, LINGER_MS);
    return () => window.clearTimeout(timer);
    // `page` is in the deps so a second arrival restarts the clock rather than
    // inheriting the tail of the first one's.
  }, [count, page, onDismiss]);

  return (
    // Lifted clear of the viewer's own transient chip (bottom-8, z-30), which
    // occupies the same centre line and would otherwise land on top of this —
    // and clear of the programme bar too, wherever that is on screen.
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center",
        lifted ? "pb-40 sm:pb-44" : "pb-20",
      )}
    >
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            role="status"
            className="pointer-events-auto flex items-center gap-1 rounded-full border border-ethereal-gold/40 bg-ethereal-ink/85 py-1.5 pl-3.5 pr-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <PencilLine
              size={15}
              aria-hidden="true"
              className="shrink-0 text-ethereal-gold"
            />
            <button
              type="button"
              onClick={onGoToPage}
              className="rounded-full px-1.5 py-1 transition-colors hover:bg-white/10"
            >
              {/* Counted, so the key carries every Polish plural form — there is
                  no honest single wording for "1 oznaczenie" and "5 oznaczeń". */}
              <Text as="span" size="sm" color="marble" className="leading-none">
                {t("annotations.incoming.line", { count, page })}
              </Text>
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t("common.close_aria", "Zamknij")}
              className="rounded-full p-1.5 text-ethereal-marble/60 transition-colors hover:bg-white/10 hover:text-ethereal-marble"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
