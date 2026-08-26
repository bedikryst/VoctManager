import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Clock,
  ChevronDown,
  ChevronRight,
  Shirt,
  Eye,
  Users,
  Music,
  Wrench,
  FileText,
} from "lucide-react";
import { useArtistPreview } from "@/app/providers/ArtistPreviewProvider";
import { INERT_SURFACE } from "@/shared/ui/primitives/inertSurface";
import { PdfViewerModal } from "@/shared/ui/composites/PdfViewerModal";
import { BottomSheet } from "@/shared/ui/composites/BottomSheet";
import { SegmentedTabs } from "@/shared/ui/composites/SegmentedTabs";
import { DualTimeDisplay } from "@/widgets/utility/DualTimeDisplay";
import { SpotifyWidget } from "../../projects/ProjectCard/widgets/SpotifyWidget";
import { buildProjectDayTimeline } from "../../projects/lib/dayTimeline";
import { getEventMomentPresentation } from "../../projects/lib/projectPresentation";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import type { Project, ProgramItem, PieceCasting } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { ProjectScoreBook } from "@/features/projects/components/ProjectScoreBook";
import { useTimelineProjectCard } from "../hooks/useTimelineProjectCard";
import { useProjectReadiness } from "../hooks/useProjectReadiness";
import { ReadinessRing } from "./ReadinessRing";
import { AddToCalendar } from "./AddToCalendar";
import { ConcertDayPlan, hasConcertDayPlan } from "./ConcertDayPlan";
import { OnSiteFacts, hasOnSiteFacts } from "./OnSiteFacts";
import type { TimelineEvent } from "../types/schedule.dto";
import { cn } from "@/shared/lib/utils";
import { onActivate } from "@/shared/lib/dom/a11y";

interface TimelineProjectCardProps {
  event: TimelineEvent;
  isExpanded: boolean;
  onToggle: () => void;
  artistId?: string | number;
}

interface PopulatedParticipation {
  artist: string;
  artist_name?: string;
}

interface PopulatedPieceCasting extends Omit<PieceCasting, "participation"> {
  participation: string | PopulatedParticipation;
}

const resolveArtistId = (c: PopulatedPieceCasting): string | undefined =>
  typeof c.participation === "object" ? c.participation.artist : undefined;

const resolveArtistName = (c: PopulatedPieceCasting): string | undefined =>
  typeof c.participation === "object" ? c.participation.artist_name : undefined;

export const TimelineProjectCard = ({
  event,
  isExpanded,
  onToggle,
  artistId,
}: TimelineProjectCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const proj = event.rawObj as Project;

  const {
    activeSubTab,
    setActiveSubTab,
    expandedPieceId,
    setExpandedPieceId,
    programItems,
    isProgramLoading,
    castings,
    isCastingsLoading,
    isDaySheetPreviewOpen,
    fetchDaySheetBlob,
    handleOpenDaySheetPreview,
    handleCloseDaySheetPreview,
    isScorePdfPreviewOpen,
    handleOpenScorePdfPreview,
    handleCloseScorePdfPreview,
  } = useTimelineProjectCard(proj.id, isExpanded);

  const populatedCastings = castings as PopulatedPieceCasting[];
  // Documents on this card are fetched as the caller — the day sheet is written
  // per audience and the score carries the caller's watermark — so inside a
  // preview they stay visible and refuse to open.
  const { isPreview } = useArtistPreview();
  const readiness = useProjectReadiness(
    proj.id,
    isExpanded && activeSubTab === "SETLIST",
  );
  const isUpcoming = event.date_time.getTime() > Date.now();

  // One axis for the day, the same one the printed card draws: the run sheet
  // with the call, the downbeat and the two typed windows merged in. Read off
  // the project rather than `event.run_sheet` — the windows and the venue clock
  // live there, and a second reading of the same day is how the two diverge.
  const dayEntries = useMemo(() => buildProjectDayTimeline(proj), [proj]);
  const hasDayPlan = hasConcertDayPlan(dayEntries);

  // The card's eyebrow and its sheet's subtitle are the same claim about the
  // same evening, so they read from one table — and it is the project's own
  // kind, not the hedged "Koncert / Wydarzenie" that stood here while nothing
  // knew which of the two it was.
  const eventMomentLabel = getEventMomentPresentation(proj.event_kind);
  const eventMoment = t(
    eventMomentLabel.labelKey,
    eventMomentLabel.fallbackLabel,
  );

  const hasOnsiteBlock = hasOnSiteFacts(proj);
  const hasDressCode = Boolean(proj.dress_code_female || proj.dress_code_male);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="group relative"
    >
      <GlassCard
        variant="dark"
        glow={true}
        withNoise={true}
        padding="none"
        isHoverable={false}
        className={cn(
          "overflow-hidden transition-all duration-300",
          isExpanded
            ? "border-ethereal-incense/30"
            : "hover:border-ethereal-incense/20",
        )}
      >
        {/* ── hero header ──────────────────────────────────────────── */}
        <div className="relative flex items-start gap-4 p-4 sm:p-6">
          {/* stretched click-layer: the whole header opens the detail sheet.
              A real <button> (not a div[role=button]) sitting *under* the
              location badge — no nested interactive controls, no tap clash. */}
          <button
            type="button"
            onClick={onToggle}
            aria-haspopup="dialog"
            aria-expanded={isExpanded}
            aria-label={t("schedule.card.open_detail", "Otwórz szczegóły: {{title}}", {
              title: event.title,
            })}
            className="absolute inset-0 z-[1] cursor-pointer rounded-2xl transition-colors hover:bg-ethereal-marble/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
          />
          {/* date box */}
          <div className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border flex flex-col items-center justify-center shadow-glass-ethereal bg-ethereal-incense/20 border-ethereal-incense/40 backdrop-blur-md">
            <Eyebrow as="span" color="parchment">
              {formatLocalizedDate(
                event.date_time,
                { month: "short" },
                undefined,
                proj.timezone,
              )}
            </Eyebrow>
            <Heading
              as="span"
              size="2xl"
              weight="black"
              color="white"
              className="leading-none my-0.5"
            >
              {formatLocalizedDate(
                event.date_time,
                { day: "numeric" },
                undefined,
                proj.timezone,
              )}
            </Heading>
          </div>

          {/* title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Eyebrow
                as="span"
                color="gold"
                className="whitespace-nowrap px-2.5 py-1 bg-ethereal-gold/15 border border-ethereal-gold/40 rounded-md shadow-glass-ethereal"
              >
                {eventMoment}
              </Eyebrow>
            </div>

            <Heading
              as="h3"
              size="2xl"
              weight="bold"
              color="white"
              className="mb-2.5 leading-tight"
            >
              {event.title}
            </Heading>

            {/* badges row — dress code lives in the expanded Logistics tab */}
            <div className="flex flex-wrap items-center gap-2">
              {proj.call_time && (
                <DualTimeDisplay
                  value={proj.call_time}
                  timeZone={proj.timezone}
                  label={t("schedule.card.call_time", "Zbiórka: ")}
                  icon={<Clock size={11} aria-hidden="true" />}
                  variant="dark"
                  containerClassName="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ethereal-incense/30 text-ethereal-parchment border border-ethereal-incense/50"
                  primaryTimeClassName="flex items-center gap-1.5 font-medium"
                  divider
                />
              )}
              {/* lifted above the stretched click-layer (z-[2]) so the map
                  popover opens on its own tap; flex+min-w-0 keeps the badge
                  shrinkable so a long venue name truncates instead of bleeding
                  past the card edge */}
              <span className="relative z-[2] flex min-w-0 max-w-full">
                <LocationPreview
                  locationRef={event.location}
                  fallback={t("schedule.card.no_location", "Brak lok.")}
                  variant="badge"
                  className="max-w-full text-ethereal-parchment/80 border-ethereal-incense/30 bg-ethereal-incense/10"
                />
              </span>
            </div>
          </div>

          {/* open-detail affordance (decorative — the stretched button owns
              the interaction); top-anchored beside the date box */}
          <div className="shrink-0 self-start mt-1 p-1.5 bg-ethereal-incense/20 border border-ethereal-incense/30 rounded-full text-ethereal-parchment/80 transition-colors">
            <ChevronRight size={18} aria-hidden="true" />
          </div>
        </div>

        {/* ── detail surface — bottom-sheet on touch, centred modal on
             desktop; replaces the former four-level inline accordion ─── */}
        <BottomSheet
          isOpen={isExpanded}
          onClose={onToggle}
          tone="dark"
          title={event.title}
          subtitle={eventMoment}
        >
          <div className="flex flex-col gap-4">
              {/* sub-tab bar */}
              <SegmentedTabs
                tone="dark"
                value={activeSubTab}
                onChange={setActiveSubTab}
                ariaLabel={t("schedule.card.tabs_aria", "Sekcje wydarzenia")}
                items={[
                  {
                    id: "LOGISTICS",
                    Icon: Wrench,
                    label: t("schedule.card.tab.logistics", "Logistyka"),
                  },
                  {
                    id: "SETLIST",
                    Icon: Music,
                    label: t("schedule.card.tab.setlist", "Repertuar"),
                  },
                ]}
              />

              <div className="min-w-0">
                {/* Take-away row, above the tabs' content and outside them: the
                    sheet written for this reader and the calendar entry are the
                    two things you leave with, and neither belongs to Logistyka
                    or Repertuar more than the other. */}
                <div className="mb-4 flex flex-col gap-4">
                  {/* The server writes this sheet for whoever asks for it, so a
                      manager previewing would open their own production copy
                      under the singer's name. Present, and inert. */}
                  <div inert={isPreview} className={cn(isPreview && INERT_SURFACE)}>
                    <Eyebrow
                      color="parchment-muted"
                      className="mb-1.5 flex items-center gap-1.5"
                    >
                      <FileText size={12} aria-hidden="true" />
                      {t("schedule.day_sheet.title", "Karta dnia")}
                    </Eyebrow>
                    <Button
                      variant="outline"
                      size="touch"
                      onClick={handleOpenDaySheetPreview}
                      leftIcon={<Eye size={13} aria-hidden="true" />}
                      aria-label={t(
                        "schedule.day_sheet.open_aria",
                        "Otwórz kartę dnia (PDF)",
                      )}
                      className="w-full border-ethereal-gold/50 text-ethereal-gold hover:bg-ethereal-gold/15 sm:w-auto"
                    >
                      {t("schedule.day_sheet.open", "Otwórz (PDF)")}
                    </Button>
                    <Text
                      size="xs"
                      color="parchment-muted"
                      className="mt-1.5 block text-ethereal-parchment/60"
                    >
                      {t(
                        "schedule.day_sheet.hint",
                        "Twój egzemplarz: zbiórka, przebieg dnia i Twoja obsada. Do pobrania w podglądzie.",
                      )}
                    </Text>
                  </div>
                  {isUpcoming && (
                    <AddToCalendar event={event} tone="dark" layout="inline" />
                  )}
                </div>
                {/* ── LOGISTICS tab ─────────────────────────────── */}
                {activeSubTab === "LOGISTICS" && (
                  <div className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
                    {/* dress code + description */}
                    <div className="space-y-4">
                      {hasDressCode && (
                        <div className="bg-ethereal-incense/10 border border-ethereal-incense/20 rounded-2xl p-4">
                          <Eyebrow
                            color="parchment"
                            className="mb-3 flex items-center gap-2"
                          >
                            <Shirt size={13} aria-hidden="true" />
                            {t(
                              "schedule.card.dress_code_title",
                              "Szczegóły ubioru",
                            )}
                          </Eyebrow>
                          {proj.dress_code_female && (
                            <Text
                              as="p"
                              size="sm"
                              color="white"
                              className="mb-1.5"
                            >
                              <Text
                                as="span"
                                color="parchment-muted"
                                className="mr-2"
                              >
                                {t("schedule.card.dress_code_women", "Panie:")}
                              </Text>
                              {proj.dress_code_female}
                            </Text>
                          )}
                          {proj.dress_code_male && (
                            <Text as="p" size="sm" color="white">
                              <Text
                                as="span"
                                color="parchment-muted"
                                className="mr-2"
                              >
                                {t("schedule.card.dress_code_men", "Panowie:")}
                              </Text>
                              {proj.dress_code_male}
                            </Text>
                          )}
                        </div>
                      )}
                      {hasOnsiteBlock && <OnSiteFacts project={proj} />}
                      {proj.description && (
                        <div className="bg-ethereal-incense/10 border border-ethereal-incense/20 rounded-2xl p-4">
                          <Text
                            size="base"
                            color="white"
                            className="leading-relaxed whitespace-pre-wrap font-serif"
                          >
                            {proj.description}
                          </Text>
                        </div>
                      )}
                      {/* The empty state answers for the whole column, not for
                          the notes alone: with a dress code or a door on
                          screen, "nothing here" is not true. */}
                      {!proj.description && !hasOnsiteBlock && !hasDressCode && (
                        <Text
                          size="sm"
                          color="parchment-muted"
                          className="italic px-2"
                        >
                          {t(
                            "schedule.card.no_notes",
                            "Brak dodatkowych notatek produkcyjnych.",
                          )}
                        </Text>
                      )}
                    </div>

                    {/* run sheet */}
                    <div>
                      <Eyebrow color="parchment" className="mb-3 block">
                        {t(
                          "schedule.card.run_sheet_title",
                          "Harmonogram Dnia",
                        )}
                      </Eyebrow>

                      {/* Score PDF — only shown when the manager has uploaded one */}
                      {proj.score_pdf && (
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ethereal-sage/30 bg-ethereal-sage/10 px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <FileText
                              size={12}
                              className="text-ethereal-sage"
                              aria-hidden="true"
                            />
                            <Text
                              size="sm"
                              color="parchment-muted"
                              className="text-ethereal-parchment/70"
                            >
                              {t(
                                "schedule.card.score_pdf_label",
                                "Książka nutowa",
                              )}
                            </Text>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            inert={isPreview}
                            onClick={handleOpenScorePdfPreview}
                            leftIcon={<Eye size={11} aria-hidden="true" />}
                            className={cn(
                              "border-ethereal-sage/50 text-ethereal-sage hover:bg-ethereal-sage/20",
                              isPreview && INERT_SURFACE,
                            )}
                          >
                            {t(
                              "schedule.card.view_score_pdf",
                              "Podgląd PDF",
                            )}
                          </Button>
                        </div>
                      )}

                      {hasDayPlan ? (
                        <ConcertDayPlan
                          entries={dayEntries}
                          eventKind={proj.event_kind}
                        />
                      ) : (
                        <Text
                          size="sm"
                          color="parchment-muted"
                          className="italic px-2"
                        >
                          {t(
                            "schedule.card.no_run_sheet",
                            "Harmonogram dnia nie został jeszcze opublikowany przez menedżera.",
                          )}
                        </Text>
                      )}
                    </div>
                  </div>
                )}

                {/* ── SETLIST tab ───────────────────────────────── */}
                {activeSubTab === "SETLIST" && (
                  // Single column on every breakpoint: the programme is the
                  // primary content and keeps the full sheet width, while the
                  // secondary Spotify reference drops full-width *below* it
                  // (`order-last`) instead of being crammed into a viewport-`xl`
                  // side column that the fixed-width modal never has room for.
                  <div className="flex flex-col gap-6">
                    {/* spotify reference — full-width strip below the programme */}
                    <div className="order-last">
                      {proj.spotify_playlist_url ? (
                        <SpotifyWidget
                          playlistUrl={proj.spotify_playlist_url}
                        />
                      ) : (
                        <div className="bg-ethereal-incense/10 border border-ethereal-incense/20 rounded-2xl p-4 flex items-center justify-center gap-2 text-center">
                          <Music
                            size={16}
                            className="text-ethereal-parchment/40 shrink-0"
                            aria-hidden="true"
                          />
                          <Text
                            size="sm"
                            color="parchment-muted"
                            className="italic"
                          >
                            {t(
                              "schedule.card.no_spotify",
                              "Brak playlisty referencyjnej.",
                            )}
                          </Text>
                        </div>
                      )}
                    </div>

                    {/* program items */}
                    <div className="space-y-3">
                      {readiness.hasData && (
                        <ReadinessRing
                          readiness={readiness}
                          to="/panel/materials"
                          surface="dark"
                        />
                      )}
                      {isProgramLoading ? (
                        <EtherealLoader fullHeight={false} />
                      ) : programItems.length > 0 ? (
                        [...programItems]
                          .sort(
                            (a: ProgramItem, b: ProgramItem) =>
                              a.order - b.order,
                          )
                          .map((pi: ProgramItem, idx: number) => {
                            const isPieceExpanded =
                              expandedPieceId === String(pi.piece);
                            return (
                              <div
                                key={pi.id}
                                className={cn(
                                  "bg-ethereal-incense/10 border rounded-2xl overflow-hidden transition-all",
                                  isPieceExpanded
                                    ? "border-ethereal-sage/50"
                                    : "border-ethereal-incense/20 hover:border-ethereal-incense/40 hover:bg-ethereal-incense/20",
                                )}
                              >
                                <div
                                  onClick={() =>
                                    setExpandedPieceId(
                                      isPieceExpanded ? null : String(pi.piece),
                                    )
                                  }
                                  onKeyDown={onActivate(() =>
                                    setExpandedPieceId(
                                      isPieceExpanded ? null : String(pi.piece),
                                    )
                                  )}
                                  role="button"
                                  tabIndex={0}
                                  aria-expanded={isPieceExpanded}
                                  className="p-4 flex items-center justify-between cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-sage/40"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Eyebrow
                                      as="span"
                                      color="sage"
                                      className="opacity-80 w-5 text-center shrink-0"
                                    >
                                      {idx + 1}.
                                    </Eyebrow>
                                    <div className="min-w-0">
                                      {/* The reason this whole feature exists:
                                          a singer holding the book has to know
                                          the next piece is the one at the
                                          Offertory and not the one at Communion.
                                          The words are the server's — numbered
                                          and in their own language. */}
                                      {pi.slot_label && (
                                        <Eyebrow
                                          as="span"
                                          color="gold"
                                          className="mb-0.5 block truncate"
                                        >
                                          {pi.slot_label}
                                        </Eyebrow>
                                      )}
                                      <Text
                                        weight="bold"
                                        color="white"
                                        size="md"
                                        className="truncate"
                                      >
                                        {pi.piece_title}
                                      </Text>
                                      <Text
                                        size="sm"
                                        color="parchment-muted"
                                        className="flex items-center gap-1.5 mt-0.5 text-ethereal-parchment/70"
                                      >
                                        <Users size={11} aria-hidden="true" />
                                        {isPieceExpanded
                                          ? t(
                                              "schedule.card.hide_cast",
                                              "Ukryj obsadę",
                                            )
                                          : t(
                                              "schedule.card.expand_cast",
                                              "Rozwiń obsadę (divisi)",
                                            )}
                                      </Text>
                                    </div>
                                  </div>
                                  <motion.div
                                    animate={{
                                      rotate: isPieceExpanded ? 180 : 0,
                                    }}
                                    transition={{ duration: 0.22 }}
                                    className="shrink-0"
                                  >
                                    <ChevronDown
                                      size={16}
                                      className={
                                        isPieceExpanded
                                          ? "text-ethereal-sage"
                                          : "text-ethereal-parchment/60"
                                      }
                                      aria-hidden="true"
                                    />
                                  </motion.div>
                                </div>

                                <AnimatePresence>
                                  {isPieceExpanded && (
                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: "auto" }}
                                      exit={{ height: 0 }}
                                      transition={{ duration: 0.22 }}
                                      className="overflow-hidden bg-ethereal-ink/60 border-t border-ethereal-incense/20"
                                    >
                                      <div className="p-4">
                                        {isCastingsLoading ? (
                                          <EtherealLoader fullHeight={false} />
                                        ) : populatedCastings.length > 0 ? (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                            {Object.entries(
                                              populatedCastings.reduce<
                                                Record<
                                                  string,
                                                  PopulatedPieceCasting[]
                                                >
                                              >((acc, c) => {
                                                const vl =
                                                  c.voice_line_display ||
                                                  c.voice_line ||
                                                  "Inne";
                                                if (!acc[vl]) acc[vl] = [];
                                                acc[vl].push(c);
                                                return acc;
                                              }, {}),
                                            ).map(([vl, groupCastings]) => (
                                              <div
                                                key={vl}
                                                className="space-y-2"
                                              >
                                                <Eyebrow
                                                  as="h5"
                                                  color="sage"
                                                  className="border-b border-ethereal-sage/30 pb-1.5 mb-2 text-ethereal-sage"
                                                >
                                                  {vl}
                                                </Eyebrow>
                                                <ul className="space-y-1.5">
                                                  {groupCastings.map(
                                                    (
                                                      c: PopulatedPieceCasting,
                                                    ) => {
                                                      const partArtistId =
                                                        resolveArtistId(c);
                                                      const isMe =
                                                        String(c.artist_id) ===
                                                          String(artistId) ||
                                                        partArtistId ===
                                                          String(artistId);
                                                      const displayName =
                                                        c.artist_name ||
                                                        resolveArtistName(c) ||
                                                        t(
                                                          "schedule.card.unknown_artist",
                                                          "Artysta",
                                                        );

                                                      return (
                                                        <li
                                                          key={c.id}
                                                          className={cn(
                                                            "flex flex-col gap-0.5",
                                                            isMe &&
                                                              "bg-ethereal-incense/20 px-2 py-1.5 rounded-lg border border-ethereal-incense/30",
                                                          )}
                                                        >
                                                          <Text
                                                            as="span"
                                                            size="sm"
                                                            color={
                                                              isMe
                                                                ? "white"
                                                                : "parchment"
                                                            }
                                                            weight={
                                                              isMe
                                                                ? "bold"
                                                                : "normal"
                                                            }
                                                            className={cn(
                                                              "flex items-center gap-1.5",
                                                              !isMe &&
                                                                "text-ethereal-parchment/90",
                                                            )}
                                                          >
                                                            {isMe && (
                                                              <span
                                                                className="w-1.5 h-1.5 bg-ethereal-sage rounded-full animate-pulse shadow-glass-ethereal shrink-0"
                                                                aria-hidden="true"
                                                              />
                                                            )}
                                                            {displayName}
                                                          </Text>
                                                          {c.notes && (
                                                            <Text
                                                              as="span"
                                                              size="xs"
                                                              color="gold"
                                                              className="italic bg-ethereal-gold/10 px-1.5 py-0.5 rounded w-max border border-ethereal-gold/20"
                                                            >
                                                              {t(
                                                                "schedule.card.note_label",
                                                                "Notatka:",
                                                              )}{" "}
                                                              {c.notes}
                                                            </Text>
                                                          )}
                                                        </li>
                                                      );
                                                    },
                                                  )}
                                                </ul>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <Text
                                            size="sm"
                                            color="parchment-muted"
                                            className="italic text-center py-3"
                                          >
                                            {t(
                                              "schedule.card.no_divisi",
                                              "Brak szczegółowego podziału (divisi) dla tego utworu.",
                                            )}
                                          </Text>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                      ) : (
                        <Text
                          size="sm"
                          color="parchment-muted"
                          className="text-center py-6 italic"
                        >
                          {t(
                            "schedule.card.no_program",
                            "Repertuar nie został jeszcze ustalony.",
                          )}
                        </Text>
                      )}
                    </div>
                  </div>
                )}
              </div>
          </div>
        </BottomSheet>
      </GlassCard>

      <PdfViewerModal
        isOpen={isDaySheetPreviewOpen}
        title={t("schedule.day_sheet.title", "Karta dnia")}
        subtitle={proj.title}
        fileName={`Karta_${proj.title.replace(/\s+/g, "_")}.pdf`}
        fetchBlob={fetchDaySheetBlob}
        docKey={`day-sheet-${proj.id}`}
        volatile
        fullView={{
          type: "project-day-sheet",
          id: proj.id,
          hint: {
            title: t("schedule.day_sheet.title", "Karta dnia"),
            subtitle: proj.title,
            fileName: `Karta_${proj.title.replace(/\s+/g, "_")}.pdf`,
          },
        }}
        onClose={handleCloseDaySheetPreview}
      />

      {proj.score_pdf && (
        <ProjectScoreBook
          projectId={proj.id}
          projectTitle={proj.title}
          isOpen={isScorePdfPreviewOpen}
          version={proj.updated_at ?? ""}
          onClose={handleCloseScorePdfPreview}
        />
      )}
    </motion.div>
  );
};

export default TimelineProjectCard;
