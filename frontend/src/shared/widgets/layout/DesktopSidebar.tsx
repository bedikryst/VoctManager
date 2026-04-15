/**
 * @file DesktopSidebar.tsx
 * @description Refactored Enterprise Sidebar.
 * ZERO raw CSS for text/dividers. Adheres to A11y 2026.
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

// Ethereal UI Primitives
import {
  Heading,
  Text,
  Eyebrow,
  Label,
} from "@/shared/ui/primitives/typography";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
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

const navLinkVariants = cva(
  "group/link relative flex items-center transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
  {
    variants: {
      isActive: {
        true: "border-ethereal-gold/30 bg-ethereal-gold/10 shadow-[var(--shadow-ethereal-inset)] text-ethereal-gold",
        false:
          "border-transparent text-ethereal-graphite/60 hover:text-ethereal-ink hover:bg-white/10",
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
        aria-expanded={isExpanded}
        className="fixed bottom-4 left-4 top-4 z-[60] hidden md:flex flex-col rounded-[24px] border-white/30 shadow-[var(--shadow-ethereal-deep)] will-change-[width] overflow-hidden"
      >
        <div className="flex flex-col h-full w-full">
          {/* LOGO STRATUM */}
          <div className="relative flex h-20 flex-shrink-0 items-center justify-center pt-2">
            <AnimatePresence mode="wait">
              {isExpanded ? (
                <motion.div
                  key="full"
                  initial={{ opacity: 0, filter: "blur(2px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(2px)" }}
                  className="flex items-center select-none"
                >
                  <Heading size="2xl">
                    Voct
                    <Text as="span" weight="medium" color="gold" size="lg">
                      Manager
                    </Text>
                  </Heading>
                </motion.div>
              ) : (
                <motion.div
                  key="compact"
                  className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-ethereal-gold to-ethereal-ink/90 shadow-md select-none"
                >
                  <Heading color="white" size="3xl" weight="medium">
                    V
                  </Heading>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* NAV STRATUM */}
          <div className="flex-1 min-h-0 w-full">
            <nav
              aria-label={t("dashboard.layout.nav.main_menu")}
              className={cn(
                "h-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col",
                isExpanded ? "px-4 py-2" : "px-0 py-4 items-center",
              )}
            >
              <div
                className={cn(
                  "w-full transition-all",
                  isExpanded ? "space-y-5" : "space-y-4",
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
                    {isExpanded && (
                      <div className="px-2 mb-1">
                        <Eyebrow color="incense" size="xs">
                          {t(group.labelKey)}
                        </Eyebrow>
                      </div>
                    )}

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
                                  "flex flex-shrink-0 items-center justify-center",
                                  isExpanded ? "w-6" : "w-10 h-6",
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

                              {isExpanded && (
                                <div className="ml-[10px] overflow-hidden whitespace-nowrap">
                                  <Label
                                    weight="medium"
                                    size="base"
                                    color={isActive ? "default" : "muted"}
                                  >
                                    {t(link.labelKey)}
                                  </Label>
                                </div>
                              )}
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

          {/* USER ACTIONS STRATUM */}
          <div
            className={cn(
              "mt-auto flex-shrink-0 z-10 w-full",
              isExpanded
                ? "px-5 pb-5 pt-5"
                : "px-0 pb-6 pt-5 flex flex-col items-center",
            )}
          >
            <Divider
              variant="fade"
              position="absolute-top"
              className="opacity-50"
            />

            <div
              className={cn(
                "flex w-full",
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

                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-ethereal-gold/10 to-transparent border border-ethereal-gold/20 shadow-[var(--shadow-ethereal-soft)]">
                  <Label color="gold" size="sm" weight="semibold">
                    {initials}
                  </Label>
                </div>

                {isExpanded && (
                  <div className="flex-1 min-w-0 flex items-center justify-between overflow-hidden">
                    <div className="min-w-0 pr-2">
                      <Label
                        size="base"
                        weight="medium"
                        className="truncate block"
                      >
                        {userFullName}
                      </Label>
                      <Eyebrow
                        color="incense"
                        size="xs"
                        className="truncate block mt-1 opacity-80"
                      >
                        {roleLabel}
                      </Eyebrow>
                    </div>
                    <NotificationCenter />
                  </div>
                )}
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
                  className={cn(
                    "rounded-[10px] text-ethereal-graphite/60 hover:text-ethereal-ink hover:bg-white/10 transition-colors",
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
                    {isExpanded && (
                      <Label size="sm" weight="medium">
                        {t("dashboard.layout.actions.settings")}
                      </Label>
                    )}
                  </Link>
                </Button>

                <Button
                  variant="ghost"
                  onClick={logout}
                  aria-label={t("dashboard.layout.actions.logout")}
                  className={cn(
                    "rounded-[10px] text-ethereal-graphite/50 hover:text-red-600 hover:bg-red-500/10",
                    isExpanded ? "w-9 h-9 p-0" : "w-10 h-10 p-0",
                  )}
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
