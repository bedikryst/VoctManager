/**
 * @file MobileNavigation.tsx
 * @description Enterprise SaaS Mobile Off-canvas Navigation.
 * Refactored for extreme spatial elegance and Ethereal UI compliance.
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
import { Button } from "@/shared/ui/primitives/Button";

interface MobileNavigationProps {
  user: AuthUser | null;
  logout: () => void;
}

const mobileNavLinkVariants = cva(
  "flex items-center gap-3.5 rounded-xl px-3 py-2.5 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/10 shadow-[var(--shadow-ethereal-inset)]",
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
    className="text-xl tracking-tight select-none flex items-center"
  >
    <span>Voct</span>
    <Typography
      as="span"
      variant="title"
      color="gold"
      className="italic ml-[2px]"
    >
      Manager
    </Typography>
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
    ? t("dashboard.layout.roles.admin")
    : isCrew(user)
      ? t("dashboard.layout.roles.crew")
      : user?.voice_type_display || t("dashboard.layout.roles.artist");

  const initials =
    `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() ||
    "U";

  return (
    <>
      {/* Floating Trigger */}
      <div className="fixed bottom-6 right-6 z-[70] md:hidden">
        <button
          onClick={() => setIsOpen(true)}
          aria-label={t("dashboard.layout.aria.openMenu")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-ethereal-ink text-white shadow-lg shadow-ethereal-ink/20 transition-transform active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-ethereal-gold"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[80] flex flex-col bg-white/95 backdrop-blur-3xl md:hidden overflow-hidden"
            aria-modal="true"
            role="dialog"
          >
            {/* Header */}
            <div className="relative flex h-16 flex-shrink-0 items-center justify-between px-5">
              <BrandMark />
              <div className="flex items-center gap-3">
                <NotificationCenter />
                <Button
                  variant="icon"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  aria-label={t("dashboard.layout.aria.closeMenu")}
                >
                  <X size={20} aria-hidden="true" />
                </Button>
              </div>
              <Divider position="absolute-bottom" variant="fade" />
            </div>

            {/* Navigation Body */}
            <nav className="flex-1 overflow-y-auto px-4 py-5">
              <div className="space-y-6">
                {navGroups.map((group) => (
                  <div key={group.labelKey}>
                    <div className="mb-2 px-1">
                      <Typography as="p" variant="eyebrow" color="muted">
                        {t(group.labelKey)}
                      </Typography>
                    </div>
                    <div className="space-y-0.5">
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
                          {({ isActive }) => {
                            // TypeScript safety for extracting className from the icon element
                            const iconProps = React.isValidElement(link.icon)
                              ? (link.icon.props as { className?: string })
                              : {};

                            return (
                              <>
                                <div
                                  className={cn(
                                    "flex w-7 flex-shrink-0 items-center justify-center transition-colors duration-300",
                                    isActive
                                      ? "text-ethereal-gold drop-shadow-sm"
                                      : "text-ethereal-graphite/60 group-hover/link:text-ethereal-gold",
                                  )}
                                >
                                  {/* Ikona natywnie odziedziczy kolor (currentColor) z powyższego diva */}
                                  {link.icon}
                                </div>
                                <Typography
                                  as="span"
                                  variant="label"
                                  color={isActive ? "default" : "muted"}
                                  className={cn(
                                    !isActive &&
                                      "group-hover/moblink:text-ethereal-ink",
                                  )}
                                >
                                  {t(link.labelKey)}
                                </Typography>
                              </>
                            );
                          }}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </nav>

            {/* Footer User Area */}
            <div className="relative bg-white/50 px-4 pb-safe pt-5 pb-6">
              <Divider position="absolute-top" variant="fade" />

              <div className="flex items-center gap-3.5 mb-5 px-1">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-ethereal-gold/10 border border-ethereal-gold/20">
                  <Typography as="span" variant="label" color="gold">
                    {initials}
                  </Typography>
                </div>
                <div className="min-w-0">
                  <Typography
                    as="p"
                    variant="label"
                    color="default"
                    className="truncate"
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

              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <Link to="/panel/settings">
                    <Settings size={14} />
                    {t("dashboard.layout.actions.settings")}
                  </Link>
                </Button>
                <Button variant="destructive" size="sm" onClick={logout}>
                  <LogOut size={14} />
                  {t("dashboard.layout.actions.logout")}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
