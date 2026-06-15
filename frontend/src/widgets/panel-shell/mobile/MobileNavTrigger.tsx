/**
 * @file MobileNavTrigger.tsx
 * @description Collapsed mobile navigation: a fixed, full-width bottom tab bar.
 * Four role-scoped primary destinations carry **labels** (recognition over
 * recall) plus a "More" slot that opens the command sheet for search + the long
 * tail. The active tab is marked by a single gold lozenge that **slides** between
 * tabs (shared `layoutId`) — a Material-3-class indicator that reads instantly.
 *
 * Always mounted (the sheet overlays it), so its backdrop-filter is computed
 * once and never re-rasterised.
 *
 * @architecture Enterprise SaaS 2026
 * @module widgets/panel-shell/mobile
 */

import React from "react";
import { motion } from "framer-motion";
import type { Transition } from "framer-motion";
import { NavLink } from "react-router-dom";
import { LayoutGrid } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { hapticsService } from "@/shared/lib/hardware/hapticsService";
import { UnreadMessagesBadge } from "@/features/messages/components/UnreadMessagesBadge";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { useNavigationAura } from "../hooks/useNavigationAura";

const BAR_TRANSITION: Transition = {
  type: "spring",
  stiffness: 360,
  damping: 32,
  mass: 0.85,
};

const PILL_SPRING: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.8,
};

interface MobileNavTriggerProps {
  readonly onOpen: () => void;
  readonly isMenuOpen: boolean;
  readonly aura: ReturnType<typeof useNavigationAura>;
}

const slotClass =
  "relative flex flex-1 select-none flex-col items-center justify-center gap-1.5 rounded-xl pt-2 pb-1 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.95]";

const labelClass = "max-w-full truncate text-[10.5px] leading-none tracking-tight";

export const MobileNavTrigger = ({
  onOpen,
  isMenuOpen,
  aura,
}: MobileNavTriggerProps): React.JSX.Element => {
  const { mobileTabs, t } = aura;

  return (
    <motion.nav
      aria-label={t("dashboard.layout.nav.main_menu", "Primary navigation")}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={BAR_TRANSITION}
      className={cn(
        "fixed inset-x-0 bottom-0 z-nav-dock fine-pointer:hidden",
        "border-t border-glass-border bg-ethereal-alabaster/94 backdrop-blur-md",
        "shadow-[0_-10px_30px_-14px_rgba(22,20,18,0.22)]",
      )}
    >
      <div className="mx-auto flex max-w-md items-stretch gap-0.5 px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {mobileTabs.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/panel"}
            onClick={() => hapticsService.playEtherealTick()}
            className={({ isActive }) =>
              cn(
                slotClass,
                isActive
                  ? "text-ethereal-gold"
                  : "text-ethereal-graphite/55 hover:text-ethereal-ink",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative flex h-8 items-center justify-center">
                  {isActive && (
                    <motion.span
                      layoutId="mobileNavPill"
                      transition={PILL_SPRING}
                      className="absolute inset-0 -mx-2.5 rounded-full bg-ethereal-gold/14"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center">
                    <Icon
                      size={21}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      aria-hidden="true"
                    />
                    {to === "/panel/messages" && (
                      <UnreadMessagesBadge className="-right-1 -top-1" />
                    )}
                  </span>
                </span>
                <span
                  className={cn(
                    labelClass,
                    isActive ? "font-semibold" : "font-medium",
                  )}
                >
                  {t(labelKey)}
                </span>
              </>
            )}
          </NavLink>
        ))}

        <NotificationCenter
          variant="tab"
          label={t("dashboard.layout.mobile_tabs.alerts", "Alerty")}
        />

        <button
          type="button"
          onClick={onOpen}
          aria-label={t("dashboard.layout.actions.open_menu", "Open menu")}
          aria-haspopup="dialog"
          aria-expanded={isMenuOpen}
          className={cn(
            slotClass,
            isMenuOpen
              ? "text-ethereal-gold"
              : "text-ethereal-graphite/55 hover:text-ethereal-ink",
          )}
        >
          <span className="flex h-8 items-center justify-center">
            <LayoutGrid size={21} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className={cn(labelClass, "font-medium")}>
            {t("dashboard.layout.mobile_tabs.more", "Więcej")}
          </span>
        </button>
      </div>
    </motion.nav>
  );
};

MobileNavTrigger.displayName = "MobileNavTrigger";
