/**
 * @file RehearsalRail.tsx
 * @description Context navigator for the Centrum Obecności: an active/archive
 * project switch, a project picker, and a dense, scannable list of that
 * project's rehearsals. Each row carries a completion ring so the conductor
 * sees at a glance which sessions still need attendance recorded.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/RehearsalRail
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Archive, CalendarClock, CalendarPlus, FolderOpen } from "lucide-react";

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

import type { Project, Rehearsal } from "@/shared/types";
import type { ProjectTabType } from "../types/rehearsals.dto";
import type { AttendanceTally } from "../lib/attendanceStats";
import { EMPTY_TALLY, isPast, isRehearsalLive } from "../lib/attendanceStats";
import { CompletionRing } from "@/shared/ui/composites/CompletionRing";

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

const RehearsalRow = ({
  rehearsal,
  tally,
  isActive,
  onSelect,
  getLocationName,
  nowMs,
}: {
  rehearsal: Rehearsal;
  tally: AttendanceTally;
  isActive: boolean;
  onSelect: (id: string) => void;
  getLocationName: RehearsalRailProps["getLocationName"];
  nowMs: number;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const past = isPast(rehearsal.date_time, nowMs);
  const live = isRehearsalLive(rehearsal.date_time, nowMs);

  return (
    <button
      type="button"
      aria-pressed={isActive}
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
        <div className="flex items-center gap-2">
          <Text as="span" size="sm" weight="semibold" className="whitespace-nowrap tabular-nums">
            {clockFace(rehearsal)}
          </Text>
          {live && (
            <Badge variant="warning" pulse>
              {t("rehearsals.rail.live", "Teraz")}
            </Badge>
          )}
        </div>
        <Caption color="muted" truncate className="mt-0.5 block">
          {rehearsal.focus?.trim() ||
            getLocationName(
              rehearsal.location,
              t("rehearsals.dashboard.no_location", "Brak lok."),
            )}
        </Caption>
      </div>

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

  const TABS: SegmentedTabItem<ProjectTabType>[] = [
    { id: "ACTIVE", label: t("rehearsals.tabs.active", "Aktywne") },
    { id: "ARCHIVE", label: t("rehearsals.tabs.archive", "Archiwum"), Icon: Archive },
  ];

  return (
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
      className="lg:max-h-[calc(100dvh-7rem)]"
    >
      {projectRehearsals.length > 0 ? (
        projectRehearsals.map((rehearsal) => (
          <RehearsalRow
            key={rehearsal.id}
            rehearsal={rehearsal}
            tally={rehearsalTallies.get(String(rehearsal.id)) ?? EMPTY_TALLY}
            isActive={String(rehearsal.id) === activeRehearsalId}
            onSelect={onSelectRehearsal}
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
  );
};
