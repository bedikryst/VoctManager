/**
 * @file RehearsalRail.tsx
 * @description Context navigator for the Centrum Obecności: an active/archive
 * project switch, a project picker, and a dense, scannable list of that
 * project's rehearsals. Each row names its evening by the topic line, else by
 * the plan's first pieces, else by the room; says where its plan stands with
 * the choir (bez planu / szkic / wysłany / zmieniony); and carries a
 * completion ring so the conductor sees at a glance which sessions still need
 * attendance recorded. The ring counts replies until the register opens and
 * marks from then on, and says which under it.
 *
 * On a phone the rail folds into a compact evening picker — the evening on
 * the card, a step to either neighbour, the full list on demand — so the
 * card sits right under it instead of below the whole list. A pick from the
 * unfolded list folds it back and brings the picker to the top.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/RehearsalRail
 */

import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Archive,
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import {
  SegmentedTabs,
  type SegmentedTabItem,
} from "@/shared/ui/composites/SegmentedTabs";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import {
  formatLocalizedDate,
  formatLocalizedTime,
} from "@/shared/lib/time/intl";
import { formatShortWeekday } from "@/shared/lib/time/weekday";

import type { Project, Rehearsal } from "@/shared/types";
import type { ProjectTabType } from "../types/rehearsals.dto";
import type { AttendanceTally } from "../lib/attendanceStats";
import {
  EMPTY_TALLY,
  isPast,
  isRegisterOpen,
  isRehearsalLive,
} from "../lib/attendanceStats";
import { planStateOf, type PlanState } from "../lib/planPublication";
import { CompletionRing } from "@/shared/ui/composites/CompletionRing";
import type { BadgeVariant } from "@/shared/ui/primitives/Badge";

interface RehearsalRailProps {
  projectTab: ProjectTabType;
  onProjectTab: (tab: ProjectTabType) => void;
  displayProjects: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  projectRehearsals: Rehearsal[];
  rehearsalTallies: Map<string, AttendanceTally>;
  activeRehearsalId: string | null;
  onSelectRehearsal: (id: string) => void;
  getLocationName: (ref: Rehearsal["location"], fallback: string) => string;
  /** Ticking clock, so "past" and "now" age without a remount. */
  nowMs: number;
}

/**
 * The ring measures how much of the roll call is written down. An unfinished
 * one is outstanding work — gold — whether or not the session has happened;
 * crimson used to mark every past session with a gap, which put the panel's
 * alarm colour on ordinary paperwork and left nothing louder for a real fault.
 */
/**
 * The row's clock face: `18:00` alone, or the whole span where somebody timed
 * the session. Both ends are read in the venue's clock — the rail is a dense
 * navigator, so the reader's own zone stays on the inspector beside it.
 * An en dash with no spaces, the typographic form of a span of clock time.
 */
const clockFace = (rehearsal: Rehearsal): string => {
  const clock = (value: string): string =>
    formatLocalizedTime(
      value,
      { hour: "2-digit", minute: "2-digit" },
      undefined,
      rehearsal.timezone,
    );

  return rehearsal.end_date_time
    ? `${clock(rehearsal.date_time)}–${clock(rehearsal.end_date_time)}`
    : clock(rehearsal.date_time);
};

const ringToneFor = (tally: AttendanceTally): "gold" | "sage" | "graphite" => {
  if (tally.total === 0) return "graphite";
  return tally.completion >= 100 ? "sage" : "gold";
};

/** How many of the plan's pieces name an evening that has no topic line. */
const PREVIEW_PIECES = 2;

/**
 * "Lark · Laudes · +3": the main rows' titles in order. Breaks and the
 * reserve are left out — they do not say what the evening works on.
 */
const planPreview = (rehearsal: Rehearsal): string | null => {
  const titles = (rehearsal.plan ?? [])
    .filter((row) => !row.is_reserve && !row.is_break)
    .sort((a, b) => a.position - b.position)
    .map((row) => row.title.trim())
    .filter((title) => title !== "");
  if (titles.length === 0) return null;
  const rest = titles.length - PREVIEW_PIECES;
  const shown = titles.slice(0, PREVIEW_PIECES);
  return (rest > 0 ? [...shown, `+${rest}`] : shown).join(" · ");
};

/**
 * Unsent changes take the gold the plan's own caption gives them; a plan
 * the choir has as it stands is sage; the two states with nothing sent stay
 * neutral, because "no plan yet" is a fact about the evening, not a fault.
 */
const PLAN_STATE_BADGE: Record<PlanState, { variant: BadgeVariant; key: string; fallback: string }> = {
  none: { variant: "outline", key: "rehearsals.rail.plan.none", fallback: "bez planu" },
  draft: { variant: "neutral", key: "rehearsals.rail.plan.draft", fallback: "szkic" },
  sent: { variant: "success", key: "rehearsals.rail.plan.sent", fallback: "wysłany" },
  changed: { variant: "warning", key: "rehearsals.rail.plan.changed", fallback: "zmieniony" },
};

const RehearsalRow = ({
  rehearsal,
  tally,
  isActive,
  onSelect,
  expanded,
  getLocationName,
  nowMs,
}: {
  rehearsal: Rehearsal;
  tally: AttendanceTally;
  isActive: boolean;
  onSelect: (id: string) => void;
  /**
   * Present → the row is the phone picker's disclosure for the full list and
   * says whether that list is open, instead of being one choice in it.
   */
  expanded?: boolean;
  getLocationName: RehearsalRailProps["getLocationName"];
  nowMs: number;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const past = isPast(rehearsal.date_time, nowMs);
  const live = isRehearsalLive(rehearsal.date_time, nowMs);
  // One boundary with the card's own "Plan · Obecność" default: before the
  // register opens the ring counts the singers' replies, from then on the
  // marks of who came.
  const ringLabel = isRegisterOpen(rehearsal.date_time, nowMs)
    ? t("rehearsals.rail.ring.attendance", "obecność")
    : t("rehearsals.rail.ring.replies", "odpowiedzi");
  // While the evening runs, "Teraz" is the one word the row needs.
  const planState = live ? null : planStateOf(rehearsal, nowMs);
  const planBadge = planState ? PLAN_STATE_BADGE[planState] : null;
  const subtitle =
    rehearsal.focus?.trim() ||
    planPreview(rehearsal) ||
    getLocationName(rehearsal.location, t("rehearsals.dashboard.no_location", "Brak lok."));

  return (
    <button
      type="button"
      aria-pressed={expanded === undefined ? isActive : undefined}
      aria-expanded={expanded}
      onClick={() => onSelect(String(rehearsal.id))}
      className={cn(
        "flex w-full items-center gap-3 rounded-nested border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.99]",
        isActive
          ? "border-ethereal-gold/45 bg-ethereal-gold/6 ring-1 ring-ethereal-gold/25"
          : "border-hairline-strong bg-ethereal-alabaster hover:border-ethereal-gold/30",
        past && !isActive && !live && "opacity-70",
      )}
    >
      <div className="flex w-11 shrink-0 flex-col items-center">
        <Eyebrow as="span" size="overline-sm" color="muted" className="mb-0.5">
          {formatShortWeekday(rehearsal.date_time, rehearsal.timezone)}
        </Eyebrow>
        <Text as="span" size="lg" weight="bold" className="leading-none tabular-nums">
          {formatLocalizedDate(
            rehearsal.date_time,
            { day: "numeric" },
            undefined,
            rehearsal.timezone,
          )}
        </Text>
        <Eyebrow as="span" color="muted" className="mt-0.5">
          {formatLocalizedDate(
            rehearsal.date_time,
            { month: "short" },
            undefined,
            rehearsal.timezone,
          )}
        </Eyebrow>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Text as="span" size="sm" weight="semibold" className="whitespace-nowrap tabular-nums">
            {clockFace(rehearsal)}
          </Text>
          {live && (
            <Badge variant="warning" pulse>
              {t("rehearsals.rail.live", "Teraz")}
            </Badge>
          )}
          {planBadge && (
            <Badge variant={planBadge.variant}>{t(planBadge.key, planBadge.fallback)}</Badge>
          )}
        </div>
        <Caption color="muted" truncate className="mt-0.5 block">
          {subtitle}
        </Caption>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <CompletionRing
          value={tally.completion}
          tone={ringToneFor(tally)}
          size={38}
          strokeWidth={3.5}
        >
          <span className="text-[9px] font-bold tabular-nums text-ethereal-ink">
            {tally.total > 0 ? `${tally.marked}/${tally.total}` : "—"}
          </span>
        </CompletionRing>
        <Caption size="xs" color="muted" className="whitespace-nowrap leading-none">
          {ringLabel}
        </Caption>
      </div>
    </button>
  );
};

export const RehearsalRail = ({
  projectTab,
  onProjectTab,
  displayProjects,
  selectedProjectId,
  onSelectProject,
  projectRehearsals,
  rehearsalTallies,
  activeRehearsalId,
  onSelectRehearsal,
  getLocationName,
  nowMs,
}: RehearsalRailProps): React.JSX.Element => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion() ?? false;
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const toggleList = (): void => setIsListOpen((open) => !open);

  const TABS: SegmentedTabItem<ProjectTabType>[] = [
    { id: "ACTIVE", label: t("rehearsals.tabs.active", "Aktywne") },
    { id: "ARCHIVE", label: t("rehearsals.tabs.archive", "Archiwum"), Icon: Archive },
  ];

  const activeIndex = projectRehearsals.findIndex(
    (rehearsal) => String(rehearsal.id) === activeRehearsalId,
  );
  const activeRehearsal = activeIndex >= 0 ? projectRehearsals[activeIndex] : undefined;
  const previous = activeIndex > 0 ? projectRehearsals[activeIndex - 1] : undefined;
  const next = activeIndex >= 0 ? projectRehearsals[activeIndex + 1] : undefined;
  // The list folds only around an evening that can stand in its place; with
  // none picked, or none to pick, the full card is the picker.
  const isFolded = activeRehearsal !== undefined && !isListOpen;

  const pickFromList = (rehearsalId: string): void => {
    onSelectRehearsal(rehearsalId);
    const picker = pickerRef.current;
    // Only where the list folds — the picker is laid out on a phone alone.
    if (!picker || picker.getClientRects().length === 0) return;
    setIsListOpen(false);
    // After the fold has rendered, so the card lands right under the picker.
    requestAnimationFrame(() =>
      picker.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {activeRehearsal && (
        <div ref={pickerRef} className="flex scroll-mt-4 flex-col gap-1 lg:hidden">
          <RehearsalRow
            rehearsal={activeRehearsal}
            tally={rehearsalTallies.get(String(activeRehearsal.id)) ?? EMPTY_TALLY}
            isActive
            onSelect={toggleList}
            expanded={isListOpen}
            getLocationName={getLocationName}
            nowMs={nowMs}
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="icon"
              size="icon"
              aria-label={t("rehearsals.picker.previous", "Poprzednia próba")}
              disabled={!previous}
              onClick={() => previous && onSelectRehearsal(String(previous.id))}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleList}
              aria-expanded={isListOpen}
              rightIcon={
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={cn("transition-transform", isListOpen && "rotate-180")}
                />
              }
            >
              {isListOpen
                ? t("rehearsals.picker.collapse", "Zwiń listę")
                : t("rehearsals.picker.all", "Wszystkie próby ({{total}})", {
                    total: projectRehearsals.length,
                  })}
            </Button>
            <Button
              variant="icon"
              size="icon"
              aria-label={t("rehearsals.picker.next", "Następna próba")}
              disabled={!next}
              onClick={() => next && onSelectRehearsal(String(next.id))}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      <SectionCard
        as="h2"
        title={t("rehearsals.rail.title", "Próby")}
        icon={<CalendarClock size={14} />}
        action={
          projectRehearsals.length > 0 ? (
            <Caption color="muted" className="tabular-nums">
              {projectRehearsals.length}
            </Caption>
          ) : undefined
        }
        toolbar={
          // Full-bleed rule: the list scrolls under this block, so it needs a lip.
          <div className="-mx-5 space-y-3 border-b border-hairline px-5 pb-4">
            <SegmentedTabs
              items={TABS}
              value={projectTab}
              onChange={onProjectTab}
              ariaLabel={t("rehearsals.dashboard.project_context", "Kontekst Projektu")}
              wrap
            />

            {displayProjects.length > 0 ? (
              <Select
                ariaLabel={t("rehearsals.rail.project_label", "Projekt")}
                leftIcon={<FolderOpen size={16} aria-hidden="true" />}
                value={selectedProjectId}
                onValueChange={onSelectProject}
                options={displayProjects.map((project) => ({
                  value: String(project.id),
                  label: project.title,
                }))}
              />
            ) : (
              <Caption color="muted" className="block px-1">
                {t("rehearsals.dashboard.no_projects", "Brak projektów w tej zakładce.")}
              </Caption>
            )}
          </div>
        }
        scroll
        bodyClassName="space-y-2 p-3"
        className={cn("lg:max-h-[calc(100dvh-7rem)]", isFolded && "max-lg:hidden")}
      >
        {projectRehearsals.length > 0 ? (
          projectRehearsals.map((rehearsal) => (
            <RehearsalRow
              key={rehearsal.id}
              rehearsal={rehearsal}
              tally={rehearsalTallies.get(String(rehearsal.id)) ?? EMPTY_TALLY}
              isActive={String(rehearsal.id) === activeRehearsalId}
              onSelect={pickFromList}
              getLocationName={getLocationName}
              nowMs={nowMs}
            />
          ))
        ) : (
          <StatePanel
            variant="inline"
            icon={<CalendarClock size={20} aria-hidden="true" />}
            title={t("rehearsals.rail.no_rehearsals_title", "Brak prób")}
            description={t(
              "rehearsals.rail.no_rehearsals_desc",
              "Ten projekt nie ma jeszcze zaplanowanych prób. Dodasz je w karcie projektu → Harmonogram.",
            )}
            actions={
              selectedProjectId ? (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/panel/projects/${selectedProjectId}/rehearsals`}>
                    <CalendarPlus size={14} aria-hidden="true" />
                    {t("rehearsals.rail.schedule_cta", "Zaplanuj próbę")}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </SectionCard>
    </div>
  );
};
