/**
 * @file RehearsalBookButton.tsx
 * @description Opens the reader's available score book from a rehearsal.
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useArtistPreview } from "@/app/providers/ArtistPreviewProvider";
import { scoreStandAccessFor } from "@/features/annotations";
import { ProjectScoreBook } from "@/features/projects/components/ProjectScoreBook";
import { isManager } from "@/shared/auth/rbac";
import { Button } from "@/shared/ui/primitives/Button";
import { useMaterialsData } from "../hooks/useMaterialsData";

export const RehearsalBookButton = ({ projectId }: { projectId: string | number }): React.JSX.Element | null => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPreview } = useArtistPreview();
  const { filteredGroups } = useMaterialsData("", !!user);
  const [open, setOpen] = useState(false);
  const group = filteredGroups.find((entry) => entry.project.id === String(projectId));
  if (!group?.project.has_score_pdf) return null;
  return (
    <>
      <Button variant="secondary" size="touch" leftIcon={<BookOpen size={14} aria-hidden="true" />} disabled={isPreview} onClick={() => setOpen(true)}>
        {t("score_book.title", "Książka nutowa")}
      </Button>
      {!isPreview && <ProjectScoreBook
        projectId={group.project.id}
        projectTitle={group.project.title}
        isOpen={open}
        {...scoreStandAccessFor({
          isManager: isManager(user),
          mayMarkForChoir: group.program.length > 0 && group.program.every((item) => item.piece.may_mark_for_choir),
          mayMarkWithConductor: group.program.length > 0 && group.program.every((item) => item.piece.may_mark_with_conductor === true),
        })}
        onClose={() => setOpen(false)}
      />}
    </>
  );
};
