/**
 * @file RehearsalInspector.tsx
 * @description The protagonist surface: everything the conductor needs to take
 * and read attendance for one rehearsal. A composition-aware progress header,
 * a roll-call toolbar (focus mode · only-unmarked filter · fill gaps · pitch
 * pipe) and a voice-grouped roster that swaps between a scanning list and large
 * tap-target cards.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/RehearsalInspector
 */

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Clock,
  Filter,
  ListChecks,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Metric, Text } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { PitchPipe } from "@/shared/ui/instruments/PitchPipe";
import { formatLocalizedDate } from "@/shared/lib/time/intl";

import type { Artist, Attendance, Participation, Rehearsal } from "@/shared/types";
import type { AttendanceTally, VoiceGroup } from "../lib/attendanceStats";
import { rateAccent } from "../lib/attendanceStats";
import {
  ATTENDANCE_STATUS_META,
  voiceSectionLabelKey,
} from "../constants/attendanceMeta";
import { ArtistRow } from "./ArtistRow";

interface RehearsalInspectorProps {
  rehearsal: Rehearsal;
  voiceGroups: VoiceGroup[];
  invitedCount: number;
  artistMap: Map<string, Artist>;
  attendanceMap: Map<string, Attendance>;
  stats: AttendanceTally;
  isRollCall: boolean;
  onToggleRollCall: () => void;
  showOnlyUnmarked: boolean;
  onToggleOnlyUnmarked: () => void;
  isMarkingAll: boolean;
  onMarkAllPresent: () => void;
}

const SEGMENTS = ["PRESENT", "LATE", "EXCUSED", "ABSENT"] as const;

const StatPill = ({
  status,
  value,
  label,
}: {
  status: keyof typeof ATTENDANCE_STATUS_META;
  value: number;
  label: string;
}) => {
  const meta = ATTENDANCE_STATUS_META[status];
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden="true" />
      <Text as="span" size="sm" weight="semibold" className="tabular-nums">
        {value}
      </Text>
      <Caption color="muted">{label}</Caption>
    </div>
  );
};

export const RehearsalInspector = ({
  rehearsal,
  voiceGroups,
  invitedCount,
  artistMap,
  attendanceMap,
  stats,
  isRollCall,
  onToggleRollCall,
  showOnlyUnmarked,
  onToggleOnlyUnmarked,
  isMarkingAll,
  onMarkAllPresent,
}: RehearsalInspectorProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isPitchPipeOpen, setIsPitchPipeOpen] = useState(false);

  const isSectional = (rehearsal.invited_participations?.length ?? 0) > 0;

  const sectionalSummary = useMemo(() => {
    if (!isSectional) return t("rehearsals.dashboard.tutti", "Tutti (Cały Zespół)");
    const labels = voiceGroups.map((group) =>
      t(voiceSectionLabelKey(group.key), group.key),
    );
    return `${t("rehearsals.dashboard.only", "Tylko:")} ${labels.join(", ")}`;
  }, [isSectional, voiceGroups, t]);

  // Apply the only-unmarked filter without mutating the source groups.
  const displayGroups = useMemo(() => {
    if (!showOnlyUnmarked) return voiceGroups;
    return voiceGroups
      .map((group) => ({
        ...group,
        participations: group.participations.filter(
          (p: Participation) => !attendanceMap.get(String(p.id))?.status,
        ),
      }))
      .filter((group) => group.participations.length > 0);
  }, [voiceGroups, showOnlyUnmarked, attendanceMap]);

  const accent = rateAccent(stats.rate);
  const accentText =
    accent === "gold"
      ? "text-ethereal-gold"
      : accent === "crimson"
        ? "text-ethereal-crimson"
        : "text-ethereal-ink";

  return (
    <GlassCard variant="solid" padding="none" isHoverable={false} className="flex flex-col">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="border-b border-ethereal-ink/6 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isSectional ? "amethyst" : "brand"} icon={<Users size={11} />}>
            {isSectional
              ? t("rehearsals.dashboard.sectional", "Próba Sekcyjna")
              : t("rehearsals.dashboard.tutti_badge", "Próba Tutti")}
          </Badge>
          <Badge variant="neutral">{sectionalSummary}</Badge>
          {!rehearsal.is_mandatory && (
            <Badge variant="outline">
              {t("rehearsals.dashboard.optional", "Opcjonalna")}
            </Badge>
          )}
        </div>

        <Text size="lg" weight="semibold" className="mt-4 block leading-tight">
          {rehearsal.focus?.trim() ||
            t("rehearsals.dashboard.general_work", "Praca Bieżąca")}
        </Text>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-ethereal-incense/15 bg-ethereal-alabaster px-3 py-1.5">
            <Clock size={12} className="shrink-0 text-ethereal-gold" aria-hidden="true" />
            <Caption>
              {formatLocalizedDate(
                rehearsal.date_time,
                { weekday: "long", day: "numeric", month: "long" },
                undefined,
                rehearsal.timezone,
              )}
            </Caption>
          </div>
          <div className="flex items-center rounded-xl border border-ethereal-incense/15 bg-ethereal-alabaster px-3 py-1.5">
            <DualTimeDisplay
              value={rehearsal.date_time}
              timeZone={rehearsal.timezone}
              className="border-none bg-transparent p-0"
              typography="sans"
              size="sm"
            />
          </div>
          <LocationPreview
            locationRef={rehearsal.location}
            fallback={t("rehearsals.dashboard.no_location", "Brak lok.")}
            variant="minimal"
          />
        </div>

        {/* Progress + composition */}
        {invitedCount > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <Eyebrow color="muted">
                  {t("rehearsals.inspector.recorded", "Oznaczono")}
                </Eyebrow>
                <Text size="sm" weight="semibold" className="tabular-nums">
                  {stats.marked} / {stats.total}
                  {stats.none > 0 && (
                    <Caption as="span" color="muted" className="ml-2">
                      {t("rehearsals.inspector.remaining", "({{count}} do uzupełnienia)", {
                        count: stats.none,
                      })}
                    </Caption>
                  )}
                </Text>
              </div>
              <div className="text-right">
                <Eyebrow color="muted">{t("rehearsals.stats.rate", "Frekwencja")}</Eyebrow>
                <Metric size="xl" className={cn("leading-none tabular-nums", accentText)}>
                  {stats.rate}%
                </Metric>
              </div>
            </div>

            <div
              className="flex h-2 w-full overflow-hidden rounded-full bg-ethereal-ink/6"
              role="img"
              aria-label={t("rehearsals.inspector.composition", "Skład obecności")}
            >
              {SEGMENTS.map((status) => {
                const count =
                  status === "PRESENT"
                    ? stats.present
                    : status === "LATE"
                      ? stats.late
                      : status === "EXCUSED"
                        ? stats.excused
                        : stats.absent;
                if (count === 0) return null;
                return (
                  <span
                    key={status}
                    className={cn("h-full", ATTENDANCE_STATUS_META[status].dot)}
                    style={{ width: `${(count / stats.total) * 100}%` }}
                  />
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <StatPill status="PRESENT" value={stats.present} label={t("rehearsals.row.status_present", "Obecny")} />
              <StatPill status="LATE" value={stats.late} label={t("rehearsals.row.status_late", "Spóźniony")} />
              <StatPill status="EXCUSED" value={stats.excused} label={t("rehearsals.row.status_excused", "Usprawiedliwiony")} />
              <StatPill status="ABSENT" value={stats.absent} label={t("rehearsals.row.status_absent", "Nieobecny")} />
              {stats.none > 0 && (
                <StatPill status="NONE" value={stats.none} label={t("rehearsals.row.status_none", "Nieoznaczony")} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      {invitedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ethereal-ink/6 bg-ethereal-marble/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isRollCall ? "primary" : "outline"}
              size="sm"
              onClick={onToggleRollCall}
              leftIcon={<ListChecks size={14} aria-hidden="true" />}
            >
              {t("rehearsals.inspector.roll_call_mode", "Tryb odprawy")}
            </Button>
            <Button
              variant={showOnlyUnmarked ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleOnlyUnmarked}
              leftIcon={<Filter size={14} aria-hidden="true" />}
              disabled={stats.none === 0 && !showOnlyUnmarked}
            >
              {t("rehearsals.inspector.only_unmarked", "Tylko nieoznaczeni")}
              {stats.none > 0 && (
                <span className="ml-1.5 tabular-nums opacity-60">{stats.none}</span>
              )}
            </Button>
            <Button
              variant={isPitchPipeOpen ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setIsPitchPipeOpen((prev) => !prev)}
              leftIcon={<Radio size={14} aria-hidden="true" />}
            >
              {t("rehearsals.inspector.pitch_pipe", "Kamerton")}
            </Button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={onMarkAllPresent}
            disabled={isMarkingAll || stats.none === 0}
            isLoading={isMarkingAll}
            leftIcon={!isMarkingAll ? <CheckCircle2 size={14} /> : undefined}
          >
            {t("rehearsals.dashboard.bulk_fill", "Uzupełnij luki", { count: stats.none })}
          </Button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {isPitchPipeOpen && (
          <motion.div
            key="pitch-pipe"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-b border-ethereal-ink/6 bg-ethereal-parchment/30"
          >
            <div className="p-4">
              <PitchPipe />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Roster ────────────────────────────────────────────────────── */}
      <div className="max-h-[64vh] overflow-y-auto overflow-x-hidden">
        {invitedCount === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Users size={26} className="text-ethereal-incense/30" aria-hidden="true" />
            <Eyebrow color="muted">
              {t("rehearsals.inspector.no_invited", "Nikt nie został wezwany na tę próbę")}
            </Eyebrow>
          </div>
        ) : displayGroups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Sparkles size={26} className="text-ethereal-sage/60" aria-hidden="true" />
            <Eyebrow color="sage">
              {t("rehearsals.inspector.all_marked", "Wszyscy oznaczeni — komplet!")}
            </Eyebrow>
          </div>
        ) : (
          displayGroups.map((group) => (
            <div key={group.key}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ethereal-incense/10 bg-ethereal-alabaster/95 px-5 py-2.5 backdrop-blur-sm">
                <Eyebrow color="gold">{t(voiceSectionLabelKey(group.key), group.key)}</Eyebrow>
                <Caption color="muted" className="tabular-nums">
                  {group.participations.length}
                </Caption>
              </div>

              {isRollCall ? (
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.participations.map((part: Participation) => {
                    const artist = artistMap.get(String(part.artist));
                    if (!artist) return null;
                    return (
                      <ArtistRow
                        key={part.id}
                        part={part}
                        artist={artist}
                        existingRecord={attendanceMap.get(String(part.id))}
                        rehearsalId={String(rehearsal.id)}
                        density="rollcall"
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col">
                  {group.participations.map((part: Participation) => {
                    const artist = artistMap.get(String(part.artist));
                    if (!artist) return null;
                    return (
                      <ArtistRow
                        key={part.id}
                        part={part}
                        artist={artist}
                        existingRecord={attendanceMap.get(String(part.id))}
                        rehearsalId={String(rehearsal.id)}
                        density="compact"
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
};
