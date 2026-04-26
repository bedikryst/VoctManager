import React, { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Clock,
  Archive,
  Users,
  TrendingUp,
  UserMinus,
  ChevronRight,
} from "lucide-react";

import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "@/features/logistics/components/LocationPreview";
import { useRehearsalsData } from "./hooks/useRehearsalsData";
import { useLocationResolver } from "@/features/logistics/hooks/useLocationResolver";
import {
  formatLocalizedDate,
  formatLocalizedTime,
} from "@/shared/lib/time/intl";

import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { MetricBlock } from "@/shared/ui/composites/MetricBlock";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Caption,
  Eyebrow,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";
import { ArtistRow } from "./components/ArtistRow";

const VOICE_LABELS: Record<string, string> = {
  S: "rehearsals.voices.sopranos",
  A: "rehearsals.voices.altos",
  T: "rehearsals.voices.tenors",
  B: "rehearsals.voices.basses",
  M: "rehearsals.voices.mezzos",
  C: "rehearsals.voices.countertenors",
  BAR: "rehearsals.voices.baritones",
};

const VOICE_FALLBACKS: Record<string, string> = {
  S: "Soprany",
  A: "Alty",
  T: "Tenory",
  B: "Basy",
  M: "Mezzosoprany",
  C: "Kontratenory",
  BAR: "Barytony",
};

export default function Rehearsals(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    isLoading,
    isError,
    projectTab,
    setProjectTab,
    displayProjects,
    selectedProjectId,
    setSelectedProjectId,
    projectRehearsals,
    activeRehearsalId,
    setActiveRehearsalId,
    activeRehearsal,
    invitedParticipations,
    artistMap,
    attendanceMap,
    stats,
    isMarkingAll,
    handleMarkAllPresent,
  } = useRehearsalsData();

  const { getLocationName } = useLocationResolver();

  useEffect(() => {
    if (isError)
      toast.error(
        t("rehearsals.toast.sync_error_title", "Błąd synchronizacji"),
        {
          description: t(
            "rehearsals.toast.sync_error_desc",
            "Nie udało się załadować danych.",
          ),
        },
      );
  }, [isError, t]);

  const sectionalDetails = useMemo(() => {
    if (!activeRehearsal?.invited_participations?.length)
      return t("rehearsals.dashboard.tutti", "Tutti (Cały Zespół)");

    const voices = new Set<string>();
    invitedParticipations.forEach((p) => {
      const artist = artistMap.get(String(p.artist));
      if (artist?.voice_type)
        voices.add(artist.voice_type.charAt(0).toUpperCase());
    });

    const voiceDict: Record<string, string> = {
      S: t("rehearsals.voices.sopranos", "Soprany"),
      A: t("rehearsals.voices.altos", "Alty"),
      T: t("rehearsals.voices.tenors", "Tenory"),
      B: t("rehearsals.voices.basses", "Basy"),
      M: t("rehearsals.voices.mezzos", "Mezzosoprany"),
      C: t("rehearsals.voices.countertenors", "Kontratenory"),
      BAR: t("rehearsals.voices.baritones", "Barytony"),
    };

    const names = Array.from(voices).map((v) => voiceDict[v] ?? v);
    return `${t("rehearsals.dashboard.only", "Tylko:")} ${names.join(", ")}`;
  }, [activeRehearsal, invitedParticipations, artistMap, t]);

  const attendanceRateAccent =
    stats.rate >= 80 ? "gold" : stats.rate >= 50 ? "default" : "crimson";

  if (isLoading && displayProjects.length === 0) {
    return <EtherealLoader />;
  }

  return (
    <PageTransition>
      <div className="space-y-10 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <PageHeader
          size="dashboard"
          roleText={t("rehearsals.dashboard.subtitle", "Moduł Inspektora")}
          title={t("rehearsals.dashboard.title", "Dziennik")}
          titleHighlight={t(
            "rehearsals.dashboard.title_highlight",
            "Obecności",
          )}
        />

        {/* ── Project Context ──────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <SectionHeader
              title={t(
                "rehearsals.dashboard.project_context",
                "Kontekst Projektu",
              )}
              withFluidDivider={false}
              className="pb-0 mb-0"
            />

            <div className="flex items-center gap-1 p-1 rounded-2xl bg-ethereal-alabaster border border-ethereal-incense/15">
              {(["ACTIVE", "ARCHIVE"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setProjectTab(tab)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                    projectTab === tab
                      ? "bg-ethereal-marble shadow-glass-solid text-ethereal-ink border border-ethereal-incense/20"
                      : "text-ethereal-graphite hover:text-ethereal-ink"
                  }`}
                >
                  {tab === "ARCHIVE" && (
                    <Archive size={10} aria-hidden="true" />
                  )}
                  {tab === "ACTIVE"
                    ? t("rehearsals.tabs.active", "Aktywne")
                    : t("rehearsals.tabs.archive", "Archiwum")}
                </button>
              ))}
            </div>
          </div>

          <div className="relative group">
            <div className="flex overflow-x-auto gap-4 py-4 -my-4 no-scrollbar snap-x items-stretch">
              {displayProjects.length === 0 ? (
                <Caption className="italic">
                  {t(
                    "rehearsals.dashboard.no_projects",
                    "Brak projektów w tej zakładce.",
                  )}
                </Caption>
              ) : (
                displayProjects.map((project) => {
                  const isSelected = selectedProjectId === String(project.id);
                  return (
                    <GlassCard
                      key={project.id}
                      as="button"
                      onClick={() => setSelectedProjectId(String(project.id))}
                      variant={isSelected ? "solid" : "light"}
                      padding="sm"
                      animationEngine="css"
                      className={`snap-start w-[260px] sm:w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)] shrink-0 ${
                        isSelected ? "ring-1 ring-ethereal-gold/40" : ""
                      }`}
                    >
                      <Caption className="block mb-1.5 text-left">
                        {formatLocalizedDate(
                          project.date_time,
                          undefined,
                          undefined,
                          project.timezone,
                        )}
                      </Caption>
                      <Text
                        size="sm"
                        weight="semibold"
                        className="truncate block text-left"
                      >
                        {project.title}
                      </Text>
                    </GlassCard>
                  );
                })
              )}
            </div>
            {displayProjects.length > 4 && (
              <div className="absolute top-0 right-0 bottom-4 w-16 bg-gradient-to-l from-ethereal-alabaster to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-end pr-1">
                <ChevronRight className="text-ethereal-graphite/50 w-6 h-6" />
              </div>
            )}
          </div>
        </section>

        {/* ── Rehearsal Selector + Inspector ───────────────────── */}
        {selectedProjectId && projectRehearsals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="space-y-6"
          >
            {/* Time chips */}
            <div className="relative group">
              <div className="flex overflow-x-auto gap-4 py-4 -my-4 no-scrollbar snap-x items-stretch">
                {projectRehearsals.map((reh) => {
                  const isSelected =
                    String(activeRehearsalId) === String(reh.id);
                  const isPast = new Date(reh.date_time) < new Date();
                  return (
                    <GlassCard
                      key={reh.id}
                      as="button"
                      onClick={() => setActiveRehearsalId(String(reh.id))}
                      variant={isSelected ? "solid" : "light"}
                      padding="sm"
                      animationEngine="css"
                      className={`snap-start w-[200px] sm:w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)] shrink-0 text-left ${
                        isSelected ? "ring-1 ring-ethereal-gold/40" : ""
                      }`}
                    >
                      <Caption
                        color={isSelected ? "gold" : "muted"}
                        className="block mb-0.5"
                      >
                        {formatLocalizedDate(
                          reh.date_time,
                          { day: "numeric", month: "short" },
                          undefined,
                          reh.timezone,
                        )}
                      </Caption>
                      <Heading
                        as="p"
                        size="lg"
                        weight="bold"
                        color={isPast && !isSelected ? "graphite" : "default"}
                        className="leading-none mb-1"
                      >
                        {formatLocalizedTime(
                          reh.date_time,
                          { hour: "2-digit", minute: "2-digit" },
                          undefined,
                          reh.timezone,
                        )}
                      </Heading>
                      <Caption
                        color="muted"
                        className="truncate max-w-full block"
                      >
                        {getLocationName(
                          reh.location,
                          t("rehearsals.dashboard.no_location", "Brak lok."),
                        )}
                      </Caption>
                    </GlassCard>
                  );
                })}
              </div>
              {projectRehearsals.length > 4 && (
                <div className="absolute top-0 right-0 bottom-4 w-16 bg-gradient-to-l from-ethereal-alabaster to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-end pr-1">
                  <ChevronRight className="text-ethereal-graphite/50 w-6 h-6" />
                </div>
              )}
            </div>

            {/* Active rehearsal inspector */}
            {activeRehearsal && (
              <GlassCard variant="solid" padding="none" isHoverable={false}>
                {/* ── Inspector header ── */}
                <div className="p-6 md:p-8 border-b border-ethereal-incense/10">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <Badge
                          variant={
                            activeRehearsal.invited_participations?.length
                              ? "amethyst"
                              : "brand"
                          }
                        >
                          {activeRehearsal.invited_participations?.length
                            ? t(
                                "rehearsals.dashboard.sectional",
                                "Próba Sekcyjna",
                              )
                            : t(
                                "rehearsals.dashboard.tutti_badge",
                                "Próba Tutti",
                              )}
                        </Badge>
                        <Badge variant="neutral">{sectionalDetails}</Badge>
                      </div>

                      <Text
                        size="lg"
                        weight="semibold"
                        className="mb-5 leading-tight block"
                      >
                        {activeRehearsal.focus ??
                          t(
                            "rehearsals.dashboard.general_work",
                            "Praca Bieżąca",
                          )}
                      </Text>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ethereal-alabaster border border-ethereal-incense/15">
                          <Clock
                            size={12}
                            className="text-ethereal-gold shrink-0"
                            aria-hidden="true"
                          />
                          <Caption>
                            {formatLocalizedDate(
                              activeRehearsal.date_time,
                              {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                              },
                              undefined,
                              activeRehearsal.timezone,
                            )}
                          </Caption>
                        </div>

                        <div className="flex items-center px-3 py-1.5 rounded-xl bg-ethereal-alabaster border border-ethereal-incense/15">
                          <DualTimeDisplay
                            value={activeRehearsal.date_time}
                            timeZone={activeRehearsal.timezone}
                            className="border-none bg-transparent p-0"
                            typography="sans"
                            size="sm"
                          />
                        </div>

                        <LocationPreview
                          locationRef={activeRehearsal.location}
                          fallback={t(
                            "rehearsals.dashboard.no_location",
                            "Brak lok.",
                          )}
                          variant="minimal"
                        />
                      </div>
                    </div>

                    {/* Stats strip */}
                    <div className="flex flex-wrap bg-ethereal-alabaster rounded-2xl border border-ethereal-incense/15 overflow-hidden shrink-0 divide-x divide-ethereal-incense/10">
                      <MetricBlock
                        label={t("rehearsals.stats.rate", "Frekwencja")}
                        value={`${stats.rate}%`}
                        icon={<TrendingUp />}
                        accentColor={attendanceRateAccent}
                        className="px-6 py-4"
                      />
                      <MetricBlock
                        label={t("rehearsals.stats.present", "Obecni")}
                        value={stats.present + stats.late}
                        unit={`/ ${stats.total}`}
                        icon={<Users />}
                        className="px-6 py-4"
                      />
                      <MetricBlock
                        label={t("rehearsals.stats.absent", "Braki")}
                        value={stats.absent + stats.excused}
                        icon={<UserMinus />}
                        accentColor="crimson"
                        className="px-6 py-4"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Actions toolbar ── */}
                <div className="flex justify-end px-6 py-3 border-b border-ethereal-incense/10 bg-ethereal-marble/30">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleMarkAllPresent}
                    disabled={
                      isMarkingAll ||
                      invitedParticipations.length === 0 ||
                      stats.none === 0
                    }
                    isLoading={isMarkingAll}
                    leftIcon={
                      !isMarkingAll ? <CheckCircle2 size={15} /> : undefined
                    }
                  >
                    {t(
                      "rehearsals.dashboard.bulk_fill",
                      'Uzupełnij luki ({{count}}) jako "Obecny"',
                      { count: stats.none },
                    )}
                  </Button>
                </div>

                {/* ── Attendance roster ── */}
                <div className="overflow-x-hidden overflow-y-auto max-h-[60vh]">
                  {(["S", "A", "T", "B", "M", "C", "BAR"] as const).map(
                    (voiceGroup) => {
                      const groupParts = invitedParticipations.filter((p) => {
                        const artist = artistMap.get(String(p.artist));
                        if (!artist?.voice_type) return false;

                        // Handling "BAR" and others that might be longer than 1 char
                        if (voiceGroup === "BAR")
                          return artist.voice_type === "BAR";
                        if (voiceGroup === "M")
                          return artist.voice_type === "MEZ";
                        if (voiceGroup === "C")
                          return artist.voice_type === "CT";

                        return artist.voice_type.startsWith(voiceGroup);
                      });
                      if (groupParts.length === 0) return null;

                      return (
                        <div key={voiceGroup}>
                          <div className="sticky top-0 z-10 bg-ethereal-alabaster/95 backdrop-blur-sm px-6 py-2.5 border-b border-ethereal-incense/10">
                            <Eyebrow color="gold">
                              {t(
                                VOICE_LABELS[voiceGroup],
                                VOICE_FALLBACKS[voiceGroup],
                              )}
                            </Eyebrow>
                          </div>

                          <div className="flex flex-col">
                            {groupParts.map((part) => {
                              const artist = artistMap.get(String(part.artist));
                              if (!artist) return null;
                              return (
                                <ArtistRow
                                  key={part.id}
                                  part={part}
                                  artist={artist}
                                  existingRecord={attendanceMap.get(
                                    String(part.id),
                                  )}
                                  rehearsalId={activeRehearsal.id}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </GlassCard>
            )}
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
