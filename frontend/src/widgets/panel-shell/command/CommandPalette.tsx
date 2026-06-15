/**
 * @file CommandPalette.tsx
 * @description Spotlight-class "jump anywhere / do anything" surface. Resolves a
 * free-text query across navigation, projects, artists and quick-actions, and
 * shows pinned + recent projects when idle. Fully keyboard-driven: type to
 * filter, ↑/↓ to traverse, ↵ to go, esc to dismiss. Project/artist data is
 * fetched lazily and non-blocking (see useCommandItems), so the surface stays
 * instant and never suspends the shell.
 * @module widgets/panel-shell/command
 * @architecture Enterprise SaaS 2026
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Transition } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Search, Star, X } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import type { AuthUser } from "@/shared/auth/auth.types";
import { Eyebrow, Label } from "@/shared/ui/primitives/typography";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { useCloseWatcher } from "@/shared/lib/dom/useCloseWatcher";
import { useFocusTrap } from "@/shared/lib/dom/useFocusTrap";
import { hapticsService } from "@/shared/lib/hardware/hapticsService";
import { useTranslation } from "react-i18next";
import { UnreadMessagesBadge } from "@/features/messages/components/UnreadMessagesBadge";
import { useCommandItems, type CommandItem } from "./useCommandItems";
import { toggleProjectFavorite, useProjectQuickAccess } from "./quickAccessStore";

const PANEL_SPRING: Transition = {
  type: "spring",
  stiffness: 460,
  damping: 36,
  mass: 0.7,
};

const SCRIM_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};

interface CommandPaletteProps {
  readonly user: AuthUser | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

const KbdHint = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-ethereal-graphite/15 bg-ethereal-marble/70 px-1.5 font-sans text-[10px] font-semibold leading-none text-ethereal-graphite/70">
    {children}
  </span>
);

export const CommandPalette = ({
  user,
  isOpen,
  onClose,
}: CommandPaletteProps): React.JSX.Element => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useBodyScrollLock(isOpen);
  useFocusTrap(containerRef, isOpen);
  useCloseWatcher(isOpen, onClose);

  const { favorites } = useProjectQuickAccess();
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const { sections, flatItems } = useCommandItems(user, isOpen, query);

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    flatItems.forEach((item, index) => map.set(item.id, index));
    return map;
  }, [flatItems]);

  // Fresh palette on every open; keep the highlight valid as results narrow.
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex((current) =>
      flatItems.length === 0 ? 0 : Math.min(current, flatItems.length - 1),
    );
  }, [flatItems.length]);

  useEffect(() => {
    if (!isOpen) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-index="${activeIndex}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const go = useCallback(
    (to: string) => {
      hapticsService.playEtherealTick();
      onClose();
      navigate(to);
    },
    [navigate, onClose],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) =>
          flatItems.length === 0 ? 0 : (current + 1) % flatItems.length,
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) =>
          flatItems.length === 0
            ? 0
            : (current - 1 + flatItems.length) % flatItems.length,
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = flatItems[activeIndex];
        if (item) go(item.to);
      } else if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(Math.max(0, flatItems.length - 1));
      }
    },
    [flatItems, activeIndex, go],
  );

  const renderRow = (item: CommandItem): React.JSX.Element => {
    const index = indexById.get(item.id) ?? 0;
    const isHighlighted = index === activeIndex;
    const Icon = item.icon;
    const isFavorite = item.projectId
      ? favoriteSet.has(item.projectId)
      : false;

    return (
      <div
        key={item.id}
        role="button"
        tabIndex={-1}
        data-cmd-index={index}
        onMouseMove={() => setActiveIndex(index)}
        onClick={() => go(item.to)}
        aria-label={item.label}
        className={cn(
          "group/cmd flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors duration-150",
          isHighlighted
            ? "bg-ethereal-gold/[0.14]"
            : "hover:bg-ethereal-graphite/[0.04]",
        )}
      >
        <span
          className={cn(
            "relative grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-150",
            isHighlighted
              ? "bg-ethereal-gold/15 text-ethereal-gold"
              : "text-ethereal-graphite/55",
          )}
        >
          <Icon
            size={17}
            strokeWidth={isHighlighted ? 2.25 : 1.75}
            aria-hidden="true"
          />
          {item.hasMessagesBadge && (
            <UnreadMessagesBadge className="right-0.5 top-0.5" />
          )}
        </span>

        <Label
          size="base"
          weight={isHighlighted ? "semibold" : "medium"}
          className={cn(
            "min-w-0 flex-1 truncate",
            isHighlighted ? "text-ethereal-ink" : "text-ethereal-graphite/85",
          )}
        >
          {item.label}
        </Label>

        {item.isCurrent ? (
          <Eyebrow
            size="caption"
            color="gold"
            weight="medium"
            className="shrink-0 tracking-[0.16em]"
          >
            {t("dashboard.layout.command.current", "Tutaj")}
          </Eyebrow>
        ) : (
          item.hint && (
            <Eyebrow
              size="caption"
              color="muted"
              className="shrink-0 tabular-nums tracking-[0.08em]"
            >
              {item.hint}
            </Eyebrow>
          )
        )}

        {item.kind === "project" && item.projectId && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleProjectFavorite(item.projectId as string);
            }}
            aria-label={
              isFavorite
                ? t("dashboard.layout.command.unpin_project", "Odepnij projekt")
                : t("dashboard.layout.command.pin_project", "Przypnij projekt")
            }
            aria-pressed={isFavorite}
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors",
              isFavorite
                ? "text-ethereal-gold"
                : "text-ethereal-graphite/30 hover:text-ethereal-graphite/70 group-hover/cmd:text-ethereal-graphite/55",
            )}
          >
            <Star
              size={15}
              strokeWidth={2}
              className={isFavorite ? "fill-ethereal-gold" : ""}
              aria-hidden="true"
            />
          </button>
        )}

        {isHighlighted && (
          <CornerDownLeft
            size={15}
            strokeWidth={2}
            className="shrink-0 text-ethereal-gold"
            aria-hidden="true"
          />
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-toast flex justify-center px-4 pt-[14vh]"
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SCRIM_TRANSITION}
            className="absolute inset-0 bg-ethereal-ink/35 backdrop-blur-[6px]"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("dashboard.layout.command.title", "Szybkie przejście")}
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={PANEL_SPRING}
            onKeyDown={handleKeyDown}
            className={cn(
              "relative z-10 flex max-h-[68vh] w-full max-w-[620px] flex-col overflow-hidden",
              "rounded-[22px] border border-glass-border bg-ethereal-alabaster/96 backdrop-blur-ethereal",
              "shadow-[0_32px_80px_-24px_rgba(22,20,18,0.4),0_0_0_1px_rgba(194,168,120,0.18)]",
            )}
          >
            <div className="flex shrink-0 items-center gap-3 px-4 py-3.5">
              <Search
                size={18}
                strokeWidth={1.75}
                className="shrink-0 text-ethereal-incense"
                aria-hidden="true"
              />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t(
                  "dashboard.layout.command.placeholder",
                  "Szukaj lub przejdź do…",
                )}
                aria-label={t(
                  "dashboard.layout.command.placeholder",
                  "Szukaj lub przejdź do…",
                )}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-ethereal-ink outline-none placeholder:text-ethereal-incense/80"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.actions.close", "Zamknij")}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ethereal-graphite/55 transition-colors hover:bg-ethereal-graphite/[0.06] hover:text-ethereal-ink"
              >
                <X size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="h-px shrink-0 bg-ethereal-graphite/10" />

            <div
              ref={listRef}
              className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
            >
              {flatItems.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                  <Label size="sm" weight="medium" color="graphite">
                    {t("dashboard.layout.command.no_results", "Brak wyników")}
                  </Label>
                  <Eyebrow size="caption" color="muted">
                    {t(
                      "dashboard.layout.command.no_results_hint",
                      "Spróbuj innej frazy",
                    )}
                  </Eyebrow>
                </div>
              ) : (
                sections.map((section) => (
                  <div key={section.id} className="mb-1.5 last:mb-0">
                    <Eyebrow
                      size="caption"
                      color="muted"
                      weight="medium"
                      className="block px-3 pb-1 pt-2 tracking-[0.18em]"
                    >
                      {t(section.titleKey)}
                    </Eyebrow>
                    <div className="flex flex-col">
                      {section.items.map((item) => renderRow(item))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-ethereal-graphite/10 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <KbdHint>↑</KbdHint>
                  <KbdHint>↓</KbdHint>
                  <Eyebrow size="caption" color="muted">
                    {t("dashboard.layout.command.hint_move", "nawigacja")}
                  </Eyebrow>
                </span>
                <span className="flex items-center gap-1.5">
                  <KbdHint>↵</KbdHint>
                  <Eyebrow size="caption" color="muted">
                    {t("dashboard.layout.command.hint_select", "przejdź")}
                  </Eyebrow>
                </span>
              </div>
              <span className="flex items-center gap-1.5">
                <KbdHint>esc</KbdHint>
                <Eyebrow size="caption" color="muted">
                  {t("dashboard.layout.command.hint_close", "zamknij")}
                </Eyebrow>
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

CommandPalette.displayName = "CommandPalette";
