import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Clock,
  ChevronDown,
  ChevronUp,
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

const resolveParticipationArtistId = (
  casting: PopulatedPieceCasting,
): string | undefined => {
  if (
    typeof casting.participation === "object" &&
    casting.participation !== null
  ) {
    return casting.participation.artist;
  }
  return undefined;
};

const resolveParticipationArtistName = (
  casting: PopulatedPieceCasting,
): string | undefined => {
  if (
    typeof casting.participation === "object" &&
    casting.participation !== null
  ) {
    return casting.participation.artist_name;
  }
  return undefined;
};

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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="relative sm:pl-16 transition-all duration-300 group"
    >
      <div className="hidden sm:block absolute left-4 md:left-6.75 top-6 w-3 h-3 rounded-full border-[3px] ring-4 ring-ethereal-parchment z-10 bg-ethereal-amethyst border-ethereal-amethyst shadow-glass-solid" />

      <GlassCard
        variant="dark"
        glow={true}
        withNoise={true}
        padding="none"
        isHoverable={false}
        className={cn(
          "transition-all duration-300",
          isExpanded
            ? "border-ethereal-incense/30"
            : "hover:border-ethereal-incense/20",
        )}
      >
        <div
          className="p-5 md:p-6 lg:p-8 flex flex-col md:flex-row md:items-start justify-between gap-5 cursor-pointer relative z-10 hover:bg-ethereal-marble/5 transition-colors"
          onClick={onToggle}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 md:gap-6">
            <div className="w-16 h-16 rounded-2xl border flex flex-col items-center justify-center flex-shrink-0 shadow-glass-ethereal bg-ethereal-marble/10 border-ethereal-incense/20 backdrop-blur-md">
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

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Eyebrow
                  as="span"
                  color="amethyst"
                  className="px-2.5 py-1 bg-ethereal-amethyst/20 border border-ethereal-amethyst/40 rounded-md shadow-glass-ethereal"
                >
                  {t("schedule.card.project_badge", "Koncert / Wydarzenie")}
                </Eyebrow>
              </div>
              <Heading as="h3" size="3xl" weight="bold" color="marble" className="mb-3">
                {event.title}
              </Heading>

              <div className="flex flex-wrap items-center gap-2">
                {proj.call_time && (
                  <DualTimeDisplay
                    value={proj.call_time}
                    timeZone={proj.timezone}
                    label={t("schedule.card.call_time", "Zbiórka: ")}
                    icon={<Clock size={12} aria-hidden="true" />}
                    containerClassName="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ethereal-incense/20 text-ethereal-incense border border-ethereal-incense/30"
                    primaryTimeClassName="flex items-center gap-1.5"
                    localTimeClassName="text-[9px] text-ethereal-incense/70 border-l border-ethereal-incense/30 pl-1.5"
                  />
                )}
                {combinedDressCode && (
                  <Eyebrow
                    as="span"
                    color="amethyst"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ethereal-amethyst/10 border border-ethereal-amethyst/20 max-w-52 truncate"
                    title={combinedDressCode}
                  >
                    <Shirt size={12} aria-hidden="true" />
                    {combinedDressCode}
                  </Eyebrow>
                )}
                <LocationPreview
                  locationRef={event.location}
                  fallback={t("schedule.card.no_location", "Brak lok.")}
                  variant="badge"
                  className="text-ethereal-marble/70"
                />
              </div>
            </div>
          </div>

          <div className="bg-ethereal-marble/10 border border-ethereal-incense/15 text-ethereal-marble shadow-glass-ethereal p-2 rounded-full transition-transform duration-300 relative z-10 self-end md:self-auto flex-shrink-0">
            {isExpanded ? (
              <ChevronUp size={20} aria-hidden="true" />
            ) : (
              <ChevronDown size={20} aria-hidden="true" />
            )}
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-ethereal-incense/10 bg-ethereal-ink/20 relative z-0"
            >
              <div className="p-5 md:p-8 pb-0">
                <div className="flex flex-wrap gap-2 p-1.5 bg-ethereal-marble/5 border border-ethereal-incense/10 rounded-2xl w-max mb-6">
                  <Button
                    variant={activeSubTab === "LOGISTICS" ? "outline" : "ghost"}
                    size="sm"
                    onClick={() => setActiveSubTab("LOGISTICS")}
                    leftIcon={<Wrench size={14} aria-hidden="true" />}
                    className={
                      activeSubTab === "LOGISTICS"
                        ? "border-ethereal-amethyst/30 text-ethereal-amethyst bg-ethereal-amethyst/10"
                        : "text-ethereal-marble/50 hover:text-ethereal-marble"
                    }
                  >
                    {t("schedule.card.tab.logistics", "Logistyka & Plan")}
                  </Button>
                  <Button
                    variant={activeSubTab === "SETLIST" ? "outline" : "ghost"}
                    size="sm"
                    onClick={() => setActiveSubTab("SETLIST")}
                    leftIcon={<Music size={14} aria-hidden="true" />}
                    className={
                      activeSubTab === "SETLIST"
                        ? "border-ethereal-sage/30 text-ethereal-sage bg-ethereal-sage/10"
                        : "text-ethereal-marble/50 hover:text-ethereal-marble"
                    }
                  >
                    {t("schedule.card.tab.setlist", "Repertuar & Divisi")}
                  </Button>
                </div>
              </div>

              <div className="px-5 md:px-8 pb-8 pt-2">
                {activeSubTab === "LOGISTICS" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      {(proj.dress_code_female || proj.dress_code_male) && (
                        <div className="bg-ethereal-marble/5 border border-ethereal-incense/10 rounded-2xl p-5">
                          <Eyebrow
                            color="muted"
                            className="mb-3 flex items-center gap-2"
                          >
                            <Shirt size={14} aria-hidden="true" />
                            {t(
                              "schedule.card.dress_code_title",
                              "Szczegóły ubioru",
                            )}
                          </Eyebrow>
                          {proj.dress_code_female && (
                            <Text as="p" size="sm" color="parchment" className="mb-1.5">
                              <Text as="span" color="graphite" className="mr-2">
                                {t("schedule.card.dress_code_women", "Panie:")}
                              </Text>
                              {proj.dress_code_female}
                            </Text>
                          )}
                          {proj.dress_code_male && (
                            <Text as="p" size="sm" color="parchment">
                              <Text as="span" color="graphite" className="mr-2">
                                {t("schedule.card.dress_code_men", "Panowie:")}
                              </Text>
                              {proj.dress_code_male}
                            </Text>
                          )}
                        </div>
                      )}

                      {proj.description ? (
                        <div className="bg-ethereal-marble/5 border border-ethereal-incense/10 rounded-2xl p-5">
                          <Text
                            size="sm"
                            color="parchment"
                            className="leading-relaxed whitespace-pre-wrap font-serif"
                          >
                            {proj.description}
                          </Text>
                        </div>
                      ) : (
                        <Text size="sm" color="graphite" className="italic mt-2">
                          {t(
                            "schedule.card.no_notes",
                            "Brak dodatkowych notatek produkcyjnych.",
                          )}
                        </Text>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Eyebrow color="muted">
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
                              <Download size={12} aria-hidden="true" />
                            ) : undefined
                          }
                          className="border-ethereal-amethyst/30 text-ethereal-amethyst hover:bg-ethereal-amethyst/10"
                        >
                          {t(
                            "schedule.card.download_call_sheet",
                            "Call-Sheet PDF",
                          )}
                        </Button>
                      </div>

                      {event.run_sheet && event.run_sheet.length > 0 ? (
                        <div className="relative pl-5 border-l border-ethereal-incense/10 space-y-5 ml-2 mt-6">
                          {[...event.run_sheet]
                            .sort((a, b) => a.time.localeCompare(b.time))
                            .map((item, idx) => (
                              <div
                                key={item.id || idx}
                                className="relative group/run"
                              >
                                <div className="absolute -left-6.25 top-1.5 w-3 h-3 bg-ethereal-ink border-2 border-ethereal-amethyst rounded-full shadow-glass-solid group-hover/run:scale-125 transition-transform" />
                                <div className="flex flex-col gap-1.5">
                                  <Eyebrow
                                    as="span"
                                    color="amethyst"
                                    className="bg-ethereal-amethyst/10 self-start px-2 py-0.5 rounded border border-ethereal-amethyst/20"
                                  >
                                    {item.time}
                                  </Eyebrow>
                                  <div className="bg-ethereal-marble/5 p-4 rounded-xl border border-ethereal-incense/10 hover:bg-ethereal-marble/10 transition-colors shadow-glass-ethereal">
                                    <Text weight="bold" color="marble">
                                      {item.title}
                                    </Text>
                                    {item.description && (
                                      <Text
                                        size="sm"
                                        color="graphite"
                                        className="mt-1.5 leading-relaxed"
                                      >
                                        {item.description}
                                      </Text>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <Text size="sm" color="graphite" className="italic mt-6">
                          {t(
                            "schedule.card.no_run_sheet",
                            "Harmonogram dnia nie został jeszcze opublikowany przez menedżera.",
                          )}
                        </Text>
                      )}
                    </div>
                  </div>
                )}

                {activeSubTab === "SETLIST" && (
                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                    <div className="xl:col-span-2 xl:order-last">
                      {proj.spotify_playlist_url ? (
                        <SpotifyWidget
                          playlistUrl={proj.spotify_playlist_url}
                          theme="dark"
                        />
                      ) : (
                        <div className="bg-ethereal-marble/5 border border-ethereal-incense/10 rounded-2xl p-5 text-center flex flex-col items-center justify-center h-full min-h-37.5">
                          <Music
                            size={24}
                            className="text-ethereal-graphite/40 mb-2"
                            aria-hidden="true"
                          />
                          <Text size="sm" color="graphite" className="italic">
                            {t(
                              "schedule.card.no_spotify",
                              "Brak playlisty referencyjnej.",
                            )}
                          </Text>
                        </div>
                      )}
                    </div>

                    <div className="xl:col-span-3 space-y-4">
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
                                  "bg-ethereal-marble/5 border rounded-2xl overflow-hidden transition-all",
                                  isPieceExpanded
                                    ? "border-ethereal-sage/30"
                                    : "border-ethereal-incense/10 hover:border-ethereal-incense/20",
                                )}
                              >
                                <div
                                  onClick={() =>
                                    setExpandedPieceId(
                                      isPieceExpanded
                                        ? null
                                        : String(pi.piece),
                                    )
                                  }
                                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-ethereal-marble/5 transition-colors"
                                >
                                  <div className="flex items-center gap-4">
                                    <Eyebrow
                                      as="span"
                                      color="sage"
                                      className="opacity-50 w-6 text-center"
                                    >
                                      {idx + 1}.
                                    </Eyebrow>
                                    <div>
                                      <Text weight="bold" color="marble" size="md">
                                        {pi.piece_title}
                                      </Text>
                                      <Text
                                        size="sm"
                                        color="graphite"
                                        className="flex items-center gap-1.5 mt-0.5"
                                      >
                                        <Users size={12} aria-hidden="true" />
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
                                  {isPieceExpanded ? (
                                    <ChevronUp
                                      size={18}
                                      className="text-ethereal-sage"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <ChevronDown
                                      size={18}
                                      className="text-ethereal-graphite/50"
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>

                                <AnimatePresence>
                                  {isPieceExpanded && (
                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: "auto" }}
                                      exit={{ height: 0 }}
                                      className="overflow-hidden bg-ethereal-ink/40 border-t border-ethereal-incense/5"
                                    >
                                      <div className="p-4 md:p-6">
                                        {isCastingsLoading ? (
                                          <EtherealLoader fullHeight={false} />
                                        ) : populatedCastings.length > 0 ? (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
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
                                                className="space-y-3"
                                              >
                                                <Eyebrow
                                                  as="h5"
                                                  color="sage"
                                                  className="border-b border-ethereal-incense/10 pb-1.5 mb-2"
                                                >
                                                  {vl}
                                                </Eyebrow>
                                                <ul className="space-y-2">
                                                  {groupCastings.map(
                                                    (c: PopulatedPieceCasting) => {
                                                      const participationArtistId =
                                                        resolveParticipationArtistId(
                                                          c,
                                                        );
                                                      const isMe =
                                                        String(c.artist_id) ===
                                                          String(artistId) ||
                                                        participationArtistId ===
                                                          String(artistId);
                                                      const displayName =
                                                        c.artist_name ||
                                                        resolveParticipationArtistName(
                                                          c,
                                                        ) ||
                                                        t(
                                                          "schedule.card.unknown_artist",
                                                          "Artysta",
                                                        );

                                                      return (
                                                        <li
                                                          key={c.id}
                                                          className={cn(
                                                            "flex flex-col gap-1",
                                                            isMe &&
                                                              "bg-ethereal-marble/10 p-2 rounded-lg border border-ethereal-incense/10",
                                                          )}
                                                        >
                                                          <Text
                                                            as="span"
                                                            size="sm"
                                                            color={
                                                              isMe
                                                                ? "marble"
                                                                : "graphite"
                                                            }
                                                            weight={
                                                              isMe
                                                                ? "bold"
                                                                : "normal"
                                                            }
                                                            className="flex items-center gap-1.5"
                                                          >
                                                            {isMe && (
                                                              <span
                                                                className="w-2 h-2 bg-ethereal-sage rounded-full animate-pulse shadow-glass-ethereal shrink-0"
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
                                                              className="italic bg-ethereal-gold/10 px-1.5 py-0.5 rounded w-max"
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
                                            color="graphite"
                                            className="italic text-center py-4"
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
                          color="graphite"
                          className="text-center py-6"
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
