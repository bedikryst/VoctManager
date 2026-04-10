// frontend/src/widgets/layout/dashboard/components/MobileNavigation.tsx
import React, { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Menu, X, Settings, LogOut } from "lucide-react";

import {
  adminNavGroups,
  artistNavGroups,
  BrandMark,
} from "../navigation.config";
import { NotificationCenter } from "../../../../features/notifications/components/NotificationCenter";
import { isCrew, isManager } from "../../../../shared/auth/rbac";
import type { AuthUser } from "../../../../shared/auth/auth.types";

interface MobileNavigationProps {
  user: AuthUser | null;
  logout: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  user,
  logout,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const isManagerUser = isManager(user);
  const navGroups = isManagerUser ? adminNavGroups : artistNavGroups;
  const userFullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");
  const mobileRoleLabel = isManagerUser
    ? t("dashboard.layout.roles.management")
    : isCrew(user)
      ? t("dashboard.layout.roles.crew", "Crew")
      : user?.voice_type_display || t("dashboard.layout.roles.artist");
  const initials =
    `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() ||
    "U";

  return (
    <>
      {/* HEADER (Visible only on mobile) */}
      <header className="fixed top-0 z-40 flex w-full items-center justify-between border-b border-stone-200/60 bg-white/80 px-5 py-4 shadow-sm backdrop-blur-2xl md:hidden">
        <BrandMark />
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <button
            onClick={() => setIsOpen(true)}
            className="rounded-2xl border border-stone-200/80 bg-white p-2.5 text-stone-600 shadow-sm transition-colors hover:bg-stone-100 active:scale-95"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* DRAWER MENU */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[50] bg-stone-900/25 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 right-0 top-0 z-[60] flex w-4/5 max-w-sm flex-col border-l border-white/60 bg-[#f4f2ee] shadow-2xl md:hidden"
            >
              <div className="relative flex flex-shrink-0 items-center justify-between border-b border-stone-200/60 bg-white/84 p-5 backdrop-blur-xl">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#002395]">
                    {t("dashboard.layout.mobile_nav_title")}
                  </span>
                  <div className="mt-2">
                    <BrandMark />
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-2xl border border-stone-200 bg-white p-2 text-stone-400 shadow-sm transition-all hover:text-stone-900 active:scale-95"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <nav className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
                {navGroups.map((group) => (
                  <div key={group.labelKey}>
                    <p className="mb-3 border-b border-stone-200/70 px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                      {t(group.labelKey)}
                    </p>
                    <div className="space-y-1.5">
                      {group.links.map((link) => (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          end={link.to === "/panel"}
                          onClick={() => setIsOpen(false)}
                          className={({ isActive }) =>
                            `group flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-bold tracking-wide transition-all duration-300 ${isActive ? "border-[#001766]/20 bg-[linear-gradient(135deg,#002395_0%,#0f4bd8_100%)] text-white shadow-[0_16px_34px_rgba(0,35,149,0.28)]" : "border-transparent bg-white/55 text-stone-500 hover:border-stone-200/70 hover:bg-white hover:text-stone-900 hover:shadow-[0_10px_24px_rgba(28,25,23,0.08)]"}`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <span
                                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${isActive ? "bg-white/15" : "bg-black/5 group-hover:bg-stone-100/90"}`}
                              >
                                {link.icon}
                              </span>
                              <span>{t(link.labelKey)}</span>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="flex flex-shrink-0 flex-col gap-3 border-t border-stone-200/60 bg-white/84 p-5 backdrop-blur-xl">
                <div className="flex items-center gap-3 rounded-[1.35rem] border border-stone-200/70 bg-white p-3 shadow-sm">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-sm font-bold text-[#002395] shadow-sm">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-800">
                      {userFullName || user?.email}
                    </p>
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400">
                      {mobileRoleLabel}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/panel/settings"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-600 transition-colors hover:border-blue-100 hover:bg-blue-50 hover:text-[#002395]"
                  >
                    <Settings size={15} />{" "}
                    {t("dashboard.layout.profile_settings")}
                  </Link>
                  <button
                    onClick={logout}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-red-600 transition-colors hover:bg-red-100 active:scale-95"
                  >
                    <LogOut size={15} /> {t("dashboard.layout.logout")}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
