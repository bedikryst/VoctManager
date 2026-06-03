/**
 * @file MobileNavTrigger.tsx
 * @description Collapsed dock state of the mobile navigation. Pinned routes,
 * notification entry point, and an opener for the expanded sheet.
 *
 * Performance contract: enter / exit animations only. No shared-layout
 * indicators, no live blur recomputation under translation. The dock itself is
 * static at rest; backdrop-filter is therefore safe to keep on this element.
 *
 * @architecture Enterprise SaaS 2026
 * @module widgets/panel-shell/mobile
 */

import React from "react";
import { motion } from "framer-motion";
import type { Transition } from "framer-motion";
import { NavLink } from "react-router-dom";
import { Menu } from "lucide-react";
import { cva } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";
import { hapticsService } from "@/shared/lib/hardware/hapticsService";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { useNavigationAura } from "../hooks/useNavigationAura";

const DOCK_TRANSITION: Transition = {
  type: "spring",
  stiffness: 360,
  damping: 32,
  mass: 0.85,
};

const dockSlotVariants = cva(
  [
    "relative grid h-11 w-11 shrink-0 place-items-center rounded-[14px]",
    "outline-none transition-[background-color,color,transform] duration-200",
    "focus-visible:ring-2 focus-visible:ring-ethereal-gold/60",
    "active:scale-[0.94]",
  ],
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/[0.10] text-ethereal-gold",
        false:
          "text-ethereal-graphite/65 hover:bg-ethereal-graphite/[0.04] hover:text-ethereal-ink",
      },
    },
    defaultVariants: { isActive: false },
  },
);

interface MobileNavTriggerProps {
  readonly onOpen: () => void;
  readonly aura: ReturnType<typeof useNavigationAura>;
}

export const MobileNavTrigger = ({
  onOpen,
  aura,
}: MobileNavTriggerProps): React.JSX.Element => {
  const { allItems, t } = aura;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={DOCK_TRANSITION}
      className="pointer-events-none fixed inset-x-0 bottom-5 z-nav-dock flex justify-center px-4 fine-pointer:hidden"
    >
      <nav
        aria-label={t("dashboard.layout.nav.main_menu", "Primary navigation")}
        className={cn(
          "pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-[22px] px-2 py-1.5 no-scrollbar",
          "border border-glass-border bg-ethereal-alabaster/92 backdrop-blur-md",
          "shadow-[0_10px_32px_-12px_rgba(22,20,18,0.18),0_2px_6px_rgba(22,20,18,0.06)]",
        )}
      >
        {allItems.map(({ icon: Icon, to, labelKey, isPinned }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/panel"}
            aria-label={t(labelKey)}
            onClick={() => hapticsService.playEtherealTick()}
            className={({ isActive }) =>
              cn(dockSlotVariants({ isActive }), !isPinned && "max-sm:hidden")
            }
          >
            {({ isActive }) => (
              <Icon
                size={20}
                strokeWidth={isActive ? 2.25 : 1.75}
                aria-hidden="true"
              />
            )}
          </NavLink>
        ))}

        <span
          aria-hidden="true"
          className="mx-1 h-5 w-px shrink-0 bg-ethereal-graphite/12"
        />

        <div className="grid h-11 w-11 shrink-0 place-items-center">
          <NotificationCenter />
        </div>

        <button
          type="button"
          onClick={onOpen}
          aria-label={t("dashboard.layout.actions.open_menu", "Open menu")}
          aria-haspopup="dialog"
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-[14px]",
            "text-ethereal-graphite/65 outline-none",
            "transition-[background-color,color,transform] duration-200",
            "hover:bg-ethereal-graphite/[0.04] hover:text-ethereal-ink",
            "focus-visible:ring-2 focus-visible:ring-ethereal-gold/60",
            "active:scale-[0.94]",
          )}
        >
          <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </nav>
    </motion.div>
  );
};

MobileNavTrigger.displayName = "MobileNavTrigger";
