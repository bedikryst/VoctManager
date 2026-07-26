/**
 * @file ScoreManualUploadRail.tsx
 * @description The "use your own PDF" path in the Score work area — the fallback
 * for a programme whose editions aren't ingested, or a book typeset elsewhere.
 * It rides the cockpit's footer rather than a card of its own: both paths write
 * the same `project.score_pdf`, the cockpit's status hero already describes
 * whichever book exists, and a second full card gave a rare alternative the same
 * weight as the generator. Uploading/removing reconciles the generator state, so
 * the two producers never silently fight over the field.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/components/ScoreManualUploadRail
 */

import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, Trash2 } from "lucide-react";

import { toastApiError } from "@/shared/api/errors";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Eyebrow } from "@/shared/ui/primitives/typography";

import { projectKeys } from "../api/project.query-keys";
import { ProjectService } from "../api/project.service";

interface ScoreManualUploadRailProps {
  projectId: string;
  /** A book exists on the project — generated or hand-uploaded. */
  hasScorePdf: boolean;
  /** That book is the hand-uploaded one. */
  isManual: boolean;
}

export function ScoreManualUploadRail({
  projectId,
  hasScorePdf,
  isManual,
}: ScoreManualUploadRailProps): React.JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Eyebrow color="muted">
          {t("projects.score_package.manual.title", "Własny plik PDF")}
        </Eyebrow>
        <Caption color="muted">
          {isManual && hasScorePdf
            ? t(
                "projects.score_package.manual.current",
                "Obecna partytura została wgrana ręcznie.",
              )
            : t(
                "projects.score_package.manual.intro",
                "Masz gotową książkę złożoną poza aplikacją? Wgraj ją zamiast generować.",
              )}
        </Caption>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="ghost"
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
            {t("projects.score_package.manual.remove", "Usuń partyturę")}
          </Button>
        )}
      </div>
    </div>
  );
}
