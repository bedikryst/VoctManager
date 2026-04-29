/**
 * @file useTimelineProjectCard.ts
 * @description Encapsulates lazy data fetching and call-sheet download handling for project timeline cards.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
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
  const [isCallSheetPreviewOpen, setCallSheetPreviewOpen] = useState(false);
  const [isScorePdfPreviewOpen, setScorePdfPreviewOpen] = useState(false);

  const { data: programItems = [], isLoading: isProgramLoading } =
    useScheduleProgramItems(
      projectId,
      isExpanded && activeSubTab === "SETLIST",
    );
  const { data: castings = [], isLoading: isCastingsLoading } =
    useSchedulePieceCastings(projectId, expandedPieceId, !!expandedPieceId);

  const fetchCallSheetBlob = useCallback(
    () => ScheduleService.exportCallSheet(projectId),
    [projectId],
  );

  const fetchScorePdfBlob = useCallback(
    () => ProjectService.fetchScorePdfBlob(String(projectId)),
    [projectId],
  );

  const handleOpenCallSheetPreview = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setCallSheetPreviewOpen(true);
    },
    [],
  );

  const handleCloseCallSheetPreview = useCallback(() => {
    setCallSheetPreviewOpen(false);
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

  const handleDownloadCallSheet = async (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsDownloading(true);
    const toastId = toast.loading(
      t("schedule.card.download_loading", "Generowanie dokumentu Call-Sheet..."),
    );

    try {
      const blob = await ScheduleService.exportCallSheet(projectId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `CallSheet_${projectTitle.replace(/\s+/g, "_")}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(t("schedule.card.download_success", "Plik został pobrany"), {
        id: toastId,
      });
    } catch {
      toast.error(t("common.errors.generation_error", "Błąd generowania"), {
        id: toastId,
        description: t(
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
    handleDownloadCallSheet,
    isCallSheetPreviewOpen,
    fetchCallSheetBlob,
    handleOpenCallSheetPreview,
    handleCloseCallSheetPreview,
    isScorePdfPreviewOpen,
    fetchScorePdfBlob,
    handleOpenScorePdfPreview,
    handleCloseScorePdfPreview,
  };
};
