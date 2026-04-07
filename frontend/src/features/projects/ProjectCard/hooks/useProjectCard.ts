/**
 * @file useProjectCard.ts
 * @description Custom hook managing the asynchronous document generation and download lifecycle.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectCard/hooks/useProjectCard
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { ProjectReportEndpoint } from "../../api/project.service";
import { ProjectService } from "../../api/project.service";

export function useProjectCard(projectId: number | string) {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const downloadReport = async (
    endpoint: ProjectReportEndpoint,
    defaultFilename: string,
    loaderKey: string,
  ) => {
    setIsDownloading(loaderKey);
    const toastId = toast.loading(
      t("projects.card.generating_doc", "Generowanie dokumentu..."),
    );

    try {
      const response = await ProjectService.downloadReport(projectId, endpoint);
      const disposition = response.headers["content-disposition"];
      let filename = defaultFilename;

      if (disposition && disposition.indexOf("attachment") !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
          disposition,
        );
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, "");
        }
      }

      const blob = new Blob([response.data], {
        type: response.headers["content-type"],
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(
        t(
          "projects.card.download_success",
          "Dokument został pomyślnie pobrany.",
        ),
        { id: toastId },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t(
              "projects.card.download_unknown_error",
              "Nie udało się wygenerować dokumentu.",
            );
      toast.error(t("common.errors.generation_error", "Błąd generowania"), {
        id: toastId,
        description: message,
      });
    } finally {
      setIsDownloading(null);
    }
  };

  return { downloadReport, isDownloading };
}
