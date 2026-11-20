/**
 * @file useEditionUploads.ts
 * @description Sends score PDFs as new editions and keeps one row per file for
 * the surface that took them: queued, uploading, sent (the row then follows the
 * pipeline by its edition id), or failed with the server's reason.
 *
 * A file can also be held before it is sent, for a surface that asks one thing
 * about it first: the piece card asks a Latin piece's pronunciation after the
 * drop, because the choice travels with the upload and cannot follow it.
 * @module features/archive/hooks/useEditionUploads
 */

import { useCallback, useMemo, useState } from "react";
import type { DropzoneOptions, FileRejection } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { parseApiError, resolveErrorCopy } from "@/shared/api/errors";
import type { LatinPronunciationCode } from "@/shared/types";

import { useUploadEdition } from "../api/archive.queries";
import { DEFAULT_LATIN_PRONUNCIATION } from "../constants/latinPronunciation";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** What every score drop target accepts. */
export const SCORE_DROP_OPTIONS = {
  accept: { "application/pdf": [".pdf"] },
  maxSize: MAX_FILE_BYTES,
  multiple: true,
  useFsAccessApi: false,
} as const satisfies DropzoneOptions;

export type UploadPhase = "held" | "queued" | "uploading" | "succeeded" | "failed";

export interface PendingUpload {
  readonly localId: string;
  readonly file: File;
  readonly phase: UploadPhase;
  readonly progress: number;
  readonly errorMessage?: string;
  /** Set once the PDF is accepted; keys the live ingestion progress. */
  readonly editionId?: string;
}

const newLocalId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const formatFileSize = (bytes: number): string =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const useEditionUploads = (pieceId?: string) => {
  const { t } = useTranslation();
  const [uploads, setUploads] = useState<readonly PendingUpload[]>([]);
  const { mutateAsync: uploadEdition } = useUploadEdition();

  const update = useCallback((localId: string, patch: Partial<PendingUpload>): void => {
    setUploads((current) =>
      current.map((upload) => (upload.localId === localId ? { ...upload, ...patch } : upload)),
    );
  }, []);

  const send = useCallback(
    async (entry: PendingUpload, latinSystem: LatinPronunciationCode): Promise<void> => {
      update(entry.localId, { phase: "uploading", progress: 0 });
      try {
        const created = await uploadEdition({
          dto: {
            pdf_file: entry.file,
            original_filename: entry.file.name,
            piece_id: pieceId,
            latin_system: latinSystem === DEFAULT_LATIN_PRONUNCIATION ? undefined : latinSystem,
          },
          onProgress: (loaded, total) => {
            update(entry.localId, { progress: Math.min(100, Math.round((loaded / total) * 100)) });
          },
        });
        // `succeeded` means the PDF reached the server and the pipeline was
        // dispatched, not that the analysis finished.
        update(entry.localId, { phase: "succeeded", progress: 100, editionId: created.id });
        toast.success(t("archive.upload.toast_success", "{{name}} — pipeline uruchomiony", {
          name: entry.file.name,
        }));
      } catch (err) {
        // The server's reason in the UI language, kept on the row as well.
        const { detail } = resolveErrorCopy(parseApiError(err), t);
        update(entry.localId, { phase: "failed", errorMessage: detail });
        toast.error(`${entry.file.name} — ${detail}`);
      }
    },
    [pieceId, uploadEdition, update, t],
  );

  const reject = useCallback((rejections: readonly FileRejection[]): void => {
    for (const rejection of rejections) {
      const reason = rejection.errors[0];
      const message =
        reason?.code === "file-too-large"
          ? t("archive.upload.error_too_large", "Plik przekracza limit 50 MB")
          : reason?.code === "file-invalid-type"
            ? t("archive.upload.error_wrong_type", "Tylko pliki PDF są akceptowane")
            : (reason?.message ?? t("archive.upload.error_generic", "Plik odrzucony"));
      toast.error(`${rejection.file.name} — ${message}`);
    }
  }, [t]);

  /** Sends at once with `latinSystem`, or holds the files when it is null. */
  const add = useCallback(
    (files: readonly File[], latinSystem: LatinPronunciationCode | null): void => {
      if (files.length === 0) return;
      const entries: PendingUpload[] = files.map((file) => ({
        localId: newLocalId(),
        file,
        phase: latinSystem ? "queued" : "held",
        progress: 0,
      }));
      setUploads((current) => [...entries, ...current]);
      if (latinSystem) entries.forEach((entry) => void send(entry, latinSystem));
    },
    [send],
  );

  const remove = useCallback((localId: string): void => {
    setUploads((current) => current.filter((upload) => upload.localId !== localId));
  }, []);

  const clearFinished = useCallback((): void => {
    setUploads((current) =>
      current.filter((upload) => upload.phase !== "succeeded" && upload.phase !== "failed"),
    );
  }, []);

  const hasFinished = useMemo(
    () => uploads.some((upload) => upload.phase === "succeeded" || upload.phase === "failed"),
    [uploads],
  );
  const inFlightCount = useMemo(
    () => uploads.filter((upload) => upload.phase === "uploading" || upload.phase === "queued").length,
    [uploads],
  );

  return { uploads, add, send, reject, remove, clearFinished, hasFinished, inFlightCount };
};

export type EditionUploads = ReturnType<typeof useEditionUploads>;
