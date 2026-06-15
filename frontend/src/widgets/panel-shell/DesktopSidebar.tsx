import React, { forwardRef } from "react";
import { Link, NavLink, NavLinkProps } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Transition } from "framer-motion";
import { LogOut, Pin, Search, Settings } from "lucide-react";
import { cva } from "class-variance-authority";

import { useNavigationAura } from "./hooks/useNavigationAura";
import { useSidebarPin } from "./hooks/useSidebarPin";
import { useCommandPalette } from "./command/CommandPaletteProvider";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { UnreadMessagesBadge } from "@/features/messages/components/UnreadMessagesBadge";
import type { AuthUser } from "@/shared/auth/auth.types";
import { cn } from "@/shared/lib/utils";
import { useSidebarKinematics } from "@/shared/ui/kinematics/hooks/useSidebarKinematics";

import { Heading, Eyebrow, Label } from "@/shared/ui/primitives/typography";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { Divider } from "@/shared/ui/primitives/Divider";
import { Tooltip, TooltipProvider } from "@/shared/ui/primitives/Tooltip";

interface DesktopSidebarProps {
  user: AuthUser | null;
  logout: () => void;
}

const KINETIC_TRANSITION: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 40,
  mass: 0.8,
};

const CONTENT_FADE_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};

// Windows conductors get Ctrl, macOS gets ⌘ — show the key they actually press.
const SHORTCUT_LABEL =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘K"
    : "Ctrl K";

const navLinkVariants = cva(
  "group/desklink relative block h-10 rounded-xl transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50 overflow-hidden",
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/12 border border-ethereal-gold/25 text-ethereal-ink",
        false:
          "border border-transparent text-ethereal-graphite/65 hover:text-ethereal-ink hover:bg-ethereal-ink/[0.04]",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);

const SidebarNavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className: radixClassName, to, children, style, ...props }, ref) => {
    return (
      <NavLink
        to={to}
        ref={ref}
        style={style}
        className={({ isActive }) =>
          cn(
            navLinkVariants({ isActive }),
            "transition-[width] duration-300 ease-out will-change-[width]",
            radixClassName as string,
          )
        }
        {...props}
      >
        {children}
      </NavLink>
    );
  },
);
SidebarNavLink.displayName = "SidebarNavLink";

export const DesktopSidebar = ({
  user,
  logout,
}: DesktopSidebarProps): React.JSX.Element => {
  const {
    isExpanded: isHoverExpanded,
    handleMouseEnter,
    handleMouseLeave,
  } = useSidebarKinematics();
  const { isPinned, togglePin } = useSidebarPin();
  const { open: openCommandPalette } = useCommandPalette();
  const { navGroups, userFullName, roleLabel, initials, avatarUrl, t } =
    useNavigationAura(user);

  // Pinned rail stays open across the session; hover is the opt-in peek.
  const isExpanded = isPinned || isHoverExpanded;

  return (
    <TooltipProvider delayDuration={10} disableHoverableContent>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0.5 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0.5 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 left-0 z-30 hidden w-105 origin-left pointer-events-none mix-blend-multiply fine-pointer:block"
            style={{
              background:
                "linear-gradient(to right, rgba(22, 20, 18, 0.10) 0%, rgba(22, 20, 18, 0.03) 50%, transparent 100%)",
            }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <GlassCard
        as={motion.aside}
        variant="ethereal"
        glow={false}
        withNoise={true}
        initial={false}
        animate={{
          clipPath: isExpanded
            ? "inset(0px 0% 0px 0px round 2.5rem)"
            : "inset(0px calc(100% - 88px) 0px 0px round 2.5rem)",
          boxShadow: isExpanded
            ? "0 24px 64px -12px rgba(194, 168, 120, 0.15), 0 0 0 1px rgba(194, 168, 120, 0.25)"
            : "0 8px 32px rgba(166, 146, 121, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.3)",
        }}
        transition={KINETIC_TRANSITION}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        padding="none"
        aria-expanded={isExpanded}
        isHoverable={false}
        className="fixed bottom-4 left-4 top-4 z-60 hidden w-70 flex-col border-none will-change-[clip-path,box-shadow] fine-pointer:flex"
      >
        <div className="relative flex h-full w-70 flex-col p-4">
          {/* ---- Brand + pin ---- */}
          <div className="relative mb-3 flex h-14 w-full shrink-0 items-center overflow-hidden">
            <motion.img
              src="/logo.png"
              initial={false}
              animate={{
                opacity: isExpanded ? 0 : 1,
                scale: isExpanded ? 0 : 1,
              }}
              className="absolute left-1 top-1 h-12 object-contain"
            />

            <motion.div
              initial={false}
              animate={{
                opacity: isExpanded ? 1 : 0,
                x: isExpanded ? 0 : 20,
              }}
              transition={CONTENT_FADE_TRANSITION}
              className="pointer-events-none absolute left-9 flex select-none items-center"
              aria-hidden={!isExpanded}
            >
              <Heading size="2xl">
                Voct
                <Heading
                  as="span"
                  weight="light"
                  color="gold"
                  size="2xl"
                  className="italic"
                >
                  Manager
                </Heading>
              </Heading>
            </motion.div>

            <motion.div
              initial={false}
              animate={{ opacity: isExpanded ? 1 : 0 }}
              transition={CONTENT_FADE_TRANSITION}
              className={cn(
                "absolute right-0 top-1/2 -translate-y-1/2",
                isExpanded ? "pointer-events-auto" : "pointer-events-none",
              )}
            >
              <Tooltip
                content={
                  isPinned
                    ? t("dashboard.layout.actions.unpin", "Odepnij panel")
                    : t("dashboard.layout.actions.pin", "Przypnij panel")
                }
                side="bottom"
              >
                <button
                  type="button"
                  onClick={togglePin}
                  aria-label={
                    isPinned
                      ? t("dashboard.layout.actions.unpin", "Odepnij panel")
                      : t("dashboard.layout.actions.pin", "Przypnij panel")
                  }
                  aria-pressed={isPinned}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
                    isPinned
                      ? "bg-ethereal-gold/15 text-ethereal-gold"
                      : "text-ethereal-graphite/45 hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink",
                  )}
                >
                  <Pin
                    size={15}
                    strokeWidth={2}
                    className={cn(
                      "transition-transform duration-300",
                      isPinned ? "rotate-0 fill-ethereal-gold/30" : "rotate-45",
                    )}
                    aria-hidden="true"
                  />
                </button>
              </Tooltip>
            </motion.div>
          </div>

          {/* ---- Command palette trigger ---- */}
          <div className="mb-3 w-full shrink-0">
            <Tooltip
              content={`${t("dashboard.layout.command.open", "Szukaj")} · ${SHORTCUT_LABEL}`}
              disabled={isExpanded}
              side="right"
            >
              <button
                type="button"
                onClick={openCommandPalette}
                aria-label={t("dashboard.layout.command.open", "Szukaj")}
                style={{ width: isExpanded ? "100%" : "56px" }}
                className="group/cmd relative flex h-11 items-center overflow-hidden rounded-xl border border-ethereal-gold/20 bg-ethereal-ink/[0.03] text-ethereal-graphite/65 outline-none transition-[width,background-color,border-color] duration-300 ease-out hover:border-ethereal-gold/40 hover:bg-ethereal-ink/[0.05] hover:text-ethereal-ink focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
              >
                <span className="absolute left-0 top-0 bottom-0 flex w-14 shrink-0 items-center justify-center">
                  <Search size={17} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <motion.span
                  initial={false}
                  animate={{ opacity: isExpanded ? 1 : 0 }}
                  transition={CONTENT_FADE_TRANSITION}
                  className="absolute inset-y-0 left-14 right-2.5 flex items-center justify-between whitespace-nowrap"
                  aria-hidden={!isExpanded}
                >
                  <Label size="sm" weight="medium" color="inherit">
                    {t("dashboard.layout.command.placeholder", "Szukaj lub przejdź do…")}
                  </Label>
                  <span className="inline-flex h-5 items-center rounded-[6px] border border-ethereal-graphite/15 bg-ethereal-marble/70 px-1.5 font-sans text-[10px] font-semibold leading-none text-ethereal-graphite/60">
                    {SHORTCUT_LABEL}
                  </span>
                </motion.span>
              </button>
            </Tooltip>
          </div>

          {/* ---- Navigation ---- */}
          <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <nav
              aria-label={t("dashboard.layout.nav.main_menu")}
              className="flex w-full flex-col space-y-3 pb-4"
            >
              {navGroups.map((group) => (
                <div key={group.labelKey} className="w-full relative">
                  <motion.div
                    initial={false}
                    animate={{
                      height: isExpanded ? 24 : 0,
                      opacity: isExpanded ? 1 : 0,
                    }}
                    className="relative w-full overflow-hidden mb-1"
                    aria-hidden={!isExpanded}
                  >
                    <div className="absolute left-4 top-1 whitespace-nowrap">
                      <Eyebrow
                        color="muted"
                        size="caption"
                        className="tracking-[0.12em]"
                      >
                        {t(group.labelKey)}
                      </Eyebrow>
                    </div>
                  </motion.div>

                  <div className="flex flex-col space-y-1 w-full">
                    {group.links.map((link) => {
                      const IconComponent = link.icon as React.ElementType;
                      return (
                        <Tooltip
                          key={link.to}
                          content={t(link.labelKey)}
                          disabled={isExpanded}
                          side="right"
                        >
                          <SidebarNavLink
                            to={link.to}
                            end={link.to === "/panel"}
                            style={{ width: isExpanded ? "100%" : "56px" }}
                            aria-label={
                              !isExpanded ? t(link.labelKey) : undefined
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && (
                                  <span
                                    aria-hidden="true"
                                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-ethereal-gold"
                                  />
                                )}
                                <div
                                  className={cn(
                                    "absolute left-0 top-0 bottom-0 w-14 flex shrink-0 items-center justify-center transition-transform duration-300 ease-out group-active/desklink:scale-95",
                                    isActive && "text-ethereal-gold",
                                  )}
                                >
                                  <IconComponent
                                    size={18}
                                    strokeWidth={isActive ? 2.5 : 1.5}
                                    className="transition-all duration-300"
                                  />
                                  {link.to === "/panel/messages" && (
                                    <UnreadMessagesBadge className="right-2.5 top-1.5 ring-white/60" />
                                  )}
                                </div>
                                <motion.div
                                  initial={false}
                                  animate={{
                                    opacity: isExpanded ? 1 : 0,
                                    x: isExpanded ? 0 : -4,
                                  }}
                                  transition={CONTENT_FADE_TRANSITION}
                                  className="absolute left-14 right-0 top-0 bottom-0 flex items-center whitespace-nowrap"
                                  aria-hidden={!isExpanded}
                                >
                                  <Label
                                    weight={isActive ? "semibold" : "medium"}
                                    size="base"
                                    color="inherit"
                                    className="transition-all duration-300"
                                  >
                                    {t(link.labelKey)}
                                  </Label>
                                </motion.div>
                              </>
                            )}
                          </SidebarNavLink>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          {/* ---- Footer: identity + actions ---- */}
          <div className="mt-auto shrink-0 z-10 w-full relative pt-4 flex flex-col gap-3">
            <Divider
              variant="fade"
              position="absolute-top"
              className="opacity-50"
            />

            <div
              style={{ width: isExpanded ? "100%" : "56px" }}
              className="relative flex h-12 overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-[width] duration-300 ease-out"
            >
              <div className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  <Avatar
                    src={avatarUrl}
                    name={userFullName}
                    shape="rounded"
                    className="h-8 w-8 rounded-lg border border-ethereal-gold/40"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-ethereal-gold/40 bg-linear-to-br from-ethereal-gold/30 to-transparent">
                    <Label color="gold" size="sm" weight="semibold">
                      {initials}
                    </Label>
                  </div>
                )}
              </div>
              <motion.div
                initial={false}
                animate={{ opacity: isExpanded ? 1 : 0 }}
                transition={CONTENT_FADE_TRANSITION}
                className="absolute left-14 right-2 top-0 bottom-0 flex flex-col justify-center whitespace-nowrap overflow-hidden"
                aria-hidden={!isExpanded}
              >
                <Label
                  size="sm"
                  weight="medium"
                  className="truncate block leading-tight text-ethereal-ink"
                >
                  {userFullName}
                </Label>
                <Eyebrow
                  color="incense"
                  size="xs"
                  className="truncate block opacity-80 leading-tight mt-0.5"
                >
                  {roleLabel}
                </Eyebrow>
              </motion.div>
            </div>

            <div
              style={{ width: isExpanded ? "100%" : "56px" }}
              className="flex flex-wrap gap-2 transition-[width] duration-300 ease-out overflow-hidden"
            >
              <Tooltip
                content={t("dashboard.layout.actions.settings")}
                disabled={isExpanded}
                side="right"
              >
                <Link
                  to="/panel/settings"
                  aria-label={t("dashboard.layout.actions.settings")}
                  className="group/settings relative block h-10 min-w-14 flex-1 overflow-hidden rounded-lg text-ethereal-graphite/65 outline-none transition-colors duration-200 hover:bg-ethereal-ink/[0.04] hover:text-ethereal-ink focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center transition-transform duration-300 ease-out group-active/settings:scale-95">
                    <Settings size={18} strokeWidth={2} />
                  </div>
                  <motion.div
                    initial={false}
                    animate={{ opacity: isExpanded ? 1 : 0 }}
                    transition={CONTENT_FADE_TRANSITION}
                    className="absolute left-14 right-0 top-0 bottom-0 flex items-center whitespace-nowrap"
                    aria-hidden={!isExpanded}
                  >
                    <Label size="sm" weight="medium" color="inherit">
                      {t("dashboard.layout.actions.settings")}
                    </Label>
                  </motion.div>
                </Link>
              </Tooltip>

              <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg transition-all duration-200">
                <NotificationCenter />
              </div>

              <Tooltip
                content={t("dashboard.layout.actions.logout")}
                disabled={isExpanded}
                side="right"
              >
                <button
                  onClick={logout}
                  aria-label={t("dashboard.layout.actions.logout")}
                  className="group/logout relative flex h-10 w-14 shrink-0 items-center justify-center rounded-lg text-ethereal-graphite/50 outline-none transition-colors duration-200 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson focus-visible:ring-2 focus-visible:ring-ethereal-crimson/50"
                >
                  <div className="transition-transform duration-300 ease-out group-active/logout:scale-95">
                    <LogOut size={18} strokeWidth={2.5} />
                  </div>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </GlassCard>
    </TooltipProvider>
  );
};
