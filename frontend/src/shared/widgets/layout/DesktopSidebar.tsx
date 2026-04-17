/**
 * @file DesktopSidebar.tsx
 * @description Master Ethereal Sidebar - Fluid Overlay Edition.
 * Achieves 120fps kinematics via Absolute Anchors and GPU clip-path masking.
 * Implements "Floating Pill" design to prevent edge-bleeding during hardware clipping.
 * ZERO layout thrashing. Strict adherence to Ethereal UI Taxonomy.
 * @module shared/widgets/layout/DesktopSidebar
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

// Removed absolute w-full. Width is now dynamically injected via inline styles
// to create the "Floating Pill" effect, ensuring it never touches the clip-path edge.
const navLinkVariants = cva(
  "group/desklink relative block h-10 rounded-[12px] transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 overflow-hidden",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/15 border border-ethereal-gold/30 shadow-[var(--shadow-ethereal-inset)] text-ethereal-gold",
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
      {/* Overlay Backdrop: Dimming the content behind the sidebar without squeezing the layout */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[30] backdrop-blur-[2px] pointer-events-none hidden md:block"
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
        animate={{
          clipPath: isExpanded
            ? "inset(0px 0% 0px 0px round 2.5rem)"
            : "inset(0px calc(100% - 88px) 0px 0px round 2.5rem)",
        }}
        transition={KINETIC_TRANSITION}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        padding="none"
        aria-expanded={isExpanded}
        className="fixed bottom-4 left-4 top-4 z-[60] hidden md:flex flex-col w-[280px] border-white/30 shadow-[var(--shadow-ethereal-deep)] will-change-[clip-path]"
      >
        <div className="flex flex-col h-full w-[280px] p-4 relative">
          {/* STRATUM: LOGO */}
          <div className="relative flex h-16 w-full flex-shrink-0 items-center overflow-hidden mb-4 pl-2">
            <motion.div
              initial={false}
              animate={{
                opacity: isExpanded ? 0 : 1,
                scale: isExpanded ? 0.9 : 1,
              }}
              transition={CONTENT_FADE_TRANSITION}
              className="absolute flex items-center justify-center pointer-events-none select-none w-10 h-10 rounded-[12px] bg-gradient-to-br from-ethereal-gold to-ethereal-ink/90 shadow-md"
              aria-hidden={isExpanded}
            >
              <Heading color="white" size="3xl" weight="medium">
                V
              </Heading>
            </motion.div>

            <motion.div
              initial={false}
              animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : -20 }}
              transition={CONTENT_FADE_TRANSITION}
              className="absolute left-[56px] flex items-center pointer-events-none select-none"
              aria-hidden={!isExpanded}
            >
              <Heading size="4xl">
                Voct
                <Text as="span" weight="light" color="gold" size="3xl">
                  Manager
                </Text>
              </Heading>
            </motion.div>
          </div>

          {/* STRATUM: NAVIGATION */}
          <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <nav
              aria-label={t("dashboard.layout.nav.main_menu")}
              className="flex flex-col space-y-3 w-full pb-4"
            >
              {navGroups.map((group) => (
                <div key={group.labelKey} className="w-full relative">
                  <motion.div
                    initial={false}
                    animate={{
                      height: isExpanded ? 24 : 0,
                      opacity: isExpanded ? 1 : 0,
                    }}
                    className="relative w-full overflow-hidden mb-1"
                    aria-hidden={!isExpanded}
                  >
                    <div className="absolute left-[16px] top-1 whitespace-nowrap">
                      <Eyebrow
                        color="muted"
                        className="tracking-[0.25em] uppercase"
                      >
                        {t(group.labelKey)}
                      </Eyebrow>
                    </div>
                  </motion.div>

                  <div className="flex flex-col space-y-1 w-full">
                    {group.links.map((link) => {
                      const IconComponent = link.icon as React.ElementType;
                      return (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          end={link.to === "/panel"}
                          // Floating Pill transition logic:
                          style={{ width: isExpanded ? "100%" : "56px" }}
                          className={({ isActive }) =>
                            cn(
                              navLinkVariants({ isActive }),
                              "transition-[width] duration-300 ease-out will-change-[width]",
                            )
                          }
                          aria-label={
                            !isExpanded ? t(link.labelKey) : undefined
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <div className="absolute left-0 top-0 bottom-0 w-[56px] flex flex-shrink-0 items-center justify-center transition-transform duration-300 ease-out group-active/desklink:scale-95">
                                <IconComponent
                                  size={18}
                                  strokeWidth={isActive ? 2.5 : 1.5}
                                  className="transition-all duration-300"
                                />
                              </div>
                              <motion.div
                                initial={false}
                                animate={{
                                  opacity: isExpanded ? 1 : 0,
                                  x: isExpanded ? 0 : -4,
                                }}
                                transition={CONTENT_FADE_TRANSITION}
                                className="absolute left-[56px] right-0 top-0 bottom-0 flex items-center whitespace-nowrap"
                                aria-hidden={!isExpanded}
                              >
                                <Label
                                  weight={isActive ? "semibold" : "medium"}
                                  size="base"
                                  color="inherit"
                                  className="transition-all duration-300"
                                >
                                  {t(link.labelKey)}
                                </Label>
                              </motion.div>
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          {/* STRATUM: USER ACTIONS */}
          <div className="mt-auto flex-shrink-0 z-10 w-full relative pt-4 flex flex-col gap-3">
            <Divider
              variant="fade"
              position="absolute-top"
              className="opacity-50"
            />

            {/* Profile Block Pill */}
            <div
              style={{ width: isExpanded ? "100%" : "56px" }}
              className="relative flex h-[48px] rounded-[14px] bg-white/5 border border-white/10 overflow-hidden shadow-[var(--shadow-ethereal-soft)] transition-[width] duration-300 ease-out"
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
                className="absolute left-[56px] right-2 top-0 bottom-0 flex flex-col justify-center whitespace-nowrap overflow-hidden"
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
            </div>

            {/* Hardware-Accelerated Flex-Wrap Actions.
                Expands horizontally to 100%, collapses to 56px, forcing icons to wrap vertically 
                smoothly without causing React Reconciler layout thrashing.
            */}
            <div
              style={{ width: isExpanded ? "100%" : "56px" }}
              className="flex flex-wrap gap-2 transition-[width] duration-300 ease-out overflow-hidden"
            >
              <Link
                to="/panel/settings"
                aria-label={t("dashboard.layout.actions.settings")}
                className="group/settings relative block h-[40px] flex-1 min-w-[56px] rounded-[12px] hover:bg-white/10 text-ethereal-graphite/60 hover:text-ethereal-ink transition-colors duration-300 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
              >
                <div className="absolute left-0 top-0 bottom-0 w-[56px] flex items-center justify-center transition-transform duration-300 ease-out group-active/settings:scale-95">
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

              {/* RECOVERED NOTIFICATIONS */}
              <div className="flex h-[40px] w-[56px] flex-shrink-0 items-center justify-center rounded-[12px] transition-all duration-300">
                <NotificationCenter />
              </div>

              <button
                onClick={logout}
                aria-label={t("dashboard.layout.actions.logout")}
                className="group/logout relative flex h-[40px] w-[56px] flex-shrink-0 items-center justify-center rounded-[12px] hover:bg-red-500/10 text-ethereal-graphite/50 hover:text-red-600 transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
              >
                <div className="transition-transform duration-300 ease-out group-active/logout:scale-95">
                  <LogOut size={18} strokeWidth={2.5} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </GlassCard>
    </>
  );
};
