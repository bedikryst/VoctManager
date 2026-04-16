/**
 * @file MobileNavSheet.tsx
 * @description Spatial expanded state of navigation.
 * Implements hardware-accelerated scroll masking, spring physics, and strict A11y.
 * @module shared/widgets/layout/mobile
 * @architecture Enterprise SaaS 2026
 */

import React, { useRef } from "react";
import { motion, PanInfo, useDragControls } from "framer-motion";
import { useNavigate, NavLink } from "react-router-dom";
import { X, Settings, LogOut } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import {
  Heading,
  Eyebrow,
  Label,
  Text,
} from "@/shared/ui/primitives/typography";
import { useNavigationAura } from "../hooks/useNavigationAura";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";
import { mobileNavLinkVariants } from "./MobileNavigation.styles";
import type { Transition } from "framer-motion";

const sheetTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 35,
  mass: 0.8,
};

const sheetKinematics = {
  // Removed explicit scales to prevent raster distortion (squishing)
  initial: { opacity: 0, y: "100%" },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: "100%" },
  transition: sheetTransition,
};

interface MobileNavSheetProps {
  readonly onClose: () => void;
  readonly logout: () => void;
  readonly aura: ReturnType<typeof useNavigationAura>;
}

export const MobileNavSheet = ({
  onClose,
  logout,
  aura,
}: MobileNavSheetProps): React.JSX.Element => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // A11y: Strict focus boundary projection
  useFocusTrap(containerRef, true);

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    // Gestural intent validation
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  const handleNavigation = (to: string) => {
    onClose();
    navigate(to); // Relies on React 19 View Transitions for fluid routing
  };

  return (
    <>
      {/* 1. Ethereal Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-(--z-nav-sheet) bg-ethereal-ink/20 backdrop-blur-md md:hidden will-change-transform"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 2. Spatial Navigation Sheet */}
      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={aura.t(
          "nav.sheet.accessibility_label",
          "Expanded Navigation",
        )}
        className="fixed bottom-0 left-0 right-0 z-(--z-nav-sheet) h-[90dvh] outline-none md:hidden overflow-hidden flex flex-col justify-end will-change-transform"
        onDragEnd={handleDragEnd}
        drag="y"
        dragControls={dragControls}
        dragListener={false} // Enforces interaction ONLY via the tactile handle
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.05}
        {...sheetKinematics}
      >
        <GlassCard
          variant="ethereal"
          padding="none"
          withNoise={true}
          className="flex flex-col w-full h-full overflow-hidden rounded-t-[2.5rem] border-t border-white/40 shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
        >
          {/* Tactile Grab Handle for Spatial Awareness */}
          <div
            className="w-full flex justify-center py-5 cursor-grab active:cursor-grabbing touch-none shrink-0"
            onPointerDown={(e) => dragControls.start(e)}
            aria-hidden="true"
          >
            <div className="w-12 h-1.5 rounded-full bg-ethereal-graphite/30" />
          </div>

          <header className="flex items-center justify-between px-8 pb-4 shrink-0">
            <Heading as="span" size="lg" className="tracking-tight">
              <span className="font-medium">Voct</span>
              <Text as="span" color="gold" size="2xl" className="italic ml-0.5">
                Manager
              </Text>
            </Heading>
            <button
              onClick={onClose}
              aria-label={aura.t("common.actions.close", "Close navigation")}
              className="p-2 rounded-full bg-ethereal-graphite/5 hover:bg-ethereal-graphite/10 transition-colors active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold"
            >
              <X size={22} className="text-ethereal-graphite/80" />
            </button>
          </header>

          <div
            className="flex-1 min-h-0 overflow-y-auto px-6 touch-pan-y overscroll-contain no-scrollbar"
            onPointerDownCapture={(e) => e.stopPropagation()}
            onTouchStartCapture={(e) => e.stopPropagation()}
            onWheelCapture={(e) => e.stopPropagation()}
          >
            <nav className="flex flex-col gap-8 py-6 pb-12">
              {aura.navGroups.map((group) => (
                <section key={group.labelKey}>
                  <Eyebrow className="mb-4 pl-4 opacity-60 tracking-[0.2em] uppercase">
                    {aura.t(group.labelKey)}
                  </Eyebrow>
                  <ul className="space-y-2 list-none p-0 m-0">
                    {group.links.map((link) => {
                      const Icon = link.icon;
                      return (
                        <li key={link.to}>
                          <NavLink
                            to={link.to}
                            onClick={(e) => {
                              e.preventDefault();
                              handleNavigation(link.to);
                            }}
                            className={({ isActive }) =>
                              cn(mobileNavLinkVariants({ isActive }))
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <Icon
                                  size={22}
                                  strokeWidth={isActive ? 2.5 : 2}
                                  className={
                                    isActive
                                      ? "text-ethereal-gold"
                                      : "text-ethereal-graphite/60"
                                  }
                                />
                                <Text
                                  weight={isActive ? "medium" : "normal"}
                                  className={
                                    isActive
                                      ? "text-ethereal-ink"
                                      : "text-ethereal-graphite/80"
                                  }
                                >
                                  {aura.t(link.labelKey)}
                                </Text>
                              </>
                            )}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </nav>
          </div>

          {/* Identity & Context Footer */}
          <footer className="mt-auto px-8 pt-6 pb-safe-offset-8 bg-white/40 backdrop-blur-xl border-t border-white/30 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex flex-col overflow-hidden pr-4">
                <Label className="text-lg leading-tight mb-0.5 truncate">
                  {aura.userFullName}
                </Label>
                <Eyebrow color="incense" size="xs" className="truncate">
                  {aura.roleLabel}
                </Eyebrow>
              </div>

              {/* Contextual Action Cluster */}
              <div className="flex gap-3 shrink-0">
                <button
                  onClick={() => handleNavigation("/panel/settings")}
                  aria-label={aura.t("nav.settings", "Settings")}
                  className="p-3 rounded-[1.25rem] bg-ethereal-gold/10 border border-ethereal-gold/20 text-ethereal-gold hover:bg-ethereal-gold/20 transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold"
                >
                  <Settings size={20} strokeWidth={2} />
                </button>
                <button
                  onClick={logout}
                  aria-label={aura.t("auth.logout", "Log out")}
                  className="p-3 rounded-[1.25rem] bg-ethereal-crimson/10 border border-ethereal-crimson/20 text-ethereal-crimson hover:bg-ethereal-crimson/20 transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-crimson"
                >
                  <LogOut size={20} strokeWidth={2} />
                </button>
              </div>
            </div>
          </footer>
        </GlassCard>
      </motion.div>
    </>
  );
};
