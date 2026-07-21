/**
 * @file useTimelineProjectCard.ts
 * @description Encapsulates lazy data fetching and day-sheet download handling for
 * project timeline cards on the *personal* schedule. The day sheet is scoped
 * server-side to the caller — a cast singer gets their personalized card, the
 * conductor gets the maestro card — so this surface never touches the
 * manager-only production call sheet.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { toastApiError } from "@/shared/api/errors";
import { useTranslation } from "react-i18next";

import { ScheduleService } from "../api/schedule.service";
import { ProjectService } from "@/features/projects/api/project.service";
import {
  useSchedulePieceCastings,
  useScheduleProgramItems,
} from "../api/schedule.queries";

export const useTimelineProjectCard = (
  projectId: string | number,
  projectTitle: string,
  isExpanded: boolean,
) => {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<"LOGISTICS" | "SETLIST">(
    "LOGISTICS",
  );
  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDaySheetPreviewOpen, setDaySheetPreviewOpen] = useState(false);
  const [isScorePdfPreviewOpen, setScorePdfPreviewOpen] = useState(false);

  const { data: programItems = [], isLoading: isProgramLoading } =
    useScheduleProgramItems(
      projectId,
      isExpanded && activeSubTab === "SETLIST",
    );
  const { data: castings = [], isLoading: isCastingsLoading } =
    useSchedulePieceCastings(projectId, expandedPieceId, !!expandedPieceId);

  const fetchDaySheetBlob = useCallback(
    () => ScheduleService.exportDaySheet(projectId),
    [projectId],
  );

  const fetchScorePdfBlob = useCallback(
    () => ProjectService.fetchScorePdfBlob(String(projectId)),
    [projectId],
  );

  const handleOpenDaySheetPreview = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setDaySheetPreviewOpen(true);
    },
    [],
  );

  const handleCloseDaySheetPreview = useCallback(() => {
    setDaySheetPreviewOpen(false);
  }, []);

  const handleOpenScorePdfPreview = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setScorePdfPreviewOpen(true);
    },
    [],
  );

  const handleCloseScorePdfPreview = useCallback(() => {
    setScorePdfPreviewOpen(false);
  }, []);

  const handleDownloadDaySheet = async (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsDownloading(true);
    const toastId = toast.loading(
      t("schedule.card.download_loading", "Przygotowywanie karty dnia..."),
    );

    try {
      const blob = await ScheduleService.exportDaySheet(projectId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Karta_${projectTitle.replace(/\s+/g, "_")}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(t("schedule.card.download_success", "Plik został pobrany"), {
        id: toastId,
      });
    } catch (error) {
      toastApiError(error, t, {
        id: toastId,
        fallbackDescription: t(
          "schedule.card.download_error_desc",
          "Nie udało się pobrać pliku.",
        ),
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    activeSubTab,
    setActiveSubTab,
    expandedPieceId,
    setExpandedPieceId,
    isDownloading,
    programItems,
    isProgramLoading,
    castings,
    isCastingsLoading,
    handleDownloadDaySheet,
    isDaySheetPreviewOpen,
    fetchDaySheetBlob,
    handleOpenDaySheetPreview,
    handleCloseDaySheetPreview,
    isScorePdfPreviewOpen,
    fetchScorePdfBlob,
    handleOpenScorePdfPreview,
    handleCloseScorePdfPreview,
  };
};
