/**
 * @file ProjectTabs.tsx
 * @description Per-project sub-navigation for the Project Hub: real,
 * deep-linkable routes under `/panel/projects/:id/*`. On a phone about four of
 * the ten tabs fit, so the strip scrolls sideways — and since it has no
 * scrollbar, it says so itself: the active tab is brought to the middle on
 * every route change, and an edge fades on each side that still hides tabs.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/ProjectTabs
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Banknote,
  BookOpen,
  Briefcase,
  Calendar1,
  Grid,
  LayoutDashboard,
  ListOrdered,
  MicVocal,
  Users,
  Wrench,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Eyebrow } from "@/shared/ui/primitives/typography";

interface ProjectTabsProps {
  readonly projectId: string;
  readonly className?: string;
}

interface TabDef {
  readonly segment: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  /** Marks the index route so it is only active on the exact hub root. */
  readonly end?: boolean;
}

/** How far into the strip a hiding edge fades. */
const EDGE_FADE = "2rem";

/** A sub-pixel remainder of the scroll range is not a hidden tab. */
const EDGE_TOLERANCE_PX = 1;

const edgeMask = (start: boolean, end: boolean): string =>
  `linear-gradient(to right, ${start ? "transparent" : "black"}, black ${EDGE_FADE}, black calc(100% - ${EDGE_FADE}), ${end ? "transparent" : "black"})`;

export const ProjectTabs = ({
  projectId,
  className,
}: ProjectTabsProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion() ?? false;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hasPositioned = useRef(false);
  const [edges, setEdges] = useState({ start: false, end: false });
  const base = `/panel/projects/${projectId}`;

  const updateEdges = useCallback((): void => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const start = scroller.scrollLeft > EDGE_TOLERANCE_PX;
    const end =
      scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft >
      EDGE_TOLERANCE_PX;
    setEdges((previous) =>
      previous.start === start && previous.end === end
        ? previous
        : { start, end },
    );
  }, []);

  // The active tab to the middle of the strip, so the tabs on either side of
  // it show too. The first placement is instant: arriving on "Budżet" should
  // not play a slide across the other nine. The page never scrolls with it.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const active = scroller?.querySelector<HTMLElement>('[aria-current="page"]');
    if (scroller && active) {
      const strip = scroller.getBoundingClientRect();
      const tab = active.getBoundingClientRect();
      scroller.scrollTo({
        left:
          scroller.scrollLeft +
          (tab.left - strip.left) -
          (strip.width - tab.width) / 2,
        behavior: hasPositioned.current && !reduceMotion ? "smooth" : "auto",
      });
      hasPositioned.current = true;
    }
    updateEdges();
  }, [pathname, reduceMotion, updateEdges]);

  // A turned phone or a translated label moves the overflow without a scroll.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [updateEdges]);

  const mask = edgeMask(edges.start, edges.end);

  const tabs: TabDef[] = [
    {
      segment: "",
      label: t("projects.hub.tabs.overview", "Przegląd"),
      icon: <LayoutDashboard size={14} aria-hidden="true" />,
      end: true,
    },
    {
      segment: "details",
      label: t("projects.editor.tabs.details", "Szczegóły"),
      icon: <Briefcase size={14} aria-hidden="true" />,
    },
    {
      segment: "program",
      label: t("projects.editor.tabs.program", "Program"),
      icon: <ListOrdered size={14} aria-hidden="true" />,
    },
    {
      segment: "partytura",
      label: t("projects.editor.tabs.score", "Partytura"),
      icon: <BookOpen size={14} aria-hidden="true" />,
    },
    {
      segment: "cast",
      label: t("projects.editor.tabs.cast", "Obsada"),
      icon: <Users size={14} aria-hidden="true" />,
    },
    {
      segment: "divisi",
      label: t("projects.editor.tabs.divisi", "Divisi"),
      icon: <MicVocal size={14} aria-hidden="true" />,
    },
    {
      segment: "rehearsals",
      label: t("projects.editor.tabs.rehearsals", "Próby"),
      icon: <Calendar1 size={14} aria-hidden="true" />,
    },
    {
      segment: "attendance",
      label: t("projects.editor.tabs.matrix", "Frekwencja"),
      icon: <Grid size={14} aria-hidden="true" />,
    },
    {
      segment: "crew",
      label: t("projects.editor.tabs.crew", "Ekipa"),
      icon: <Wrench size={14} aria-hidden="true" />,
    },
    {
      segment: "budget",
      label: t("projects.editor.tabs.budget", "Budżet"),
      icon: <Banknote size={14} aria-hidden="true" />,
    },
  ];

  return (
    <nav
      aria-label={t("projects.hub.tabs_aria", "Sekcje projektu")}
      className={cn(
        "rounded-nested border border-hairline bg-ethereal-marble/55 shadow-glass-solid backdrop-blur-md",
        className,
      )}
    >
      {/* The mask sits on this inner strip, not on the nav, so it fades tabs
          and leaves the frame whole. The padding lives here too: the scroll
          box clips, and the active pill's shadow needs the room. */}
      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className="flex gap-1 overflow-x-auto p-1.5 no-scrollbar"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.segment || "overview"}
            to={tab.segment ? `${base}/${tab.segment}` : base}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "relative inline-flex shrink-0 items-center gap-1.5 rounded-control px-3.5 py-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
                isActive
                  ? "bg-ethereal-marble text-ethereal-ink shadow-[0_1px_3px_var(--glass-contact),0_1px_1px_rgba(194,168,120,0.14)]"
                  : "text-ethereal-graphite/65 hover:bg-ethereal-marble/60 hover:text-ethereal-ink",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-ethereal-gold" : "text-ethereal-graphite/50",
                  )}
                  aria-hidden="true"
                >
                  {tab.icon}
                </span>
                <Eyebrow color="inherit" className="truncate">
                  {tab.label}
                </Eyebrow>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
