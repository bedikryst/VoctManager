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
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
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
import { CompletionRing } from "./CompletionRing";

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
}

const ringToneFor = (
  tally: AttendanceTally,
  past: boolean,
): "gold" | "sage" | "crimson" | "graphite" => {
  if (tally.total === 0) return "graphite";
  if (tally.completion >= 100) return "sage";
  if (past && tally.none > 0) return "crimson";
  return "gold";
};

const RehearsalRow = ({
  rehearsal,
  tally,
  isActive,
  onSelect,
  getLocationName,
}: {
  rehearsal: Rehearsal;
  tally: AttendanceTally;
  isActive: boolean;
  onSelect: (id: string) => void;
  getLocationName: RehearsalRailProps["getLocationName"];
}): React.JSX.Element => {
  const { t } = useTranslation();
  const past = isPast(rehearsal.date_time);
  const live = isRehearsalLive(rehearsal.date_time);
  const tone = ringToneFor(tally, past);

  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={() => onSelect(String(rehearsal.id))}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40 active:scale-[0.99]",
        isActive
          ? "border-ethereal-gold/45 bg-ethereal-gold/[0.06] ring-1 ring-ethereal-gold/25"
          : "border-ethereal-ink/8 bg-ethereal-alabaster hover:border-ethereal-gold/30",
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
          <Text as="span" size="sm" weight="semibold" className="tabular-nums">
            {formatLocalizedTime(
              rehearsal.date_time,
              { hour: "2-digit", minute: "2-digit" },
              undefined,
              rehearsal.timezone,
            )}
          </Text>
          {live && (
            <span className="inline-flex items-center gap-1 text-ethereal-gold">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ethereal-gold opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ethereal-gold" />
              </span>
              <Eyebrow as="span" color="gold">
                {t("rehearsals.rail.live", "Teraz")}
              </Eyebrow>
            </span>
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

      <CompletionRing value={tally.completion} tone={tone} size={38} strokeWidth={3.5}>
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
}: RehearsalRailProps): React.JSX.Element => {
  const { t } = useTranslation();

  const TABS: Array<{ id: ProjectTabType; label: string }> = [
    { id: "ACTIVE", label: t("rehearsals.tabs.active", "Aktywne") },
    { id: "ARCHIVE", label: t("rehearsals.tabs.archive", "Archiwum") },
  ];

  return (
    <GlassCard
      variant="solid"
      padding="none"
      isHoverable={false}
      className="flex flex-col lg:max-h-[calc(100dvh-7rem)]"
    >
      <div className="shrink-0 space-y-3 border-b border-ethereal-ink/6 p-4">
        <div
          role="tablist"
          aria-label={t("rehearsals.dashboard.project_context", "Kontekst Projektu")}
          className="grid grid-cols-2 gap-1 rounded-xl border border-ethereal-ink/8 bg-ethereal-alabaster/70 p-1"
        >
          {TABS.map((tab) => {
            const isActive = projectTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onProjectTab(tab.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-ethereal-gold text-ethereal-ink shadow-sm"
                    : "text-ethereal-graphite hover:text-ethereal-ink",
                )}
              >
                {tab.id === "ARCHIVE" && <Archive size={13} aria-hidden="true" />}
                {tab.label}
              </button>
            );
          })}
        </div>

        {displayProjects.length > 0 ? (
          <Select
            aria-label={t("rehearsals.rail.project_label", "Projekt")}
            leftIcon={<FolderOpen size={16} aria-hidden="true" />}
            value={selectedProjectId}
            onChange={(event) => onSelectProject(event.target.value)}
          >
            {displayProjects.map((project) => (
              <option key={project.id} value={String(project.id)}>
                {project.title}
              </option>
            ))}
          </Select>
        ) : (
          <Caption className="block px-1 italic">
            {t("rehearsals.dashboard.no_projects", "Brak projektów w tej zakładce.")}
          </Caption>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {projectRehearsals.length > 0 ? (
          projectRehearsals.map((rehearsal) => (
            <RehearsalRow
              key={rehearsal.id}
              rehearsal={rehearsal}
              tally={rehearsalTallies.get(String(rehearsal.id)) ?? EMPTY_TALLY}
              isActive={String(rehearsal.id) === activeRehearsalId}
              onSelect={onSelectRehearsal}
              getLocationName={getLocationName}
            />
          ))
        ) : (
          <StatePanel
            icon={<CalendarClock size={20} aria-hidden="true" />}
            title={t("rehearsals.rail.no_rehearsals_title", "Brak prób")}
            description={t(
              "rehearsals.rail.no_rehearsals_desc",
              "Ten projekt nie ma jeszcze zaplanowanych prób. Dodasz je w karcie projektu → Harmonogram.",
            )}
            className="!p-6"
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
      </div>
    </GlassCard>
  );
};
