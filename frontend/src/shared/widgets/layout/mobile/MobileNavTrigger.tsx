import React from "react";
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { Menu } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { cn } from "@/shared/lib/utils";
import { hapticsService } from "@/shared/lib/hardware/hapticsService";
import { useNavigationAura } from "../hooks/useNavigationAura";

interface MobileNavTriggerProps {
  readonly onOpen: () => void;
  readonly aura: ReturnType<typeof useNavigationAura>;
}

export const MobileNavTrigger = ({
  onOpen,
  aura,
}: MobileNavTriggerProps): React.JSX.Element => {
  const dockItems = aura.pinnedItems;

  return (
    <motion.div
      layoutId="mobile-nav-container"
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="md:hidden fixed bottom-6 left-0 right-0 z-[var(--z-nav-dock)] flex justify-center px-4 pointer-events-none"
    >
      <GlassCard
        variant="ethereal"
        padding="none"
        withNoise={true}
        className="pointer-events-auto flex items-center justify-evenly h-nav-dock px-3 rounded-full min-w-[320px] max-w-sm w-full border border-white/60 shadow-2xl transform-gpu will-change-transform"
      >
        <nav
          aria-label="Main Mobile Navigation"
          className="flex items-center justify-between w-full"
        >
          {dockItems.map(({ icon: Icon, to, labelKey }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={aura.t(labelKey)}
              onClick={() => hapticsService.playEtherealTick()}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center justify-center h-12 w-12 rounded-full outline-none transition-colors duration-300 active:scale-90 focus-visible:ring-2 focus-visible:ring-ethereal-gold",
                  isActive
                    ? "text-ethereal-gold"
                    : "text-ethereal-graphite/60 hover:text-ethereal-graphite/90",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
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

          <div
            className="w-[1px] h-6 bg-ethereal-graphite/10 mx-1"
            aria-hidden="true"
          />

          <div className="flex items-center justify-center h-12 w-12 shrink-0 relative z-10">
            <NotificationCenter />
          </div>

          <button
            onClick={onOpen}
            aria-label="Open expansive menu"
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
