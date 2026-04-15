/**
 * @file DesktopSidebar.tsx
 * @description Master Ethereal Sidebar.
 * Achieves 120fps kinematics via Absolute Anchors and GPU mask clipping.
 * ZERO layout thrashing. Strict adherence to Ethereal UI Taxonomy.
 */

import React from "react";
import { Link, NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Transition } from "framer-motion";
import { LogOut, Settings } from "lucide-react";
import { cva } from "class-variance-authority";

import { useNavigationAura } from "./hooks/useNavigationAura";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import type { AuthUser } from "@/shared/auth/auth.types";
import { cn } from "@/shared/lib/utils";
import { useSidebarKinematics } from "@/shared/ui/kinematics/hooks/useSidebarKinematics";

// Ethereal UI Primitives
import {
  Heading,
  Text,
  Eyebrow,
  Label,
} from "@/shared/ui/primitives/typography";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Divider } from "@/shared/ui/primitives/Divider";

interface DesktopSidebarProps {
  user: AuthUser | null;
  logout: () => void;
}

interface IconProps {
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
}

// Strictly typed transitions for TypeScript 7.0 inference
const KINETIC_TRANSITION: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 40,
  mass: 0.8,
};

const CONTENT_FADE_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};

// CVA is now simplified to handle background/border colors only.
// Dimension shifts are entirely managed by the parent Sidebar mask.
const navLinkVariants = cva(
  "relative block h-10 w-full rounded-[12px] transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 overflow-hidden",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/10 border border-ethereal-gold/30 shadow-[var(--shadow-ethereal-inset)] text-ethereal-gold",
        false:
          "border border-transparent text-ethereal-graphite/60 hover:text-ethereal-ink hover:bg-white/10",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);

export const DesktopSidebar = ({
  user,
  logout,
}: DesktopSidebarProps): React.JSX.Element => {
  const { isExpanded, handleMouseEnter, handleMouseLeave } =
    useSidebarKinematics();
  const { navGroups, userFullName, roleLabel, initials, t } =
    useNavigationAura(user);

  return (
    <>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(2px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[50] bg-ethereal-ink/5 pointer-events-none hidden md:block"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <GlassCard
        as={motion.aside}
        variant="ethereal"
        glow={true}
        withNoise={true}
        initial={false}
        // Mathematics of the mask: 88px (compact) = 16px left padding + 56px icon anchor + 16px right padding.
        animate={{ width: isExpanded ? 280 : 88 }}
        transition={KINETIC_TRANSITION}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        padding="none"
        aria-expanded={isExpanded}
        className="fixed bottom-4 left-4 top-4 z-[60] hidden md:flex flex-col rounded-[24px] border-white/30 shadow-[var(--shadow-ethereal-deep)] will-change-[width] overflow-hidden"
      >
        <div className="flex flex-col h-full w-full p-4 relative">
          {/* LOGO STRATUM */}
          <div className="relative flex h-16 w-full flex-shrink-0 items-center justify-center overflow-hidden mb-4">
            <motion.div
              initial={false}
              animate={{
                opacity: isExpanded ? 1 : 0,
                scale: isExpanded ? 1 : 0.95,
              }}
              transition={CONTENT_FADE_TRANSITION}
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
              aria-hidden={!isExpanded}
            >
              <Heading size="2xl">
                Voct
                <Text as="span" weight="medium" color="gold" size="lg">
                  Manager
                </Text>
              </Heading>
            </motion.div>

            <motion.div
              initial={false}
              animate={{
                opacity: isExpanded ? 0 : 1,
                scale: isExpanded ? 0.9 : 1,
              }}
              transition={CONTENT_FADE_TRANSITION}
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
              aria-hidden={isExpanded}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-ethereal-gold to-ethereal-ink/90 shadow-md">
                <Heading color="white" size="3xl" weight="medium">
                  V
                </Heading>
              </div>
            </motion.div>
          </div>

          {/* NAV STRATUM */}
          <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <nav
              aria-label={t("dashboard.layout.nav.main_menu")}
              className="flex flex-col space-y-3 w-full pb-4"
            >
              {navGroups.map((group) => (
                <div key={group.labelKey} className="w-full relative">
                  {/* Group Eyebrow */}
                  <motion.div
                    initial={false}
                    animate={{
                      height: isExpanded ? 20 : 0,
                      opacity: isExpanded ? 1 : 0,
                    }}
                    className="relative w-full overflow-hidden mb-1"
                    aria-hidden={!isExpanded}
                  >
                    <div className="absolute left-[12px] top-0 whitespace-nowrap">
                      <Eyebrow color="incense" size="xs">
                        {t(group.labelKey)}
                      </Eyebrow>
                    </div>
                  </motion.div>

                  {/* Nav Links Node */}
                  <div className="flex flex-col space-y-1 w-full">
                    {group.links.map((link) => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        end={link.to === "/panel"}
                        className={({ isActive }) =>
                          cn(navLinkVariants({ isActive }))
                        }
                        aria-label={!isExpanded ? t(link.labelKey) : undefined}
                      >
                        {({ isActive }) => (
                          <>
                            <div className="absolute left-0 top-0 bottom-0 w-[56px] flex flex-shrink-0 items-center justify-center">
                              {React.cloneElement(
                                link.icon as React.ReactElement<IconProps>,
                                {
                                  size: 18,
                                  strokeWidth: isActive ? 2.5 : 2,
                                },
                              )}
                            </div>

                            <motion.div
                              initial={false}
                              animate={{ opacity: isExpanded ? 1 : 0 }}
                              transition={CONTENT_FADE_TRANSITION}
                              className="absolute left-[56px] right-0 top-0 bottom-0 flex items-center whitespace-nowrap"
                              aria-hidden={!isExpanded}
                            >
                              <Label
                                weight="medium"
                                size="base"
                                color={isActive ? "default" : "muted"}
                              >
                                {t(link.labelKey)}
                              </Label>
                            </motion.div>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          {/* USER ACTIONS STRATUM */}
          <div className="mt-auto flex-shrink-0 z-10 w-full relative pt-4">
            <Divider
              variant="fade"
              position="absolute-top"
              className="opacity-50"
            />

            <motion.div layout className="flex flex-col gap-2 w-full">
              <motion.div
                layout
                className={cn(
                  "flex gap-2",
                  isExpanded ? "flex-row items-center" : "flex-col",
                )}
              >
                <motion.div
                  layout="position"
                  className="relative mt-1 flex h-[48px] flex-1 min-w-0 rounded-[14px] bg-white/5 border border-white/10 overflow-hidden shadow-[var(--shadow-ethereal-soft)]"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[56px] flex items-center justify-center flex-shrink-0">
                    <div className="flex h-[32px] w-[32px] items-center justify-center rounded-[10px] bg-gradient-to-br from-ethereal-gold/20 to-transparent border border-ethereal-gold/30">
                      <Label color="gold" size="sm" weight="semibold">
                        {initials}
                      </Label>
                    </div>
                  </div>
                  <motion.div
                    initial={false}
                    animate={{ opacity: isExpanded ? 1 : 0 }}
                    transition={CONTENT_FADE_TRANSITION}
                    className="absolute left-[56px] right-2 top-0 bottom-0 flex flex-col justify-center whitespace-nowrap overflow-hidden min-w-0"
                    aria-hidden={!isExpanded}
                  >
                    <Label
                      size="sm"
                      weight="medium"
                      className="truncate block leading-tight text-ethereal-ink"
                    >
                      {userFullName}
                    </Label>
                    <Eyebrow
                      color="incense"
                      size="xs"
                      className="truncate block opacity-80 leading-tight mt-0.5"
                    >
                      {roleLabel}
                    </Eyebrow>
                  </motion.div>
                </motion.div>

                <motion.div
                  layout
                  className="relative flex h-[40px] w-[56px] flex-shrink-0 items-center justify-center rounded-[12px] transition-colors"
                >
                  <NotificationCenter />
                </motion.div>
              </motion.div>

              <motion.div
                layout
                className={cn(
                  "flex gap-2",
                  isExpanded ? "flex-row items-center" : "flex-col",
                )}
              >
                <motion.div layout className="flex-1">
                  <Link
                    to="/panel/settings"
                    aria-label={t("dashboard.layout.actions.settings")}
                    className="relative block h-[40px] w-full rounded-[12px] hover:bg-white/10 text-ethereal-graphite/60 hover:text-ethereal-ink transition-colors overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[56px] flex items-center justify-center">
                      <Settings size={18} strokeWidth={2} />
                    </div>
                    <motion.div
                      initial={false}
                      animate={{ opacity: isExpanded ? 1 : 0 }}
                      transition={CONTENT_FADE_TRANSITION}
                      className="absolute left-[56px] right-0 top-0 bottom-0 flex items-center whitespace-nowrap"
                      aria-hidden={!isExpanded}
                    >
                      <Label size="sm" weight="medium" color="inherit">
                        {t("dashboard.layout.actions.settings")}
                      </Label>
                    </motion.div>
                  </Link>
                </motion.div>

                <motion.button
                  layout
                  onClick={logout}
                  aria-label={t("dashboard.layout.actions.logout")}
                  className="relative flex h-[40px] w-[56px] flex-shrink-0 items-center justify-center rounded-[12px] hover:bg-red-500/10 text-ethereal-graphite/50 hover:text-red-600 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                >
                  <LogOut size={18} strokeWidth={2.5} />
                </motion.button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </GlassCard>
    </>
  );
};
