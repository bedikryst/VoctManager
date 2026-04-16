/**
 * @file MobileNavTrigger.tsx
 * @description Spatial Floating Dock for mobile navigation (Enterprise 2026 Standard).
 * Replaces the legacy Dynamic Island pill to reduce cognitive load and click-fatigue.
 * Integrates layout morphing for a seamless transition into the expanded sheet.
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { Home, Calendar, Music, Menu } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { cn } from "@/shared/lib/utils";
import { hapticsService } from "@/shared/lib/hardware/hapticsService";

interface MobileNavTriggerProps {
  readonly onOpen: () => void;
}

/**
 * Dock configuration payload.
 * Kept strictly typed to ensure routing stability.
 */
const DOCK_ITEMS = [
  { icon: Home, path: "/panel/dashboard", label: "Dashboard" },
  { icon: Calendar, path: "/panel/schedule", label: "Schedule" },
  { icon: Music, path: "/panel/repertoire", label: "Repertoire" },
] as const;

export const MobileNavTrigger = ({
  onOpen,
}: MobileNavTriggerProps): React.JSX.Element => {
  // Pre-calculate to avoid unnecessary renders
  const dockConfig = useMemo(() => DOCK_ITEMS, []);

  return (
    <motion.div
      // layoutId connects this component geometrically to MobileNavSheet
      layoutId="mobile-nav-container"
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="fixed bottom-6 left-0 right-0 z-70 z-[var(--z-nav-dock)] flex justify-center px-4 pointer-events-none"
    >
      <GlassCard
        variant="ethereal"
        padding="none"
        withNoise={true}
        className="pointer-events-auto flex items-center justify-evenly h-nav-dock px-3 rounded-full min-w-[320px] max-w-sm w-full border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)] transform-gpu will-change-transform"
      >
        <nav
          aria-label="Main Mobile Navigation"
          className="flex items-center justify-between w-full"
        >
          {dockConfig.map(({ icon: Icon, path, label }) => (
            <NavLink
              key={path}
              to={path}
              aria-label={label}
              onClick={() => hapticsService.playEtherealTick()}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center justify-center h-12 w-12 rounded-full outline-none transition-all duration-300 active:scale-90 focus-visible:ring-2 focus-visible:ring-ethereal-gold",
                  isActive
                    ? "text-ethereal-gold"
                    : "text-ethereal-graphite/60 hover:text-ethereal-graphite/90",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  {/* Subtle active indicator for accessibility and spatial awareness */}
                  {isActive && (
                    <motion.div
                      layoutId="active-dock-indicator"
                      className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-ethereal-gold"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* Divider to separate core routes from tools/actions */}
          <div
            className="w-[1px] h-6 bg-ethereal-graphite/10 mx-1"
            aria-hidden="true"
          />

          {/* Notification Center embedded in the dock */}
          <div className="flex items-center justify-center h-12 w-12 shrink-0 relative z-10">
            <NotificationCenter />
          </div>

          {/* Trigger to expand the remaining navigation sheet */}
          <button
            onClick={onOpen}
            aria-label="Open more options"
            aria-haspopup="dialog"
            className="flex items-center justify-center h-12 w-12 rounded-full text-ethereal-graphite/60 hover:text-ethereal-graphite/90 transition-all duration-300 active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold"
          >
            <Menu size={24} strokeWidth={2} />
          </button>
        </nav>
      </GlassCard>
    </motion.div>
  );
};
