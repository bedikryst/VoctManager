/**
 * @file ScoreManualUploadCard.tsx
 * @description The "use your own PDF" path in the Score work area. The conductor
 * can hand-upload a finished score book instead of assembling one — the fallback
 * for a programme whose editions aren't ingested, or a typeset book made elsewhere.
 * Uploading/removing reconciles the generator's cockpit (backend marks the package
 * manual / cleared), so the two producers never silently fight over project.score_pdf.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/ScoreManualUploadCard
 */

import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, FileUp, Trash2 } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { WidgetCard } from "@/shared/ui/composites/WidgetCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Text } from "@/shared/ui/primitives/typography";

import { projectKeys } from "../api/project.query-keys";
import { ProjectService } from "../api/project.service";
import { useScorePackageState } from "../api/project.score-package";

interface ScoreManualUploadCardProps {
  projectId: string;
  hasScorePdf: boolean;
  onPreview: () => void;
}

export function ScoreManualUploadCard({
  projectId,
  hasScorePdf,
  onPreview,
}: ScoreManualUploadCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: state } = useScorePackageState(projectId);
  const isManual = state?.is_manual_upload ?? false;

  // Both paths write project.score_pdf and the score-package read model, so a
  // mutation here must refresh the cockpit state and the project across the hub.
  const refresh = (): void => {
    void queryClient.invalidateQueries({
      queryKey: projectKeys.scorePackage.byProject(projectId),
    });
    void queryClient.invalidateQueries({
      queryKey: projectKeys.projects.details(projectId),
    });
    void queryClient.invalidateQueries({ queryKey: projectKeys.projects.all });
  };

  const upload = useMutation({
    mutationFn: (file: File) => ProjectService.uploadScorePdf(projectId, file),
    onSuccess: refresh,
    onError: (error) => toastApiError(error),
  });

  const remove = useMutation({
    mutationFn: () => ProjectService.removeScorePdf(projectId),
    onSuccess: refresh,
    onError: (error) => toastApiError(error),
  });

  const busy = upload.isPending || remove.isPending;

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file after a remove
    if (file) upload.mutate(file);
  };

  return (
    <WidgetCard
      title={t("projects.score_package.manual.title", "Własny plik PDF")}
      icon={<FileUp size={15} aria-hidden="true" />}
      bodyClassName="flex flex-col gap-3"
    >
      <Text size="sm" color="graphite">
        {t(
          "projects.score_package.manual.intro",
          "Masz gotową partyturę złożoną poza aplikacją? Wgraj ją zamiast generować — zastąpi obecną książkę.",
        )}
      </Text>

      {isManual && hasScorePdf && (
        <Caption color="muted" className="italic">
          {t(
            "projects.score_package.manual.current",
            "Obecna partytura została wgrana ręcznie.",
          )}
        </Caption>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          isLoading={upload.isPending}
          disabled={busy}
          leftIcon={<FileUp size={14} aria-hidden="true" />}
          onClick={() => inputRef.current?.click()}
        >
          {hasScorePdf
            ? t("projects.score_package.manual.replace", "Wgraj inny PDF")
            : t("projects.score_package.manual.upload", "Wgraj PDF")}
        </Button>

        {hasScorePdf && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Eye size={14} aria-hidden="true" />}
              onClick={onPreview}
            >
              {t("projects.score_package.manual.preview", "Podgląd")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              isLoading={remove.isPending}
              disabled={busy}
              leftIcon={<Trash2 size={14} aria-hidden="true" />}
              className="text-ethereal-graphite/60 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
              onClick={() => remove.mutate()}
            >
              {t("projects.score_package.manual.remove", "Usuń")}
            </Button>
          </>
        )}
      </div>
    </WidgetCard>
  );
}
