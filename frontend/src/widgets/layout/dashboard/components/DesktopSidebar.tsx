/**
 * @file DesktopSidebar.tsx
 * @description Enterprise SaaS Collapsible Sidebar (High-Density Mode).
 * Expands on hover without causing layout shifts. Optimized vertical rhythm to eliminate scrolling.
 */

import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
  adminNavGroups,
  artistNavGroups,
  BrandMark,
} from "../navigation.config";
import { NotificationCenter } from "@features/notifications/components/NotificationCenter";
import { isCrew, isManager } from "@/shared/auth/rbac";
import type { AuthUser } from "@/shared/auth/auth.types";

interface DesktopSidebarProps {
  user: AuthUser | null;
  logout: () => void;
}

const BrandIcon = () => (
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#002395_0%,#0f4bd8_100%)] shadow-md shadow-blue-900/20">
    <span
      className="text-xl font-bold text-white"
      style={{ fontFamily: "'Cormorant', serif" }}
    >
      V
    </span>
  </div>
);

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  user,
  logout,
}) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const isManagerUser = isManager(user);
  const navGroups = isManagerUser ? adminNavGroups : artistNavGroups;
  const userFullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");
  const userRoleLabel = isManagerUser
    ? t("dashboard.layout.roles.admin")
    : isCrew(user)
      ? t("dashboard.layout.roles.crew", "Crew")
      : user?.voice_type_display || t("dashboard.layout.roles.artist");
  const initials =
    `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() ||
    "U";

  return (
    <motion.aside
      initial={{ width: 88 }}
      animate={{ width: isHovered ? 280 : 88 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-4 left-4 top-4 z-[60] hidden md:flex flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/75 shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur-2xl transition-shadow hover:shadow-[0_20px_50px_rgba(0,35,149,0.12)]"
    >
      <div className="relative z-10 flex h-16 flex-shrink-0 items-center justify-center pt-2">
        <AnimatePresence mode="wait">
          {isHovered ? (
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

      {/* MIDDLE: NAWIGACJA (Tryb Kompaktowy) */}
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
              {/* Etykiety grup (np. OVERVIEW) */}
              <div className="mb-1.5 flex h-4 items-center px-2">
                {isHovered && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-[9px] font-bold uppercase tracking-[0.22em] text-stone-400"
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
                      `group/link relative flex items-center rounded-xl border px-3 py-2 text-[13px] font-bold tracking-wide transition-all duration-300 ${
                        isActive
                          ? "border-brand-dark/20 bg-[linear-gradient(135deg,#002395_0%,#0f4bd8_100%)] text-white shadow-md"
                          : "border-transparent text-stone-500 hover:bg-white hover:text-stone-900 hover:shadow-sm"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex w-7 flex-shrink-0 items-center justify-center">
                          {/* Zastosowano poprawny typ dla cloneElement */}
                          {React.cloneElement(
                            link.icon as React.ReactElement<{
                              className?: string;
                            }>,
                            {
                              className: isActive
                                ? "text-white"
                                : "text-stone-400 group-hover/link:text-brand transition-colors",
                            },
                          )}
                        </div>
                        <div
                          className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${isHovered ? "ml-3 max-w-[150px] opacity-100" : "max-w-0 opacity-0"}`}
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

      {/* BOTTOM: UŻYTKOWNIK I AKCJE (Bardziej ściśnięte) */}
      <div className="relative z-10 flex flex-shrink-0 flex-col border-t border-stone-200/50 bg-stone-50/40 p-3 transition-all duration-300">
        {isHovered ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between rounded-xl border border-stone-200/60 bg-white/90 p-2 shadow-sm">
              <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-bold text-brand">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-stone-800">
                    {userFullName || user?.email}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.18em] text-stone-400">
                    {userRoleLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center pr-1">
                <NotificationCenter />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/panel/settings"
                className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500 shadow-sm transition-colors hover:text-brand"
              >
                <Settings size={13} />
                {t("dashboard.layout.profile_settings", "Ustawienia")}
              </Link>
              <button
                onClick={logout}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-red-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-600 shadow-sm transition-colors hover:bg-red-100"
              >
                <LogOut size={13} />
                {t("dashboard.layout.logout", "Wyloguj")}
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
              className="text-stone-400 transition-colors hover:text-brand"
            >
              <Settings size={18} />
            </Link>
            <div className="h-px w-6 bg-stone-200/80" />
            <div className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-xs font-bold text-brand shadow-sm transition-transform hover:scale-105">
              {initials}
            </div>
          </motion.div>
        )}
      </div>
    </motion.aside>
  );
};
