/**
 * @file MobileNavSheet.tsx
 * @description Expanded mobile navigation — the touch presentation of the
 * command surface. Leads with identity (account header → settings), then search,
 * then a rich command list shared with the desktop palette via `useCommandItems`
 * (quick-actions · pinned/recent projects · navigation · project & artist
 * search), and a clear log-out. Solid alabaster surface that animates only `y`;
 * the scrim owns the blur so backdrop-filter is never re-rasterised mid-drag.
 *
 * Architectural contract:
 *   - No `backdrop-filter` on the moving subtree.
 *   - `contain: paint` isolates the sheet from the dashboard outlet.
 *   - Height is content-fit, capped at 88dvh (no vast empty sheet when sparse).
 *
 * @architecture Enterprise SaaS 2026
 * @module widgets/panel-shell/mobile
 */

import React, { useRef, useState } from "react";
import {
  motion,
  PanInfo,
  Transition,
  useDragControls,
  useMotionValue,
} from "framer-motion";
import { NavLink, useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, Search, Settings, Star, X } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import type { AuthUser } from "@/shared/auth/auth.types";
import { Eyebrow, Label } from "@/shared/ui/primitives/typography";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { UnreadMessagesBadge } from "@/features/messages/components/UnreadMessagesBadge";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";
import { hapticsService } from "@/shared/lib/hardware/hapticsService";
import { useNavigationAura } from "../hooks/useNavigationAura";
import { useCommandItems, type CommandItem } from "../command/useCommandItems";
import {
  toggleProjectFavorite,
  useProjectQuickAccess,
} from "../command/quickAccessStore";

const SHEET_SPRING: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 36,
  mass: 0.8,
};

const SCRIM_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};

const SWIPE_OFFSET_THRESHOLD = 96;
const SWIPE_VELOCITY_THRESHOLD = 420;
const DRAG_ELASTICITY = 0.04;

interface MobileNavSheetProps {
  readonly user: AuthUser | null;
  readonly onClose: () => void;
  readonly logout: () => void;
  readonly aura: ReturnType<typeof useNavigationAura>;
}

export const MobileNavSheet = ({
  user,
  onClose,
  logout,
  aura,
}: MobileNavSheetProps): React.JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useFocusTrap(containerRef, true);

  const { favorites } = useProjectQuickAccess();
  const favoriteSet = new Set(favorites);
  const { sections, flatItems } = useCommandItems(user, true, query);
  const isSearching = query.trim().length > 0;

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

  const go = (to: string) => {
    hapticsService.playEtherealTick();
    onClose();
    navigate(to);
  };

  const renderRow = (item: CommandItem): React.JSX.Element => {
    const Icon = item.icon;
    const isFavorite = item.projectId ? favoriteSet.has(item.projectId) : false;
    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={() => go(item.to)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            go(item.to);
          }
        }}
        className="group/row relative flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 outline-none transition-[background-color,transform] duration-200 hover:bg-ethereal-graphite/[0.04] focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.99]"
      >
        <span
          className={cn(
            "relative grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-200",
            item.isCurrent
              ? "bg-ethereal-gold/12 text-ethereal-gold"
              : "bg-ethereal-graphite/[0.06] text-ethereal-graphite/65",
          )}
        >
          <Icon
            size={19}
            strokeWidth={item.isCurrent ? 2.25 : 1.75}
            aria-hidden="true"
          />
          {item.hasMessagesBadge && (
            <UnreadMessagesBadge className="-right-1 -top-1" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <Label
            size="base"
            weight={item.isCurrent ? "semibold" : "medium"}
            truncate
            className={cn(
              "block",
              item.isCurrent ? "text-ethereal-ink" : "text-ethereal-graphite/85",
            )}
          >
            {item.label}
          </Label>
          {item.hint && (
            <span className="block truncate text-[11px] leading-tight text-ethereal-graphite/45">
              {item.hint}
            </span>
          )}
        </span>

        {item.isCurrent && (
          <Eyebrow
            size="caption"
            color="gold"
            weight="medium"
            className="shrink-0 tracking-[0.16em]"
          >
            {aura.t("dashboard.layout.command.current", "Tutaj")}
          </Eyebrow>
        )}

        {item.kind === "project" && item.projectId ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleProjectFavorite(item.projectId as string);
            }}
            aria-label={
              isFavorite
                ? aura.t("dashboard.layout.command.unpin_project", "Odepnij projekt")
                : aura.t("dashboard.layout.command.pin_project", "Przypnij projekt")
            }
            aria-pressed={isFavorite}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors active:scale-95",
              isFavorite
                ? "text-ethereal-gold"
                : "text-ethereal-graphite/30 hover:text-ethereal-graphite/65",
            )}
          >
            <Star
              size={16}
              strokeWidth={2}
              className={isFavorite ? "fill-ethereal-gold" : ""}
              aria-hidden="true"
            />
          </button>
        ) : (
          <ChevronRight
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="shrink-0 text-ethereal-graphite/25 transition-transform duration-200 group-hover/row:translate-x-0.5"
          />
        )}
      </div>
    );
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
          "fixed inset-x-0 bottom-0 z-nav-sheet flex max-h-[88dvh] flex-col",
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
          className="flex w-full shrink-0 cursor-grab justify-center pt-3 pb-1.5 touch-none active:cursor-grabbing"
          onPointerDown={(event) => dragControls.start(event)}
          aria-hidden="true"
        >
          <span className="block h-[3px] w-9 rounded-full bg-ethereal-graphite/15" />
        </div>

        {/* Account header — identity leads, taps through to settings. */}
        <header className="flex shrink-0 items-center gap-2 px-4 pb-3">
          <NavLink
            to="/panel/settings"
            onClick={onClose}
            className="group/id flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 outline-none transition-colors hover:bg-ethereal-graphite/[0.04] focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
          >
            {aura.avatarUrl ? (
              <Avatar
                src={aura.avatarUrl}
                name={aura.userFullName}
                shape="rounded"
                className="h-11 w-11 rounded-2xl border border-ethereal-gold/30"
              />
            ) : (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-ethereal-gold/30 bg-gradient-to-br from-ethereal-gold/25 to-ethereal-gold/5">
                <Label color="gold" size="base" weight="semibold">
                  {aura.initials}
                </Label>
              </div>
            )}
            <div className="flex min-w-0 flex-col">
              <Label
                size="base"
                weight="semibold"
                truncate
                className="block leading-tight text-ethereal-ink"
              >
                {aura.userFullName}
              </Label>
              <Eyebrow
                color="incense"
                size="caption"
                weight="medium"
                truncate
                className="mt-0.5 block leading-tight tracking-[0.16em] opacity-80"
              >
                {aura.roleLabel}
              </Eyebrow>
            </div>
            <Settings
              size={17}
              strokeWidth={1.75}
              aria-hidden="true"
              className="ml-auto shrink-0 text-ethereal-graphite/35 transition-colors group-hover/id:text-ethereal-graphite/70"
            />
          </NavLink>

          <button
            type="button"
            onClick={onClose}
            aria-label={aura.t("common.actions.close", "Close navigation")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ethereal-graphite/[0.04] text-ethereal-graphite/70 outline-none transition-[background-color,color,transform] duration-200 hover:bg-ethereal-graphite/[0.08] hover:text-ethereal-ink focus-visible:ring-2 focus-visible:ring-ethereal-gold/60 active:scale-[0.96]"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        {/* Search */}
        <div className="shrink-0 px-4 pb-3">
          <div className="flex h-12 items-center gap-2.5 rounded-2xl border border-ethereal-graphite/12 bg-ethereal-graphite/[0.03] px-4 transition-colors focus-within:border-ethereal-gold/45 focus-within:bg-ethereal-marble/60">
            <Search
              size={18}
              strokeWidth={1.75}
              className="shrink-0 text-ethereal-incense"
              aria-hidden="true"
            />
            <input
              type="text"
              inputMode="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={aura.t(
                "dashboard.layout.command.placeholder",
                "Szukaj lub przejdź do…",
              )}
              aria-label={aura.t(
                "dashboard.layout.command.placeholder",
                "Szukaj lub przejdź do…",
              )}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ethereal-ink outline-none placeholder:text-ethereal-incense/80"
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={aura.t("common.actions.clear", "Wyczyść")}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ethereal-graphite/55 transition-colors active:scale-95 hover:bg-ethereal-graphite/[0.06] hover:text-ethereal-ink"
              >
                <X size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <nav
          data-scroll-lock-ignore="true"
          aria-label={aura.t(
            "dashboard.layout.nav.main_menu",
            "Primary navigation",
          )}
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          {flatItems.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-14 text-center">
              <Label size="sm" weight="medium" color="graphite">
                {aura.t("dashboard.layout.command.no_results", "Brak wyników")}
              </Label>
              <Eyebrow size="caption" color="muted">
                {aura.t(
                  "dashboard.layout.command.no_results_hint",
                  "Spróbuj innej frazy",
                )}
              </Eyebrow>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.id} className="mb-1 last:mb-0">
                <Eyebrow
                  size="caption"
                  color="muted"
                  weight="medium"
                  className="block px-3 pb-1 pt-3 tracking-[0.18em]"
                >
                  {aura.t(section.titleKey)}
                </Eyebrow>
                <div className="flex flex-col">
                  {section.items.map((item) => renderRow(item))}
                </div>
              </div>
            ))
          )}
        </nav>

        <div className="shrink-0 border-t border-ethereal-graphite/10 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-ethereal-crimson/85 outline-none transition-colors hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson focus-visible:ring-2 focus-visible:ring-ethereal-crimson/40 active:scale-[0.99]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ethereal-crimson/10">
              <LogOut size={18} strokeWidth={2} aria-hidden="true" />
            </span>
            <Label size="base" weight="medium" color="inherit">
              {aura.t("dashboard.layout.actions.logout", "Wyloguj")}
            </Label>
          </button>
        </div>
      </motion.div>
    </>
  );
};

MobileNavSheet.displayName = "MobileNavSheet";
