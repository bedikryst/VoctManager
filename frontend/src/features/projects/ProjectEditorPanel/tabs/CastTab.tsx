/**
 * @file CastTab.tsx
 * @description Primary Casting Manager Module for Vocal Assignments.
 * Implements absolute DOM continuity via Unified AnimatePresence preventing cross-list visual popping.
 * Delegates caching and mutation state exclusively to the useCastTab hook.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/CastTab
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
import { motion, AnimatePresence } from "framer-motion";

import type { Artist, ParticipationStatus } from "@/shared/types";
import { Input } from "@/shared/ui/primitives/Input";
import { Button } from "@/shared/ui/primitives/Button";
import { Badge } from "@/shared/ui/primitives/Badge";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
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

    return (
      <motion.div
        layoutId={`artist-card-${artist.id}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
        layout="position"
        className="mb-2"
      >
        <GlassCard
          variant="solid"
          padding="sm"
          isHoverable={false}
          className={cn(
            "flex flex-col justify-between gap-4 sm:flex-row sm:items-center",
            isDeclined && "border-ethereal-crimson/30 bg-ethereal-crimson/5",
            isPending && "opacity-70",
          )}
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <Text weight="bold" size="sm">
                {artist.first_name} {artist.last_name}
              </Text>
              <Badge
                variant={
                  isDeclined ? "danger" : isAssigned ? "warning" : "neutral"
                }
              >
                {artist.voice_type
                  ? t(`dashboard.layout.roles.${artist.voice_type}`)
                  : artist.voice_type_display || artist.voice_type || "?"}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {(artist.vocal_range_bottom || artist.vocal_range_top) && (
                <div className="flex items-center gap-1">
                  <MicVocal
                    size={12}
                    className="text-ethereal-gold/60"
                    aria-hidden="true"
                  />
                  <Eyebrow color="muted">
                    {artist.vocal_range_bottom || "?"} -{" "}
                    {artist.vocal_range_top || "?"}
                  </Eyebrow>
                </div>
              )}
              {artist.sight_reading_skill && (
                <div className="flex items-center gap-1">
                  <BookOpen
                    size={12}
                    className="text-ethereal-gold/60"
                    aria-hidden="true"
                  />
                  <Eyebrow color="muted">
                    {t("projects.cast.card.a_vista", "A vista:")}{" "}
                    {artist.sight_reading_skill}/5
                  </Eyebrow>
                </div>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant={isAssigned ? "destructive" : "primary"}
            size="sm"
            disabled={isProcessing}
            isLoading={isProcessing}
            onClick={() =>
              onToggle(String(artist.id), isAssigned, participationId)
            }
            leftIcon={
              isAssigned ? (
                <Trash2 size={14} aria-hidden="true" />
              ) : (
                <UserPlus size={14} aria-hidden="true" />
              )
            }
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
        </GlassCard>
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

  const unassignedCount = allArtists.filter(
    (artist) => !assignedIds.has(String(artist.id)),
  ).length;

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col">
      <div className="mb-6 flex shrink-0 flex-col gap-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="flex items-center gap-3">
            <GlassCard
              variant="light"
              padding="sm"
              isHoverable={false}
              className="flex h-10 w-10 items-center justify-center"
            >
              <Users
                size={18}
                className="text-ethereal-gold"
                aria-hidden="true"
              />
            </GlassCard>
            <div>
              <Eyebrow color="default">
                {t("projects.cast.header.title", "Casting Główny")}
              </Eyebrow>
              <Text size="xs" color="muted">
                {t(
                  "projects.cast.header.subtitle",
                  "Zarządzaj wokalistami. Ustawienie [scrollbar-gutter] neutralizuje skoki układu.",
                )}
              </Text>
            </div>
          </div>

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

        <GlassCard
          variant="light"
          padding="none"
          isHoverable={false}
          className="flex overflow-hidden p-1 md:hidden"
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

      <AnimatePresence mode="popLayout" initial={false}>
        <div className="grid flex-1 min-h-0 w-full grid-cols-1 gap-6 overflow-hidden pb-8 md:grid-cols-2 md:gap-8">
          <motion.div
            key="available-list"
            layoutId="available-list-container"
            className={`h-full flex-1 min-h-0 flex-col [scrollbar-gutter:stable] ${
              mobileView === "AVAILABLE" ? "flex" : "hidden md:flex"
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-2">
              <Eyebrow color="muted">
                {t("projects.cast.sections.available", "Baza Artystów")}
              </Eyebrow>
              <Badge variant="neutral">{unassignedCount}</Badge>
            </div>

            <GlassCard
              variant="light"
              padding="sm"
              isHoverable={false}
              className=" flex flex-col min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
            >
              {allArtists
                .filter((artist) => !assignedIds.has(String(artist.id)))
                .map((artist) => (
                  <ArtistCard
                    key={artist.id}
                    artist={artist}
                    isAssigned={false}
                    isProcessing={processingId === String(artist.id)}
                    onToggle={toggleCasting}
                  />
                ))}
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
          </motion.div>

          <motion.div
            key="assigned-list"
            layoutId="assigned-list-container"
            className={`flex-col flex-1 min-h-0 h-full [scrollbar-gutter:stable] ${
              mobileView === "ASSIGNED" ? "flex" : "hidden md:flex"
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
              <Badge variant="warning">{participations.length}</Badge>
            </div>

            <GlassCard
              variant="light"
              padding="sm"
              isHoverable={false}
              className=" flex-1 flex-col min-h-0 overflow-y-auto overflow-x-hidden border-ethereal-gold/20 bg-ethereal-gold/5 [scrollbar-gutter:stable]"
            >
              {allArtists
                .filter((artist) => assignedIds.has(String(artist.id)))
                .map((artist) => {
                  const participation = participations.find(
                    (p) => String(p.artist) === String(artist.id),
                  );
                  return (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      isAssigned={true}
                      participationId={participation?.id}
                      participationStatus={participation?.status}
                      isProcessing={processingId === String(artist.id)}
                      onToggle={toggleCasting}
                    />
                  );
                })}
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
          </motion.div>
        </div>
      </AnimatePresence>
    </div>
  );
};
