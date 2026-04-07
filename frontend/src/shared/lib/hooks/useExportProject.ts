/**
 * @file useExportProject.ts
 * @description Custom React hook for managing asynchronous ZIP export tasks.
 * Implements polling logic to check Celery task status, automatically handling
 * timeouts, state transitions, memory cleanup, and payload mapping.
 * @architecture Enterprise 2026 Standards
 * @module hooks/useExportProject
 */

import { useState, useRef, useCallback, useEffect } from "react";
import api from "../../api/api";

type ExportStatus = "idle" | "processing" | "success" | "error";

interface UseExportProjectReturn {
  startExport: (projectId: string | number) => Promise<void>;
  status: ExportStatus;
  downloadUrl: string | null;
  error: string | null;
  reset: () => void;
}

export const useExportProject = (): UseExportProjectReturn => {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const checkStatus = useCallback(async (taskId: string) => {
    try {
      const response = await api.get(
        `/api/participations/check_zip_status/?task_id=${taskId}`,
      );
      const data = response.data;

      if (data.state === "SUCCESS") {
        setStatus("success");
        const finalUrl = data.file_url;

        if (finalUrl) {
          const fullUrl = finalUrl.startsWith("http")
            ? finalUrl
            : `${api.defaults.baseURL || ""}${finalUrl}`;
          setDownloadUrl(fullUrl);
        } else {
          setStatus("error");
          setError(
            "Zadanie zakończone, ale serwer nie zwrócił linku do pliku.",
          );
        }
      } else if (data.state === "FAILURE" || data.state === "FAILED") {
        setStatus("error");
        setError(
          data.error || "Wystąpił błąd na serwerze podczas generowania paczki.",
        );
      } else {
        timeoutRef.current = setTimeout(() => checkStatus(taskId), 2000);
      }
    } catch (err) {
      setStatus("error");
      setError("Błąd podczas odpytywania serwera o status zadania.");
    }
  }, []);

  const startExport = async (projectId: string | number) => {
    setStatus("processing");
    setError(null);
    setDownloadUrl(null);

    try {
      const response = await api.post(
        "/api/participations/request_project_zip/",
        {
          project_id: projectId,
        },
      );

      if (response.data.task_id) {
        timeoutRef.current = setTimeout(
          () => checkStatus(response.data.task_id),
          1500,
        );
      } else {
        setStatus("error");
        setError("Serwer nie przydzielił numeru zadania (Task ID).");
      }
    } catch (err: any) {
      setStatus("error");
      setError(
        err.response?.data?.error ||
          "Nie udało się rozpocząć zadania. Serwer nie odpowiada.",
      );
    }
  };

  const reset = () => {
    setStatus("idle");
    setDownloadUrl(null);
    setError(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return { startExport, status, downloadUrl, error, reset };
};
