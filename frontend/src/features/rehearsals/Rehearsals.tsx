/**
 * @file Rehearsals.tsx
 * @description Master Attendance Log and Inspector Dashboard view.
 * @module panel/Rehearsals
 */

import React, { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  MapPin,
  CheckCircle2,
  Loader2,
  CheckSquare,
  Clock,
  Briefcase,
  Archive,
} from "lucide-react";

import { useRehearsalsData } from "./hooks/useRehearsalsData";
import { GlassCard } from "../../shared/ui/GlassCard";
import { Button } from "../../shared/ui/Button";
import { ArtistRow } from "./components/ArtistRow";

export default function Rehearsals(): React.JSX.Element {
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

  useEffect(() => {
    if (isError)
      toast.error("Błąd synchronizacji", {
        description: "Nie udało się załadować danych.",
      });
  }, [isError]);

  const sectionalDetails = useMemo(() => {
    if (!activeRehearsal || !activeRehearsal.invited_participations?.length)
      return "Tutti (Cały Zespół)";

    const voices = new Set<string>();
    invitedParticipations.forEach((p) => {
      const artist = artistMap.get(String(p.artist));
      if (artist?.voice_type) {
        voices.add(artist.voice_type.charAt(0).toUpperCase());
      }
    });

    const voiceDict: Record<string, string> = {
      S: "Soprany",
      A: "Alty",
      T: "Tenory",
      B: "Basy",
      M: "Mezzosoprany",
      C: "Kontratenory",
    };
    const voiceNames = Array.from(voices).map((v) => voiceDict[v] || v);

    return `Tylko: ${voiceNames.join(", ")}`;
  }, [activeRehearsal, invitedParticipations, artistMap]);

  if (isLoading && displayProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 size={32} className="animate-spin text-[#002395]/40" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-24 max-w-7xl mx-auto cursor-default px-4 sm:px-6 lg:px-8">
      <header className="relative pt-8 mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
            <CheckSquare size={12} className="text-[#002395]" />
            <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
              Moduł Inspektora
            </p>
          </div>
          <h1
            className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight"
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            Dziennik{" "}
            <span className="italic text-[#002395] font-bold">Obecności</span>.
          </h1>
        </motion.div>
      </header>

      {/* --- ENTERPRISE PROJECT NAVIGATOR --- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200/60 pb-4">
          <h2 className="text-sm font-bold text-stone-800 uppercase tracking-widest flex items-center gap-2">
            <Briefcase size={16} className="text-stone-400" />
            Kontekst Projektu
          </h2>

          <div className="flex bg-stone-100/80 p-1 rounded-xl border border-stone-200/60 shadow-sm">
            <button
              onClick={() => setProjectTab("ACTIVE")}
              className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${projectTab === "ACTIVE" ? "bg-white text-[#002395] shadow-sm border border-stone-200/60" : "text-stone-500 hover:text-stone-800"}`}
            >
              Aktywne
            </button>
            <button
              onClick={() => setProjectTab("ARCHIVE")}
              className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 ${projectTab === "ARCHIVE" ? "bg-white text-stone-800 shadow-sm border border-stone-200/60" : "text-stone-500 hover:text-stone-800"}`}
            >
              <Archive size={10} /> Archiwum
            </button>
          </div>
        </div>

        <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x">
          {displayProjects.length === 0 ? (
            <div className="text-stone-400 text-xs italic">
              Brak projektów w tej zakładce.
            </div>
          ) : (
            displayProjects.map((project) => {
              const isSelected = selectedProjectId === String(project.id);
              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(String(project.id))}
                  className={`snap-start flex-shrink-0 w-64 p-4 rounded-2xl border text-left transition-all group active:scale-95 ${
                    isSelected
                      ? "bg-[#002395] border-[#002395] shadow-lg shadow-[#002395]/20"
                      : "bg-white/60 hover:bg-white border-stone-200 shadow-sm"
                  }`}
                >
                  <div
                    className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${isSelected ? "text-blue-200" : "text-stone-400"}`}
                  >
                    {new Date(project.date_time).toLocaleDateString("pl-PL")}
                  </div>
                  <h3
                    className={`font-bold text-sm truncate ${isSelected ? "text-white" : "text-stone-800"}`}
                  >
                    {project.title}
                  </h3>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selectedProjectId && projectRehearsals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8 mt-4"
        >
          {/* --- REHEARSAL TIMELINE --- */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-stone-200/60">
            {projectRehearsals.map((reh) => {
              const isSelected = String(activeRehearsalId) === String(reh.id);
              const isPast = new Date(reh.date_time) < new Date();
              return (
                <button
                  key={reh.id}
                  onClick={() => setActiveRehearsalId(String(reh.id))}
                  className={`flex flex-col items-start p-3.5 min-w-[150px] rounded-2xl border transition-all text-left flex-shrink-0 active:scale-95 ${isSelected ? "bg-white border-[#002395] shadow-[0_10px_25px_rgba(0,35,149,0.1)] ring-1 ring-[#002395]" : "bg-white/50 border-white/80 shadow-sm hover:bg-white"}`}
                >
                  <span
                    className={`text-[9px] font-bold antialiased uppercase tracking-widest mb-1 ${isSelected ? "text-[#002395]" : "text-stone-400"}`}
                  >
                    {new Date(reh.date_time).toLocaleDateString("pl-PL", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span
                    className={`text-xl font-black tracking-tight leading-none mb-1.5 ${isSelected ? "text-stone-900" : isPast ? "text-stone-400" : "text-stone-700"}`}
                  >
                    {new Date(reh.date_time).toLocaleTimeString("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-stone-400 truncate max-w-full">
                    {reh.location || "Brak lok."}
                  </span>
                </button>
              );
            })}
          </div>

          {activeRehearsal && (
            <GlassCard noPadding variant="premium" className="flex flex-col">
              <div className="p-6 md:p-8 bg-stone-50/50 border-b border-stone-200/60 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-3 py-1.5 text-[8px] font-bold uppercase tracking-widest rounded border shadow-sm ${
                        activeRehearsal.invited_participations?.length
                          ? "bg-purple-50 text-purple-700 border-purple-100"
                          : "bg-blue-50 text-[#002395] border-blue-100"
                      }`}
                    >
                      {activeRehearsal.invited_participations?.length
                        ? "Próba Sekcyjna"
                        : "Próba Tutti"}
                    </span>
                    {/* ENTERPRISE FIX: Wyświetlanie dla kogo jest próba */}
                    <span className="text-[10px] font-bold text-stone-500 bg-white px-2 py-1 rounded border border-stone-200 shadow-sm">
                      {sectionalDetails}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-stone-900 tracking-tight leading-tight mt-3">
                    {activeRehearsal.focus || "Praca Bieżąca"}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} />{" "}
                      {new Date(activeRehearsal.date_time).toLocaleString(
                        "pl-PL",
                        { weekday: "long", hour: "2-digit", minute: "2-digit" },
                      )}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin size={12} /> {activeRehearsal.location}
                    </span>
                  </div>
                </div>

                {/* Prawa strona statystyk (Bez zmian) */}
                <div className="flex flex-wrap gap-2 lg:gap-4 bg-white p-3 rounded-2xl border border-stone-200/80 shadow-sm">
                  {/* ... statystyki ... */}
                  <div className="flex flex-col items-center px-4 py-1 border-r border-stone-100 last:border-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                      Frekwencja
                    </span>
                    <span
                      className={`text-lg font-black ${stats.rate >= 80 ? "text-emerald-600" : stats.rate >= 50 ? "text-orange-500" : "text-red-500"}`}
                    >
                      {stats.rate}%
                    </span>
                  </div>
                  <div className="flex flex-col items-center px-4 py-1 border-r border-stone-100 last:border-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                      Obecni
                    </span>
                    <span className="text-lg font-black text-stone-800">
                      {stats.present + stats.late}
                      <span className="text-xs text-stone-400 ml-1">
                        / {stats.total}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-col items-center px-4 py-1 border-r border-stone-100 last:border-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                      Braki
                    </span>
                    <span className="text-lg font-black text-red-500">
                      {stats.absent + stats.excused}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end p-4 border-b border-stone-200/60 bg-white">
                <Button
                  variant="primary"
                  onClick={handleMarkAllPresent}
                  disabled={
                    isMarkingAll ||
                    invitedParticipations.length === 0 ||
                    stats.none === 0
                  }
                  isLoading={isMarkingAll}
                  leftIcon={
                    !isMarkingAll ? <CheckCircle2 size={16} /> : undefined
                  }
                >
                  Uzupełnij luki ({stats.none}) jako "Obecny"
                </Button>
              </div>

              <div className="flex-1 overflow-x-hidden overflow-y-auto max-h-[60vh] bg-stone-50/30">
                {["S", "A", "T", "B"].map((voiceGroup) => {
                  const groupParts = invitedParticipations.filter((p) => {
                    const artist = artistMap.get(String(p.artist));
                    return artist?.voice_type?.startsWith(voiceGroup);
                  });

                  if (groupParts.length === 0) return null;

                  return (
                    <div key={voiceGroup} className="mb-6 last:mb-0">
                      <div className="bg-stone-100/80 px-4 py-2 border-y border-stone-200/60 sticky top-0 z-10 backdrop-blur-md">
                        <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-[#002395]">
                          {voiceGroup === "S"
                            ? "Soprany"
                            : voiceGroup === "A"
                              ? "Alty"
                              : voiceGroup === "T"
                                ? "Tenory"
                                : "Basy"}
                        </span>
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
                })}
              </div>
            </GlassCard>
          )}
        </motion.div>
      )}
    </div>
  );
}
