/**
 * @file MobileNavSheet.tsx
 * @description Expanded mobile navigation. Solid alabaster surface that
 * animates only `y` and `opacity`. The visual depth (scrim + blur) lives on
 * the static overlay so backdrop-filter is computed once and cached, never
 * re-rasterized while the sheet translates.
 *
 * Architectural contract:
 *   - No `backdrop-filter` on the moving subtree.
 *   - No staggered child entrances; the sheet is a single composite layer.
 *   - No shared-layout indicators (`layoutId`); active states are pure CSS.
 *   - `contain: paint` keeps the sheet isolated from the dashboard outlet.
 *
 * @architecture Enterprise SaaS 2026
 * @module widgets/panel-shell/mobile
 */

import React, { useRef } from "react";
import {
  motion,
  PanInfo,
  Transition,
  useDragControls,
  useMotionValue,
} from "framer-motion";
import { NavLink } from "react-router-dom";
import { X, Settings, LogOut } from "lucide-react";
import { cva } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";
import {
  Heading,
  Eyebrow,
  Label,
} from "@/shared/ui/primitives/typography";
import { Divider } from "@/shared/ui/primitives/Divider";
import { UnreadMessagesBadge } from "@/features/messages/components/UnreadMessagesBadge";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";
import { useNavigationAura } from "../hooks/useNavigationAura";

const SHEET_SPRING: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 32,
  mass: 0.85,
};

const SCRIM_TRANSITION: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
};

const SWIPE_OFFSET_THRESHOLD = 96;
const SWIPE_VELOCITY_THRESHOLD = 420;
const DRAG_ELASTICITY = 0.04;

const sheetLinkVariants = cva(
  [
    "group/m-link relative flex items-center gap-3 rounded-[14px] px-3 py-2.5",
    "outline-none transition-[background-color,color,transform] duration-200",
    "focus-visible:ring-2 focus-visible:ring-ethereal-gold/50",
    "active:scale-[0.985]",
  ],
  {
    variants: {
      isActive: {
        true: "bg-ethereal-gold/[0.07]",
        false: "hover:bg-ethereal-graphite/[0.035]",
      },
    },
    defaultVariants: { isActive: false },
  },
);

interface MobileNavSheetProps {
  readonly onClose: () => void;
  readonly logout: () => void;
  readonly aura: ReturnType<typeof useNavigationAura>;
}

export const MobileNavSheet = ({
  onClose,
  logout,
  aura,
}: MobileNavSheetProps): React.JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const y = useMotionValue(0);

  useFocusTrap(containerRef, true);

  const handleDragEnd = (
    _: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    if (
      info.offset.y > SWIPE_OFFSET_THRESHOLD ||
      info.velocity.y > SWIPE_VELOCITY_THRESHOLD
    ) {
      onClose();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={SCRIM_TRANSITION}
        className="fixed inset-0 z-nav-sheet bg-ethereal-ink/45 backdrop-blur-[4px] fine-pointer:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={aura.t(
          "nav.sheet.accessibility_label",
          "Expanded mobile navigation",
        )}
        className={cn(
          "fixed inset-x-0 bottom-0 z-nav-sheet flex h-[88dvh] max-h-[88dvh] flex-col",
          "overflow-hidden rounded-t-[26px] border-t border-glass-border",
          "bg-ethereal-alabaster outline-none",
          "shadow-[0_-12px_40px_-8px_rgba(22,20,18,0.18)]",
          "fine-pointer:hidden",
        )}
        style={{ y, contain: "paint" }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={DRAG_ELASTICITY}
        onDragEnd={handleDragEnd}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", transition: { duration: 0.22, ease: "circIn" } }}
        transition={SHEET_SPRING}
      >
        <div
          className="flex w-full shrink-0 cursor-grab justify-center py-3 touch-none active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          aria-hidden="true"
        >
          <span className="block h-[3px] w-9 rounded-full bg-ethereal-graphite/15" />
        </div>

        <header className="flex shrink-0 items-center justify-between px-6 pb-4">
          <Heading size="2xl" weight="medium" className="tracking-tight">
            Voct
            <Heading
              as="span"
              weight="light"
              color="gold"
              size="2xl"
              className="ml-1 italic"
            >
              Manager
            </Heading>
          </Heading>

          <button
            type="button"
            onClick={onClose}
            aria-label={aura.t("common.actions.close", "Close navigation")}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-xl",
              "bg-ethereal-graphite/[0.04] text-ethereal-graphite/70",
              "transition-[background-color,color,transform] duration-200",
              "hover:bg-ethereal-graphite/[0.08] hover:text-ethereal-ink",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/60",
              "active:scale-[0.96]",
            )}
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <Divider variant="solid" className="bg-ethereal-graphite/10" />

        <nav
          data-scroll-lock-ignore="true"
          aria-label={aura.t(
            "dashboard.layout.nav.main_menu",
            "Primary navigation",
          )}
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5"
          style={{
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          }}
        >
          <ul className="m-0 flex list-none flex-col gap-7 p-0">
            {aura.navGroups.map((group) => (
              <li key={group.labelKey}>
                <Eyebrow
                  size="caption"
                  color="muted"
                  weight="medium"
                  className="mb-2 block px-4 tracking-[0.22em]"
                >
                  {aura.t(group.labelKey)}
                </Eyebrow>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {group.links.map((link) => {
                    const Icon = link.icon;
                    return (
                      <li key={link.to}>
                        <NavLink
                          to={link.to}
                          end={link.to === "/panel"}
                          onClick={onClose}
                          className={({ isActive }) =>
                            cn(sheetLinkVariants({ isActive }))
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {isActive && (
                                <span
                                  aria-hidden="true"
                                  className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-r-full bg-ethereal-gold"
                                />
                              )}
                              <span
                                className={cn(
                                  "relative grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-200",
                                  isActive
                                    ? "bg-ethereal-gold/10 text-ethereal-gold"
                                    : "text-ethereal-graphite/60 group-hover/m-link:text-ethereal-ink",
                                )}
                              >
                                <Icon
                                  size={18}
                                  strokeWidth={isActive ? 2.25 : 1.75}
                                  aria-hidden="true"
                                />
                                {link.to === "/panel/messages" && (
                                  <UnreadMessagesBadge className="right-0 top-0" />
                                )}
                              </span>
                              <Label
                                size="base"
                                weight={isActive ? "semibold" : "medium"}
                                className={cn(
                                  "tracking-[-0.005em]",
                                  isActive
                                    ? "text-ethereal-ink"
                                    : "text-ethereal-graphite/80",
                                )}
                              >
                                {aura.t(link.labelKey)}
                              </Label>
                            </>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <Divider variant="solid" className="bg-ethereal-graphite/10" />

        <footer className="flex shrink-0 items-center justify-between gap-3 px-5 py-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ethereal-gold/30 bg-gradient-to-br from-ethereal-gold/25 to-ethereal-gold/5">
              <Label color="gold" size="sm" weight="semibold">
                {aura.initials}
              </Label>
            </div>
            <div className="flex min-w-0 flex-col">
              <Label
                size="sm"
                weight="semibold"
                truncate
                className="leading-tight text-ethereal-ink"
              >
                {aura.userFullName}
              </Label>
              <Eyebrow
                color="incense"
                size="caption"
                weight="medium"
                truncate
                className="mt-0.5 leading-tight tracking-[0.18em] opacity-80"
              >
                {aura.roleLabel}
              </Eyebrow>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <NavLink
              to="/panel/settings"
              onClick={onClose}
              aria-label={aura.t(
                "dashboard.layout.actions.settings",
                "Settings",
              )}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-xl",
                "text-ethereal-graphite/70 outline-none",
                "transition-[background-color,color,transform] duration-200",
                "hover:bg-ethereal-graphite/[0.06] hover:text-ethereal-ink",
                "focus-visible:ring-2 focus-visible:ring-ethereal-gold/60",
                "active:scale-[0.96]",
              )}
            >
              <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
            </NavLink>
            <button
              type="button"
              onClick={logout}
              aria-label={aura.t(
                "dashboard.layout.actions.logout",
                "Log out",
              )}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-xl",
                "text-ethereal-crimson/85 outline-none",
                "transition-[background-color,color,transform] duration-200",
                "hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson",
                "focus-visible:ring-2 focus-visible:ring-ethereal-crimson/50",
                "active:scale-[0.96]",
              )}
            >
              <LogOut size={18} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>
        </footer>
      </motion.div>
    </>
  );
};

MobileNavSheet.displayName = "MobileNavSheet";
