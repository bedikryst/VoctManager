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
  Loader2,
  Search,
  UserCheck,
  UserPlus,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import type { Artist } from "@/shared/types";
import { Input } from "@/shared/ui/primitives/Input";
import { useCastTab } from "../hooks/useCastTab";

interface CastTabProps {
  projectId: string;
}

const STYLE_LIST_CONTAINER =
  "flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] bg-white/40 backdrop-blur-md border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl p-2";

interface ArtistCardProps {
  artist: Artist;
  isAssigned: boolean;
  participationId?: string;
  isProcessing: boolean;
  onToggle: (artistId: string, isAssigned: boolean, partId?: string) => void;
}

const ArtistCard = React.memo(
  ({
    artist,
    isAssigned,
    participationId,
    isProcessing,
    onToggle,
  }: ArtistCardProps) => {
    const { t } = useTranslation();

    return (
      <motion.div
        layoutId={`artist-card-${artist.id}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
        layout="position"
        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-stone-200/60 rounded-xl mb-2 shadow-sm gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <p className="font-bold text-sm tracking-tight text-stone-900">
              {artist.first_name} {artist.last_name}
            </p>
            <span
              className={`text-[8px] font-bold antialiased uppercase tracking-[0.2em] px-2 py-0.5 rounded-md border ${isAssigned ? "bg-blue-50 text-brand border-blue-100" : "bg-stone-50 text-stone-500 border-stone-200/60"}`}
            >
              {artist.voice_type_display || artist.voice_type || "?"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">
            {(artist.vocal_range_bottom || artist.vocal_range_top) && (
              <span className="flex items-center gap-1">
                <MicVocal
                  size={12}
                  className="text-brand/40"
                  aria-hidden="true"
                />
                <span>
                  <strong className="text-stone-600">
                    {artist.vocal_range_bottom || "?"} -{" "}
                    {artist.vocal_range_top || "?"}
                  </strong>
                </span>
              </span>
            )}
            {artist.sight_reading_skill && (
              <span className="flex items-center gap-1">
                <BookOpen
                  size={12}
                  className="text-brand/40"
                  aria-hidden="true"
                />
                <span>
                  {t("projects.cast.card.a_vista", "A vista:")}{" "}
                  <strong className="text-stone-600">
                    {artist.sight_reading_skill}/5
                  </strong>
                </span>
              </span>
            )}
          </div>
        </div>

        <button
          disabled={isProcessing}
          onClick={() =>
            onToggle(String(artist.id), isAssigned, participationId)
          }
          className={`flex justify-center items-center p-2.5 sm:px-4 sm:py-2.5 rounded-lg text-[9px] uppercase font-bold antialiased tracking-widest transition-all shadow-sm active:scale-95 disabled:opacity-50 flex-shrink-0 ${
            isAssigned
              ? "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
              : "bg-stone-900 border border-stone-800 text-white hover:bg-brand hover:border-brand-dark"
          }`}
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
          {isProcessing ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : isAssigned ? (
            <>
              <Trash2 size={14} className="sm:mr-1.5" aria-hidden="true" />{" "}
              <span className="hidden sm:inline">
                {t("projects.cast.card.remove", "Usuń")}
              </span>
            </>
          ) : (
            <>
              <UserPlus size={14} className="sm:mr-1.5" aria-hidden="true" />{" "}
              <span className="hidden sm:inline">
                {t("projects.cast.card.add", "Dodaj")}
              </span>
            </>
          )}
        </button>
      </motion.div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.artist.id === nextProps.artist.id &&
    prevProps.isAssigned === nextProps.isAssigned &&
    prevProps.isProcessing === nextProps.isProcessing &&
    prevProps.participationId === nextProps.participationId,
);

ArtistCard.displayName = "ArtistCard";
export default function CastTab({
  projectId,
}: CastTabProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const {
    participations,
    isFetching,
    searchQuery,
    setSearchQuery,
    processingId,
    mobileView,
    setMobileView,
    allArtists,
    assignedIds,
    toggleCasting,
  } = useCastTab(projectId);

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[80vh]">
      <div className="mb-6 space-y-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm">
              <Users size={18} className="text-brand" aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-[12px] font-bold antialiased uppercase tracking-widest text-stone-800">
                {t("projects.cast.header.title", "Casting Główny")}
              </h4>
              <p className="text-[10px] text-stone-500 font-medium">
                {t(
                  "projects.cast.header.subtitle",
                  "Zarządzaj wokalistami. Ustawienie [scrollbar-gutter] neutralizuje skoki układu.",
                )}
              </p>
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
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={
                <Search
                  size={16}
                  className="text-stone-400"
                  aria-hidden="true"
                />
              }
            />
          </div>
        </div>

        <div className="md:hidden flex bg-white/60 p-1 rounded-xl border border-stone-200/60 shadow-sm">
          <button
            onClick={() => setMobileView("AVAILABLE")}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${mobileView === "AVAILABLE" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
          >
            {t("projects.cast.mobile.available", "Baza")} (
            {allArtists.filter((a) => !assignedIds.has(String(a.id))).length})
          </button>
          <button
            onClick={() => setMobileView("ASSIGNED")}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${mobileView === "ASSIGNED" ? "bg-brand text-white shadow-sm" : "text-stone-500"}`}
          >
            {t("projects.cast.mobile.assigned", "Obsada")} (
            {participations.length})
          </button>
        </div>
      </div>

      {isFetching ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2
            size={32}
            className="animate-spin text-brand/40"
            aria-hidden="true"
          />
        </div>
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 overflow-hidden pb-8">
            <motion.div
              key="available-list"
              layoutId="available-list-container"
              className={`flex-col h-full [scrollbar-gutter:stable] ${mobileView === "AVAILABLE" ? "flex" : "hidden md:flex"}`}
            >
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
                  {t("projects.cast.sections.available", "Baza Artystów")}
                </span>
                <span className="text-[9px] font-bold antialiased text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                  {
                    allArtists.filter((a) => !assignedIds.has(String(a.id)))
                      .length
                  }
                </span>
              </div>

              <div className={STYLE_LIST_CONTAINER}>
                {allArtists
                  .filter((a) => !assignedIds.has(String(a.id)))
                  .map((artist) => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      isAssigned={false}
                      isProcessing={processingId === String(artist.id)}
                      onToggle={toggleCasting}
                    />
                  ))}
                {allArtists.filter((a) => !assignedIds.has(String(a.id)))
                  .length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-60 p-6">
                    <Users
                      size={24}
                      className="text-stone-400 mb-2"
                      aria-hidden="true"
                    />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-stone-500">
                      {t("projects.cast.empty_available", "Brak dostępnych")}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              key="assigned-list"
              layoutId="assigned-list-container"
              className={`flex-col h-full [scrollbar-gutter:stable] ${mobileView === "ASSIGNED" ? "flex" : "hidden md:flex"}`}
            >
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-brand flex items-center gap-1.5">
                  <UserCheck size={14} aria-hidden="true" />{" "}
                  {t("projects.cast.sections.assigned", "Obsada Projektu")}
                </span>
                <span className="text-[9px] font-bold antialiased text-brand bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                  {participations.length}
                </span>
              </div>

              <div
                className={`${STYLE_LIST_CONTAINER} border-brand/20 bg-blue-50/10`}
              >
                {allArtists
                  .filter((a) => assignedIds.has(String(a.id)))
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
                        isProcessing={processingId === String(artist.id)}
                        onToggle={toggleCasting}
                      />
                    );
                  })}
                {participations.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-60 p-6">
                    <UserCheck
                      size={24}
                      className="text-stone-400 mb-2"
                      aria-hidden="true"
                    />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-stone-500">
                      {t("projects.cast.empty_assigned", "Obsada jest pusta")}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
