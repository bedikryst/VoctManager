/**
 * @file RehearsalInspector.tsx
 * @description The protagonist surface: everything the conductor needs to take
 * and read attendance for one rehearsal. A composition-aware progress header,
 * a roll-call toolbar (density · only-unmarked filter · fill gaps · pitch pipe)
 * and a voice-grouped roster that swaps between a scanning list and large tap
 * targets.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/RehearsalInspector
 */

import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Clock,
  Filter,
  LayoutGrid,
  List,
  Radio,
  UserPlus,
  Users,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import {
  SegmentedTabs,
  type SegmentedTabItem,
} from "@/shared/ui/composites/SegmentedTabs";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow, Metric, Text } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { PitchPipe } from "@/shared/ui/instruments/PitchPipe";
import { formatLocalizedDate } from "@/shared/lib/time/intl";

import type { Artist, Attendance, Participation, Rehearsal } from "@/shared/types";
import type { AttendanceTally, VoiceGroup } from "../lib/attendanceStats";
import {
  ATTENDANCE_STATUS_META,
  RATE_TONE_TEXT,
  attendanceRateTone,
  voiceSectionLabelKey,
} from "../constants/attendanceMeta";
import { ArtistRow } from "./ArtistRow";
import { AbsenceSpanSheet } from "./AbsenceSpanSheet";

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
type DensityId = "LIST" | "ROLL_CALL";

/**
 * The label comes from the shared meta, not from the call site: this strip was
 * the second copy of a vocabulary the module already owns.
 *
 * It carries the census AND doubles as the roster's legend, which is why the
 * swatch is the status glyph on its lit fill rather than a bare dot — it is
 * pixel-for-pixel what a roll-call card's chosen segment looks like, so the
 * icon-only cards below need no legend of their own to decode.
 */
const StatPill = ({
  status,
  value,
}: {
  status: (typeof SEGMENTS)[number];
  value: number;
}) => {
  const { t } = useTranslation();
  const meta = ATTENDANCE_STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={cn("flex size-5 items-center justify-center rounded-chip", meta.solid)}
        aria-hidden="true"
      >
        <Icon size={11} />
      </span>
      <Text as="span" size="sm" weight="semibold" className="tabular-nums">
        {value}
      </Text>
      <Caption color="muted">{t(meta.labelKey, meta.fallback)}</Caption>
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
  /* One sheet for the whole roster, named by whoever opened it. The setter is
     what the rows receive, so the callback stays stable across re-renders and
     the memoized rows keep their optimistic state through a roll call. */
  const [spanArtistId, setSpanArtistId] = useState<string | null>(null);
  const openSpan = useCallback((artistId: string) => setSpanArtistId(artistId), []);
  const closeSpan = useCallback(() => setSpanArtistId(null), []);
  const spanArtist = spanArtistId ? artistMap.get(spanArtistId) : undefined;

  const isSectional = (rehearsal.invited_participations?.length ?? 0) > 0;

  const calledSections = useMemo(
    () =>
      voiceGroups
        .map((group) => t(voiceSectionLabelKey(group.key), group.key))
        .join(", "),
    [voiceGroups, t],
  );

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

  const focus = rehearsal.focus?.trim();
  const dateLabel = formatLocalizedDate(
    rehearsal.date_time,
    { weekday: "long", day: "numeric", month: "long" },
    undefined,
    rehearsal.timezone,
  );

  const rateTone = attendanceRateTone(stats.rate);

  /** One reading of the tally, shared by the composition bar and its legend. */
  const countOf: Record<(typeof SEGMENTS)[number], number> = {
    PRESENT: stats.present,
    LATE: stats.late,
    EXCUSED: stats.excused,
    ABSENT: stats.absent,
  };

  /* The roster is one body of content at two densities, which is what the
     composite's icon-only mode exists for — and it takes the gold back off a
     mode toggle, so the card's one primary button is the one that writes. */
  const DENSITIES: SegmentedTabItem<DensityId>[] = [
    { id: "LIST", label: t("rehearsals.inspector.density_list", "Lista"), Icon: List },
    {
      id: "ROLL_CALL",
      label: t("rehearsals.inspector.density_cards", "Karty odprawy"),
      Icon: LayoutGrid,
    },
  ];

  return (
    <GlassCard variant="solid" padding="none" isHoverable={false} className="flex flex-col">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="border-b border-hairline p-5 md:p-6">
        {/* Tutti is the resting case and says nothing; a sectional call is the
            exception, and the sections it summoned are the whole payload. */}
        {(isSectional || !rehearsal.is_mandatory) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {isSectional && (
              <Badge variant="amethyst" icon={<Users size={11} />}>
                {t("rehearsals.dashboard.sectional_only", "Tylko: {{sections}}", {
                  sections: calledSections,
                })}
              </Badge>
            )}
            {!rehearsal.is_mandatory && (
              <Badge variant="outline">
                {t("rehearsals.dashboard.optional", "Opcjonalna")}
              </Badge>
            )}
          </div>
        )}

        {/* A session is identified by WHEN it is; what it works on is the
            subtitle, and only when the conductor wrote one. */}
        <Text size="lg" weight="semibold" className="block capitalize leading-tight">
          {dateLabel}
        </Text>
        {/* The serif runs a size ABOVE the sans it sits under, never level with
            it: Cormorant's x-height is ~0.39em against the sans's ~0.55, so a
            subtitle set at the body step comes out reading smaller than the
            metadata below it. */}
        {focus && (
          <Text size="md" color="graphite" className="mt-1 block font-serif italic">
            {focus}
          </Text>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <DualTimeDisplay
            value={rehearsal.date_time}
            endValue={rehearsal.end_date_time}
            timeZone={rehearsal.timezone}
            className="border-none bg-transparent p-0"
            typography="sans"
            size="sm"
            weight="semibold"
            icon={<Clock size={12} className="text-ethereal-gold/70" aria-hidden="true" />}
          />
          <LocationPreview
            locationRef={rehearsal.location}
            fallback={t("rehearsals.dashboard.no_location", "Brak lok.")}
            variant="minimal"
          />
        </div>

        {/* Progress + composition */}
        {invitedCount > 0 && (
          <div className="mt-5">
            {/* Both halves are a label over a figure, and `Eyebrow`, `Text` and
                `Metric` all render inline spans — so the column is what puts the
                label ABOVE its figure. Without it they set on one line and the
                rate reads as one word with its own caption. */}
            <div className="mb-2 flex items-end justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <Eyebrow color="muted">
                  {t("rehearsals.inspector.recorded", "Oznaczono")}
                </Eyebrow>
                <Text size="md" weight="semibold" className="leading-none tabular-nums">
                  {stats.marked} / {stats.total}
                </Text>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <Eyebrow color="muted">{t("rehearsals.stats.rate", "Frekwencja")}</Eyebrow>
                {/* Measured over what is written down: before the first tap this
                    is no rate at all, not a 0% the conductor has to explain. */}
                <Metric size="3xl" className={cn("leading-none", RATE_TONE_TEXT[rateTone])}>
                  {stats.rate === null ? "—" : `${stats.rate}%`}
                </Metric>
              </div>
            </div>

            <div
              className="flex h-2 w-full overflow-hidden rounded-full bg-ethereal-ink/6"
              role="img"
              aria-label={t("rehearsals.inspector.composition", "Skład obecności")}
            >
              {SEGMENTS.map((status) =>
                countOf[status] === 0 ? null : (
                  <span
                    key={status}
                    className={cn("h-full", ATTENDANCE_STATUS_META[status].dot)}
                    style={{ width: `${(countOf[status] / stats.total) * 100}%` }}
                  />
                ),
              )}
            </div>

            {/* The recorded statuses only. What is still blank is the filter's
                figure below and the "Oznaczono" fraction above — printing it a
                third time here made the one number the eye had to find into
                wallpaper. */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {SEGMENTS.map((status) => (
                <StatPill key={status} status={status} value={countOf[status]} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      {invitedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-ethereal-marble/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedTabs
              iconOnly
              items={DENSITIES}
              value={isRollCall ? "ROLL_CALL" : "LIST"}
              onChange={(id) => {
                if ((id === "ROLL_CALL") !== isRollCall) onToggleRollCall();
              }}
              ariaLabel={t("rehearsals.inspector.density", "Widok listy")}
            />
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
            className="overflow-hidden border-b border-hairline bg-ethereal-parchment/30"
          >
            <div className="p-4">
              <PitchPipe />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Roster ────────────────────────────────────────────────────── */}
      {/* On phones/tablets the roster flows with the page (natural scroll);
          only once the rail + inspector sit side by side (lg) does it become a
          height-capped panel so the two columns stay aligned. */}
      <div className="overflow-x-hidden lg:max-h-[64vh] lg:overflow-y-auto">
        {invitedCount === 0 ? (
          <StatePanel
            variant="inline"
            className="py-12"
            icon={<Users size={22} aria-hidden="true" />}
            title={t("rehearsals.inspector.no_invited_title", "Nikogo nie wezwano")}
            description={t(
              "rehearsals.inspector.no_invited_desc",
              "Na tej próbie nie ma ani jednego śpiewaka. Sprawdź obsadę projektu.",
            )}
            actions={
              <Button variant="outline" size="sm" asChild>
                <Link to={`/panel/projects/${String(rehearsal.project)}/cast`}>
                  <UserPlus size={14} aria-hidden="true" />
                  {t("rehearsals.inspector.open_cast", "Otwórz obsadę")}
                </Link>
              </Button>
            }
          />
        ) : displayGroups.length === 0 ? (
          <StatePanel
            variant="inline"
            className="py-12"
            icon={<CheckCircle2 size={22} aria-hidden="true" />}
            title={t("rehearsals.inspector.all_marked_title", "Wszyscy oznaczeni")}
            description={t(
              "rehearsals.inspector.all_marked_desc",
              "Nikt z wezwanych nie czeka już na wpis.",
            )}
          />
        ) : (
          displayGroups.map((group) => (
            <div key={group.key}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-ethereal-alabaster/95 px-5 py-2.5 backdrop-blur-sm">
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
                        onOpenSpan={openSpan}
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
                        onOpenSpan={openSpan}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Mounted, not conditional: the sheet animates out, and unmounting it on
          close would cut that short. The id going null is what shuts it. */}
      <AbsenceSpanSheet
        isOpen={!!spanArtist}
        onClose={closeSpan}
        artistId={spanArtist ? String(spanArtist.id) : null}
        artistName={
          spanArtist ? `${spanArtist.first_name} ${spanArtist.last_name}` : ""
        }
        anchorDate={rehearsal.date_time}
        anchorTimezone={rehearsal.timezone}
      />
    </GlassCard>
  );
};
