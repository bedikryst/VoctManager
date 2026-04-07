/**
 * @file useTimelineProjectCard.ts
 * @description Encapsulates lazy data fetching and call-sheet download handling for project timeline cards.
 */

import { useState } from "react";
import { toast } from "sonner";
import { ScheduleService } from "../api/schedule.service";
import {
  useSchedulePieceCastings,
  useScheduleProgramItems,
} from "../api/schedule.queries";

export const useTimelineProjectCard = (
  projectId: string | number,
  projectTitle: string,
  isExpanded: boolean,
) => {
  const [activeSubTab, setActiveSubTab] = useState<"LOGISTICS" | "SETLIST">(
    "LOGISTICS",
  );
  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: programItems = [], isLoading: isProgramLoading } =
    useScheduleProgramItems(
      projectId,
      isExpanded && activeSubTab === "SETLIST",
    );
  const { data: castings = [], isLoading: isCastingsLoading } =
    useSchedulePieceCastings(projectId, expandedPieceId, !!expandedPieceId);

  const handleDownloadCallSheet = async (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsDownloading(true);
    const toastId = toast.loading("Generowanie dokumentu Call-Sheet...");

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

      toast.success("Plik został pobrany", { id: toastId });
    } catch (error) {
      toast.error("Błąd generowania", {
        id: toastId,
        description: "Nie udało się pobrać pliku.",
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
  };
};
