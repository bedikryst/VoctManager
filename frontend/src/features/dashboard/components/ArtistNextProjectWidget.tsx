/**
 * @file ArtistNextProjectWidget.tsx
 * @description Isolated widget for the next concert/project spotlight.
 * Refactored to Enterprise SaaS 2026 standard: Strict Typing (No 'any') and complete i18n.
 * @architecture Enterprise SaaS 2026
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Music,
  Calendar,
  Clock,
  Download,
  ArrowRight,
  Loader2,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { downloadFile } from "@/shared/lib/io/downloadFile";
import api from "@/shared/api/api";
import type { Project } from "@/shared/types";

// Definicja ścisłego kontraktu DTO, odwzorowująca dane z useArtistDashboardData
export interface UpcomingProjectDto {
  type: "PROJECT";
  date: Date;
  data: Project;
  title: string;
}

export interface ArtistNextProjectWidgetProps {
  project: UpcomingProjectDto;
}

export function ArtistNextProjectWidget({
  project,
}: ArtistNextProjectWidgetProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [isDownloadingRunSheet, setIsDownloadingRunSheet] = useState(false);

  // Strażnik (Guard Clause) chroniący przed renderowaniem pustego stanu
  if (!project) return null;

  const handleDownloadRunSheet = async () => {
    setIsDownloadingRunSheet(true);
    const toastId = toast.loading(
      t(
        "dashboard.artist.toast_downloading_runsheet",
        "Generowanie harmonogramu...",
      ),
    );
    try {
      const response = await api.get(
        `/api/projects/${project.data.id}/export_call_sheet/`,
        { responseType: "blob" },
      );
      downloadFile(
        response.data,
        `CallSheet_${project.title.replace(/\s+/g, "_")}.pdf`,
      );
      toast.success(
        t(
          "dashboard.artist.toast_download_success",
          "Pobrano harmonogram pomyślnie",
        ),
        { id: toastId },
      );
    } catch (error: unknown) {
      toast.error(
        t(
          "dashboard.artist.toast_download_error",
          "Błąd pobierania harmonogramu",
        ),
        { id: toastId },
      );
    } finally {
      setIsDownloadingRunSheet(false);
    }
  };

  return (
    <GlassCard
      variant="dark"
      className="flex flex-col h-full relative z-10 !overflow-visible"
    >
      {/* Background Layer with glow effect and strict clipping */}
      <div
        className="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none -z-10 bg-stone-900"
        aria-hidden="true"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/4" />
      </div>

      <div className="p-6 flex-1 relative z-50 rounded-t-[inherit]">
        <Badge
          variant="brand"
          className="bg-white/10 text-blue-100 border-white/20 mb-4 backdrop-blur-sm"
          icon={<Music size={12} className="text-blue-300" />}
        >
          {t("dashboard.artist.badge_concert", "Koncert")}
        </Badge>

        <h3 className="text-2xl font-bold font-serif tracking-tight mb-4 leading-tight text-white">
          {project.title}
        </h3>

        <div className="flex flex-col gap-2 text-[11px] font-bold text-stone-300 mb-6">
          <span className="flex items-center gap-2">
            <Calendar size={14} className="text-blue-400" />{" "}
            {formatLocalizedDate(
              project.date,
              { weekday: "long", day: "numeric", month: "long" },
              undefined,
              project.data.timezone,
            )}
          </span>

          {project.data.call_time && (
            <DualTimeDisplay
              value={project.data.call_time}
              timeZone={project.data.timezone}
              label={t(
                "dashboard.artist.label_call_time",
                "Zbiórka (Call-time): ",
              )}
              icon={
                <Clock size={14} className="text-blue-400" aria-hidden="true" />
              }
            />
          )}

          {project.data.location && (
            <div className="flex items-center gap-2 text-blue-100 pl-0.5 z-[100]">
              <LocationPreview
                locationRef={project.data.location}
                fallback={t("common.tba", "TBA")}
              />
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 border-t border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row gap-2 rounded-b-[inherit]">
        {/* W przyszłości, przy pełnej implementacji CVA, można to zastąpić komponentem <Button variant="darkOutline"> */}
        <button
          onClick={handleDownloadRunSheet}
          disabled={isDownloadingRunSheet}
          className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-95"
        >
          {isDownloadingRunSheet ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {t(
            "dashboard.artist.btn_download_runsheet",
            "Harmonogram (Call-sheet)",
          )}
        </button>

        <Link
          to="/panel/materials"
          className="flex-1 bg-white hover:bg-stone-200 text-stone-900 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm group/btn active:scale-95"
        >
          {t("dashboard.artist.btn_materials", "Nuty i Audio")}{" "}
          <ArrowRight
            size={14}
            className="group-hover/btn:translate-x-1 transition-transform"
          />
        </Link>
      </div>
    </GlassCard>
  );
}
