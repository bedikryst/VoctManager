/**
 * @file DesktopSidebar.tsx
 * @description Enterprise SaaS Collapsible Sidebar (High-Density Mode).
 * Fully adheres to Ethereal UI taxonomy, Strict TS 7.0, and layout kinematics.
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
import { Divider } from "@/shared/ui/primitives/Divider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";

interface DesktopSidebarProps {
  user: AuthUser | null;
  logout: () => void;
}

// Strict interface to satisfy TS 7.0 cloneElement constraint
interface IconProps {
  size?: number | string;
  className?: string;
}

const navLinkVariants = cva(
  "group/link relative flex items-center transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 overflow-hidden",
  {
    variants: {
      isActive: {
        true: "border-ethereal-gold/30 bg-ethereal-gold/10 shadow-[var(--shadow-ethereal-inset)] text-ethereal-gold",
        false:
          "border-transparent text-ethereal-graphite/60 hover:text-ethereal-ink hover:bg-white/40 hover:shadow-[var(--shadow-ethereal-soft)]",
      },
      isExpanded: {
        true: "w-full rounded-xl border px-3 py-2.5 justify-start",
        // Wymuszona idealna symetria: padding 0, sztywne wymiary
        false: "w-11 h-11 rounded-2xl border p-0 justify-center mx-auto",
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
    <GlassCard
      as={motion.aside}
      variant="ethereal"
      glow={false}
      withNoise={true}
      animate={{ width: isExpanded ? 280 : 88 }}
      transition={{ type: "spring", stiffness: 350, damping: 35 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed bottom-4 left-4 top-4 z-[60] hidden md:flex flex-col rounded-[24px] border-white/40 shadow-2xl"
    >
      {/* Brand Stratum */}
      <div className="relative flex h-20 flex-shrink-0 items-center justify-center">
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="full"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.2 }}
              className="flex items-center select-none"
            >
              <Typography variant="title" className="text-xl tracking-tight">
                Voct
                <span className="italic text-ethereal-gold ml-[2px]">
                  Manager
                </span>
              </Typography>
            </motion.div>
          ) : (
            <motion.div
              key="compact"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-ethereal-gold to-ethereal-ink shadow-md select-none"
            >
              <Typography
                variant="title"
                color="inherit"
                className="text-white"
              >
                V
              </Typography>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Stratum */}
      {/* Dynamiczny padding kontenera uwalnia przestrzeń (Box Model Constraint Fix) */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          isExpanded ? "px-4 py-2" : "px-2 py-4",
        )}
      >
        <div className="space-y-6">
          {navGroups.map((group) => (
            <div key={group.labelKey} className="space-y-1 relative">
              {/* Etykieta grupy nawigacyjnej */}
              <div className="flex items-center h-5 px-3 mb-1.5 overflow-hidden">
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.7 }}
                      exit={{ opacity: 0 }}
                      className="whitespace-nowrap"
                    >
                      <Typography as="span" variant="eyebrow" color="incense">
                        {t(group.labelKey)}
                      </Typography>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-1">
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
                            isExpanded ? "w-6" : "w-full h-full",
                            isActive
                              ? "text-ethereal-gold drop-shadow-sm"
                              : "currentColor",
                          )}
                        >
                          {/* Bezpieczne rzutowanie dla TypeScript 7.0 */}
                          {React.cloneElement(
                            link.icon as React.ReactElement<IconProps>,
                            {
                              size: isExpanded ? 18 : 20,
                            },
                          )}
                        </div>

                        {/* Redukcja 'ml-3' do 'ml-0' eliminuje wypychanie siatki przez niewidzialny margines */}
                        <div
                          className={cn(
                            "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out flex items-center",
                            isExpanded
                              ? "ml-3 max-w-[150px] opacity-100"
                              : "ml-0 max-w-0 opacity-0",
                          )}
                        >
                          <Typography
                            as="span"
                            variant="label"
                            color={isActive ? "default" : "muted"}
                            className={cn(
                              "font-medium",
                              !isActive && "group-hover/link:text-ethereal-ink",
                            )}
                          >
                            {t(link.labelKey)}
                          </Typography>
                        </div>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* User Actions Stratum */}
      <div
        className={cn(
          "mt-auto flex-shrink-0 transition-all duration-300 z-10",
          isExpanded ? "p-3" : "p-2 pb-4",
        )}
      >
        <GlassCard
          variant="light"
          className={cn(
            "flex transition-all duration-300 border-white/20",
            isExpanded
              ? "flex-col gap-3 p-3 rounded-2xl"
              : "flex-col items-center gap-3 p-2 py-3 rounded-[20px]",
          )}
        >
          {isExpanded ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ethereal-gold/10 border border-ethereal-gold/20 shadow-sm">
                <Typography variant="label" color="gold">
                  {initials}
                </Typography>
              </div>
              <div className="min-w-0 flex-1">
                <Typography
                  variant="label"
                  className="truncate block mb-0.5 font-medium"
                >
                  {userFullName}
                </Typography>
                <Typography
                  variant="eyebrow"
                  color="muted"
                  className="truncate block leading-none"
                >
                  {roleLabel}
                </Typography>
              </div>
              <NotificationCenter />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-1">
              <NotificationCenter />
              <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-ethereal-gold/10 border border-ethereal-gold/20 shadow-sm transition-transform hover:scale-105">
                <Typography variant="label" color="gold">
                  {initials}
                </Typography>
              </div>
            </div>
          )}

          <Divider variant="fade" className="opacity-50" />

          <div
            className={cn(
              "grid gap-2",
              isExpanded ? "grid-cols-2" : "grid-cols-1 w-full",
            )}
          >
            <Button
              asChild
              variant="ghost"
              size={isExpanded ? "sm" : "icon"}
              className="w-full"
            >
              <Link
                to="/panel/settings"
                aria-label={t("dashboard.layout.actions.settings")}
              >
                <Settings size={isExpanded ? 16 : 18} />
                {isExpanded && (
                  <span className="ml-2">
                    {t("dashboard.layout.actions.settings")}
                  </span>
                )}
              </Link>
            </Button>
            <Button
              variant="destructive"
              size={isExpanded ? "sm" : "icon"}
              onClick={logout}
              className="w-full"
              aria-label={t("dashboard.layout.actions.logout")}
            >
              <LogOut size={isExpanded ? 16 : 18} />
              {isExpanded && (
                <span className="ml-2">
                  {t("dashboard.layout.actions.logout")}
                </span>
              )}
            </Button>
          </div>
        </GlassCard>
      </div>
    </GlassCard>
  );
};
