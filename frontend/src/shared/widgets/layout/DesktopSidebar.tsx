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

interface DesktopSidebarProps {
  user: AuthUser | null;
  logout: () => void;
}

const navLinkVariants = cva(
  "group/link relative flex items-center rounded-xl border px-3 py-2 text-[13px] font-bold tracking-wide transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
  {
    variants: {
      isActive: {
        true: "border-ethereal-gold/30 bg-ethereal-gold/10 text-ethereal-ink shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_2px_8px_rgba(194,168,120,0.15)]",
        false:
          "border-transparent text-ethereal-graphite hover:bg-white/40 hover:text-ethereal-ink hover:shadow-sm",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);

const BrandMark = (): React.JSX.Element => (
  <h2
    className="text-3xl font-medium text-ethereal-ink tracking-tight select-none"
    style={{ fontFamily: "'Cormorant', serif" }}
  >
    Voct<span className="italic text-ethereal-gold">Manager</span>
  </h2>
);

const BrandIcon = (): React.JSX.Element => (
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ethereal-gold/80 to-ethereal-incense shadow-md shadow-ethereal-gold/20 select-none">
    <span
      className="text-xl font-bold text-white"
      style={{ fontFamily: "'Cormorant', serif" }}
    >
      V
    </span>
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
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 280 : 88 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed bottom-4 left-4 top-4 z-[60] hidden md:flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/45 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_8px_32px_rgba(166,146,121,0.08)] backdrop-blur-[16px] transition-shadow hover:shadow-[0_12px_40px_rgba(166,146,121,0.12)]"
      aria-label={t("dashboard.layout.aria.sidebar", "Main Navigation")}
    >
      {/* Background Noise for Glass Continuity */}
      <div
        className="bg-noise absolute inset-0 -z-10 opacity-[0.03] pointer-events-none mix-blend-overlay"
        aria-hidden="true"
      />

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
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-[9px] font-bold uppercase tracking-[0.22em] text-ethereal-incense"
                  >
                    {t(group.labelKey)}
                  </motion.p>
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
                          {t(link.labelKey)}
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
      <div className="relative z-10 flex flex-shrink-0 flex-col border-t border-ethereal-incense/10 bg-white/30 p-3 transition-all duration-300">
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/60 backdrop-blur-md p-2 shadow-[0_2px_8px_rgba(166,146,121,0.05)]">
              <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-ethereal-gold/10 text-xs font-bold text-ethereal-gold border border-ethereal-gold/20">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ethereal-ink">
                    {userFullName || user?.email}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.18em] text-ethereal-graphite">
                    {userRoleLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center pr-1 text-ethereal-graphite">
                <NotificationCenter />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/panel/settings"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-transparent hover:border-ethereal-incense/20 bg-white/50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ethereal-graphite shadow-sm transition-all hover:text-ethereal-ink hover:bg-white/80 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold"
              >
                <Settings size={13} aria-hidden="true" />
                {t("dashboard.layout.actions.settings", "Ustawienia")}
              </Link>
              <button
                onClick={logout}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-transparent hover:border-ethereal-incense/20 bg-white/50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ethereal-graphite shadow-sm transition-all hover:text-red-900 hover:bg-red-900/5 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold"
              >
                <LogOut size={13} aria-hidden="true" />
                {t("dashboard.layout.actions.logout", "Wyloguj")}
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
            <div
              className="h-px w-6 bg-ethereal-incense/20"
              aria-hidden="true"
            />
            <div className="flex h-9 w-9 flex-shrink-0 cursor-default items-center justify-center rounded-xl bg-ethereal-gold/10 border border-ethereal-gold/20 text-xs font-bold text-ethereal-gold shadow-sm transition-transform hover:scale-105">
              {initials}
            </div>
          </motion.div>
        )}
      </div>
    </motion.aside>
  );
};
