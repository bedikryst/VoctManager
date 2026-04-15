/**
 * @file DesktopSidebar.tsx
 * @description Enterprise SaaS Collapsible Sidebar (High-Density Mode).
 * Flawlessly adheres to Ethereal UI taxonomy, Strict TS 7.0, and layout kinematics.
 * @module shared/widgets/layout/DesktopSidebar
 */

import React from "react";
import { Link, NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Settings } from "lucide-react";
import { cva } from "class-variance-authority";

import { useNavigationAura } from "./hooks/useNavigationAura";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import type { AuthUser } from "@/shared/auth/auth.types";
import { cn } from "@/shared/lib/utils";
import { useSidebarKinematics } from "@/shared/ui/kinematics/hooks/useSidebarKinematics";

// Ethereal UI Primitives & Composites
import { Typography } from "@/shared/ui/primitives/Typography";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";

interface DesktopSidebarProps {
  user: AuthUser | null;
  logout: () => void;
}

interface IconProps {
  size?: number | string;
  className?: string;
  strokeWidth?: number | string;
}

const navLinkVariants = cva(
  "group/link relative flex items-center transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
  {
    variants: {
      isActive: {
        true: "border-ethereal-gold/30 bg-ethereal-gold/10 shadow-[var(--shadow-ethereal-inset)] text-ethereal-gold",
        false:
          "border-transparent text-ethereal-graphite/60 hover:text-ethereal-ink hover:bg-white/40",
      },
      isExpanded: {
        true: "w-full rounded-[10px] border px-3 h-9 justify-start",
        false: "w-10 h-10 rounded-[12px] border p-0 justify-center",
      },
    },
    defaultVariants: {
      isActive: false,
      isExpanded: true,
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[50] bg-ethereal-ink/5 backdrop-blur-[2px] pointer-events-none hidden md:block"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <GlassCard
        as={motion.aside}
        variant="ethereal"
        glow={false}
        withNoise={true}
        initial={false}
        animate={{ width: isExpanded ? 280 : 80 }}
        transition={{ type: "spring", stiffness: 400, damping: 40, mass: 0.8 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        padding="none"
        className="fixed bottom-4 left-4 top-4 z-[60] hidden md:flex flex-col rounded-[24px] border-white/30 shadow-[var(--shadow-ethereal-deep)] will-change-[width] overflow-hidden"
      >
        <div className="flex flex-col h-full w-full">
          <div className="relative flex h-20 flex-shrink-0 items-center justify-center pt-2">
            <AnimatePresence mode="wait">
              {isExpanded ? (
                <motion.div
                  key="full"
                  initial={{ opacity: 0, filter: "blur(2px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(2px)" }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center select-none"
                >
                  <Typography
                    variant="title"
                    className="text-[22px] tracking-tight flex items-baseline gap-[2px]"
                  >
                    Voct
                    <Typography
                      as="span"
                      variant="emphasis"
                      color="gold"
                      className="text-lg"
                    >
                      Manager
                    </Typography>
                  </Typography>
                </motion.div>
              ) : (
                <motion.div
                  key="compact"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-ethereal-gold to-ethereal-ink shadow-md select-none"
                >
                  <Typography
                    variant="subtitle"
                    color="inherit"
                    className="text-white/70"
                  >
                    V
                  </Typography>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 min-h-0 w-full">
            <nav
              className={cn(
                "h-full overflow-y-auto overflow-x-hidden transition-all duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full flex flex-col",
                isExpanded ? "px-4 py-2" : "px-0 py-4 items-center",
              )}
            >
              <div
                className={cn(
                  "w-full transition-all duration-300",
                  isExpanded
                    ? "space-y-5"
                    : "flex flex-col items-center space-y-4",
                )}
              >
                {navGroups.map((group) => (
                  <div
                    key={group.labelKey}
                    className={cn(
                      "relative",
                      isExpanded
                        ? "w-full space-y-1"
                        : "flex flex-col items-center space-y-3",
                    )}
                  >
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                          animate={{
                            opacity: 0.6,
                            height: 20,
                            marginBottom: 4,
                          }}
                          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                          transition={{ duration: 0.2 }}
                          className="px-2 overflow-hidden whitespace-nowrap flex items-center"
                        >
                          <Typography
                            as="span"
                            variant="eyebrow"
                            color="incense"
                            className="tracking-widest font-sans"
                          >
                            {t(group.labelKey)}
                          </Typography>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div
                      className={cn(
                        isExpanded
                          ? "w-full space-y-0.5"
                          : "flex flex-col items-center space-y-1",
                      )}
                    >
                      {group.links.map((link) => (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          end={link.to === "/panel"}
                          className={({ isActive }) =>
                            cn(navLinkVariants({ isActive, isExpanded }))
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <div
                                className={cn(
                                  "flex flex-shrink-0 items-center justify-center transition-colors duration-300",
                                  isExpanded ? "w-6" : "w-10 h-6",
                                  isActive
                                    ? "text-ethereal-gold"
                                    : "currentColor",
                                )}
                              >
                                {React.cloneElement(
                                  link.icon as React.ReactElement<IconProps>,
                                  {
                                    size: 18,
                                    strokeWidth: isActive ? 2.5 : 2,
                                  },
                                )}
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{
                                      opacity: 0,
                                      width: 0,
                                      marginLeft: 0,
                                    }}
                                    animate={{
                                      opacity: 1,
                                      width: "auto",
                                      marginLeft: 10,
                                    }}
                                    exit={{
                                      opacity: 0,
                                      width: 0,
                                      marginLeft: 0,
                                    }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden whitespace-nowrap flex items-center"
                                  >
                                    <Typography
                                      as="span"
                                      variant="label"
                                      color={isActive ? "default" : "muted"}
                                      className={cn(
                                        "font-sans font-medium tracking-wide text-[13px]",
                                        !isActive &&
                                          "group-hover/link:text-ethereal-ink",
                                      )}
                                    >
                                      {t(link.labelKey)}
                                    </Typography>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </nav>
          </div>

          {/* User Actions Stratum - Czysta forma */}
          <div
            className={cn(
              "mt-auto flex-shrink-0 z-10 w-full transition-all duration-300 relative",
              "before:absolute before:top-0 before:left-5 before:right-5 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent",
              isExpanded
                ? "px-5 pb-5 pt-5"
                : "px-0 pb-6 pt-5 flex flex-col items-center",
            )}
          >
            <div
              className={cn(
                "flex transition-all duration-300 w-full",
                isExpanded ? "flex-col gap-4" : "flex-col items-center gap-5",
              )}
            >
              <div
                className={cn(
                  "flex items-center min-w-0",
                  isExpanded ? "gap-3 w-full" : "flex-col gap-5 w-[64px]",
                )}
              >
                {!isExpanded && <NotificationCenter />}

                <div
                  className={cn(
                    "flex flex-shrink-0 items-center justify-center rounded-[12px] transition-transform hover:scale-105",
                    "bg-gradient-to-br from-ethereal-gold/10 to-transparent border border-ethereal-gold/20 shadow-[var(--shadow-ethereal-soft)]",
                    isExpanded ? "h-10 w-10" : "h-10 w-10",
                  )}
                >
                  <Typography
                    variant="label"
                    color="gold"
                    className="font-semibold text-xs"
                  >
                    {initials}
                  </Typography>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 min-w-0 flex items-center justify-between overflow-hidden"
                    >
                      <div className="min-w-0 pr-2">
                        <Typography
                          variant="label"
                          className="truncate block font-medium text-[13px] leading-tight text-ethereal-ink font-sans"
                        >
                          {userFullName}
                        </Typography>
                        <Typography
                          variant="eyebrow"
                          color="incense"
                          className="truncate block mt-1 tracking-widest opacity-80 font-sans"
                        >
                          {roleLabel}
                        </Typography>
                      </div>
                      <NotificationCenter />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div
                className={cn(
                  "flex",
                  isExpanded
                    ? "items-center justify-between w-full"
                    : "flex-col gap-3",
                )}
              >
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "flex items-center rounded-[10px] text-ethereal-graphite/60 hover:text-ethereal-ink hover:bg-white/40 transition-colors",
                    isExpanded
                      ? "flex-1 justify-start gap-2.5 h-9 px-2"
                      : "w-10 h-10 p-0 justify-center",
                  )}
                >
                  <Link
                    to="/panel/settings"
                    aria-label={t("dashboard.layout.actions.settings")}
                  >
                    <Settings size={16} strokeWidth={2} />
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          <Typography
                            as="span"
                            variant="label"
                            className="text-[12px] font-medium pointer-events-none tracking-wide font-sans"
                          >
                            {t("dashboard.layout.actions.settings")}
                          </Typography>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Link>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className={cn(
                    "flex items-center justify-center rounded-[10px] text-ethereal-graphite/50 hover:text-red-600 hover:bg-red-500/10 transition-colors",
                    isExpanded ? "w-9 h-9 p-0 flex-shrink-0" : "w-10 h-10 p-0",
                  )}
                  aria-label={t("dashboard.layout.actions.logout")}
                >
                  <LogOut size={16} strokeWidth={2.5} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </>
  );
};
