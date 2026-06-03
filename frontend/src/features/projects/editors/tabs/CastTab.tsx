/**
 * @file CastTab.tsx
 * @description Primary Casting Manager Module for Vocal Assignments.
 * Implements absolute DOM continuity via Unified AnimatePresence preventing cross-list visual popping.
 * Delegates caching and mutation state exclusively to the useCastTab hook.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/CastTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  MicVocal,
  BookOpen,
  Users,
  Search,
  UserCheck,
  UserPlus,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";

import type { Artist, ParticipationStatus } from "@/shared/types";
import { Input } from "@/shared/ui/primitives/Input";
import { Button } from "@/shared/ui/primitives/Button";
import { Badge } from "@/shared/ui/primitives/Badge";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { AutosaveStatus } from "@/shared/ui/composites/AutosaveStatus";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { useCastTab } from "../hooks/useCastTab";

interface CastTabProps {
  projectId: string;
}

interface ArtistCardProps {
  artist: Artist;
  isAssigned: boolean;
  participationId?: string;
  participationStatus?: ParticipationStatus;
  isProcessing: boolean;
  onToggle: (artistId: string, isAssigned: boolean, partId?: string) => void;
}

const VOICE_ORDER: readonly string[] = ["S", "M", "A", "C", "T", "BAR", "B"];

interface VoiceGroup {
  readonly key: string;
  readonly artists: Artist[];
}

/** Buckets an already voice-sorted artist list into ordered SATB sections. */
const groupArtistsByVoice = (list: Artist[]): VoiceGroup[] => {
  const groups = new Map<string, Artist[]>();
  for (const artist of list) {
    const key = artist.voice_type || "?";
    const bucket = groups.get(key);
    if (bucket) bucket.push(artist);
    else groups.set(key, [artist]);
  }

  const rank = (key: string): number => {
    const index = VOICE_ORDER.indexOf(key);
    return index === -1 ? VOICE_ORDER.length : index;
  };

  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([key, artists]) => ({ key, artists }));
};

const ArtistCard = React.memo(
  ({
    artist,
    isAssigned,
    participationId,
    participationStatus,
    isProcessing,
    onToggle,
  }: ArtistCardProps) => {
    const { t } = useTranslation();

    const isDeclined = isAssigned && participationStatus === "DEC";
    const isPending = isAssigned && participationStatus === "INV";

    const voiceInitial = artist.voice_type
      ? t(`dashboard.layout.roles.${artist.voice_type}`).substring(0, 1)
      : artist.voice_type_display?.substring(0, 1) || "?";

    return (
      <motion.div
        layoutId={`artist-card-${artist.id}`}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
        layout="position"
        className="mb-1.5"
      >
        <div
          className={cn(
            "group flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
            isDeclined
              ? "border-ethereal-crimson/30 bg-ethereal-crimson/5"
              : "border-ethereal-ink/6 bg-ethereal-marble hover:border-ethereal-gold/30",
            isPending && "opacity-70",
          )}
        >
          <span
            className={cn(
              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[10px] font-bold uppercase",
              isAssigned
                ? "border-ethereal-gold/30 bg-ethereal-gold/10 text-ethereal-gold"
                : "border-ethereal-ink/8 bg-ethereal-alabaster text-ethereal-graphite/70",
            )}
            aria-hidden="true"
          >
            {voiceInitial}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Text
                size="sm"
                weight="semibold"
                truncate
                className={isDeclined ? "text-ethereal-crimson" : undefined}
              >
                {artist.first_name} {artist.last_name}
              </Text>
              {isDeclined && (
                <Badge variant="danger">
                  {t("projects.cast.card.declined", "Odmowa")}
                </Badge>
              )}
              {isPending && (
                <Badge variant="warning">
                  {t("projects.cast.card.pending", "Zaproszony")}
                </Badge>
              )}
            </div>

            {(artist.vocal_range_bottom ||
              artist.vocal_range_top ||
              artist.sight_reading_skill) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                {(artist.vocal_range_bottom || artist.vocal_range_top) && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ethereal-graphite/55">
                    <MicVocal
                      size={11}
                      className="text-ethereal-gold/50"
                      aria-hidden="true"
                    />
                    {artist.vocal_range_bottom || "?"}–
                    {artist.vocal_range_top || "?"}
                  </span>
                )}
                {artist.sight_reading_skill && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ethereal-graphite/55">
                    <BookOpen
                      size={11}
                      className="text-ethereal-gold/50"
                      aria-hidden="true"
                    />
                    {t("projects.cast.card.a_vista", "A vista:")}{" "}
                    {artist.sight_reading_skill}/5
                  </span>
                )}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant={isAssigned ? "ghost" : "secondary"}
            size="sm"
            disabled={isProcessing}
            isLoading={isProcessing}
            onClick={() =>
              onToggle(String(artist.id), isAssigned, participationId)
            }
            leftIcon={
              isAssigned ? (
                <Trash2 size={13} aria-hidden="true" />
              ) : (
                <UserPlus size={13} aria-hidden="true" />
              )
            }
            className={cn(
              "shrink-0",
              isAssigned &&
                "text-ethereal-crimson/70 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson",
            )}
            aria-label={
              isAssigned
                ? t("projects.cast.card.remove_aria", "Usuń z obsady", {
                    name: artist.first_name,
                  })
                : t("projects.cast.card.add_aria", "Dodaj do obsady", {
                    name: artist.first_name,
                  })
            }
          >
            {isAssigned
              ? t("projects.cast.card.remove", "Usuń")
              : t("projects.cast.card.add", "Dodaj")}
          </Button>
        </div>
      </motion.div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.artist.id === nextProps.artist.id &&
    prevProps.isAssigned === nextProps.isAssigned &&
    prevProps.isProcessing === nextProps.isProcessing &&
    prevProps.participationId === nextProps.participationId &&
    prevProps.participationStatus === nextProps.participationStatus,
);

ArtistCard.displayName = "ArtistCard";

export const CastTab = ({
  projectId,
}: CastTabProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const {
    participations,
    searchQuery,
    setSearchQuery,
    processingId,
    mobileView,
    setMobileView,
    allArtists,
    assignedIds,
    toggleCasting,
  } = useCastTab(projectId);

  const availableArtists = allArtists.filter(
    (artist) => !assignedIds.has(String(artist.id)),
  );
  const assignedArtists = allArtists.filter((artist) =>
    assignedIds.has(String(artist.id)),
  );
  const availableGroups = groupArtistsByVoice(availableArtists);
  const assignedGroups = groupArtistsByVoice(assignedArtists);
  const unassignedCount = availableArtists.length;

  const voiceLabel = (key: string): string =>
    key === "?"
      ? t("projects.cast.voice_unknown", "Bez głosu")
      : t(`dashboard.layout.roles.${key}`, key);

  const renderGroup = (
    group: VoiceGroup,
    assigned: boolean,
  ): React.JSX.Element => (
    <div key={group.key} className="mb-2 last:mb-0">
      <div className="sticky top-0 z-10 mb-1 flex items-center justify-between rounded-lg bg-ethereal-alabaster/85 px-2 py-1 backdrop-blur-sm">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ethereal-graphite/55">
          {voiceLabel(group.key)}
        </span>
        <span className="text-[10px] font-bold tabular-nums text-ethereal-graphite/40">
          {group.artists.length}
        </span>
      </div>
      {group.artists.map((artist) => {
        const participation = assigned
          ? participations.find((p) => String(p.artist) === String(artist.id))
          : undefined;
        return (
          <ArtistCard
            key={artist.id}
            artist={artist}
            isAssigned={assigned}
            participationId={participation?.id}
            participationStatus={participation?.status}
            isProcessing={processingId === String(artist.id)}
            onToggle={toggleCasting}
          />
        );
      })}
    </div>
  );

  return (
    <div className="flex w-full flex-col">
      <div className="mb-5 flex shrink-0 justify-end">
        <div className="w-full md:w-80">
          <Input
            type="text"
            placeholder={t(
              "projects.cast.search_placeholder",
              "Szukaj artysty...",
            )}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            leftIcon={<Search size={16} aria-hidden="true" />}
          />
        </div>
      </div>

      <div className="mb-6 flex shrink-0 flex-col gap-4 lg:hidden">
        <GlassCard
          variant="light"
          padding="none"
          isHoverable={false}
          className="flex overflow-hidden p-1"
        >
          <Button
            type="button"
            variant={mobileView === "AVAILABLE" ? "primary" : "ghost"}
            size="sm"
            fullWidth
            onClick={() => setMobileView("AVAILABLE")}
            className="rounded-lg"
          >
            {t("projects.cast.mobile.available", "Baza")} ({unassignedCount})
          </Button>
          <Button
            type="button"
            variant={mobileView === "ASSIGNED" ? "primary" : "ghost"}
            size="sm"
            fullWidth
            onClick={() => setMobileView("ASSIGNED")}
            className="rounded-lg"
          >
            {t("projects.cast.mobile.assigned", "Obsada")} (
            {participations.length})
          </Button>
        </GlassCard>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 pb-8 lg:grid-cols-2 lg:gap-8 lg:items-start">
          <div
            className={`flex-col ${
              mobileView === "AVAILABLE" ? "flex" : "hidden lg:flex"
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-2">
              <Eyebrow color="muted">
                {t("projects.cast.sections.available", "Baza Artystów")}
              </Eyebrow>
              <Badge variant="neutral">{unassignedCount}</Badge>
            </div>

            <GlassCard
              variant="solid"
              padding="sm"
              isHoverable={false}
              className="max-h-[70dvh] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
            >
              {availableGroups.map((group) => renderGroup(group, false))}
              {unassignedCount === 0 && (
                <div className="flex h-full min-h-0 flex-col items-center justify-center p-6 text-center opacity-60">
                  <Users
                    size={24}
                    className="mb-2 text-ethereal-graphite/40"
                    aria-hidden="true"
                  />
                  <Eyebrow color="muted">
                    {t("projects.cast.empty_available", "Brak dostępnych")}
                  </Eyebrow>
                </div>
              )}
            </GlassCard>
          </div>

          <div
            className={`flex-col ${
              mobileView === "ASSIGNED" ? "flex" : "hidden lg:flex"
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-2">
              <div className="flex items-center gap-1.5">
                <UserCheck
                  size={14}
                  className="text-ethereal-gold"
                  aria-hidden="true"
                />
                <Eyebrow color="gold">
                  {t("projects.cast.sections.assigned", "Obsada Projektu")}
                </Eyebrow>
              </div>
              <Badge variant="neutral">{participations.length}</Badge>
            </div>

            <GlassCard
              variant="solid"
              padding="sm"
              isHoverable={false}
              className="max-h-[70dvh] overflow-y-auto overflow-x-hidden border-ethereal-gold/25 [scrollbar-gutter:stable]"
            >
              {assignedGroups.map((group) => renderGroup(group, true))}
              {participations.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center opacity-60">
                  <UserCheck
                    size={24}
                    className="mb-2 text-ethereal-graphite/40"
                    aria-hidden="true"
                  />
                  <Eyebrow color="muted">
                    {t("projects.cast.empty_assigned", "Obsada jest pusta")}
                  </Eyebrow>
                </div>
              )}
            </GlassCard>
          </div>
        </div>

      <AutosaveStatus isSaving={processingId !== null} />
    </div>
  );
};
