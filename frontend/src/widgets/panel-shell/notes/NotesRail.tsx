/**
 * @file NotesRail.tsx
 * @description Right-side rail for the private scratchpad on `wide-shell`
 * viewports (≥60rem) — mirror of `../DesktopSidebar.tsx` /
 * `../hooks/useSidebarPin.ts`, with one difference that changes the collapsed
 * geometry: the sidebar's collapsed sliver shows the logo and the nav icons,
 * and this rail has no permanent content at all. So it collapses to ZERO width
 * rather than to the sidebar's 88px — a sliver with nothing in it is not a
 * peek, it is an empty column parked over the right edge of every page, and a
 * `clipPath` clips hit-testing along with paint, so it would also have eaten
 * every click landing in that strip. `inert` while collapsed is the other half:
 * the panel stays mounted (the composer must survive a plain open with its
 * draft), and inert is what keeps its close button, its pin and its rows out of
 * hit-testing, out of the tab order and out of the accessibility tree.
 *
 * The pin toggle appears only on a fine pointer, since a touch-only wide
 * viewport (iPad landscape) can open the rail as an overlay but cannot benefit
 * from it reflowing a layout no cursor will hover back out of.
 * @module widgets/panel-shell/notes
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import type { Transition } from "framer-motion";
import { Pin, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading } from "@/shared/ui/primitives/typography";
import { Tooltip, TooltipProvider } from "@/shared/ui/primitives/Tooltip";
import { cn } from "@/shared/lib/utils";
import { useIsFinePointer } from "@/shared/lib/dom/useMediaQuery";
import { NotesPanel } from "@/features/notes/components/NotesPanel";
import { useNotesPanel } from "@/features/notes/hooks/useNotesPanel";
import { useNotesPin } from "./useNotesPin";

const KINETIC_TRANSITION: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 40,
  mass: 0.8,
};

export const NotesRail = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { isOpen, close } = useNotesPanel();
  const { isPinned, togglePin } = useNotesPin();
  const isFinePointer = useIsFinePointer();

  const isExpanded = isOpen || isPinned;

  useEffect(() => {
    if (!isOpen || isPinned) return;
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [close, isOpen, isPinned]);

  return (
    <TooltipProvider delayDuration={10} disableHoverableContent>
      <GlassCard
        as={motion.aside}
        variant="ethereal"
        glow={false}
        withNoise={true}
        initial={false}
        animate={{
          clipPath: isExpanded
            ? "inset(0px 0% 0px 0px round 2.5rem)"
            : "inset(0px 0px 0px 100% round 2.5rem)",
          boxShadow: isExpanded
            ? "0 24px 64px -12px rgba(194, 168, 120, 0.15), 0 0 0 1px rgba(194, 168, 120, 0.25)"
            : "0 8px 32px var(--glass-shade), 0 0 0 1px var(--glass-highlight)",
        }}
        transition={KINETIC_TRANSITION}
        padding="none"
        aria-expanded={isExpanded}
        inert={!isExpanded}
        isHoverable={false}
        className="fixed bottom-4 right-4 top-4 z-60 hidden w-88 flex-col border-none bg-ethereal-marble will-change-[clip-path,box-shadow] wide-shell:flex"
      >
        <motion.div
          initial={false}
          animate={{ opacity: isExpanded ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex h-full w-88 min-h-0 flex-col p-4"
        >
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
            <Heading as="h2" size="lg" weight="normal">
              {t("notes.panel.title", "Notatki")}
            </Heading>
            <div className="flex items-center gap-1">
              {isFinePointer && (
                <Tooltip
                  content={
                    isPinned
                      ? t("notes.panel.unpin", "Odepnij")
                      : t("notes.panel.pin", "Przypnij")
                  }
                  side="bottom"
                >
                  <button
                    type="button"
                    onClick={togglePin}
                    aria-label={
                      isPinned
                        ? t("notes.panel.unpin", "Odepnij")
                        : t("notes.panel.pin", "Przypnij")
                    }
                    aria-pressed={isPinned}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-lg outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
                      isPinned
                        ? "bg-ethereal-gold/15 text-ethereal-gold"
                        : "text-ethereal-graphite/45 hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink",
                    )}
                  >
                    <Pin
                      size={15}
                      strokeWidth={2}
                      className={cn(
                        "transition-transform duration-300",
                        isPinned ? "rotate-0 fill-ethereal-gold/30" : "rotate-45",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </Tooltip>
              )}
              {!isPinned && (
                <button
                  type="button"
                  onClick={close}
                  aria-label={t("common.actions.close", "Zamknij")}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ethereal-graphite/45 outline-none transition-colors duration-200 hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
                >
                  <X size={15} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <NotesPanel />
          </div>
        </motion.div>
      </GlassCard>
    </TooltipProvider>
  );
};

NotesRail.displayName = "NotesRail";
