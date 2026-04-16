/**
 * @file MobileNavigation.tsx
 * @description Enterprise SaaS Gestural Command Centre - 2026 Edition.
 * Engineered with pure hardware-accelerated transforms and projection-stable kinematics.
 * Implements CloseWatcher API for native-like Android/Mobile back-button handling.
 * @module shared/widgets/layout/MobileNavigation
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  type Transition,
  PanInfo,
} from "framer-motion";
import { Menu, X, Settings, LogOut } from "lucide-react";
import { cva } from "class-variance-authority";

import { useNavigationAura } from "./hooks/useNavigationAura";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import type { AuthUser } from "@/shared/auth/auth.types";
import { cn } from "@/shared/lib/utils";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

import {
  Heading,
  Eyebrow,
  Label,
  Text,
} from "@/shared/ui/primitives/typography";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Divider } from "@/shared/ui/primitives/Divider";

interface MobileNavigationProps {
  readonly user: AuthUser | null;
  readonly logout: () => void;
}

const KINETIC_SPRING: Transition = {
  type: "spring",
  stiffness: 350,
  damping: 32,
  mass: 1,
  restDelta: 0.001,
};

const mobileNavLinkVariants = cva(
  "group/moblink relative flex items-center gap-4 rounded-[1.25rem] px-5 py-3.5 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 active:scale-[0.98] will-change-transform",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/10 border border-ethereal-gold/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
        false: "border border-transparent hover:bg-white/20",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);

/**
 * BrandMark - Optimized for 2026 React Compiler.
 * Wrapped in motion.div with layout="position" to prevent distortion during parent scaling.
 */
const BrandMark = () => (
  <motion.div layout="position" className="flex items-center">
    <Heading
      as="span"
      size="lg"
      className="tracking-tight select-none pt-0.5 flex items-center"
    >
      <span className="font-medium text-ethereal-ink">Voct</span>
      <Text
        as="span"
        weight="normal"
        color="gold"
        size="2xl"
        className="italic ml-[0.5px] pb-[2.5px]"
      >
        Manager
      </Text>
    </Heading>
  </motion.div>
);

export const MobileNavigation = ({
  user,
  logout,
}: MobileNavigationProps): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const dragControls = useDragControls();

  const { navGroups, userFullName, roleLabel, initials, t } =
    useNavigationAura(user);

  useBodyScrollLock(isOpen);

  // Micro-haptics for premium feel
  const triggerHaptic = useCallback((pattern: number = 10) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    triggerHaptic(8);
  }, [triggerHaptic]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    triggerHaptic(12);
  }, [triggerHaptic]);

  // Native hardware back button / ESC key handling (2026 Web Standard)
  useEffect(() => {
    if (!isOpen) return;

    // Use CloseWatcher API if available (Chrome 120+)
    // @ts-expect-error CloseWatcher is a modern Web API
    if (typeof window.CloseWatcher !== "undefined") {
      // @ts-expect-error watcher
      const watcher = new window.CloseWatcher();
      watcher.onclose = handleClose;
      return () => watcher.destroy();
    }

    // Fallback for older browsers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.y > 100 || info.velocity.y > 500) {
        handleClose();
      }
    },
    [handleClose],
  );

  // Programmatic navigation to prevent race conditions with the closing animation
  const handleNavigation = useCallback(
    (to: string) => {
      handleClose();
      // Allow the menu to start closing before the router swaps the view
      setTimeout(() => navigate(to), 100);
    },
    [handleClose, navigate],
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[60] bg-ethereal-ink/30 backdrop-blur-md md:hidden"
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-5 left-0 right-0 z-[70] px-4 pb-safe flex justify-center pointer-events-none md:hidden [perspective:1200px]">
        <GlassCard
          ref={containerRef}
          as={motion.nav}
          variant="ethereal"
          animationEngine="framer"
          withNoise={true}
          glow={isOpen}
          padding="none"
          // We use absolute DVH to prevent layout thrashing
          animate={{
            height: isOpen ? "78dvh" : "72px",
            borderRadius: isOpen ? "32px" : "36px",
            y: 0,
          }}
          transition={KINETIC_SPRING}
          drag={isOpen ? "y" : false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.08}
          onDragEnd={handleDragEnd}
          className="pointer-events-auto relative w-full overflow-hidden border border-white/60 shadow-[var(--shadow-ethereal-deep)] transform-gpu origin-bottom will-change-[height,transform]"
        >
          {/* Collapsed State: Optimized Header */}
          <AnimatePresence mode="popLayout">
            {!isOpen && (
              <motion.div
                key="collapsed-header"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute inset-0 flex items-center justify-between h-[72px] px-3 z-20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-ethereal-gold/15 to-transparent border border-ethereal-gold/20">
                  <Label
                    as="span"
                    color="gold"
                    weight="bold"
                    className="tracking-widest"
                  >
                    {initials}
                  </Label>
                </div>

                <button
                  onClick={handleOpen}
                  className="flex flex-1 items-center justify-center gap-3 h-full px-4 outline-none"
                >
                  <Menu className="text-ethereal-graphite/70" size={22} />
                  <BrandMark />
                </button>

                <div className="flex h-12 w-12 items-center justify-center">
                  <NotificationCenter />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expanded State: Menu Content */}
          <motion.div
            initial={false}
            animate={{ opacity: isOpen ? 1 : 0 }}
            className={cn(
              "relative flex flex-col w-full h-full pt-4 transition-opacity",
              !isOpen && "pointer-events-none",
            )}
          >
            {/* Drag Handle - Tactile Area */}
            <div
              className="w-full flex justify-center pb-2 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1.5 rounded-full bg-ethereal-graphite/20 shadow-inner" />
            </div>

            <header className="flex items-center justify-between px-6 pt-2 pb-4">
              <BrandMark />
              <button
                onClick={handleClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-ethereal-graphite/5 text-ethereal-graphite"
              >
                <X size={20} />
              </button>
            </header>

            {/* Scrollable Area with Fade Masking */}
            <div
              className="flex-1 overflow-y-auto px-5 pb-8 overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{
                maskImage:
                  "linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)",
              }}
            >
              <div className="flex flex-col gap-6 py-4">
                {navGroups.map((group) => (
                  <section key={group.labelKey} className="flex flex-col">
                    <motion.div layout="position">
                      <Eyebrow
                        as="h3"
                        weight="semibold"
                        color="incense"
                        size="sm"
                        className="mb-3 pl-4 tracking-[0.25em] uppercase opacity-60"
                      >
                        {t(group.labelKey)}
                      </Eyebrow>
                    </motion.div>

                    <ul className="space-y-1.5 m-0 p-0 list-none">
                      {group.links.map((link) => {
                        const IconComponent = link.icon as React.ElementType;
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
                                  <motion.div
                                    layout="position"
                                    className={cn(
                                      "flex w-8 items-center justify-center",
                                      isActive
                                        ? "text-ethereal-gold"
                                        : "text-ethereal-graphite/70",
                                    )}
                                  >
                                    <IconComponent
                                      size={20}
                                      strokeWidth={isActive ? 2.5 : 1.5}
                                    />
                                  </motion.div>
                                  <motion.div layout="position">
                                    <Text
                                      as="span"
                                      weight={isActive ? "medium" : "normal"}
                                      className={
                                        isActive
                                          ? "text-ethereal-gold"
                                          : "text-ethereal-graphite/80"
                                      }
                                    >
                                      {t(link.labelKey)}
                                    </Text>
                                  </motion.div>
                                </>
                              )}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </div>

            {/* Footer - Fixed at bottom of the expanded sheet */}
            <footer className="mt-auto px-7 pt-2 pb-6 bg-gradient-to-t from-white/80 to-transparent backdrop-blur-sm rounded-b-[32px] relative">
              <Divider
                position="absolute-top"
                variant="fade"
                className="opacity-30"
              />
              <div className="flex items-center justify-between gap-4 pt-4">
                <motion.div layout="position" className="flex flex-col min-w-0">
                  <Label
                    as="p"
                    weight="medium"
                    className="truncate text-base text-ethereal-ink leading-none mb-1"
                  >
                    {userFullName}
                  </Label>
                  <Eyebrow
                    as="p"
                    color="incense"
                    className="truncate opacity-60 text-[0.7rem] tracking-widest uppercase"
                  >
                    {roleLabel}
                  </Eyebrow>
                </motion.div>

                <motion.div layout="position" className="flex gap-2">
                  <button
                    onClick={() => handleNavigation("/panel/settings")}
                    className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-ethereal-gold/10 border border-ethereal-gold/20 text-ethereal-graphite"
                  >
                    <Settings size={18} />
                  </button>
                  <button
                    onClick={logout}
                    className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-red-50 text-red-500 border border-red-100"
                  >
                    <LogOut size={18} />
                  </button>
                </motion.div>
              </div>
            </footer>
          </motion.div>
        </GlassCard>
      </div>
    </>
  );
};
