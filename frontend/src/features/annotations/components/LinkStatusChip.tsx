/**
 * @file LinkStatusChip.tsx
 * @description One line, low on the page, for the two moments a jump link needs
 * words. While a link is being placed it says what each tap does, because the
 * first leaves only a dashed ring and the target is usually pages away; its
 * cross puts down the half-placed link, then the tool.
 * After a link was followed it offers the way back to where the reader jumped
 * from, and stays until it is used or dismissed: a singer who jumped to the
 * segno may need it only after the whole repeat.
 *
 * It sits above the incoming-marks notice, which shares the centre line, so the
 * two never cover each other.
 * @module features/annotations/components
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownRight, CornerUpLeft, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

/**
 * `placing`: the link tool is armed, waiting for where the link sits (`from`)
 * or where it leads (`to`). `return`: a link was followed from `page`, as the
 * reader sees it numbered.
 */
export type LinkStatus =
  | { kind: "placing"; step: "from" | "to" }
  | { kind: "return"; page: number };

interface LinkStatusChipProps {
  /** Null keeps the chip off screen. */
  status: LinkStatus | null;
  /** The concert binder floats its programme bar on this same centre line. */
  lifted?: boolean;
  /** Goes back to the page the last link was followed from. */
  onReturn: () => void;
  onDismiss: () => void;
}

export const LinkStatusChip = ({
  status,
  lifted = false,
  onReturn,
  onDismiss,
}: LinkStatusChipProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4",
        lifted ? "pb-56 sm:pb-60" : "pb-36",
      )}
    >
      <AnimatePresence>
        {status && (
          <motion.div
            key={status.kind === "placing" ? status.step : status.kind}
            initial={{ opacity: 0, transform: "translateY(12px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(12px)" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex min-w-0 max-w-full items-center gap-1 rounded-full border border-ethereal-gold/40 bg-surface-inverse/85 py-1.5 pl-3.5 pr-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            {status.kind === "placing" ? (
              <>
                <CornerDownRight
                  size={15}
                  aria-hidden="true"
                  className="shrink-0 text-ethereal-gold"
                />
                <Text
                  as="span"
                  role="status"
                  size="sm"
                  color="ink-on-inverse"
                  className="min-w-0 px-1.5 py-1 leading-snug"
                >
                  {status.step === "from"
                    ? t(
                        "annotations.link.placing_from",
                        "Dotknij miejsca, z którego się skacze, np. przy D.S.",
                      )
                    : t(
                        "annotations.link.placing_to",
                        "Teraz dotknij miejsca, do którego prowadzi skok. Możesz przewrócić stronę.",
                      )}
                </Text>
              </>
            ) : (
              <>
                <CornerUpLeft
                  size={15}
                  aria-hidden="true"
                  className="shrink-0 text-ethereal-gold"
                />
                <button
                  type="button"
                  onClick={onReturn}
                  className="min-w-0 rounded-full px-1.5 py-1 text-left transition-colors hover:bg-ink-on-inverse/10"
                >
                  <Text as="span" size="sm" color="ink-on-inverse" className="leading-snug">
                    {t("annotations.link.return", "Wróć na s. {{page}}", { page: status.page })}
                  </Text>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onDismiss}
              aria-label={
                status.kind === "placing"
                  ? t("annotations.link.cancel", "Anuluj skok")
                  : t("common.close_aria", "Zamknij")
              }
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
