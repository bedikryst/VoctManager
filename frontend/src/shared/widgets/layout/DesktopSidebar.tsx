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

import { Heading, Eyebrow, Label } from "@/shared/ui/primitives/typography";
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

const navLinkVariants = cva(
  "group/desklink relative block h-10 rounded-xl transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 overflow-hidden",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/15 border border-ethereal-gold/30 shadow-(--shadow-ethereal-inset) text-ethereal-gold",
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
      {/* Overlay Backdrop: Kinetic Volumetric Shadow (2026 Trend)
          Instead of dulling the entire screen, we cast an ethereal volumetric
          gradient shadow from the left edge. This provides peripheral depth
          focusing attention on the sidebar without repainting the entire viewport. */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0.5 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0.5 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 left-0 z-30 w-[800px] pointer-events-none hidden md:block origin-left mix-blend-multiply"
            style={{
              background:
                "linear-gradient(to right, rgba(22, 20, 18, 0.12) 0%, rgba(22, 20, 18, 0.04) 40%, transparent 100%)",
            }}
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
          boxShadow: isExpanded
            ? "0 24px 64px -12px rgba(194, 168, 120, 0.15), 0 0 0 1px rgba(194, 168, 120, 0.25)"
            : "0 8px 32px rgba(166, 146, 121, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.3)",
        }}
        transition={KINETIC_TRANSITION}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        padding="none"
        aria-expanded={isExpanded}
        isHoverable={false}
        className="fixed bottom-4 left-4 top-4 z-60 hidden md:flex flex-col w-70 border-none will-change-[clip-path,box-shadow]"
      >
        <div className="flex flex-col h-full w-70 p-4 relative">
          {/* STRATUM: LOGO */}
          <div className="relative flex h-16 w-full shrink-0 items-start overflow-hidden mb-4">
            <motion.img
              src="/monogram_V.png"
              initial={false}
              animate={{
                opacity: isExpanded ? 0 : 1,
                scale: isExpanded ? 0 : 1,
              }}
              className="absolute left-3.5 top-2 h-14 object-contain"
            />

            <motion.div
              initial={false}
              animate={{
                opacity: isExpanded ? 1 : 0,
                x: isExpanded ? 0 : 20,
              }}
              transition={CONTENT_FADE_TRANSITION}
              className="absolute left-9 top-5 flex items-center pointer-events-none select-none"
              aria-hidden={!isExpanded}
            >
              <Heading size="4xl">
                Voct
                <Heading
                  as="span"
                  weight="light"
                  color="gold"
                  size="4xl"
                  className="italic"
                >
                  Manager
                </Heading>
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
                    <div className="absolute left-4 top-1 whitespace-nowrap">
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
                              <div className="absolute left-0 top-0 bottom-0 w-14 flex shrink-0 items-center justify-center transition-transform duration-300 ease-out group-active/desklink:scale-95">
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
                                className="absolute left-14 right-0 top-0 bottom-0 flex items-center whitespace-nowrap"
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
          <div className="mt-auto shrink-0 z-10 w-full relative pt-4 flex flex-col gap-3">
            <Divider
              variant="fade"
              position="absolute-top"
              className="opacity-50"
            />

            {/* Profile Block Pill */}
            <div
              style={{ width: isExpanded ? "100%" : "56px" }}
              className="relative flex h-12 rounded-[14px] bg-white/5 border border-white/10 overflow-hidden shadow-(--shadow-ethereal-soft) transition-[width] duration-300 ease-out"
            >
              <div className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-linear-to-br from-ethereal-gold/30 to-transparent border border-ethereal-gold/40">
                  <Label color="gold" size="sm" weight="semibold">
                    {initials}
                  </Label>
                </div>
              </div>
              <motion.div
                initial={false}
                animate={{ opacity: isExpanded ? 1 : 0 }}
                transition={CONTENT_FADE_TRANSITION}
                className="absolute left-14 right-2 top-0 bottom-0 flex flex-col justify-center whitespace-nowrap overflow-hidden"
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

            <div
              style={{ width: isExpanded ? "100%" : "56px" }}
              className="flex flex-wrap gap-2 transition-[width] duration-300 ease-out overflow-hidden"
            >
              <Link
                to="/panel/settings"
                aria-label={t("dashboard.layout.actions.settings")}
                className="group/settings relative block h-10 flex-1 min-w-14 rounded-xl hover:bg-white/10 text-ethereal-graphite/60 hover:text-ethereal-ink transition-colors duration-300 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
              >
                <div className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center transition-transform duration-300 ease-out group-active/settings:scale-95">
                  <Settings size={18} strokeWidth={2} />
                </div>
                <motion.div
                  initial={false}
                  animate={{ opacity: isExpanded ? 1 : 0 }}
                  transition={CONTENT_FADE_TRANSITION}
                  className="absolute left-14 right-0 top-0 bottom-0 flex items-center whitespace-nowrap"
                  aria-hidden={!isExpanded}
                >
                  <Label size="sm" weight="medium" color="inherit">
                    {t("dashboard.layout.actions.settings")}
                  </Label>
                </motion.div>
              </Link>

              <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-xl transition-all duration-300">
                <NotificationCenter />
              </div>

              <button
                onClick={logout}
                aria-label={t("dashboard.layout.actions.logout")}
                className="group/logout relative flex h-10 w-14 shrink-0 items-center justify-center rounded-xl hover:bg-red-500/10 text-ethereal-graphite/50 hover:text-red-600 transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
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
