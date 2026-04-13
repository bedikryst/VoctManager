/**
 * @file MobileNavigation.tsx
 * @description Enterprise SaaS Mobile Off-canvas Navigation.
 * Implements Ethereal UI glassmorphism and strict Framer Motion kinematics.
 * Body scroll strictly managed via declarative useBodyScrollLock hook.
 * @module shared/widgets/layout/MobileNavigation
 */

import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Menu, X, Settings, LogOut } from "lucide-react";
import { cva } from "class-variance-authority";

import {
  ADMIN_NAV_GROUPS as adminNavGroups,
  ARTIST_NAV_GROUPS as artistNavGroups,
} from "../../config/navigation/dashboard.config";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { isCrew, isManager } from "@/shared/auth/rbac";
import type { AuthUser } from "@/shared/auth/auth.types";
import { cn } from "@/shared/lib/utils";
import { useBodyScrollLock } from "@/shared/lib/hooks/useBodyScrollLock";

interface MobileNavigationProps {
  user: AuthUser | null;
  logout: () => void;
}

const mobileNavLinkVariants = cva(
  "flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[13px] font-bold tracking-wide transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-brand",
  {
    variants: {
      isActive: {
        true: "bg-brand/10 text-brand shadow-sm",
        false:
          "bg-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-900",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);

const BrandMark = (): React.JSX.Element => (
  <h2
    className="text-2xl font-medium text-stone-900 tracking-tight select-none"
    style={{ fontFamily: "'Cormorant', serif" }}
  >
    Voct<span className="italic text-brand">Manager</span>
  </h2>
);

export const MobileNavigation = ({
  user,
  logout,
}: MobileNavigationProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Declarative body scroll locking implementation
  useBodyScrollLock(isOpen);

  const isManagerUser = isManager(user);
  const navGroups = isManagerUser ? adminNavGroups : artistNavGroups;
  const userFullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");
  const mobileRoleLabel = isManagerUser
    ? t("dashboard.layout.roles.admin", "Administrator")
    : isCrew(user)
      ? t("dashboard.layout.roles.crew", "Ekipa")
      : user?.voice_type_display ||
        t("dashboard.layout.roles.artist", "Artysta");

  const initials =
    `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() ||
    "U";

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[70] md:hidden">
        <button
          onClick={() => setIsOpen(true)}
          aria-label={t(
            "dashboard.layout.aria.openMenu",
            "Otwórz menu nawigacyjne",
          )}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-white shadow-xl shadow-stone-900/20 transition-transform active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-brand"
        >
          <Menu size={24} aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[80] flex flex-col bg-white/95 backdrop-blur-3xl md:hidden overflow-hidden"
            aria-modal="true"
            role="dialog"
          >
            <div className="flex h-20 items-center justify-between px-6 border-b border-stone-200/40">
              <BrandMark />
              <div className="flex items-center gap-4">
                <NotificationCenter />
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label={t(
                    "dashboard.layout.aria.closeMenu",
                    "Zamknij menu",
                  )}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-colors active:bg-stone-200 outline-none"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-6 py-8">
              <div className="space-y-8">
                {navGroups.map((group) => (
                  <div key={group.labelKey}>
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                      {t(group.labelKey)}
                    </p>
                    <div className="space-y-1">
                      {group.links.map((link) => (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          end={link.to === "/panel"}
                          onClick={() => setIsOpen(false)}
                          className={({ isActive }) =>
                            cn(mobileNavLinkVariants({ isActive }))
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {React.isValidElement(link.icon)
                                ? React.cloneElement(link.icon, {
                                    className: cn(
                                      "flex-shrink-0 transition-colors",
                                      isActive
                                        ? "text-brand"
                                        : "text-stone-400",
                                    ),
                                  })
                                : link.icon}
                              <span>{t(link.labelKey)}</span>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </nav>

            <div className="border-t border-stone-200/50 bg-stone-50/50 px-6 pb-safe pt-6 pb-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-sm font-bold text-brand">
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
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/panel/settings"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-600 transition-colors hover:border-brand/30 hover:text-brand shadow-sm outline-none"
                >
                  <Settings size={15} aria-hidden="true" />
                  {t("dashboard.layout.actions.settings", "Ustawienia")}
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-red-600 transition-colors hover:bg-red-100 active:scale-95 shadow-sm outline-none"
                >
                  <LogOut size={15} aria-hidden="true" />
                  {t("dashboard.layout.actions.logout", "Wyloguj")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
