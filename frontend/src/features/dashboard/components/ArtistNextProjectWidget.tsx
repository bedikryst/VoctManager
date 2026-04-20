/**
 * @file ArtistNextProjectWidget.tsx
 * @description Isolated widget for the next concert/project spotlight.
 * Refactored to Enterprise SaaS 2026 standard: Strict Typing (No 'any') and complete i18n.
 * Powered by Ethereal UI (Gold palette for Projects/Concerts).
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
  Sparkles,
} from "lucide-react";

import { EventCard } from "@/shared/ui/composites/EventCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Heading, Eyebrow } from "@/shared/ui/primitives/typography";
import { DualTimeDisplay } from "@/shared/widgets/utility/DualTimeDisplay";
import { LocationPreview } from "../../logistics/components/LocationPreview";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { downloadFile } from "@/shared/lib/io/downloadFile";
import api from "@/shared/api/api";
import type { Project } from "@/shared/types";

// Definicja ścisłego kontraktu DTO
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
    <EventCard
      theme="gold"
      backgroundElement={
        <div
          className="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none -z-10"
          aria-hidden="true"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-ethereal-gold/10 rounded-full blur-[50px] -translate-y-1/2 translate-x-1/4" />
        </div>
      }
      badgesSlot={
        <Badge variant="outline">
          <Sparkles size={10} className="mr-1.5 text-ethereal-gold/80" />
          {t("dashboard.artist.badge_concert", "Wydarzenie Główne")}
        </Badge>
      }
      title={project.title}
      dateSlot={formatLocalizedDate(
        project.date,
        { weekday: "long", day: "numeric", month: "long" },
        undefined,
        project.data.timezone,
      )}
      timeSlot={
        project.data.call_time ? (
          <DualTimeDisplay
            value={project.data.call_time}
            timeZone={project.data.timezone}
            label={t("dashboard.artist.label_call_time", "Zbiórka: ")}
            icon={
              <Clock
                size={13}
                strokeWidth={1.5}
                className="shrink-0 opacity-70 text-ethereal-gold"
                aria-hidden="true"
              />
            }
            typography="sans"
            color="default"
            size="xs"
            weight="medium"
          />
        ) : undefined
      }
      locationSlot={
        project.data.location ? (
          <LocationPreview
            locationRef={project.data.location}
            fallback={t("common.tba", "TBA")}
            variant="minimal"
            className="text-[10px] font-medium uppercase tracking-[0.25em] transition-colors duration-500 hover:text-ethereal-gold"
          />
        ) : undefined
      }
      actionSlot={
        <>
          <button
            onClick={handleDownloadRunSheet}
            disabled={isDownloadingRunSheet}
            className="flex-1 bg-white/60 hover:bg-white border border-ethereal-incense/30 hover:border-ethereal-gold/40 text-ethereal-ink px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-95"
          >
            {isDownloadingRunSheet ? (
              <Loader2 size={14} className="animate-spin text-ethereal-gold" />
            ) : (
              <Download size={14} className="text-ethereal-gold" />
            )}
            {t("dashboard.artist.btn_download_runsheet", "Harmonogram (PDF)")}
          </button>

          <Link
            to="/panel/materials"
            className="flex-1 bg-ethereal-gold hover:bg-ethereal-gold/90 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-sm group/btn active:scale-95"
          >
            <Music size={14} />
            {t("dashboard.artist.btn_materials", "Nuty i Audio")}{" "}
            <ArrowRight
              size={14}
              className="group-hover/btn:translate-x-1 transition-transform"
            />
          </Link>
        </>
      }
    />
  );
}
