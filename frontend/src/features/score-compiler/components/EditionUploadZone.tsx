/**
 * @file EditionUploadZone.tsx
 * @description Drag-and-drop multi-file upload surface for the Score Package
 * Compiler. Uses react-dropzone for the picker (handles folder drops, MIME
 * rejection reasons, and keyboard focus/Enter activation natively), then
 * dispatches one multipart POST per accepted PDF in parallel. The actual
 * ingestion pipeline runs server-side; once each upload completes, the new
 * ScoreEdition row appears in EditionStatusList via the polling query.
 * @architecture Enterprise SaaS 2026
 * @module features/score-compiler/components/EditionUploadZone
 */

import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useDropzone,
  type FileRejection,
} from "react-dropzone";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  CheckCircle2,
  CircleAlert,
  FileText,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Caption,
  Heading,
  Text,
} from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

import { useUploadScoreEdition } from "../api/score-compiler.queries";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

type UploadPhase = "queued" | "uploading" | "succeeded" | "failed";

interface PendingUpload {
  readonly localId: string;
  readonly file: File;
  phase: UploadPhase;
  progress: number; // 0–100
  errorMessage?: string;
  remoteEditionId?: string;
}

const fmtSizeMB = (bytes: number): string =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const newLocalId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const EditionUploadZone = (): React.JSX.Element => {
  const { t } = useTranslation();
  const [uploads, setUploads] = useState<readonly PendingUpload[]>([]);
  const { mutateAsync: uploadEdition } = useUploadScoreEdition();

  const updateUpload = useCallback(
    (localId: string, patch: Partial<PendingUpload>): void => {
      setUploads((current) =>
        current.map((u) => (u.localId === localId ? { ...u, ...patch } : u)),
      );
    },
    [],
  );

  const startUpload = useCallback(
    async (entry: PendingUpload): Promise<void> => {
      updateUpload(entry.localId, { phase: "uploading", progress: 0 });
      try {
        const result = await uploadEdition({
          dto: { pdf_file: entry.file, original_filename: entry.file.name },
          onProgress: (loaded, total) => {
            const pct = Math.min(100, Math.round((loaded / total) * 100));
            updateUpload(entry.localId, { progress: pct });
          },
        });
        updateUpload(entry.localId, {
          phase: "succeeded",
          progress: 100,
          remoteEditionId: result.id,
        });
        toast.success(
          t(
            "score_compiler.upload.toast_success",
            "{{name}} — pipeline uruchomiony",
            { name: entry.file.name },
          ),
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t(
                "score_compiler.upload.toast_failed",
                "Upload nieudany",
              );
        updateUpload(entry.localId, {
          phase: "failed",
          errorMessage: message,
        });
        toast.error(`${entry.file.name} — ${message}`);
      }
    },
    [uploadEdition, updateUpload, t],
  );

  // react-dropzone already filters by MIME + size; we only have to translate
  // rejection reasons into a single human-readable toast per file and enqueue
  // the accepted ones.
  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]): void => {
      for (const rej of rejections) {
        const reason = rej.errors[0];
        const message =
          reason?.code === "file-too-large"
            ? t(
                "score_compiler.upload.error_too_large",
                "Plik przekracza limit 50 MB",
              )
            : reason?.code === "file-invalid-type"
              ? t(
                  "score_compiler.upload.error_wrong_type",
                  "Tylko pliki PDF są akceptowane",
                )
              : (reason?.message ??
                t(
                  "score_compiler.upload.error_generic",
                  "Plik odrzucony",
                ));
        toast.error(`${rej.file.name} — ${message}`);
      }

      if (accepted.length === 0) return;

      const entries: PendingUpload[] = accepted.map((file) => ({
        localId: newLocalId(),
        file,
        phase: "queued",
        progress: 0,
      }));
      setUploads((current) => [...entries, ...current]);
      // Parallel dispatch — backend chains are independent per edition, so
      // serialising buys nothing.
      entries.forEach((entry) => {
        void startUpload(entry);
      });
    },
    [startUpload, t],
  );

  const { getRootProps, getInputProps, isDragActive, isFocused } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_FILE_BYTES,
    multiple: true,
    // Allow folder drops — react-dropzone walks the entries via the
    // webkit File System Access API and yields each .pdf inside.
    useFsAccessApi: false,
  });

  const removeRow = (localId: string): void => {
    setUploads((current) => current.filter((u) => u.localId !== localId));
  };

  const clearFinished = (): void => {
    setUploads((current) =>
      current.filter((u) => u.phase !== "succeeded" && u.phase !== "failed"),
    );
  };

  const hasFinished = useMemo(
    () => uploads.some((u) => u.phase === "succeeded" || u.phase === "failed"),
    [uploads],
  );
  const inFlightCount = useMemo(
    () =>
      uploads.filter((u) => u.phase === "uploading" || u.phase === "queued")
        .length,
    [uploads],
  );

  return (
    <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
      <SectionHeader
        title={t("score_compiler.upload.section", "Upload partytur")}
      />

      <div
        {...getRootProps({
          className: cn(
            "group/dropzone relative flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300 cursor-pointer outline-none",
            isDragActive
              ? "border-ethereal-gold/70 bg-ethereal-gold/10 scale-[1.01]"
              : "border-ethereal-incense/30 hover:border-ethereal-gold/40 hover:bg-ethereal-parchment/30",
            isFocused && "ring-2 ring-ethereal-gold/40 ring-offset-2 ring-offset-transparent",
          ),
          "aria-label": t(
            "score_compiler.upload.dropzone_aria",
            "Strefa upuszczania PDF z partyturą",
          ),
        })}
      >
        <input {...getInputProps()} />

        <motion.div
          animate={{
            y: isDragActive ? -4 : 0,
            scale: isDragActive ? 1.05 : 1,
          }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors",
            isDragActive
              ? "border-ethereal-gold/60 bg-ethereal-gold/15 text-ethereal-gold"
              : "border-ethereal-incense/30 bg-ethereal-marble/70 text-ethereal-graphite group-hover/dropzone:text-ethereal-gold",
          )}
          aria-hidden="true"
        >
          <UploadCloud size={26} strokeWidth={1.6} />
        </motion.div>

        <Heading as="h3" size="lg" weight="medium">
          {isDragActive
            ? t(
                "score_compiler.upload.drop_active",
                "Upuść tutaj, by dodać do kolejki",
              )
            : t(
                "score_compiler.upload.title",
                "Przeciągnij PDF-y partytur",
              )}
        </Heading>
        <Text color="muted" size="sm">
          {t(
            "score_compiler.upload.subtitle",
            "lub kliknij, by wybrać. Obsługujemy wiele plików naraz · max 50 MB każdy",
          )}
        </Text>
      </div>

      <AnimatePresence initial={false}>
        {uploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mt-6 flex flex-col gap-3"
          >
            <div className="flex items-baseline justify-between">
              <Caption color="muted">
                {inFlightCount > 0
                  ? t(
                      "score_compiler.upload.in_flight",
                      "{{count}} w trakcie wysyłki",
                      { count: inFlightCount },
                    )
                  : t(
                      "score_compiler.upload.done",
                      "Wszystkie wysyłki zakończone",
                    )}
              </Caption>
              {hasFinished && (
                <Button variant="ghost" size="sm" onClick={clearFinished}>
                  {t(
                    "score_compiler.upload.clear_finished",
                    "Wyczyść ukończone",
                  )}
                </Button>
              )}
            </div>

            <ul role="list" aria-live="polite" className="flex flex-col gap-2">
              {uploads.map((entry) => (
                <UploadRow
                  key={entry.localId}
                  entry={entry}
                  onRemove={removeRow}
                />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};

interface UploadRowProps {
  readonly entry: PendingUpload;
  readonly onRemove: (localId: string) => void;
}

const UploadRow = ({ entry, onRemove }: UploadRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { file, phase, progress, errorMessage } = entry;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-3 rounded-2xl border border-ethereal-incense/20 bg-ethereal-alabaster/70 px-4 py-3"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          phase === "succeeded"
            ? "border-ethereal-sage/50 bg-ethereal-sage/15 text-ethereal-sage"
            : phase === "failed"
              ? "border-ethereal-crimson/50 bg-ethereal-crimson/10 text-ethereal-crimson"
              : "border-ethereal-incense/30 bg-ethereal-marble/80 text-ethereal-graphite",
        )}
        aria-hidden="true"
      >
        {phase === "succeeded" ? (
          <CheckCircle2 size={16} strokeWidth={2} />
        ) : phase === "failed" ? (
          <CircleAlert size={16} strokeWidth={2} />
        ) : phase === "uploading" ? (
          <Loader2 size={16} strokeWidth={2} className="animate-spin" />
        ) : (
          <FileText size={16} strokeWidth={1.8} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <Text size="sm" weight="semibold" truncate className="block">
          {file.name}
        </Text>
        <div className="mt-1 flex items-center gap-3">
          <Caption color="muted">{fmtSizeMB(file.size)}</Caption>
          {phase === "uploading" && (
            <Caption color="muted">{progress}%</Caption>
          )}
          {phase === "succeeded" && (
            <Caption color="muted">
              {t(
                "score_compiler.upload.row_succeeded",
                "Wysłano · pipeline uruchomiony",
              )}
            </Caption>
          )}
          {phase === "failed" && (
            <Caption color="crimson">
              {errorMessage ??
                t("score_compiler.upload.row_failed", "Błąd wysyłki")}
            </Caption>
          )}
        </div>
        {(phase === "uploading" || phase === "queued") && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ethereal-incense/15"
          >
            <motion.div
              className="h-full bg-ethereal-gold/70"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        )}
      </div>

      {(phase === "succeeded" || phase === "failed") && (
        <Button
          variant="icon"
          size="icon"
          onClick={() => onRemove(entry.localId)}
          aria-label={t(
            "score_compiler.upload.row_remove_aria",
            "Usuń {{name}} z listy",
            { name: file.name },
          )}
          className="h-8 w-8"
        >
          <X size={14} aria-hidden="true" />
        </Button>
      )}
    </motion.li>
  );
};
