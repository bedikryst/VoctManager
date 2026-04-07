/**
 * @file useProjectCard.ts
 * @description Custom hook managing the asynchronous document generation and download lifecycle.
 * Implements the "Headless UI" pattern for file downloads. Encapsulates Blob memory
 * management (preventing memory leaks via revokeObjectURL), HTTP header parsing for
 * dynamic filenames, and integrated toast notification states.
 * @module panel/projects/ProjectCard/hooks/useProjectCard
 */

import { useState } from "react";
import { toast } from "sonner";
import api from "../../../../shared/api/api";

export function useProjectCard(projectId: number | string) {
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const downloadReport = async (
    endpoint: string,
    defaultFilename: string,
    loaderKey: string,
  ) => {
    setIsDownloading(loaderKey);
    const toastId = toast.loading("Generowanie dokumentu...");

    try {
      const response = await api.get(
        `/api/projects/${projectId}/${endpoint}/`,
        { responseType: "blob" },
      );

      // Extract filename from Content-Disposition header if available
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

      // Safely process the blob and trigger browser download
      const blob = new Blob([response.data], {
        type: response.headers["content-type"],
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();

      // Cleanup DOM and memory
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Dokument został pomyślnie pobrany.", { id: toastId });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Nie udało się wygenerować dokumentu.";
      toast.error("Błąd generowania", { id: toastId, description: message });
    } finally {
      setIsDownloading(null);
    }
  };

  return { downloadReport, isDownloading };
}
