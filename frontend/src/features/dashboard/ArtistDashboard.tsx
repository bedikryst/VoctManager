/**
 * @file ArtistDashboard.tsx
 * @description Highly personalized Assistant Dashboard for Artists.
 * Refactored to Enterprise SaaS 2026 High-Density (Bento Grid) standard.
 * Features dual spotlights (Rehearsal & Project) and inline absence reporting.
 * @module panel/dashboard/ArtistDashboard
 */

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  Music,
  ArrowRight,
  Clock,
  MapPin,
  Sparkles,
  ChevronRight,
  Activity,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Check,
  Download,
  Loader2,
} from "lucide-react";

import { useAuth } from "../../app/providers/AuthProvider";
import { GlassCard } from "../../shared/ui/GlassCard";
import {
  formatLocalizedDate,
  formatLocalizedTime,
} from "../../shared/lib/intl";
import { downloadFile } from "../../shared/lib/downloadFile";
import api from "../../shared/api/api";
import { useArtistDashboardData } from "./hooks/useArtistDashboardData";
import { useUpsertScheduleAttendance } from "../../features/schedule/api/schedule.queries";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
};

export default function ArtistDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isLoading, upNextRehearsal, upNextProject, greeting } =
    useArtistDashboardData(user?.id);

  // Mechanika zgłaszania nieobecności
  const attendanceMutation = useUpsertScheduleAttendance();
  const [reportingRehearsal, setReportingRehearsal] = useState(false);
  const [reportForm, setReportForm] = useState<{
    status: string;
    notes: string;
  }>({ status: "ABSENT", notes: "" });

  // Mechanika pobierania Call-sheet
  const [isDownloadingRunSheet, setIsDownloadingRunSheet] = useState(false);

  const ARTIST_MODULES = useMemo(
    () => [
      {
        id: "schedule",
        icon: <Calendar size={18} className="text-orange-600" />,
        iconBg: "bg-orange-50 border-orange-100",
        hoverClass:
          "hover:border-orange-300/60 hover:shadow-[0_8px_24px_rgba(249,115,22,0.12)]",
        titleColor: "group-hover/module:text-orange-600",
        title: t("dashboard.artist.module_schedule_title", "Mój Kalendarz"),
        desc: t(
          "dashboard.artist.module_schedule_desc",
          "Sprawdź próby, koncerty i zgłoś nieobecność.",
        ),
        path: "/panel/schedule",
      },
      {
        id: "materials",
        icon: <Music size={18} className="text-emerald-600" />,
        iconBg: "bg-emerald-50 border-emerald-100",
        hoverClass:
          "hover:border-emerald-300/60 hover:shadow-[0_8px_24px_rgba(16,185,129,0.12)]",
        titleColor: "group-hover/module:text-emerald-600",
        title: t("dashboard.artist.module_materials_title", "Materiały"),
        desc: t(
          "dashboard.artist.module_materials_desc",
          "Pobierz nuty PDF i ćwicz ze ścieżkami audio.",
        ),
        path: "/panel/materials",
      },
      {
        id: "resources",
        icon: <BookOpen size={18} className="text-purple-600" />,
        iconBg: "bg-purple-50 border-purple-100",
        hoverClass:
          "hover:border-purple-300/60 hover:shadow-[0_8px_24px_rgba(168,85,247,0.12)]",
        titleColor: "group-hover/module:text-purple-600",
        title: t("dashboard.artist.module_resources_title", "Baza Wiedzy"),
        desc: t(
          "dashboard.artist.module_resources_desc",
          "Sprawdź wytyczne, dress-code i umowy.",
        ),
        path: "/panel/resources",
      },
    ],
    [t],
  );

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-12 h-12 border-2 border-[#002395]/20 rounded-full"></div>
          <div className="w-12 h-12 border-2 border-[#002395] rounded-full border-t-transparent animate-spin"></div>
        </div>
        <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-stone-500">
          {t("dashboard.shared.syncing", "Synchronizacja pulpitu...")}
        </span>
      </div>
    );
  }

  const handleConfirmPresence = async () => {
    if (!upNextRehearsal || !upNextRehearsal.participationId) return;
    const toastId = toast.loading("Potwierdzanie obecności...");
    try {
      await attendanceMutation.mutateAsync({
        existingAttendanceId: upNextRehearsal.attendance?.id,
        payload: {
          rehearsal: upNextRehearsal.data.id,
          participation: upNextRehearsal.participationId,
          status: "PRESENT",
          excuse_note: "Obecność potwierdzona z Dashboardu",
        },
      });
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
      toast.success("Obecność potwierdzona!", { id: toastId });
    } catch (err) {
      toast.error("Błąd podczas zapisywania", { id: toastId });
    }
  };

  const handleSubmitAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upNextRehearsal || !upNextRehearsal.participationId) return;
    const toastId = toast.loading("Zapisywanie zgłoszenia...");
    try {
      await attendanceMutation.mutateAsync({
        existingAttendanceId: upNextRehearsal.attendance?.id,
        payload: {
          rehearsal: upNextRehearsal.data.id,
          participation: upNextRehearsal.participationId,
          status: reportForm.status as any,
          excuse_note: reportForm.notes,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
      setReportingRehearsal(false);
      setReportForm({ status: "ABSENT", notes: "" });
      toast.success("Zgłoszenie zostało wysłane", { id: toastId });
    } catch (err) {
      toast.error("Wystąpił błąd", { id: toastId });
    }
  };

  // Funkcja pobierania Call-sheet na bieżąco
  const handleDownloadRunSheet = async () => {
    if (!upNextProject) return;
    setIsDownloadingRunSheet(true);
    const toastId = toast.loading(
      t("dashboard.artist.downloading_runsheet", "Generowanie harmonogramu..."),
    );
    try {
      const response = await api.get(
        `/api/projects/${upNextProject.data.id}/export_call_sheet/`,
        {
          responseType: "blob",
        },
      );
      downloadFile(
        response.data,
        `CallSheet_${upNextProject.title.replace(/ /g, "_")}.pdf`,
      );
      toast.success(
        t("dashboard.artist.download_success", "Pobrano harmonogram pomyślnie"),
        { id: toastId },
      );
    } catch (error) {
      toast.error(
        t("dashboard.artist.download_error", "Błąd pobierania harmonogramu"),
        { id: toastId },
      );
    } finally {
      setIsDownloadingRunSheet(false);
    }
  };

  const currentStatus = upNextRehearsal?.attendance?.status;
  const isPresent = currentStatus === "PRESENT";
  const isExcusedOrLate =
    currentStatus === "EXCUSED" ||
    currentStatus === "LATE" ||
    currentStatus === "ABSENT";

  return (
    <div className="animate-fade-in relative cursor-default pb-12 w-full max-w-7xl mx-auto">
      {/* 1. KOMPAKTOWY HEADER */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 z-10"></div>
              <div className="absolute w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">
              {greeting} • {user?.first_name || "Artysto"}
            </p>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight flex items-baseline gap-1.5">
            Pulpit
            <span
              className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#002395] to-blue-500 pr-1 pb-1"
              style={{ fontFamily: "'Cormorant', serif", fontSize: "1.15em" }}
            >
              Muzyczny
            </span>
          </h1>
        </div>
      </header>

      {/* 2. DUAL SPOTLIGHT */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-[#002395]" aria-hidden="true" />
          <h2 className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
            {t("dashboard.artist.next_challenges", "Na horyzoncie")}
          </h2>
        </div>

        {!upNextRehearsal && !upNextProject ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white border border-dashed border-stone-300/60 rounded-[1.5rem] p-8 text-center flex flex-col items-center"
          >
            <Activity size={32} className="text-stone-300 mb-3" />
            <p className="text-stone-800 text-sm font-bold">
              {t(
                "dashboard.artist.empty_events_title",
                "Brak nadchodzących wydarzeń",
              )}
            </p>
            <p className="text-stone-500 text-xs mt-1">
              {t(
                "dashboard.artist.empty_events_desc",
                "Odpocznij, twój muzyczny kalendarz jest obecnie pusty.",
              )}
            </p>
          </motion.div>
        ) : (
          <div
            className={`grid grid-cols-1 ${upNextRehearsal && upNextProject ? "lg:grid-cols-2" : ""} gap-4`}
          >
            {/* KARTA PRÓBY */}
            {upNextRehearsal && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <GlassCard
                  variant="premium"
                  className="flex flex-col h-full overflow-hidden transition-all duration-300"
                >
                  <div
                    className={`p-6 flex-1 transition-colors ${isPresent ? "bg-emerald-50/30" : isExcusedOrLate ? "bg-orange-50/20" : "bg-white/40"}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 text-stone-600 border border-stone-200 rounded-md text-[9px] font-bold uppercase tracking-widest">
                        <Clock size={12} className="text-stone-400" /> Próba
                      </span>

                      {isPresent && (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600">
                          <CheckCircle2 size={12} /> Potwierdzona
                        </span>
                      )}
                      {(currentStatus === "ABSENT" ||
                        currentStatus === "EXCUSED") && (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-red-600">
                          <XCircle size={12} /> Zgłoszono absencję
                        </span>
                      )}
                      {currentStatus === "LATE" && (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-orange-600">
                          <AlertCircle size={12} /> Spóźnienie
                        </span>
                      )}
                    </div>

                    <h3
                      className="text-2xl font-bold tracking-tight mb-4 leading-tight text-stone-900"
                      style={{ fontFamily: "'Cormorant', serif" }}
                    >
                      {upNextRehearsal.title}
                    </h3>

                    <div className="flex flex-col gap-2 text-[11px] font-bold text-stone-600 mb-6">
                      <span className="flex items-center gap-2">
                        <Calendar size={14} className="text-[#002395]/60" />{" "}
                        {formatLocalizedDate(upNextRehearsal.date, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                      <span className="flex items-center gap-2">
                        <Clock size={14} className="text-[#002395]/60" />{" "}
                        {formatLocalizedTime(upNextRehearsal.date, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {upNextRehearsal.data.location && (
                        <span className="flex items-center gap-2">
                          <MapPin size={14} className="text-[#002395]/60" />{" "}
                          {upNextRehearsal.data.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-stone-200/60 bg-stone-50/80 p-4">
                    {!reportingRehearsal ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        {!isPresent && (
                          <button
                            onClick={handleConfirmPresence}
                            disabled={attendanceMutation.isPending}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <Check size={14} /> Potwierdź Obecność
                          </button>
                        )}
                        <button
                          onClick={() => setReportingRehearsal(true)}
                          className={`flex-1 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 border bg-white shadow-sm ${isExcusedOrLate ? "border-stone-200 text-stone-600 hover:bg-stone-100" : "border-orange-200 text-orange-600 hover:bg-orange-50"}`}
                        >
                          <AlertCircle size={14} />{" "}
                          {currentStatus
                            ? "Edytuj zgłoszenie"
                            : "Zgłoś problem"}
                        </button>
                      </div>
                    ) : (
                      <AnimatePresence>
                        <motion.form
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          onSubmit={handleSubmitAbsence}
                          className="flex flex-col gap-3"
                        >
                          <div className="flex gap-3">
                            <select
                              value={reportForm.status}
                              onChange={(e) =>
                                setReportForm({
                                  ...reportForm,
                                  status: e.target.value,
                                })
                              }
                              className="w-1/3 px-3 py-2 text-xs font-bold text-stone-800 bg-white border border-stone-200/80 rounded-lg outline-none focus:ring-2 focus:ring-[#002395]/20 appearance-none"
                            >
                              <option value="ABSENT">Nie będę</option>
                              <option value="LATE">Spóźnię się</option>
                            </select>
                            <input
                              type="text"
                              required
                              placeholder="Powód / Uwagi..."
                              value={reportForm.notes}
                              onChange={(e) =>
                                setReportForm({
                                  ...reportForm,
                                  notes: e.target.value,
                                })
                              }
                              className="flex-1 px-3 py-2 text-xs font-medium text-stone-800 bg-white border border-stone-200/80 rounded-lg outline-none focus:ring-2 focus:ring-[#002395]/20"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setReportingRehearsal(false)}
                              className="px-4 py-2 text-[9px] font-bold uppercase text-stone-500 hover:text-stone-800"
                            >
                              Anuluj
                            </button>
                            <button
                              type="submit"
                              disabled={
                                attendanceMutation.isPending ||
                                !reportForm.notes
                              }
                              className="px-4 py-2 bg-[#002395] text-white rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-blue-800 disabled:opacity-50 shadow-sm"
                            >
                              <Send size={12} /> Wyślij
                            </button>
                          </div>
                        </motion.form>
                      </AnimatePresence>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {/* KARTA KONCERTU / PROJEKTU */}
            {upNextProject && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <GlassCard
                  variant="dark"
                  className="flex flex-col h-full overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/4"></div>

                  <div className="p-6 flex-1 relative z-10">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 text-blue-100 border border-white/20 rounded-md text-[9px] font-bold uppercase tracking-widest mb-4 backdrop-blur-sm">
                      <Music size={12} className="text-blue-300" /> Koncert
                    </span>

                    <h3
                      className="text-2xl font-bold tracking-tight mb-4 leading-tight text-white"
                      style={{ fontFamily: "'Cormorant', serif" }}
                    >
                      {upNextProject.title}
                    </h3>

                    <div className="flex flex-col gap-2 text-[11px] font-bold text-stone-300 mb-6">
                      <span className="flex items-center gap-2">
                        <Calendar size={14} className="text-blue-400" />{" "}
                        {formatLocalizedDate(upNextProject.date, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </span>

                      {/* Poprawka błędu call_time za pomocą formatLocalizedTime */}
                      {upNextProject.data.call_time && (
                        <span className="flex items-center gap-2">
                          <Clock size={14} className="text-blue-400" />
                          Zbiórka (Call-time):{" "}
                          {formatLocalizedTime(upNextProject.data.call_time, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}

                      {upNextProject.data.location && (
                        <span className="flex items-center gap-2">
                          <MapPin size={14} className="text-blue-400" />{" "}
                          {upNextProject.data.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Panel Akcji dla Projektu (2 przyciski) */}
                  <div className="relative z-10 border-t border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleDownloadRunSheet}
                      disabled={isDownloadingRunSheet}
                      className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {isDownloadingRunSheet ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      {t(
                        "dashboard.artist.download_runsheet",
                        "Harmonogram (Call-sheet)",
                      )}
                    </button>

                    <Link
                      to="/panel/materials"
                      className="flex-1 bg-white hover:bg-stone-200 text-stone-900 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm group/btn"
                    >
                      Nuty i Audio{" "}
                      <ArrowRight
                        size={14}
                        className="group-hover/btn:translate-x-1 transition-transform"
                      />
                    </Link>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </div>
        )}
      </section>

      {/* 3. MODUŁY OSOBISTE */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-[#002395] rounded-full"></div>
          <h3 className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
            {t("dashboard.artist.personal_modules", "Szybki Dostęp")}
          </h3>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {ARTIST_MODULES.map((mod) => (
            <Link
              key={mod.id}
              to={mod.path}
              className="outline-none group/module block h-full active:scale-[0.99] transition-transform"
            >
              <motion.div variants={itemVariants} className="h-full">
                <GlassCard
                  variant="premium"
                  className={`p-5 flex flex-col h-full bg-white/40 transition-all duration-300 ${mod.hoverClass}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-10 h-10 border rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-colors ${mod.iconBg}`}
                    >
                      {mod.icon}
                    </div>
                    <h4
                      className={`text-sm font-bold text-stone-900 tracking-tight transition-colors line-clamp-1 ${mod.titleColor}`}
                    >
                      {mod.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-stone-500 font-medium leading-snug mb-6 line-clamp-2">
                    {mod.desc}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-stone-200/60 mt-auto group-hover/module:border-stone-300/60 transition-colors">
                    <span
                      className={`text-[9px] uppercase tracking-wider font-bold text-stone-400 transition-colors ${mod.titleColor}`}
                    >
                      {t("dashboard.artist.open_module", "Otwórz Moduł")}
                    </span>
                    <ChevronRight
                      size={14}
                      className={`text-stone-400 transform group-hover/module:translate-x-0.5 transition-all ${mod.titleColor}`}
                    />
                  </div>
                </GlassCard>
              </motion.div>
            </Link>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
