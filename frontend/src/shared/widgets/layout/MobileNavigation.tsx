/**
 * @file MobileNavigation.tsx
 * @description Enterprise SaaS Gestural Bottom Sheet & Navigation Matrix.
 * Infused with fluid drag physics, velocity-based dismissal, and pristine Ethereal aesthetics.
 * Solves the 'Brand Amnesia' and introduces a strict unified 'User Command Center'.
 * @module shared/widgets/layout/MobileNavigation
 */

import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  type Transition,
  type PanInfo,
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

interface IconProps {
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
}

// Hyper-tuned spring physics for gestural feedback
const MORPH_TRANSITION: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 38,
  mass: 0.8,
};

const mobileNavLinkVariants = cva(
  "group/moblink relative flex items-center gap-4 rounded-[20px] px-5 py-3.5 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 overflow-hidden will-change-[background-color,transform] active:scale-[0.98]",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/15 border border-ethereal-gold/30 shadow-[var(--shadow-ethereal-inset)] text-ethereal-gold",
        false:
          "border border-transparent text-ethereal-graphite/70 hover:text-ethereal-ink hover:bg-white/20",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);

const BrandMark = (): React.JSX.Element => (
  <Heading
    as="span"
    size="lg"
    className="tracking-tight select-none pt-0.5 flex items-center"
  >
    <span className="font-medium text-ethereal-ink">Voct</span>
    <Text as="span" weight="light" color="gold" className="italic ml-1">
      Manager
    </Text>
  </Heading>
);

export const MobileNavigation = ({
  user,
  logout,
}: MobileNavigationProps): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dockRef = useRef<HTMLDivElement>(null);

  const { navGroups, userFullName, roleLabel, initials, t } =
    useNavigationAura(user);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [isOpen]);

  // Gestural physics: Calculate if the swipe was hard or far enough to dismiss
  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const swipeThreshold = 100;
    const velocityThreshold = 500;
    if (info.offset.y > swipeThreshold || info.velocity.y > velocityThreshold) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Background Deep Aura */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[60] bg-ethereal-ink/20 md:hidden"
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 z-[70] px-3 pb-safe-offset-4 pt-4 flex justify-center pointer-events-none md:hidden">
        <GlassCard
          as={motion.nav}
          ref={dockRef}
          variant="ethereal"
          withNoise={true}
          glow={isOpen}
          padding="none"
          initial={false}
          animate={{
            borderRadius: isOpen ? 36 : 40,
            height: isOpen ? "88dvh" : 72,
          }}
          transition={MORPH_TRANSITION}
          // The entire shell is conditionally draggable ONLY when open
          drag={isOpen ? "y" : false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          className="pointer-events-auto relative w-full overflow-hidden border border-white/40 shadow-[var(--shadow-ethereal-deep)]"
          aria-expanded={isOpen}
          aria-label={t(
            "dashboard.layout.aria.mobileNav",
            "Mobile Navigation Matrix",
          )}
        >
          <AnimatePresence initial={false}>
            {!isOpen ? (
              /* --- STATE: THE FLOATING ORBIT --- */
              <motion.div
                key="collapsed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-between px-3"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-ethereal-gold/20 to-transparent border border-ethereal-gold/30 shadow-[var(--shadow-ethereal-soft)]">
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
                  onClick={() => setIsOpen(true)}
                  className="group flex flex-1 items-center justify-center gap-3 h-full px-4 transition-colors outline-none"
                  aria-label={t(
                    "dashboard.layout.aria.openMenu",
                    "Awaken Menu",
                  )}
                >
                  <Menu
                    className="text-ethereal-graphite group-hover:text-ethereal-gold transition-colors"
                    size={22}
                    strokeWidth={2.5}
                  />
                  <BrandMark />
                </button>

                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center">
                  <NotificationCenter />
                </div>
              </motion.div>
            ) : (
              /* --- STATE: THE GESTURAL CATHEDRAL --- */
              <motion.div
                key="expanded"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{
                  duration: 0.4,
                  delay: 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="absolute inset-0 flex flex-col"
              >
                {/* Gestural Cue (The Handle) */}
                <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                  <div className="w-12 h-1.5 rounded-full bg-ethereal-graphite/20 shadow-inner" />
                </div>

                {/* Stratum I: Restored Brand Context */}
                <div className="flex flex-shrink-0 items-center justify-between px-6 pt-2 pb-5">
                  <BrandMark />
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ethereal-graphite/5 hover:bg-ethereal-graphite/15 text-ethereal-graphite transition-all outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 active:scale-90"
                    aria-label={t(
                      "dashboard.layout.aria.closeMenu",
                      "Collapse Menu",
                    )}
                  >
                    <X size={20} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>

                {/* Stratum II: The Core Routes */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-contain">
                  <div className="space-y-8">
                    {navGroups.map((group) => (
                      <div key={group.labelKey} className="flex flex-col">
                        <Eyebrow
                          as="h3"
                          color="incense"
                          className="mb-3 pl-3 tracking-[0.2em] uppercase opacity-70 font-semibold"
                        >
                          {t(group.labelKey)}
                        </Eyebrow>
                        <ul className="space-y-2 m-0 p-0 list-none">
                          {group.links.map((link) => (
                            <li key={link.to}>
                              <NavLink
                                to={link.to}
                                end={link.to === "/panel"}
                                onClick={() => setIsOpen(false)}
                                className={({ isActive }) =>
                                  cn(mobileNavLinkVariants({ isActive }))
                                }
                              >
                                {({ isActive }) => (
                                  <>
                                    <div className="flex w-8 flex-shrink-0 items-center justify-center">
                                      {React.cloneElement(
                                        link.icon as React.ReactElement<IconProps>,
                                        {
                                          size: 20,
                                          strokeWidth: isActive ? 2.5 : 1.5,
                                        },
                                      )}
                                    </div>
                                    <Label
                                      as="span"
                                      weight={isActive ? "medium" : "normal"}
                                      color="inherit"
                                      className="text-[17px] tracking-wide pt-px"
                                    >
                                      {t(link.labelKey)}
                                    </Label>
                                  </>
                                )}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stratum III: User Command Center (Unified) */}
                <div className="flex-shrink-0 w-full bg-white/40 backdrop-blur-xl relative pb-safe">
                  <Divider
                    position="absolute-top"
                    variant="fade"
                    className="opacity-30"
                  />

                  <div className="px-5 pt-5 pb-6 flex flex-col gap-4">
                    {/* Embedded User Aura */}
                    <div className="flex items-center gap-4 px-2">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white/60 border border-white/80 shadow-sm">
                        <Label
                          as="span"
                          color="gold"
                          weight="bold"
                          className="tracking-widest"
                        >
                          {initials}
                        </Label>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <Label
                          as="p"
                          color="default"
                          weight="semibold"
                          className="truncate text-[17px] text-ethereal-ink leading-none"
                        >
                          {userFullName}
                        </Label>
                        <Eyebrow
                          as="p"
                          color="incense"
                          size="sm"
                          className="truncate mt-1.5 opacity-80 leading-none"
                        >
                          {roleLabel}
                        </Eyebrow>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <NavLink
                        to="/panel/settings"
                        onClick={() => setIsOpen(false)}
                        className="flex flex-1 h-[48px] items-center justify-center rounded-[16px] bg-white border border-white/60 shadow-sm text-ethereal-graphite hover:text-ethereal-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 active:scale-[0.98]"
                      >
                        <Settings size={18} strokeWidth={2} className="mr-2" />
                        <Label size="sm" weight="semibold" color="inherit">
                          {t("dashboard.layout.actions.settings", "Settings")}
                        </Label>
                      </NavLink>
                      <button
                        onClick={logout}
                        className="flex h-[48px] w-[56px] flex-shrink-0 items-center justify-center rounded-[16px] bg-red-50 hover:bg-red-100 border border-red-100 text-red-500 hover:text-red-600 transition-colors shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-[0.96]"
                        aria-label={t(
                          "dashboard.layout.actions.logout",
                          "Logout",
                        )}
                      >
                        <LogOut size={18} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>
    </>
  );
};
