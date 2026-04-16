/**
 * @file MobileNavigation.tsx
 * @description Enterprise SaaS Gestural Command Centre.
 * Engineered with explicit hardware-accelerated height kinematics
 * and strict drag-delegation. Zero Layout Projection warping.
 * Integrates popstate management for native-like Android back-button behavior.
 * @module shared/widgets/layout/MobileNavigation
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { NavLink } from "react-router-dom";
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
  stiffness: 320,
  damping: 28,
  mass: 0.8,
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

const BrandMark = React.memo(() => (
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
));
BrandMark.displayName = "BrandMark";

export const MobileNavigation = ({
  user,
  logout,
}: MobileNavigationProps): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dedicated controller for native-like swipe-to-dismiss
  const dragControls = useDragControls();

  const { navGroups, userFullName, roleLabel, initials, t } =
    useNavigationAura(user);

  useBodyScrollLock(isOpen);

  // Close menu handler with history manipulation for native feel
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    // Push state to handle Android hardware back button elegantly
    window.history.pushState({ navigationOpen: true }, "");
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    const handlePopState = () => {
      // If user presses hardware back button, close the menu instead of navigating back
      if (isOpen) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isOpen, handleClose]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      // Swipe threshold for dismissal (velocity or distance)
      if (info.offset.y > 80 || info.velocity.y > 400) {
        handleClose();
        // Pop the state manually if closed via drag
        if (window.history.state?.navigationOpen) {
          window.history.back();
        }
      }
    },
    [handleClose],
  );

  return (
    <>
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-ethereal-ink/20 backdrop-blur-md md:hidden"
            aria-hidden="true"
            onClick={() => {
              handleClose();
              if (window.history.state?.navigationOpen) window.history.back();
            }}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-5 left-0 right-0 z-[70] px-4 pb-safe flex justify-center pointer-events-none md:hidden [perspective:1000px]">
        <GlassCard
          ref={containerRef}
          as={motion.nav}
          variant="ethereal"
          animationEngine="framer"
          withNoise={true}
          glow={isOpen}
          padding="none"
          initial={false}
          animate={{
            height: isOpen ? "auto" : 72,
            borderRadius: isOpen ? 32 : 36,
          }}
          transition={KINETIC_SPRING}
          drag={isOpen ? "y" : false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          className="pointer-events-auto relative w-full overflow-hidden border border-white/60 shadow-[var(--shadow-ethereal-deep)] transform-gpu origin-bottom will-change-[height,transform]"
        >
          {/* Collapsed State: Header */}
          <motion.div
            animate={{
              opacity: isOpen ? 0 : 1,
              y: isOpen ? -10 : 0,
              pointerEvents: isOpen ? "none" : "auto",
            }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-between h-[72px] px-3 z-10"
            aria-hidden={isOpen}
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ethereal-gold/15 to-transparent border border-ethereal-gold/20 shadow-sm">
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
              className="group flex flex-1 items-center justify-center gap-3 h-full px-4 transition-colors outline-none"
              aria-expanded={isOpen}
              aria-controls="mobile-navigation-content"
            >
              <Menu
                className="text-ethereal-graphite/70 group-hover:text-ethereal-gold transition-colors duration-300"
                size={22}
              />
              <BrandMark />
            </button>

            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center">
              <NotificationCenter />
            </div>
          </motion.div>

          {/* Expanded State: Menu Content */}
          <motion.div
            id="mobile-navigation-content"
            animate={{
              opacity: isOpen ? 1 : 0,
              y: isOpen ? 0 : 20,
              pointerEvents: isOpen ? "auto" : "none",
            }}
            transition={{ duration: 0.35, delay: isOpen ? 0.05 : 0 }}
            className="relative flex flex-col w-full max-h-[80dvh]"
            aria-hidden={!isOpen}
          >
            {/* Drag Handle Component */}
            <div
              className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1.5 rounded-full bg-ethereal-graphite/20 shadow-inner" />
            </div>

            <header className="flex flex-shrink-0 items-center justify-between px-6 pt-2 pb-6">
              <BrandMark />
              <button
                onClick={() => {
                  handleClose();
                  if (window.history.state?.navigationOpen)
                    window.history.back();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-ethereal-graphite/5 hover:bg-ethereal-graphite/10 text-ethereal-graphite transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
                aria-label={t("navigation.mobile.close", "Close Navigation")}
              >
                <X size={20} strokeWidth={2} />
              </button>
            </header>

            {/* Scrollable Links Container */}
            <div className="flex-1 overflow-y-auto px-5 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-contain">
              <div className="flex flex-col gap-6">
                {navGroups.map((group) => (
                  <section key={group.labelKey} className="flex flex-col">
                    <Eyebrow
                      as="h3"
                      weight="semibold"
                      color="incense"
                      size="sm"
                      className="mb-2 pl-4 tracking-[0.25em] uppercase"
                    >
                      {t(group.labelKey)}
                    </Eyebrow>
                    <ul className="space-y-1 m-0 p-0 list-none">
                      {group.links.map((link) => {
                        const IconComponent = link.icon as React.ElementType;

                        return (
                          <li key={link.to}>
                            <NavLink
                              to={link.to}
                              end={link.to === "/panel"}
                              onClick={() => {
                                handleClose();
                                if (window.history.state?.navigationOpen)
                                  window.history.back();
                              }}
                              className={({ isActive }) =>
                                cn(mobileNavLinkVariants({ isActive }))
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  <div
                                    className={cn(
                                      "flex w-8 flex-shrink-0 items-center justify-center transition-colors duration-300 ease-out",
                                      isActive
                                        ? "text-ethereal-gold"
                                        : "text-ethereal-graphite/70 group-hover/moblink:text-ethereal-ink",
                                    )}
                                  >
                                    <IconComponent
                                      size={20}
                                      strokeWidth={isActive ? 2.5 : 1.5}
                                    />
                                  </div>
                                  <Text
                                    as="span"
                                    weight={isActive ? "medium" : "normal"}
                                    className={cn(
                                      "leading-none tracking-wide transition-colors duration-300",
                                      isActive
                                        ? "text-ethereal-gold"
                                        : "text-ethereal-graphite/80 group-hover/moblink:text-ethereal-ink",
                                    )}
                                  >
                                    {t(link.labelKey)}
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
              </div>
            </div>

            <footer className="flex-shrink-0 w-full bg-gradient-to-t from-white/95 to-white/60 backdrop-blur-xl relative pb-4 pt-2 rounded-b-[32px]">
              <Divider
                position="absolute-top"
                variant="fade"
                className="opacity-40"
              />
              <div className="px-7 pt-4 flex items-center justify-between gap-4">
                <div className="flex flex-col min-w-0">
                  <Label
                    as="p"
                    weight="medium"
                    className="truncate text-base text-ethereal-ink leading-none mb-1.5"
                  >
                    {userFullName}
                  </Label>
                  <Eyebrow
                    as="p"
                    color="incense"
                    className="truncate opacity-70 leading-none text-[0.7rem] tracking-wider uppercase"
                  >
                    {roleLabel}
                  </Eyebrow>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <NavLink
                    to="/panel/settings"
                    onClick={() => {
                      handleClose();
                      if (window.history.state?.navigationOpen)
                        window.history.back();
                    }}
                    aria-label={t("navigation.mobile.settings", "Settings")}
                    className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-ethereal-gold/10 border border-ethereal-gold/20 shadow-[var(--shadow-ethereal-subtle)] text-ethereal-graphite hover:text-ethereal-gold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 active:scale-95"
                  >
                    <Settings size={18} strokeWidth={2} />
                  </NavLink>
                  <button
                    onClick={logout}
                    aria-label={t("navigation.mobile.logout", "Log out")}
                    className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-ethereal-ink/5 hover:bg-red-50/80 border border-transparent hover:border-red-100 text-ethereal-graphite hover:text-red-500 transition-all outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-95"
                  >
                    <LogOut size={18} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </footer>
          </motion.div>
        </GlassCard>
      </div>
    </>
  );
};
