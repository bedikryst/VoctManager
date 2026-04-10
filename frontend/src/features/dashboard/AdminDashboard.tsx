/**
 * @file AdminDashboard.tsx
 * @description Mission Control Dashboard for Choir Managers & Conductors.
 * Refactored to Enterprise SaaS 2026 High-Density (Bento Grid) standard.
 * Includes full-card clickable areas (Fitts's Law optimization).
 * @module panel/dashboard/AdminDashboard
 */

import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, Variants } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Music,
  FileText,
  Users,
  Briefcase,
  ArrowRight,
  Clock,
  MapPin,
  Wrench,
  ChevronRight,
  ListOrdered,
  MicVocal,
  Activity,
  UserMinus,
  Plus,
  AlertCircle,
} from "lucide-react";

import { useAuth } from "../../app/providers/AuthProvider";
import { GlassCard } from "../../shared/ui/GlassCard";
import { formatLocalizedDate } from "../../shared/lib/intl";
import { DualTimeDisplay } from "../../shared/ui/DualTimeDisplay";
import { useAdminDashboardData } from "./hooks/useAdminDashboardData";

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

export default function AdminDashboard(): React.JSX.Element {
  const { user } = useAuth();
  const { t } = useTranslation();
  const {
    isLoading,
    adminStats,
    nextProject,
    nextProjectStats,
    nextRehearsal,
  } = useAdminDashboardData();

  const ADMIN_MODULES = useMemo(
    () => [
      {
        id: "projects",
        title: t("dashboard.admin.modules.projects_title", "Projekty"),
        desc: t(
          "dashboard.admin.modules.projects_desc",
          "Centrum dowodzenia produkcją.",
        ),
        features: ["Harmonogramy", "Setlisty", "Casting"],
        icon: <Briefcase size={18} className="text-[#002395]" />,
        path: "/panel/project-management",
      },
      {
        id: "archive",
        title: t("dashboard.admin.modules.archive_title", "Archiwum"),
        desc: t(
          "dashboard.admin.modules.archive_desc",
          "Baza biblioteki muzycznej.",
        ),
        features: ["Nuty PDF", "Audio", "Wymagania"],
        icon: <Music size={18} className="text-[#002395]" />,
        path: "/panel/archive-management",
      },
      {
        id: "artists",
        title: t("dashboard.admin.modules.artists_title", "Artyści"),
        desc: t(
          "dashboard.admin.modules.artists_desc",
          "Zarządzanie chórem i solistami.",
        ),
        features: ["SATB", "Profile", "A vista"],
        icon: <Users size={18} className="text-[#002395]" />,
        path: "/panel/artists",
      },
      {
        id: "contracts",
        title: t("dashboard.admin.modules.contracts_title", "Finanse"),
        desc: t(
          "dashboard.admin.modules.contracts_desc",
          "Umowy i budżetowanie.",
        ),
        features: ["Stawki", "Dokumenty", "Budżet"],
        icon: <FileText size={18} className="text-[#002395]" />,
        path: "/panel/contracts",
      },
      {
        id: "crew",
        title: t("dashboard.admin.modules.crew_title", "Technika"),
        desc: t(
          "dashboard.admin.modules.crew_desc",
          "Logistyka i reżyseria wydarzeń.",
        ),
        features: ["Dźwięk", "Światło", "Firmy"],
        icon: <Wrench size={18} className="text-[#002395]" />,
        path: "/panel/crew",
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
          {t("dashboard.shared.loading_telemetry", "Synchronizacja danych...")}
        </span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in relative cursor-default pb-12 w-full max-w-7xl mx-auto">
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 z-10"></div>
              <div className="absolute w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">
              {t("dashboard.admin.welcome_back", "Witaj z powrotem")} •{" "}
              {user?.first_name || "Admin"}
            </p>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight flex items-baseline gap-1.5">
            Pulpit
            <span
              className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#002395] to-blue-500 pr-1 pb-1"
              style={{ fontFamily: "'Cormorant', serif", fontSize: "1.15em" }}
            >
              Produkcyjny
            </span>
          </h1>
        </div>

        <Link
          to="/panel/project-management"
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-200/80 hover:border-[#002395] text-stone-700 hover:text-[#002395] text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
        >
          <Plus size={14} />{" "}
          {t("dashboard.admin.btn_new_project", "Nowy Projekt")}
        </Link>
      </header>

      {/* ALERT O PRÓBIE - Cały obszar jest teraz klikalnym linkiem (group/alert) */}
      {nextRehearsal && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <Link
            to="/panel/rehearsals"
            className="block bg-white border-l-4 border-l-orange-500 border border-stone-200/60 shadow-sm hover:shadow-md rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group/alert hover:border-orange-300 transition-all outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 group-hover/alert:bg-orange-100 transition-colors">
                <AlertCircle size={16} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600/90 mb-0.5">
                  {t(
                    "dashboard.admin.next_rehearsal_alert",
                    "Najbliższa Próba • {{title}}",
                    { title: nextRehearsal.projectTitle },
                  )}
                </p>
                <p className="text-sm font-bold text-stone-800">
                  {formatLocalizedDate(
                    nextRehearsal.date_time,
                    { weekday: "long", day: "numeric", month: "long" },
                    undefined,
                    nextRehearsal.timezone,
                  )}
                </p>
                <DualTimeDisplay
                  value={nextRehearsal.date_time}
                  timeZone={nextRehearsal.timezone}
                  containerClassName="flex items-center gap-1.5"
                  primaryTimeClassName="text-[11px] font-bold text-stone-500"
                  localTimeClassName="text-[10px] text-orange-600/80 font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {(nextRehearsal.absent_count || 0) > 0 ? (
                <span className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  <UserMinus size={12} />{" "}
                  {t("dashboard.admin.absences", "Braki: {{count}}", {
                    count: nextRehearsal.absent_count,
                  })}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  100% Frekwencji
                </span>
              )}
              {/* Zmienione z <Link> na zwykły <div>, żeby zachować wygląd strzałki */}
              <div className="p-1.5 text-stone-400 group-hover/alert:text-orange-600 transition-colors">
                <ArrowRight
                  size={16}
                  className="transform group-hover/alert:translate-x-1 transition-transform"
                />
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* LEWA: Statystyki (Nieklikalne) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="col-span-1 h-full"
        >
          <GlassCard
            variant="dark"
            className="h-full p-6 flex flex-col justify-between overflow-hidden relative"
          >
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500 rounded-full blur-[60px] opacity-20 pointer-events-none"></div>

            <div>
              <div className="flex items-center gap-2 mb-6">
                <Activity size={14} className="text-blue-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
                  {t("dashboard.admin.kpi_telemetry", "Telemetria Bazy")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Baza Utworów
                  </p>
                  <p className="text-2xl font-black text-white">
                    {adminStats.totalPieces}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Aktywne Projekty
                  </p>
                  <p className="text-2xl font-black text-blue-300">
                    {adminStats.activeProjects}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 mt-auto">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
                  Gotowość Zespołu
                </p>
                <span className="text-[9px] font-bold text-stone-300 bg-white/10 px-1.5 py-0.5 rounded">
                  {adminStats.satb.Total} os.
                </span>
              </div>

              <div className="space-y-2">
                {[
                  { label: "S", val: adminStats.satb.S, color: "bg-rose-500" },
                  {
                    label: "A",
                    val: adminStats.satb.A,
                    color: "bg-purple-500",
                  },
                  { label: "T", val: adminStats.satb.T, color: "bg-sky-500" },
                  {
                    label: "B",
                    val: adminStats.satb.B,
                    color: "bg-emerald-500",
                  },
                ].map((voice) => (
                  <div key={voice.label} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-stone-400 w-4">
                      {voice.label}
                    </span>
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`${voice.color} h-full rounded-full`}
                        style={{
                          width: `${adminStats.satb.Total ? (voice.val / adminStats.satb.Total) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-[10px] font-bold text-white w-5 text-right">
                      {voice.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* PRAWA: Nadchodzący projekt - Cały GlassCard jest teraz klikalnym linkiem (group/project) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 h-full"
        >
          <Link
            to="/panel/project-management"
            className="block h-full outline-none group/project active:scale-[0.99] transition-transform"
          >
            <GlassCard
              variant="premium"
              className="h-full p-6 flex flex-col justify-between group-hover/project:border-[#002395]/30 group-hover/project:shadow-md transition-all duration-300 bg-white/40 group-hover/project:bg-white/60"
            >
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={14} className="text-[#002395]" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 group-hover/project:text-[#002395] transition-colors">
                  {t("dashboard.admin.spotlight_title", "Wydarzenie Główne")}
                </span>
              </div>

              {nextProject && nextProjectStats ? (
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <h2
                      className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight leading-tight mb-4 group-hover/project:text-[#002395] transition-colors"
                      style={{ fontFamily: "'Cormorant', serif" }}
                    >
                      {nextProject.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-stone-700 mb-6">
                      <span className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200/80">
                        <Calendar
                          size={12}
                          className="text-[#002395]"
                          aria-hidden="true"
                        />
                        {formatLocalizedDate(
                          nextProject.date_time,
                          { day: "numeric", month: "short", year: "numeric" },
                          undefined,
                          nextProject.timezone,
                        )}
                      </span>

                      <DualTimeDisplay
                        value={nextProject.date_time}
                        timeZone={nextProject.timezone}
                        icon={
                          <Clock
                            size={12}
                            className="text-[#002395]"
                            aria-hidden="true"
                          />
                        }
                        containerClassName="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200/80"
                        primaryTimeClassName="flex items-center gap-1.5 text-[11px] font-bold text-stone-700"
                        localTimeClassName="text-[10px] text-stone-500 font-medium border-l border-stone-200 pl-1.5"
                      />

                      {nextProject.location && (
                        <span className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200/80">
                          <MapPin
                            size={12}
                            className="text-[#002395]"
                            aria-hidden="true"
                          />
                          {nextProject.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-stone-200/80 pt-4 mt-auto">
                    <div className="flex gap-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                          <ListOrdered size={10} /> Repertuar
                        </span>
                        <span className="text-xs font-bold text-stone-800">
                          {nextProjectStats.piecesCount} utworów
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                          <MicVocal size={10} /> Do koncertu
                        </span>
                        <span className="text-xs font-bold text-stone-800">
                          {nextProjectStats.rehearsalsLeft} prób
                        </span>
                      </div>
                    </div>

                    {/* Zmienione z <Link> na zwykły <div> - pełni rolę wizualnego CTA */}
                    <div className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-900 group-hover/project:bg-[#002395] text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm">
                      Otwórz Projekt{" "}
                      <ArrowRight
                        size={14}
                        className="transform group-hover/project:translate-x-1 transition-transform"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center h-full opacity-60">
                  <Briefcase size={24} className="text-stone-300 mb-3" />
                  <p className="text-xs font-bold text-stone-500 mb-1">
                    Brak aktywnych wydarzeń
                  </p>
                </div>
              )}
            </GlassCard>
          </Link>
        </motion.div>
      </div>

      {/* 4. MODUŁY SYSTEMOWE */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4"
      >
        {ADMIN_MODULES.map((card) => (
          <Link
            key={card.id}
            to={card.path}
            className="outline-none group block h-full"
          >
            <motion.div variants={itemVariants} className="h-full">
              <GlassCard
                variant="premium"
                className="p-5 flex flex-col h-full hover:border-[#002395]/30 hover:shadow-md transition-all duration-300 bg-white/40"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-white border border-stone-200/60 rounded-xl flex items-center justify-center group-hover:border-[#002395]/40 group-hover:text-[#002395] transition-colors shadow-sm shrink-0">
                    {card.icon}
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 tracking-tight group-hover:text-[#002395] transition-colors line-clamp-1">
                    {card.title}
                  </h4>
                </div>

                <p className="text-[11px] text-stone-500 font-medium leading-snug mb-4 line-clamp-2">
                  {card.desc}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {card.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 bg-stone-100 text-stone-500 text-[8px] font-bold uppercase tracking-widest rounded border border-stone-200/40"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-stone-200/60 mt-auto">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-stone-400 group-hover:text-[#002395] transition-colors">
                    Otwórz Moduł
                  </span>
                  <ChevronRight
                    size={14}
                    className="text-stone-400 group-hover:text-[#002395] group-hover:translate-x-0.5 transition-transform"
                  />
                </div>
              </GlassCard>
            </motion.div>
          </Link>
        ))}
      </motion.div>
    </div>
  );
}
