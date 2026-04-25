import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Clock,
  ChevronDown,
  Shirt,
  Download,
  Users,
  Music,
  Wrench,
} from "lucide-react";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { SpotifyWidget } from "../../projects/ProjectCard/widgets/SpotifyWidget";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import type { Project, ProgramItem, PieceCasting } from "@/shared/types";
import { Button } from "@/shared/ui/primitives/Button";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { useTimelineProjectCard } from "../hooks/useTimelineProjectCard";
import type { TimelineEvent } from "../types/schedule.dto";
import { cn } from "@/shared/lib/utils";

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
  const combinedDressCode = [proj.dress_code_female, proj.dress_code_male]
    .filter(Boolean)
    .join(" / ");

  const {
    activeSubTab,
    setActiveSubTab,
    expandedPieceId,
    setExpandedPieceId,
    isDownloading,
    programItems,
    isProgramLoading,
    castings,
    isCastingsLoading,
    handleDownloadCallSheet,
  } = useTimelineProjectCard(proj.id, proj.title, isExpanded);

  const populatedCastings = castings as PopulatedPieceCasting[];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative sm:pl-14 md:pl-16 group"
    >
      {/* timeline dot — desktop */}
      <div className="hidden sm:block absolute left-3.5 md:left-6 top-5 w-3 h-3 rounded-full border-2 ring-4 ring-ethereal-parchment z-10 bg-ethereal-amethyst border-ethereal-amethyst shadow-glass-solid" />

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
        <div
          className="relative flex items-start gap-4 p-4 sm:p-6 cursor-pointer hover:bg-ethereal-marble/5 transition-colors"
          onClick={onToggle}
          role="button"
          aria-expanded={isExpanded}
        >
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
                color="amethyst"
                className="px-2.5 py-1 bg-ethereal-amethyst/20 border border-ethereal-amethyst/40 rounded-md shadow-glass-ethereal"
              >
                {t("schedule.card.project_badge", "Koncert / Wydarzenie")}
              </Eyebrow>
            </div>

            <Heading
              as="h3"
              size="3xl"
              weight="bold"
              color="white"
              className="mb-2.5 leading-tight"
            >
              {event.title}
            </Heading>

            {/* badges row */}
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
                  localTimeClassName="text-[9px] text-ethereal-parchment/70 border-l border-ethereal-incense/50 pl-1.5"
                />
              )}
              {combinedDressCode && (
                <Eyebrow
                  as="span"
                  color="parchment"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ethereal-amethyst/20 border border-ethereal-amethyst/30 max-w-48 truncate"
                  title={combinedDressCode}
                >
                  <Shirt size={11} aria-hidden="true" />
                  {combinedDressCode}
                </Eyebrow>
              )}
              <LocationPreview
                locationRef={event.location}
                fallback={t("schedule.card.no_location", "Brak lok.")}
                variant="badge"
                className="text-ethereal-parchment/80 border-ethereal-incense/30 bg-ethereal-incense/10"
              />
            </div>
          </div>

          {/* chevron */}
          <div className="shrink-0 self-start mt-1 p-1.5 bg-ethereal-incense/20 border border-ethereal-incense/30 rounded-full text-ethereal-parchment/80 hover:bg-ethereal-incense/30 transition-colors">
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.25 }}
            >
              <ChevronDown size={18} aria-hidden="true" />
            </motion.div>
          </div>
        </div>

        {/* ── expanded panel ───────────────────────────────────────── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="overflow-hidden border-t border-ethereal-incense/10 bg-ethereal-ink/20"
            >
              {/* sub-tab bar — full-width on mobile */}
              <div className="flex p-3 sm:p-5 pb-0 gap-2">
                {(
                  [
                    {
                      id: "LOGISTICS",
                      Icon: Wrench,
                      labelKey: "schedule.card.tab.logistics",
                      fallback: "Logistyka & Plan",
                    },
                    {
                      id: "SETLIST",
                      Icon: Music,
                      labelKey: "schedule.card.tab.setlist",
                      fallback: "Repertuar & Divisi",
                    },
                  ] as const
                ).map(({ id, Icon, labelKey, fallback }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveSubTab(id)}
                    className={cn(
                      "flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 py-2 sm:px-4 rounded-xl text-xs font-medium tracking-wide uppercase transition-all duration-200 border",
                      activeSubTab === id
                        ? id === "LOGISTICS"
                          ? "border-ethereal-amethyst/50 text-ethereal-amethyst bg-ethereal-amethyst/20"
                          : "border-ethereal-sage/50 text-ethereal-sage bg-ethereal-sage/20"
                        : "border-transparent text-ethereal-parchment/60 hover:text-ethereal-parchment/90 hover:bg-ethereal-incense/10",
                    )}
                  >
                    <Icon size={13} aria-hidden="true" />
                    {t(labelKey, fallback)}
                  </button>
                ))}
              </div>

              <div className="p-4 sm:p-6 pt-4">
                {/* ── LOGISTICS tab ─────────────────────────────── */}
                {activeSubTab === "LOGISTICS" && (
                  <div className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
                    {/* dress code + description */}
                    <div className="space-y-4">
                      {(proj.dress_code_female || proj.dress_code_male) && (
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
                      {proj.description ? (
                        <div className="bg-ethereal-incense/10 border border-ethereal-incense/20 rounded-2xl p-4">
                          <Text
                            size="sm"
                            color="white"
                            className="leading-relaxed whitespace-pre-wrap font-serif"
                          >
                            {proj.description}
                          </Text>
                        </div>
                      ) : (
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
                      <div className="flex items-center justify-between mb-4">
                        <Eyebrow color="parchment">
                          {t(
                            "schedule.card.run_sheet_title",
                            "Harmonogram Dnia",
                          )}
                        </Eyebrow>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadCallSheet}
                          disabled={isDownloading}
                          isLoading={isDownloading}
                          leftIcon={
                            !isDownloading ? (
                              <Download size={11} aria-hidden="true" />
                            ) : undefined
                          }
                          className="border-ethereal-amethyst/50 text-ethereal-amethyst hover:bg-ethereal-amethyst/20"
                        >
                          {t(
                            "schedule.card.download_call_sheet",
                            "Call-Sheet PDF",
                          )}
                        </Button>
                      </div>

                      {event.run_sheet && event.run_sheet.length > 0 ? (
                        <div className="relative pl-5 border-l border-ethereal-incense/20 space-y-4 ml-2">
                          {[...event.run_sheet]
                            .sort((a, b) => a.time.localeCompare(b.time))
                            .map((item, idx) => (
                              <div
                                key={item.id || idx}
                                className="relative group/run"
                              >
                                <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 bg-ethereal-ink border-2 border-ethereal-amethyst rounded-full shadow-glass-solid group-hover/run:scale-125 transition-transform" />
                                <Eyebrow
                                  as="span"
                                  color="amethyst"
                                  className="bg-ethereal-amethyst/20 self-start px-2 py-0.5 rounded border border-ethereal-amethyst/30 mb-1.5 inline-block text-white"
                                >
                                  {item.time}
                                </Eyebrow>
                                <div className="bg-ethereal-incense/10 p-3.5 rounded-xl border border-ethereal-incense/20 hover:bg-ethereal-incense/20 transition-colors">
                                  <Text weight="bold" color="white">
                                    {item.title}
                                  </Text>
                                  {item.description && (
                                    <Text
                                      size="sm"
                                      color="parchment-muted"
                                      className="mt-1 leading-relaxed text-ethereal-parchment/80"
                                    >
                                      {item.description}
                                    </Text>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
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
                  <div className="space-y-6 xl:grid xl:grid-cols-5 xl:gap-8 xl:space-y-0">
                    {/* spotify — on mobile appears below the list */}
                    <div className="xl:col-span-2 xl:order-last">
                      {proj.spotify_playlist_url ? (
                        <SpotifyWidget
                          playlistUrl={proj.spotify_playlist_url}
                          theme="dark"
                        />
                      ) : (
                        <div className="bg-ethereal-incense/10 border border-ethereal-incense/20 rounded-2xl p-5 text-center flex flex-col items-center justify-center min-h-36">
                          <Music
                            size={22}
                            className="text-ethereal-parchment/40 mb-2"
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
                    <div className="xl:col-span-3 space-y-3">
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
                                  className="p-4 flex items-center justify-between cursor-pointer transition-colors"
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
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
};

export default TimelineProjectCard;
