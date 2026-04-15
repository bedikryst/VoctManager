/**
 * @file DesktopSidebar.tsx
 * @description Enterprise SaaS Collapsible Sidebar (High-Density Mode).
 * Refactored for Ethereal UI standards (2026). Zero raw styling for typography.
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
import { EASE } from "@/shared/ui/kinematics/motion-presets";

// Ethereal UI Taxonomy Primitives & Composites
import { Typography } from "@/shared/ui/primitives/Typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";

interface DesktopSidebarProps {
  user: AuthUser | null;
  logout: () => void;
}

/**
 * Strict CVA definition utilizing Tailwind v4 @theme variables.
 */
const navLinkVariants = cva(
  "group/link relative flex items-center rounded-xl border px-3 py-2 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
  {
    variants: {
      isActive: {
        true: "border-ethereal-gold/30 bg-ethereal-gold/10 shadow-[var(--shadow-ethereal-inset)]",
        false:
          "border-transparent hover:bg-white/40 hover:shadow-[var(--shadow-ethereal-soft)]",
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
    className="tracking-tight select-none flex items-center"
  >
    Voct
    <Typography as="span" variant="title" color="gold" className="italic">
      Manager
    </Typography>
  </Typography>
);

const BrandIcon = (): React.JSX.Element => (
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-ethereal-gradient)] shadow-md select-none">
    <Typography as="span" variant="title" color="inherit">
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
    ? t("dashboard.layout.roles.admin")
    : isCrew(user)
      ? t("dashboard.layout.roles.crew")
      : user?.voice_type_display || t("dashboard.layout.roles.artist");

  const initials =
    `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() ||
    "U";

  return (
    <GlassCard
      as={motion.aside}
      variant="ethereal"
      glow={true}
      withNoise={true}
      initial={false}
      animate={{ width: isExpanded ? 280 : 88 }}
      transition={{ type: "spring", stiffness: 350, damping: 35 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed bottom-4 left-4 top-4 z-[60] hidden md:flex flex-col overflow-hidden rounded-3xl border-white/10 shadow-[20px_0_50px_rgba(0,0,0,0.1)]"
      aria-label={t("dashboard.layout.aria.sidebar")}
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
              transition={{ duration: 0.2, ease: EASE.buttery }}
            >
              <BrandMark />
            </motion.div>
          ) : (
            <motion.div
              key="icon-logo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2, ease: EASE.buttery }}
            >
              <BrandIcon />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Middle: Navigation Area */}
      <nav className="relative z-10 flex-1 overflow-y-auto px-4 py-1 [mask-image:linear-gradient(to_bottom,transparent_0%,black_5%,black_95%,transparent_100%)]">
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
                    {({ isActive }) => {
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
                                !isActive &&
                                  "group-hover/link:text-ethereal-ink",
                              )}
                            >
                              {t(link.labelKey)}
                            </Typography>
                          </div>
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

      {/* Bottom: User Actions */}
      <div className="relative z-10 flex flex-shrink-0 flex-col p-3 transition-all duration-300 bg-ethereal-ink/5 backdrop-blur-md">
        <Divider position="absolute-top" variant="fade" />

        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2.5"
          >
            {/* Użytkownik jako "Artifact" - ciemniejsze tło dla kontrastu na nakładce */}
            <div className="flex items-center justify-between rounded-xl border border-ethereal-gold/10 bg-ethereal-ink/40 p-2 shadow-lg">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-ethereal-gold/20 border border-ethereal-gold/30">
                  <Typography as="span" variant="label" color="gold">
                    {initials}
                  </Typography>
                </div>
                <div className="min-w-0">
                  <Typography
                    as="p"
                    variant="label"
                    color="default"
                    className="truncate text-white/90"
                  >
                    {userFullName || user?.email}
                  </Typography>
                  <Typography as="span" variant="eyebrow" color="muted">
                    {userRoleLabel}
                  </Typography>
                </div>
              </div>
              <NotificationCenter />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="bg-white/5 hover:bg-white/10 text-white/70"
              >
                <Link to="/panel/settings">
                  <Settings size={14} />
                  <Typography as="span" variant="eyebrow" color="inherit">
                    {t("dashboard.layout.actions.settings")}
                  </Typography>
                </Link>
              </Button>
              <Button onClick={logout} variant="destructive" size="sm">
                <LogOut size={14} />
                <Typography as="span" variant="eyebrow" color="inherit">
                  {t("dashboard.layout.actions.logout")}
                </Typography>
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-2"
          >
            <NotificationCenter />
            <div className="h-9 w-9 rounded-xl border border-ethereal-gold/20 bg-ethereal-gold/5 flex items-center justify-center">
              <Typography as="span" variant="label" color="gold">
                {initials}
              </Typography>
            </div>
          </motion.div>
        )}
      </div>
    </GlassCard>
  );
};
