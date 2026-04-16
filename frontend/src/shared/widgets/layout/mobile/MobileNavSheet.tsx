/**
 * @file MobileNavSheet.tsx
 * @description Spatial expanded state of navigation.
 * Implements hardware-accelerated scroll masking, fluid spring physics,
 * 1:1 gesture mapping, and strict A11y standards.
 * @module shared/widgets/layout/mobile
 * @architecture Enterprise SaaS 2026
 */

import React, { useRef } from "react";
import {
  motion,
  PanInfo,
  useDragControls,
  useMotionValue,
} from "framer-motion";
import { NavLink } from "react-router-dom";
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

/**
 * Enterprise standard physics constants for UI components.
 * Snappy but fluid interactions based on 2026 Spatial UX guidelines.
 */
const KINEMATICS = {
  SHEET_SPRING: { type: "spring", stiffness: 350, damping: 40, mass: 1 },
  SWIPE_THRESHOLD: 120,
  VELOCITY_THRESHOLD: 500,
  DRAG_ELASTICITY: 0.1,
} as const;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const y = useMotionValue(0);

  useFocusTrap(containerRef, true);

  /**
   * Validates tactile intent based on velocity and displacement.
   * Handles gesture closure safely without interfering with internal scrolls.
   */
  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (
      info.offset.y > KINEMATICS.SWIPE_THRESHOLD ||
      info.velocity.y > KINEMATICS.VELOCITY_THRESHOLD
    ) {
      onClose();
    }
  };

  return (
    <>
      {/* 1. Ethereal Backdrop with spatial responsiveness */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-[calc(var(--z-nav-sheet)-1)] bg-ethereal-ink/30 backdrop-blur-md md:hidden"
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
          "Rozszerzona nawigacja mobilna",
        )}
        className="fixed bottom-0 left-0 right-0 z-[var(--z-nav-sheet)] max-h-[92dvh] h-full outline-none md:hidden overflow-hidden flex flex-col justify-end pt-12 will-change-transform"
        style={{ y, touchAction: "auto" }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={KINEMATICS.DRAG_ELASTICITY}
        onDragEnd={handleDragEnd}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={KINEMATICS.SHEET_SPRING}
      >
        <GlassCard
          variant="solid"
          padding="none"
          withNoise={true}
          isHoverable={false}
          className="w-full h-full overflow-hidden rounded-t-[2.5rem] border-t border-white/40 shadow-[0_-8px_40px_rgba(0,0,0,0.12)] bg-white/70"
        >
          {/* Architectural Fix: Internal Flex Container overrides GlassCard block-level child wrapper */}
          <div className="flex flex-col w-full h-full">
            {/* Tactile Grab Handle */}
            <div
              className="w-full flex justify-center py-5 cursor-grab active:cursor-grabbing touch-none shrink-0"
              onPointerDown={(e) => dragControls.start(e)}
              aria-hidden="true"
            >
              <div className="w-12 h-1.5 rounded-full bg-ethereal-graphite/30" />
            </div>

            {/* Header */}
            <header className="flex items-center justify-between px-8 pb-4 shrink-0">
              <Heading as="span" size="2xl">
                <span className="font-medium">Voct</span>
                <Text
                  as="span"
                  color="gold"
                  size="huge"
                  className="italic ml-0.5"
                >
                  Manager
                </Text>
              </Heading>
              <button
                onClick={onClose}
                aria-label={aura.t("common.actions.close", "Close navigation")}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full bg-ethereal-graphite/5 hover:bg-ethereal-graphite/10 transition-colors active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold"
              >
                <X size={22} className="text-ethereal-graphite/80" />
              </button>
            </header>

            {/* Scrollable Navigation Area - Fully isolated native scrolling */}
            <div
              data-scroll-lock-ignore="true"
              className="flex-1 min-h-0 overflow-y-auto px-6 touch-pan-y overscroll-contain no-scrollbar"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <nav className="flex flex-col gap-4 py-6 pb-12">
                {aura.navGroups.map((group) => (
                  <section key={group.labelKey}>
                    <Eyebrow className="mb-4 pl-4 tracking-[0.2em] uppercase">
                      {aura.t(group.labelKey)}
                    </Eyebrow>
                    <ul className="space-y-2 list-none p-0 m-0">
                      {group.links.map((link) => {
                        const Icon = link.icon;
                        return (
                          <li key={link.to}>
                            <NavLink
                              to={link.to}
                              onClick={onClose}
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
            <footer className="mt-auto px-8 py-6 bg-white/50 border-t border-white/5 shrink-0">
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
                  <NavLink
                    to="/panel/settings"
                    onClick={onClose}
                    aria-label={aura.t("nav.settings", "Settings")}
                    className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-[1.25rem] bg-ethereal-gold/10 border border-ethereal-gold/20 text-ethereal-gold hover:bg-ethereal-gold/20 transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold"
                  >
                    <Settings size={20} strokeWidth={2} />
                  </NavLink>
                  <button
                    onClick={logout}
                    aria-label={aura.t("auth.logout", "Log out")}
                    className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-[1.25rem] bg-ethereal-crimson/10 border border-ethereal-crimson/20 text-ethereal-crimson hover:bg-ethereal-crimson/20 transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-crimson"
                  >
                    <LogOut size={20} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </footer>
          </div>
        </GlassCard>
      </motion.div>
    </>
  );
};
