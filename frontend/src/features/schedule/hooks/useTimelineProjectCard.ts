/**
 * @file useTimelineProjectCard.ts
 * @description Encapsulates lazy data fetching and document handling for project
 * timeline cards on the *personal* schedule. The day sheet is scoped server-side
 * to the caller — a cast singer gets their personalized card, the conductor gets
 * the maestro card — so this surface never touches the manager-only production
 * call sheet. Both documents are handed to the shared viewer, which owns saving
 * and sharing: the sheet is assembled per request, so a separate download button
 * would rebuild the whole PDF to hand over bytes the reader already has open.
 */

import { useState, useCallback } from "react";

import { ScheduleService } from "../api/schedule.service";
import {
  useSchedulePieceCastings,
  useScheduleProgramItems,
} from "../api/schedule.queries";

export const useTimelineProjectCard = (
  projectId: string | number,
  isExpanded: boolean,
) => {
  const [activeSubTab, setActiveSubTab] = useState<"LOGISTICS" | "SETLIST">(
    "LOGISTICS",
  );
  const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null);
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

  return {
    activeSubTab,
    setActiveSubTab,
    expandedPieceId,
    setExpandedPieceId,
    programItems,
    isProgramLoading,
    castings,
    isCastingsLoading,
    isDaySheetPreviewOpen,
    fetchDaySheetBlob,
    handleOpenDaySheetPreview,
    handleCloseDaySheetPreview,
    isScorePdfPreviewOpen,
    handleOpenScorePdfPreview,
    handleCloseScorePdfPreview,
  };
};
