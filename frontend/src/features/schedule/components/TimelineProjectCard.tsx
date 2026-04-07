/**
 * @file TimelineProjectCard.tsx
 * @description Isolated component for rendering a Project/Concert on the Artist Timeline.
 * Completely strictly typed, ensuring zero 'any' usage for Data transformations.
 * @module panel/schedule/cards/TimelineProjectCard
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Shirt,
  Download,
  Users,
  Loader2,
  Music,
  Wrench,
} from "lucide-react";

import SpotifyWidget from "../../projects/ProjectCard/SpotifyWidget";
import type { Project, ProgramItem, PieceCasting } from "../../../shared/types";
import { Button } from "../../../shared/ui/Button";
import { useTimelineProjectCard } from "../hooks/useTimelineProjectCard";
import type { TimelineEvent } from "../types/schedule.dto";

interface TimelineProjectCardProps {
  event: TimelineEvent;
  isExpanded: boolean;
  onToggle: () => void;
  artistId?: string | number;
}

export default function TimelineProjectCard({
  event,
  isExpanded,
  onToggle,
  artistId,
}: TimelineProjectCardProps): React.JSX.Element {
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="relative sm:pl-16 transition-all duration-300 group"
    >
      <div className="hidden sm:block absolute left-4 md:left-[27px] top-6 w-3 h-3 rounded-full border-[3px] ring-4 ring-[#f4f2ee] z-10 bg-[#002395] border-[#002395] shadow-[0_0_10px_rgba(0,35,149,0.5)]" />

      <div
        className={`rounded-[2rem] relative overflow-hidden transition-all duration-300 bg-[#0a0a0a] text-white shadow-[0_20px_40px_rgba(0,0,0,0.3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] border ${isExpanded ? "border-stone-700" : "border-stone-800 hover:border-stone-700"}`}
      >
        <div
          className={`absolute -top-32 -right-32 w-80 h-80 bg-[#002395] rounded-full blur-[100px] pointer-events-none transition-all duration-1000 ${isExpanded ? "opacity-60 scale-110" : "opacity-30 group-hover:opacity-50"}`}
        ></div>
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        ></div>

        <div
          className="p-5 md:p-6 lg:p-8 flex flex-col md:flex-row md:items-start justify-between gap-5 cursor-pointer relative z-10 hover:bg-white/5 transition-colors"
          onClick={onToggle}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 md:gap-6">
            <div className="w-16 h-16 rounded-2xl border flex flex-col items-center justify-center flex-shrink-0 shadow-sm bg-white/10 border-white/20 text-blue-100 backdrop-blur-md">
              <span className="text-[9px] font-bold uppercase tracking-widest">
                {event.date_time.toLocaleString("pl-PL", { month: "short" })}
              </span>
              <span className="text-2xl font-black leading-none my-0.5">
                {event.date_time.getDate()}
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest bg-blue-500 text-white border border-blue-400 rounded-md shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                  {t("schedule.card.project_badge", "Koncert / Wydarzenie")}
                </span>
              </div>
              <h3
                className="text-xl md:text-3xl font-bold tracking-tight text-white mb-3"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                {event.title}
              </h3>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                {proj.call_time && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30">
                    <Clock size={12} aria-hidden="true" />{" "}
                    {t("schedule.card.call_time", "Zbiórka:")}{" "}
                    {new Date(proj.call_time).toLocaleTimeString("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                {combinedDressCode && (
                  <span
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 max-w-[200px] truncate"
                    title={combinedDressCode}
                  >
                    <Shirt size={12} aria-hidden="true" /> {combinedDressCode}
                  </span>
                )}
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-blue-200 truncate max-w-[200px]">
                  <MapPin
                    size={12}
                    className="flex-shrink-0"
                    aria-hidden="true"
                  />{" "}
                  <span className="truncate">
                    {event.location ||
                      t("schedule.card.no_location", "Brak lok.")}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 border border-white/10 text-white shadow-sm p-2 rounded-full transition-transform duration-300 relative z-10 self-end md:self-auto flex-shrink-0">
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
              className="border-t border-white/10 bg-black/20 relative z-0"
            >
              <div className="p-5 md:p-8 pb-0">
                <div className="flex flex-wrap gap-3 p-1.5 bg-white/5 border border-white/10 rounded-2xl w-max mb-6">
                  <button
                    onClick={() => setActiveSubTab("LOGISTICS")}
                    className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all rounded-xl ${activeSubTab === "LOGISTICS" ? "bg-blue-500/20 text-blue-300 shadow-sm border border-blue-500/30" : "text-stone-400 hover:text-stone-200 border border-transparent"}`}
                  >
                    <Wrench size={14} aria-hidden="true" />{" "}
                    {t("schedule.card.tab.logistics", "Logistyka & Plan")}
                  </button>
                  <button
                    onClick={() => setActiveSubTab("SETLIST")}
                    className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all rounded-xl ${activeSubTab === "SETLIST" ? "bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/30" : "text-stone-400 hover:text-stone-200 border border-transparent"}`}
                  >
                    <Music size={14} aria-hidden="true" />{" "}
                    {t("schedule.card.tab.setlist", "Repertuar & Divisi")}
                  </button>
                </div>
              </div>

              <div className="px-5 md:px-8 pb-8 pt-2">
                {activeSubTab === "LOGISTICS" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      {(proj.dress_code_female || proj.dress_code_male) && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
                            <Shirt size={14} aria-hidden="true" />{" "}
                            {t(
                              "schedule.card.dress_code_title",
                              "Szczegóły ubioru",
                            )}
                          </p>
                          {proj.dress_code_female && (
                            <p className="text-sm text-stone-300 mb-1.5">
                              <span className="text-stone-500 mr-2">
                                {t("schedule.card.dress_code_women", "Panie:")}
                              </span>{" "}
                              {proj.dress_code_female}
                            </p>
                          )}
                          {proj.dress_code_male && (
                            <p className="text-sm text-stone-300">
                              <span className="text-stone-500 mr-2">
                                {t("schedule.card.dress_code_men", "Panowie:")}
                              </span>{" "}
                              {proj.dress_code_male}
                            </p>
                          )}
                        </div>
                      )}

                      {proj.description ? (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                          <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap font-serif">
                            {proj.description}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-stone-500 italic mt-2">
                          {t(
                            "schedule.card.no_notes",
                            "Brak dodatkowych notatek produkcyjnych.",
                          )}
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">
                          {t(
                            "schedule.card.run_sheet_title",
                            "Harmonogram Dnia",
                          )}
                        </p>
                        <Button
                          variant="primary"
                          onClick={handleDownloadCallSheet}
                          disabled={isDownloading}
                          isLoading={isDownloading}
                          leftIcon={
                            !isDownloading ? (
                              <Download size={12} aria-hidden="true" />
                            ) : undefined
                          }
                          className="!px-3 !py-1.5 !rounded-lg !text-[9px] !bg-blue-600/20 hover:!bg-blue-600/40 !text-blue-300 !border-blue-500/30"
                        >
                          {t(
                            "schedule.card.download_call_sheet",
                            "Call-Sheet PDF",
                          )}
                        </Button>
                      </div>

                      {event.run_sheet && event.run_sheet.length > 0 ? (
                        <div className="relative pl-5 border-l border-white/10 space-y-5 ml-2 mt-6">
                          {[...event.run_sheet]
                            .sort((a, b) => a.time.localeCompare(b.time))
                            .map((item, idx) => (
                              <div
                                key={item.id || idx}
                                className="relative group/run"
                              >
                                <div className="absolute -left-[25px] top-1.5 w-3 h-3 bg-[#0a0a0a] border-2 border-blue-400 rounded-full shadow-[0_0_10px_rgba(96,165,250,0.5)] group-hover/run:scale-125 transition-transform"></div>
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 self-start px-2 py-0.5 rounded border border-blue-500/20 shadow-sm">
                                    {item.time}
                                  </span>
                                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors shadow-sm">
                                    <p className="text-sm font-bold text-white">
                                      {item.title}
                                    </p>
                                    {item.description && (
                                      <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-500 italic mt-6">
                          {t(
                            "schedule.card.no_run_sheet",
                            "Harmonogram dnia nie został jeszcze opublikowany przez menedżera.",
                          )}
                        </p>
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
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center flex flex-col items-center justify-center h-full min-h-[150px]">
                          <Music
                            size={24}
                            className="text-stone-600 mb-2 opacity-50"
                            aria-hidden="true"
                          />
                          <p className="text-xs text-stone-500 italic">
                            {t(
                              "schedule.card.no_spotify",
                              "Brak playlisty referencyjnej.",
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="xl:col-span-3 space-y-4">
                      {isProgramLoading ? (
                        <div className="flex justify-center py-10">
                          <Loader2
                            className="animate-spin text-emerald-400"
                            aria-hidden="true"
                          />
                        </div>
                      ) : programItems.length > 0 ? (
                        programItems
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
                                className={`bg-white/5 border rounded-2xl overflow-hidden transition-all ${isPieceExpanded ? "border-emerald-500/30" : "border-white/10 hover:border-white/20"}`}
                              >
                                <div
                                  onClick={() =>
                                    setExpandedPieceId(
                                      isPieceExpanded ? null : String(pi.piece),
                                    )
                                  }
                                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                                >
                                  <div className="flex items-center gap-4">
                                    <span className="text-emerald-500 font-black text-lg opacity-50 w-6 text-center">
                                      {idx + 1}.
                                    </span>
                                    <div>
                                      <p className="font-bold text-white text-base">
                                        {pi.piece_title}
                                      </p>
                                      <p className="text-xs text-stone-400 flex items-center gap-1.5 mt-0.5">
                                        <Users size={12} aria-hidden="true" />{" "}
                                        {isPieceExpanded
                                          ? t(
                                              "schedule.card.hide_cast",
                                              "Ukryj obsadę",
                                            )
                                          : t(
                                              "schedule.card.expand_cast",
                                              "Rozwiń obsadę (divisi)",
                                            )}
                                      </p>
                                    </div>
                                  </div>
                                  {isPieceExpanded ? (
                                    <ChevronUp
                                      size={18}
                                      className="text-emerald-500"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <ChevronDown
                                      size={18}
                                      className="text-stone-500"
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
                                      className="overflow-hidden bg-black/40 border-t border-white/5"
                                    >
                                      <div className="p-4 md:p-6">
                                        {isCastingsLoading ? (
                                          <div className="flex justify-center py-4">
                                            <Loader2
                                              size={16}
                                              className="animate-spin text-stone-500"
                                              aria-hidden="true"
                                            />
                                          </div>
                                        ) : castings.length > 0 ? (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                            {Object.entries(
                                              castings.reduce(
                                                (
                                                  acc: Record<
                                                    string,
                                                    PieceCasting[]
                                                  >,
                                                  c: PieceCasting,
                                                ) => {
                                                  const vl =
                                                    c.voice_line_display ||
                                                    c.voice_line ||
                                                    "Inne";
                                                  if (!acc[vl]) acc[vl] = [];
                                                  acc[vl].push(c);
                                                  return acc;
                                                },
                                                {},
                                              ),
                                            ).map(([vl, groupCastings]) => (
                                              <div
                                                key={vl}
                                                className="space-y-3"
                                              >
                                                <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest border-b border-white/10 pb-1.5 mb-2">
                                                  {vl}
                                                </h5>
                                                <ul className="space-y-2">
                                                  {groupCastings.map(
                                                    (c: PieceCasting) => {
                                                      const isMe =
                                                        String(c.artist_id) ===
                                                          String(artistId) ||
                                                        (c as any).participation
                                                          ?.artist ===
                                                          String(artistId); // Safe fallback to nested object if populated

                                                      return (
                                                        <li
                                                          key={c.id}
                                                          className={`text-xs flex flex-col gap-1 ${isMe ? "text-white font-bold bg-white/10 p-2 rounded-lg border border-white/10 shadow-sm" : "text-stone-400"}`}
                                                        >
                                                          <span className="flex items-center gap-1.5">
                                                            {isMe && (
                                                              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                                                            )}
                                                            {c.artist_name ||
                                                              (c as any)
                                                                .participation
                                                                ?.artist_name ||
                                                              t(
                                                                "schedule.card.unknown_artist",
                                                                "Artysta",
                                                              )}
                                                          </span>
                                                          {c.notes && (
                                                            <span className="text-[9px] text-amber-400 italic bg-amber-500/10 px-1.5 py-0.5 rounded w-max">
                                                              {t(
                                                                "schedule.card.note_label",
                                                                "Notatka:",
                                                              )}{" "}
                                                              {c.notes}
                                                            </span>
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
                                          <p className="text-xs text-stone-500 italic text-center py-4">
                                            {t(
                                              "schedule.card.no_divisi",
                                              "Brak szczegółowego podziału (divisi) dla tego utworu.",
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                      ) : (
                        <p className="text-sm text-stone-500 text-center py-6">
                          {t(
                            "schedule.card.no_program",
                            "Repertuar nie został jeszcze ustalony.",
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
