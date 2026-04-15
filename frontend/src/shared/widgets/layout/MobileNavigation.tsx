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
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

// Ethereal UI Taxonomy
import { Typography } from "@/shared/ui/primitives/Typography";
import { Divider } from "@/shared/ui/primitives/Divider";

interface MobileNavigationProps {
  user: AuthUser | null;
  logout: () => void;
}

const mobileNavLinkVariants = cva(
  "flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/10 shadow-sm",
        false: "bg-transparent hover:bg-white/40",
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
    className="text-2xl tracking-tight select-none"
  >
    Voct<span className="italic text-ethereal-gold">Manager</span>
  </Typography>
);

export const MobileNavigation = ({
  user,
  logout,
}: MobileNavigationProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState<boolean>(false);

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
          className="flex h-14 w-14 items-center justify-center rounded-full bg-ethereal-ink text-white shadow-xl shadow-ethereal-ink/20 transition-transform active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-ethereal-gold"
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
            <div className="relative flex h-20 items-center justify-between px-6">
              <BrandMark />
              <div className="flex items-center gap-4">
                <NotificationCenter />
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label={t(
                    "dashboard.layout.aria.closeMenu",
                    "Zamknij menu",
                  )}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-ethereal-incense/10 text-ethereal-graphite transition-colors active:bg-ethereal-incense/20 outline-none"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <Divider position="absolute-bottom" variant="fade" />
            </div>

            <nav className="flex-1 overflow-y-auto px-6 py-8">
              <div className="space-y-8">
                {navGroups.map((group) => (
                  <div key={group.labelKey}>
                    <div className="mb-3">
                      <Typography as="p" variant="eyebrow" color="muted">
                        {t(group.labelKey)}
                      </Typography>
                    </div>
                    <div className="space-y-1">
                      {group.links.map((link) => (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          end={link.to === "/panel"}
                          onClick={() => setIsOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              mobileNavLinkVariants({ isActive }),
                              "group/moblink",
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {React.isValidElement(link.icon)
                                ? React.cloneElement(link.icon, {
                                    className: cn(
                                      "flex-shrink-0 transition-colors",
                                      isActive
                                        ? "text-ethereal-gold"
                                        : "text-ethereal-graphite/60 group-hover/moblink:text-ethereal-ink",
                                    ),
                                  })
                                : link.icon}
                              <Typography
                                as="span"
                                variant="label"
                                color={isActive ? "gold" : "default"}
                                className={cn(
                                  isActive && "font-bold",
                                  !isActive &&
                                    "group-hover/moblink:text-ethereal-ink",
                                )}
                              >
                                {t(link.labelKey)}
                              </Typography>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </nav>

            <div className="relative bg-white/40 px-6 pb-safe pt-6 pb-8">
              <Divider position="absolute-top" variant="fade" />
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-ethereal-gold/10 border border-ethereal-gold/20">
                  <Typography
                    as="span"
                    variant="label"
                    color="gold"
                    className="text-sm font-bold"
                  >
                    {initials}
                  </Typography>
                </div>
                <div className="min-w-0">
                  <Typography
                    as="p"
                    variant="label"
                    color="default"
                    className="truncate text-sm font-bold"
                  >
                    {userFullName || user?.email}
                  </Typography>
                  <Typography
                    as="p"
                    variant="eyebrow"
                    color="muted"
                    className="truncate mt-0.5"
                  >
                    {mobileRoleLabel}
                  </Typography>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/panel/settings"
                  onClick={() => setIsOpen(false)}
                  className="group flex items-center justify-center gap-2 rounded-2xl border border-ethereal-incense/20 bg-white px-4 py-3.5 transition-colors hover:border-ethereal-gold/30 shadow-sm outline-none"
                >
                  <Settings
                    size={15}
                    className="text-ethereal-graphite group-hover:text-ethereal-gold"
                    aria-hidden="true"
                  />
                  <Typography
                    as="span"
                    variant="eyebrow"
                    color="muted"
                    className="group-hover:text-ethereal-gold"
                  >
                    {t("dashboard.layout.actions.settings", "Ustawienia")}
                  </Typography>
                </Link>
                <button
                  onClick={logout}
                  className="group flex items-center justify-center gap-2 rounded-2xl border border-red-900/10 bg-red-50 px-4 py-3.5 transition-colors hover:bg-red-100 active:scale-95 shadow-sm outline-none"
                >
                  <LogOut
                    size={15}
                    className="text-red-600"
                    aria-hidden="true"
                  />
                  <Typography
                    as="span"
                    variant="eyebrow"
                    color="default"
                    className="text-red-600"
                  >
                    {t("dashboard.layout.actions.logout", "Wyloguj")}
                  </Typography>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
