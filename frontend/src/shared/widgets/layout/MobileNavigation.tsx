/**
 * @file MobileNavigation.tsx
 * @description Enterprise SaaS Mobile Off-canvas Navigation.
 * Architecturally pure implementation of Ethereal UI.
 * Fixed: Framer Motion variant propagation & Chiaroscuro light-theme contrast.
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
} from "@/shared/config/navigation/dashboard.config";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { isCrew, isManager } from "@/shared/auth/rbac";
import type { AuthUser } from "@/shared/auth/auth.types";
import { cn } from "@/shared/lib/utils";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

// Ethereal UI Taxonomy strictly enforced
import { Heading, Eyebrow, Label } from "@/shared/ui/primitives/typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import { Button } from "@/shared/ui/primitives/Button";
import { GlassCard } from "@/shared/ui/composites/GlassCard";

// Centralized Kinematics - Single source of truth for motion (open/closed lifecycle)
import {
  MENU_PANEL_VARIANTS,
  STAGGERED_REVEAL_VARIANTS,
  FADE_UP_VARIANTS,
} from "@/shared/ui/kinematics/motion-presets";

interface MobileNavigationProps {
  user: AuthUser | null;
  logout: () => void;
}

const mobileNavLinkVariants = cva(
  "group/moblink relative flex items-center gap-4 rounded-[14px] px-3.5 py-3 transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 overflow-hidden",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/10 border border-ethereal-gold/30 shadow-[var(--shadow-ethereal-inset)]",
        false: "border border-transparent hover:bg-white/40",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);

const BrandMark = (): React.JSX.Element => (
  <Heading
    as="h2"
    size="xl"
    className="select-none flex items-center tracking-tight"
  >
    <span>Voct</span>
    <Heading as="span" color="gold" className="italic ml-[2px]">
      Manager
    </Heading>
  </Heading>
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
      {/* Floating Trigger - Integrated with Chiaroscuro */}
      <div className="fixed bottom-6 right-6 z-[70] md:hidden">
        <GlassCard
          as="button"
          variant="dark"
          padding="none"
          onClick={() => setIsOpen(true)}
          aria-label={t("dashboard.layout.aria.openMenu")}
          className="flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-ethereal-gold shadow-[var(--shadow-ethereal-deep)]"
        >
          <Menu size={22} color="white" aria-hidden="true" />
        </GlassCard>
      </div>

      <AnimatePresence>
        {isOpen && (
          <GlassCard
            as={motion.div}
            variant="ethereal"
            withNoise={true}
            padding="none"
            variants={MENU_PANEL_VARIANTS}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed inset-0 z-[80] flex flex-col md:hidden overflow-hidden rounded-none border-none overscroll-none"
            aria-modal="true"
            role="dialog"
          >
            {/* Header Stratum */}
            <div className="relative flex h-[72px] flex-shrink-0 items-center justify-between px-5 pt-safe">
              <BrandMark />
              <div className="flex items-center gap-3">
                <NotificationCenter />
                <Button
                  variant="icon"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  aria-label={t("dashboard.layout.aria.closeMenu")}
                  className="text-ethereal-graphite hover:text-ethereal-ink"
                >
                  <X size={24} aria-hidden="true" />
                </Button>
              </div>
              <Divider
                position="absolute-bottom"
                variant="fade"
                className="opacity-40"
              />
            </div>

            {/* Navigation Matrix - Inheriting purely from `open`/`closed` parent */}
            <nav className="flex-1 overflow-y-auto px-4 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="space-y-8">
                {navGroups.map((group, groupIndex) => (
                  <div key={group.labelKey} className="flex flex-col">
                    <motion.div
                      variants={FADE_UP_VARIANTS}
                      custom={0.2 + groupIndex * 0.1}
                      className="mb-3 px-2"
                    >
                      <Eyebrow as="p" color="incense">
                        {t(group.labelKey)}
                      </Eyebrow>
                    </motion.div>

                    <div className="space-y-1.5">
                      {group.links.map((link, linkIndex) => (
                        <motion.div
                          key={link.to}
                          variants={STAGGERED_REVEAL_VARIANTS}
                          custom={linkIndex + groupIndex * 3}
                        >
                          <NavLink
                            to={link.to}
                            end={link.to === "/panel"}
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) =>
                              cn(mobileNavLinkVariants({ isActive }))
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <div
                                  className={cn(
                                    "flex w-6 flex-shrink-0 items-center justify-center transition-colors duration-500",
                                    isActive
                                      ? "text-ethereal-gold"
                                      : "text-ethereal-graphite/50 group-hover/moblink:text-ethereal-gold/80",
                                  )}
                                >
                                  {React.cloneElement(
                                    link.icon as React.ReactElement,
                                    {
                                      size: 20,
                                      strokeWidth: isActive ? 2.5 : 2,
                                    },
                                  )}
                                </div>
                                <Label
                                  as="span"
                                  weight={isActive ? "semibold" : "medium"}
                                  color={isActive ? "gold" : "muted"}
                                >
                                  {t(link.labelKey)}
                                </Label>
                              </>
                            )}
                          </NavLink>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </nav>

            {/* Footer Telemetry Area - Corrected to contrast against Ethereal Glass */}
            <motion.div
              variants={FADE_UP_VARIANTS}
              custom={0.8}
              className="relative bg-white/30 px-5 pb-safe pt-6 pb-8 backdrop-blur-md"
            >
              <Divider
                position="absolute-top"
                variant="fade"
                className="opacity-30"
              />

              <div className="flex items-center gap-4 mb-6 px-1">
                <div className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-ethereal-gold/20 to-transparent border border-ethereal-gold/30 shadow-[var(--shadow-ethereal-soft)]">
                  <Label as="span" color="gold" weight="bold" size="lg">
                    {initials}
                  </Label>
                </div>
                <div className="min-w-0 flex-1">
                  <Label
                    as="p"
                    color="default"
                    weight="semibold"
                    className="truncate text-ethereal-ink"
                  >
                    {userFullName || user?.email}
                  </Label>
                  <Eyebrow
                    as="p"
                    color="incense"
                    size="xs"
                    className="truncate mt-0.5 opacity-90"
                  >
                    {mobileRoleLabel}
                  </Eyebrow>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="w-full justify-center"
                >
                  <Link to="/panel/settings">
                    <Settings size={16} className="mr-2" />
                    {t("dashboard.layout.actions.settings")}
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={logout}
                  className="w-full justify-center"
                >
                  <LogOut size={16} className="mr-2" />
                  {t("dashboard.layout.actions.logout")}
                </Button>
              </div>
            </motion.div>
          </GlassCard>
        )}
      </AnimatePresence>
    </>
  );
};
