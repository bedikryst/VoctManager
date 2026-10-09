/**
 * @file RehearsalInspector.tsx
 * @description The protagonist surface: one evening, for whoever stands in
 * front of the choir. Under the header (date, topic line, time, room, who
 * leads) a "Plan · Obecność" switch splits the card into its two jobs, which
 * happen at two different times: the plan while the evening is prepared, the
 * roll call from the hour the register opens — which is also the pane the
 * card opens on.
 *
 * Plan: whoever may plan the evening (`canEditPlan`) reads it with "Edytuj
 * plan" one tap away, and the editor opens by itself only on an empty plan
 * for an evening still ahead; a stand-in who may not reads it at stand size.
 * Once the evening has started the plan carries its ticks — the debrief's
 * first step, through `onMarkPlanItem` — so a past evening shows its plan
 * once. The pitch pipe lives here, with the music.
 *
 * Obecność: the composition-aware progress summary, the roll-call toolbar
 * (density · only-unmarked filter · fill gaps) and a voice-grouped roster
 * that swaps between a scanning list and large tap targets. The roster flows
 * with the page; its voice headers stick to the window.
 *
 * Two callers: the manager's workspace, and a stand-in's `LeadSheet` route.
 * They get the SAME card — `allowManagerActions` withholds only the two
 * things a delegation does not carry (see the prop). `onSaveFocus` makes the
 * topic line — one line, a headline; the order of pieces lives in the plan —
 * editable where it is read, for the manager and the leader alike.
 * `onSaveDebrief` is the leader's: the debrief is written at the foot of the
 * card, under both panes, and the manager reads the same block there.
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
  ListChecks,
  ListMusic,
  Radio,
  UserCheck,
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
import { InlineEditable } from "@/shared/ui/primitives/InlineEditable";
import { Caption, Eyebrow, Metric, Text } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { PitchPipe } from "@/shared/ui/instruments/PitchPipe";
import { formatLocalizedDate } from "@/shared/lib/time/intl";

import type { Artist, Attendance, Participation, Rehearsal } from "@/shared/types";
import {
  LIVE_BEFORE_HOURS,
  isRegisterOpen,
  type AttendanceTally,
  type VoiceGroup,
} from "../lib/attendanceStats";
import { sectionNamesLabel } from "../lib/sectionLabels";
import {
  ATTENDANCE_STATUS_META,
  RATE_TONE_TEXT,
  attendanceRateTone,
  voiceSectionLabelKey,
} from "../constants/attendanceMeta";
import { ArtistRow } from "./ArtistRow";
import { AbsenceSpanSheet } from "./AbsenceSpanSheet";
import { RehearsalDebrief } from "./RehearsalDebrief";
import { RehearsalPlanEditor } from "./plan/RehearsalPlanEditor";
import { RehearsalPlanReadView } from "./plan/RehearsalPlanReadView";
import { RehearsalPlanTimeline } from "./plan/RehearsalPlanTimeline";

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
  /**
   * Whether the reader may do the things that are NOT the roll call: excuse
   * somebody across a fortnight, and walk into the project's cast editor.
   *
   * False for a stand-in running one evening. Both are decisions about a
   * singer's standing in the choir rather than observations of who turned up,
   * the server refuses them to a delegation, and offering either here would arm
   * a control that answers with a 400 in front of the choir. The roll call
   * itself — every tap on every card below — is unchanged: it is the same
   * control, because a stand-in learning a second one is the one thing this
   * surface cannot afford.
   */
  allowManagerActions?: boolean;
  /**
   * Saves the evening's topic line. Present → the line under the date is
   * editable in place, empty included, so a topic can be added where there
   * was none. Absent → it is read only. A topic that already holds several
   * lines is read only either way (see the header).
   */
  onSaveFocus?: (focus: string) => Promise<unknown>;
  /**
   * Saves the debrief. Present → the "Po próbie" block at the foot is an
   * editor once the evening has started. Absent → the block shows what was
   * written, or nothing: the manager's console reads the report, it does not
   * write it here.
   */
  onSaveDebrief?: (debrief: string) => Promise<unknown>;
  /**
   * Whether the reader may lay the evening's plan out — a manager, or whoever
   * the lead sheet's `may_plan` admits. True mounts the plan's read view with
   * its publication and "Edytuj plan" as a band under the header, empty plan
   * included; the editor takes the band's place on that tap, and opens by
   * itself only for an empty plan on an evening still ahead — that empty
   * state is where a planner starts. A reader without `allowManagerActions`
   * edits as a planner — the project read through the evening rather than
   * the hub's lists. False mounts the plan as it is read, at stand size,
   * which is what a stand-in at the music stand needs (nobody drags rows
   * there). Nothing when false and the plan is empty.
   */
  canEditPlan?: boolean;
  /**
   * For a card used at the music stand (the lead sheet): a reader who may
   * plan reads the plan at stand size too. Absent → the panel's size.
   */
  planAtStand?: boolean;
  /**
   * Ticks one plan row off after the fact — the debrief's first step, same
   * gate as the debrief itself, taken on the plan once the evening has
   * started. Absent → the ticks are read, not written.
   */
  onMarkPlanItem?: (itemId: string, done: boolean) => Promise<unknown>;
  /**
   * Whether the plan editor holds an unsaved draft, for a host that can put
   * another evening under the card — it asks before it does.
   */
  onPlanDirtyChange?: (isDirty: boolean) => void;
}

const SEGMENTS = ["PRESENT", "LATE", "EXCUSED", "ABSENT"] as const;
type DensityId = "LIST" | "ROLL_CALL";
type PaneId = "PLAN" | "ATTENDANCE";

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
  allowManagerActions = true,
  onSaveFocus,
  onSaveDebrief,
  canEditPlan = false,
  planAtStand = false,
  onMarkPlanItem,
  onPlanDirtyChange,
}: RehearsalInspectorProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [isPitchPipeOpen, setIsPitchPipeOpen] = useState(false);
  // The moment picks the pane: the plan until the register opens, the roll
  // call from then on. Decided once, at mount — the register opening under a
  // reader must not move the card away from what they are reading — and the
  // hosts key the card by the evening, so each evening decides afresh.
  const [pane, setPane] = useState<PaneId>(() =>
    isRegisterOpen(rehearsal.date_time) ? "ATTENDANCE" : "PLAN",
  );
  const selectPane = useCallback((next: PaneId) => {
    setPane(next);
    // The pitch pipe belongs to the plan's pane. Leaving the pane closes it,
    // so no tone keeps sounding behind a panel nobody can see.
    if (next !== "PLAN") setIsPitchPipeOpen(false);
  }, []);
  // Decided once, when the card mounts: the downbeat passing under an open
  // editor must not unmount it and take an unsaved draft with it. Afterwards
  // only the band itself moves it — "Edytuj plan" one way; a save, a send,
  // "Anuluj" or "Zamknij" the other.
  const [isPlanEditorOpen, setIsPlanEditorOpen] = useState(
    () =>
      (rehearsal.plan?.length ?? 0) === 0 &&
      new Date(rehearsal.date_time).getTime() > Date.now(),
  );
  const openPlanEditor = useCallback(() => setIsPlanEditorOpen(true), []);
  const closePlanEditor = useCallback(() => setIsPlanEditorOpen(false), []);
  // The ticks are written after the downbeat only: before it there is
  // nothing to tick, and the plan reads as the promise it still is.
  const hasStarted = new Date(rehearsal.date_time).getTime() <= Date.now();
  const markPlanItem = hasStarted ? onMarkPlanItem : undefined;
  /* One sheet for the whole roster, named by whoever opened it. The setter is
     what the rows receive, so the callback stays stable across re-renders and
     the memoized rows keep their optimistic state through a roll call. */
  const [spanArtistId, setSpanArtistId] = useState<string | null>(null);
  const openSpan = useCallback((artistId: string) => setSpanArtistId(artistId), []);
  const closeSpan = useCallback(() => setSpanArtistId(null), []);
  const spanArtist = spanArtistId ? artistMap.get(spanArtistId) : undefined;
  // Undefined, not a no-op: `ArtistRow` reads the PRESENCE of this callback to
  // decide whether the "…and for longer" action exists at all.
  const rowSpanHandler = allowManagerActions ? openSpan : undefined;

  const storedSections = rehearsal.called_sections ?? "";
  const isSectional =
    storedSections !== "" || (rehearsal.invited_participations?.length ?? 0) > 0;

  // A sectional names its sections from the stored rule; a hand-picked call
  // stores no rule, so its badge reads the sections of the people it names.
  const calledSections = useMemo(
    () =>
      storedSections !== ""
        ? sectionNamesLabel(storedSections, t)
        : voiceGroups
            .map((group) => t(voiceSectionLabelKey(group.key), group.key))
            .join(", "),
    [storedSections, voiceGroups, t],
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
  // Topics written before the topic became one line can hold a whole plan,
  // line by line. A single-line field drops the line breaks on its first
  // keystroke, so such a topic is only read here; the rehearsal form, which
  // keeps it in a multi-line field, is where it is rewritten.
  const focusHasLines = focus !== undefined && /\r?\n/u.test(focus);
  const dateLabel = formatLocalizedDate(
    rehearsal.date_time,
    { weekday: "long", day: "numeric", month: "long" },
    undefined,
    rehearsal.timezone,
  );

  const rateTone = attendanceRateTone(stats.rate);
  const registerOpen = isRegisterOpen(rehearsal.date_time);

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
      label: t("rehearsals.inspector.density_cards", "Karty"),
      Icon: LayoutGrid,
    },
  ];

  const PANES: SegmentedTabItem<PaneId>[] = [
    { id: "PLAN", label: t("rehearsals.inspector.pane_plan", "Plan"), Icon: ListMusic },
    {
      id: "ATTENDANCE",
      label: t("rehearsals.inspector.pane_attendance", "Obecność"),
      Icon: ListChecks,
    },
  ];
  const hasPlan = (rehearsal.plan?.length ?? 0) > 0;

  return (
    // `overflow-clip`, not the card's own `overflow-hidden`: it trims the same
    // corners without making the card a scroll container, so the roster's
    // voice headers below stick to the window rather than to nothing.
    <GlassCard
      variant="solid"
      padding="none"
      isHoverable={false}
      className="flex flex-col overflow-clip"
    >
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
        {onSaveFocus && !focusHasLines ? (
          <div className="mt-1">
            <InlineEditable
              variant="subtitle"
              value={focus ?? ""}
              onSave={onSaveFocus}
              ariaLabel={t("rehearsals.lead.focus_label", "Temat próby")}
              placeholder={t("rehearsals.lead.focus_placeholder", "np. Antegenerale, Lark z Radu")}
              emptyDisplay={t("rehearsals.lead.focus_empty", "Dodaj temat próby")}
            />
          </div>
        ) : (
          focus && (
            <Text
              size="md"
              color="graphite"
              className="mt-1 block whitespace-pre-line font-serif italic"
            >
              {focus}
            </Text>
          )
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
          {/* Who stands in front, only when it was announced — the conductor
              is the resting case and is never spelled out. */}
          {rehearsal.led_by_name && (
            <span className="flex items-center gap-1.5">
              <UserCheck size={12} className="text-ethereal-gold/70" aria-hidden="true" />
              <Caption color="muted">
                {t("rehearsals.inspector.led_by", "Prowadzi: {{name}}", {
                  name: rehearsal.led_by_name,
                })}
              </Caption>
            </span>
          )}
        </div>
      </div>

      {/* ── Plan · Obecność ───────────────────────────────────────────── */}
      {/* The pitch pipe sits beside the switch while the plan is shown: it
          serves the music, and the pane it opens into is the plan's. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <SegmentedTabs
          items={PANES}
          value={pane}
          onChange={selectPane}
          ariaLabel={t("rehearsals.inspector.panes", "Plan albo obecność")}
        />
        {pane === "PLAN" && (
          <Button
            variant={isPitchPipeOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIsPitchPipeOpen((prev) => !prev)}
            aria-expanded={isPitchPipeOpen}
            leftIcon={<Radio size={14} aria-hidden="true" />}
          >
            {t("rehearsals.inspector.pitch_pipe", "Kamerton")}
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {pane === "PLAN" && isPitchPipeOpen && (
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

      {/* ── The plan ──────────────────────────────────────────────────── */}
      {/* Hidden, never unmounted, while the roll call is shown: an open
          editor may hold an unsaved draft, and the switch is not a way to
          lose it. Whoever may plan the evening reads it here and edits it in
          place; a stand-in who may not reads it at stand size. The editor is
          keyed by the evening: a draft belongs to the evening it was written
          on and never outlives it — and it guards its own way back to the
          read view, as the host guards every way to another evening. */}
      <div hidden={pane !== "PLAN"}>
        {canEditPlan ? (
          isPlanEditorOpen ? (
            <RehearsalPlanEditor
              key={String(rehearsal.id)}
              rehearsal={rehearsal}
              access={allowManagerActions ? "manager" : "planner"}
              onDirtyChange={onPlanDirtyChange}
              onClose={closePlanEditor}
            />
          ) : (
            <RehearsalPlanReadView
              key={String(rehearsal.id)}
              rehearsal={rehearsal}
              size={planAtStand ? "stand" : "default"}
              onEdit={openPlanEditor}
              onMarkItem={markPlanItem}
            />
          )
        ) : (
          <div className="p-5 md:p-6">
            <div className="flex items-center gap-2">
              <ListMusic size={12} className="text-ethereal-gold/70" aria-hidden="true" />
              <Eyebrow as="h3" color="graphite">
                {t("rehearsals.plan.title", "Plan próby")}
              </Eyebrow>
              {!hasPlan && (
                <Caption color="muted">{t("rehearsals.plan.empty.title", "Bez planu")}</Caption>
              )}
            </div>
            {hasPlan && (
              <RehearsalPlanTimeline
                rows={rehearsal.plan ?? []}
                size="stand"
                onMark={markPlanItem}
                className="mt-4"
              />
            )}
          </div>
        )}
      </div>

      {/* ── The roll call ─────────────────────────────────────────────── */}
      <div hidden={pane !== "ATTENDANCE"}>
        {/* Progress + composition */}
        {invitedCount > 0 && (
          <div className="border-b border-hairline p-5 md:p-6">
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

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
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
            </div>

            {/* Absent, not disabled, once nothing is blank: "fill 0 gaps" is
                no action at all. */}
            {stats.none > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={onMarkAllPresent}
                disabled={isMarkingAll || !registerOpen}
                title={
                  registerOpen
                    ? undefined
                    : t(
                        "rehearsals.dashboard.bulk_fill_not_yet",
                        "Dostępne od {{hours}} godz. przed próbą",
                        { hours: LIVE_BEFORE_HOURS },
                      )
                }
                isLoading={isMarkingAll}
                leftIcon={!isMarkingAll ? <CheckCircle2 size={14} /> : undefined}
              >
                {t("rehearsals.dashboard.bulk_fill", "Uzupełnij luki", { count: stats.none })}
              </Button>
            )}
          </div>
        )}

        {/* ── Roster ──────────────────────────────────────────────────── */}
        {/* No scroll box of its own: the roster flows with the page at every
            width, so the voice headers stick to the window. That holds only
            while no ancestor is a scroll container — clip, never hidden. */}
        <div className="overflow-x-clip">
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
              // The cast editor is a manager route; offering it to a stand-in
              // would send them into a redirect. Nothing replaces it: an evening
              // with nobody called is a thing to report, not to fix from here.
              actions={
                allowManagerActions ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/panel/projects/${String(rehearsal.project)}/cast`}>
                      <UserPlus size={14} aria-hidden="true" />
                      {t("rehearsals.inspector.open_cast", "Otwórz obsadę")}
                    </Link>
                  </Button>
                ) : undefined
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
                {/* No backdrop blur: under a 95 % fill it cannot show, and a
                    header riding the page's whole scroll would pay for it on
                    every frame. */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-ethereal-alabaster/95 px-5 py-2.5">
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
                          onOpenSpan={rowSpanHandler}
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
                          onOpenSpan={rowSpanHandler}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── After the rehearsal ───────────────────────────────────────── */}
      <RehearsalDebrief rehearsal={rehearsal} onSave={onSaveDebrief} />

      {/* Mounted, not conditional: the sheet animates out, and unmounting it on
          close would cut that short. The id going null is what shuts it. The
          exception is a reader who may never open it — no row can name one, so
          the sheet is not on the page either. */}
      {allowManagerActions && (
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
      )}
    </GlassCard>
  );
};
