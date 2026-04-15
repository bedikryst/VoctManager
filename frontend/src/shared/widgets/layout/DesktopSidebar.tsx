/**
 * @file DesktopSidebar.tsx
 * @description Enterprise SaaS Collapsible Sidebar (High-Density Mode).
 * Refactored for Ethereal UI. Fully transparent kinematics and glassmorphism.
 * @module shared/widgets/layout/DesktopSidebar
 */

import React from "react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cva } from "class-variance-authority";

import {
  ADMIN_NAV_GROUPS as adminNavGroups,
  ARTIST_NAV_GROUPS as artistNavGroups,
} from "../../config/navigation/dashboard.config";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { isCrew, isManager } from "@/shared/auth/rbac";
import type { AuthUser } from "@/shared/auth/auth.types";
import { cn } from "@/shared/lib/utils";
import { useSidebarKinematics } from "@/shared/ui/kinematics/hooks/useSidebarKinematics";

// Ethereal UI Taxonomy
import { Typography } from "@/shared/ui/primitives/Typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";

interface DesktopSidebarProps {
  user: AuthUser | null;
  logout: () => void;
}

const navLinkVariants = cva(
  "group/link relative flex items-center rounded-xl border px-3 py-2 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
  {
    variants: {
      isActive: {
        true: "border-ethereal-gold/30 bg-ethereal-gold/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_2px_8px_rgba(194,168,120,0.15)]",
        false: "border-transparent hover:bg-white/40 hover:shadow-sm",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);

const BrandMark = (): React.JSX.Element => (
  <Typography
    as="h2"
    variant="title"
    color="default"
    className="tracking-tight select-none"
  >
    Voct<span className="italic text-ethereal-gold">Manager</span>
  </Typography>
);

const BrandIcon = (): React.JSX.Element => (
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ethereal-gold/80 to-ethereal-incense shadow-md shadow-ethereal-gold/20 select-none">
    <Typography
      as="span"
      variant="title"
      color="inherit"
      className="text-white"
    >
      V
    </Typography>
  </div>
);

export const DesktopSidebar = ({
  user,
  logout,
}: DesktopSidebarProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { isExpanded, handleMouseEnter, handleMouseLeave } =
    useSidebarKinematics();

  const isManagerUser = isManager(user);
  const navGroups = isManagerUser ? adminNavGroups : artistNavGroups;

  const userFullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");
  const userRoleLabel = isManagerUser
    ? t("dashboard.layout.roles.admin", "Admin")
    : isCrew(user)
      ? t("dashboard.layout.roles.crew", "Crew")
      : user?.voice_type_display ||
        t("dashboard.layout.roles.artist", "Artist");

  const initials =
    `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() ||
    "U";

  return (
    <GlassCard
      as={motion.aside}
      variant="ethereal"
      glow={false}
      withNoise={true}
      initial={false}
      animate={{ width: isExpanded ? 280 : 88 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed bottom-4 left-4 top-4 z-[60] hidden md:flex flex-col overflow-hidden rounded-3xl"
      aria-label={t("dashboard.layout.aria.sidebar", "Główna Nawigacja")}
    >
      {/* Top: Brand Section */}
      <div className="relative z-10 flex h-16 flex-shrink-0 items-center justify-center pt-2">
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.div
              key="full-logo"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <BrandMark />
            </motion.div>
          ) : (
            <motion.div
              key="icon-logo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <BrandIcon />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Middle: Navigation Area */}
      <nav
        className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-4 py-1 [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)",
        }}
      >
        <div className="space-y-4 py-2">
          {navGroups.map((group) => (
            <div key={group.labelKey}>
              <div className="mb-1.5 flex h-4 items-center px-2">
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Typography as="p" variant="eyebrow" color="incense">
                      {t(group.labelKey)}
                    </Typography>
                  </motion.div>
                )}
              </div>

              <div className="space-y-0.5">
                {group.links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === "/panel"}
                    className={({ isActive }) =>
                      cn(navLinkVariants({ isActive }))
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex w-7 flex-shrink-0 items-center justify-center">
                          {React.isValidElement(link.icon)
                            ? React.cloneElement(link.icon, {
                                className: isActive
                                  ? "text-ethereal-gold drop-shadow-sm"
                                  : "text-ethereal-graphite/60 group-hover/link:text-ethereal-gold transition-colors",
                              })
                            : link.icon}
                        </div>
                        <div
                          className={cn(
                            "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                            isExpanded
                              ? "ml-3 max-w-[150px] opacity-100"
                              : "max-w-0 opacity-0",
                          )}
                        >
                          <Typography
                            as="span"
                            variant="label"
                            color={isActive ? "default" : "muted"}
                            className={cn(
                              isActive && "font-bold",
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

      {/* Bottom: User Actions */}
      <div className="relative z-10 flex flex-shrink-0 flex-col bg-white/30 p-3 transition-all duration-300">
        <Divider position="absolute-top" variant="fade" />

        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/60 backdrop-blur-md p-2 shadow-[0_2px_8px_rgba(166,146,121,0.05)]">
              <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-ethereal-gold/10 border border-ethereal-gold/20">
                  <Typography
                    as="span"
                    variant="label"
                    color="gold"
                    className="font-bold"
                  >
                    {initials}
                  </Typography>
                </div>
                <div className="min-w-0">
                  <Typography
                    as="p"
                    variant="label"
                    color="default"
                    className="truncate font-bold"
                  >
                    {userFullName || user?.email}
                  </Typography>
                  <div className="mt-0.5 truncate">
                    <Typography as="span" variant="eyebrow" color="muted">
                      {userRoleLabel}
                    </Typography>
                  </div>
                </div>
              </div>
              <div className="flex items-center pr-1 text-ethereal-graphite">
                <NotificationCenter />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/panel/settings"
                className="group flex items-center justify-center gap-1.5 rounded-xl border border-transparent hover:border-ethereal-incense/20 bg-white/50 px-2 py-1.5 shadow-sm transition-all hover:bg-white/80 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold"
              >
                <Settings
                  size={13}
                  className="text-ethereal-graphite group-hover:text-ethereal-ink"
                  aria-hidden="true"
                />
                <Typography
                  as="span"
                  variant="eyebrow"
                  color="muted"
                  className="group-hover:text-ethereal-ink"
                >
                  {t("dashboard.layout.actions.settings", "Ustawienia")}
                </Typography>
              </Link>
              <button
                onClick={logout}
                className="group flex items-center justify-center gap-1.5 rounded-xl border border-transparent hover:border-ethereal-incense/20 bg-white/50 px-2 py-1.5 shadow-sm transition-all hover:bg-red-900/5 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold"
              >
                <LogOut
                  size={13}
                  className="text-ethereal-graphite group-hover:text-red-900"
                  aria-hidden="true"
                />
                <Typography
                  as="span"
                  variant="eyebrow"
                  color="muted"
                  className="group-hover:text-red-900"
                >
                  {t("dashboard.layout.actions.logout", "Wyloguj")}
                </Typography>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-1"
          >
            <NotificationCenter />
            <Link
              to="/panel/settings"
              className="text-ethereal-graphite/60 transition-colors hover:text-ethereal-gold outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold rounded-lg p-1"
              aria-label={t("dashboard.layout.actions.settings", "Ustawienia")}
            >
              <Settings size={18} aria-hidden="true" />
            </Link>

            <Divider position="relative" variant="solid" className="w-6" />

            <div className="flex h-9 w-9 flex-shrink-0 cursor-default items-center justify-center rounded-xl bg-ethereal-gold/10 border border-ethereal-gold/20 shadow-sm transition-transform hover:scale-105">
              <Typography
                as="span"
                variant="label"
                color="gold"
                className="font-bold"
              >
                {initials}
              </Typography>
            </div>
          </motion.div>
        )}
      </div>
    </GlassCard>
  );
};
