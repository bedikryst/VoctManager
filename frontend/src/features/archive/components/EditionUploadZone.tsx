/**
 * @file EditionUploadZone.tsx
 * @description Drag-and-drop multi-file upload zone for PDF scores. Surfaces
 * in two places: at the top of the Archive page (no piece context — uploads
 * become new editions resolved into pieces by the pipeline), and inside the
 * AI Review tab (with `pieceId` so uploads attach as another edition of an
 * existing piece, skipping the resolver step).
 *
 * Server-side the ingestion Celery chain runs per upload. Once an upload
 * completes the row appears in the Archive list (or its editions sub-list
 * inside the editor) via the auto-polling pieces query.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/EditionUploadZone
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
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

import { parseApiError, resolveErrorCopy } from "@/shared/api/errors";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { SectionHeader } from "@/shared/ui/composites/SectionHeader";
import { Button } from "@/shared/ui/primitives/Button";
import { Caption, Heading, Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

import { useLiveIngestion, useUploadEdition } from "../api/archive.queries";
import { isOverloadWait, liveIngestionLabel } from "../constants/ingestionProgress";

const fmtCents = (cents?: number): string =>
  cents && cents > 0 ? `$${(cents / 100).toFixed(2)}` : "$0.00";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

type UploadPhase = "queued" | "uploading" | "succeeded" | "failed";

interface PendingUpload {
  readonly localId: string;
  readonly file: File;
  phase: UploadPhase;
  progress: number;
  errorMessage?: string;
  /** Set once the PDF is accepted — keys the live ingestion-progress poll. */
  editionId?: string;
}

interface EditionUploadZoneProps {
  /** Pre-attach to an existing piece (used inside the AI Review tab). */
  readonly pieceId?: string;
  /** Compact variant for inside an existing card (no outer GlassCard / header). */
  readonly compact?: boolean;
}

const newLocalId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const fmtSizeMB = (bytes: number): string =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const EditionUploadZone = ({
  pieceId,
  compact = false,
}: EditionUploadZoneProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [uploads, setUploads] = useState<readonly PendingUpload[]>([]);
  const { mutateAsync: uploadEdition } = useUploadEdition();

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
        const created = await uploadEdition({
          dto: {
            pdf_file: entry.file,
            original_filename: entry.file.name,
            piece_id: pieceId,
          },
          onProgress: (loaded, total) => {
            updateUpload(entry.localId, {
              progress: Math.min(100, Math.round((loaded / total) * 100)),
            });
          },
        });
        // `succeeded` here means the PDF reached the server and the AI pipeline
        // was dispatched — not that ingestion finished. Stash the edition id so
        // the row can poll and surface the live AI step.
        updateUpload(entry.localId, {
          phase: "succeeded",
          progress: 100,
          editionId: created.id,
        });
        toast.success(
          t(
            "archive.upload.toast_success",
            "{{name}} — pipeline uruchomiony",
            { name: entry.file.name },
          ),
        );
      } catch (err) {
        // Translate the server's real reason into the UI language (stable code →
        // curated copy, single rejected field → its message) instead of axios's
        // opaque "Request failed with status code 400". Persisted on the row +
        // toast so a failed ingest reads clearly at a glance.
        const normalized = parseApiError(err);
        const { detail } = resolveErrorCopy(normalized, t);
        updateUpload(entry.localId, { phase: "failed", errorMessage: detail });
        toast.error(`${entry.file.name} — ${detail}`);
      }
    },
    [pieceId, uploadEdition, updateUpload, t],
  );

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]): void => {
      for (const rej of rejections) {
        const reason = rej.errors[0];
        const message =
          reason?.code === "file-too-large"
            ? t("archive.upload.error_too_large", "Plik przekracza limit 50 MB")
            : reason?.code === "file-invalid-type"
              ? t(
                  "archive.upload.error_wrong_type",
                  "Tylko pliki PDF są akceptowane",
                )
              : (reason?.message ??
                t("archive.upload.error_generic", "Plik odrzucony"));
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
    useFsAccessApi: false,
  });

  const removeRow = (localId: string): void =>
    setUploads((current) => current.filter((u) => u.localId !== localId));

  const clearFinished = (): void =>
    setUploads((current) =>
      current.filter((u) => u.phase !== "succeeded" && u.phase !== "failed"),
    );

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

  const dropzone = (
    <>
      <div
        {...getRootProps({
          className: cn(
            "group/dropzone relative flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300 cursor-pointer outline-none",
            isDragActive
              ? "border-ethereal-gold/70 bg-ethereal-gold/10 scale-[1.01]"
              : "border-ethereal-incense/30 hover:border-ethereal-gold/40 hover:bg-ethereal-parchment/30",
            isFocused &&
              "ring-2 ring-ethereal-gold/40 ring-offset-2 ring-offset-transparent",
            compact && "py-8",
          ),
          "aria-label": t(
            "archive.upload.dropzone_aria",
            "Strefa upuszczania PDF z partyturą",
          ),
        })}
      >
        <input {...getInputProps()} />
        <motion.div
          animate={{ y: isDragActive ? -4 : 0, scale: isDragActive ? 1.05 : 1 }}
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
            ? t("archive.upload.drop_active", "Upuść tutaj, by dodać do kolejki")
            : pieceId
              ? t(
                  "archive.upload.title_existing",
                  "Dodaj kolejne wydanie tego utworu",
                )
              : t("archive.upload.title", "Przeciągnij PDF-y partytur")}
        </Heading>
        <Text color="muted" size="sm">
          {t(
            "archive.upload.subtitle",
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
                      "archive.upload.in_flight",
                      "{{count}} w trakcie wysyłki",
                      { count: inFlightCount },
                    )
                  : t(
                      "archive.upload.done",
                      "Wszystkie wysyłki zakończone",
                    )}
              </Caption>
              {hasFinished && (
                <Button variant="ghost" size="sm" onClick={clearFinished}>
                  {t("archive.upload.clear_finished", "Wyczyść ukończone")}
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
    </>
  );

  if (compact) return dropzone;

  return (
    <GlassCard variant="ethereal" padding="lg" isHoverable={false}>
      <SectionHeader
        title={t("archive.upload.section", "Upload partytur")}
      />
      {dropzone}
    </GlassCard>
  );
};

interface UploadRowProps {
  readonly entry: PendingUpload;
  readonly onRemove: (localId: string) => void;
}

type RowView =
  | "queued"
  | "uploading"
  | "upload_failed"
  | "ingesting"
  | "awaiting"
  | "ready"
  | "ingest_failed";

const UploadRow = ({ entry, onRemove }: UploadRowProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { file, phase, progress, errorMessage, editionId } = entry;

  // Live ingestion over SSE the instant the PDF is accepted — the row shows the
  // real AI step (preparing → analyzing → resolving → … ), the running cost, and
  // the "service busy, retrying" state, all pushed from the server. The pieces
  // list won't surface this edition until it's resolved onto a Piece several
  // seconds in, so this is the only early signal.
  const live = useLiveIngestion(editionId ?? null);
  const ingStatus = live?.ingestion_status;
  const overloaded = isOverloadWait(live?.ingestion_progress);

  const view: RowView =
    phase === "queued"
      ? "queued"
      : phase === "uploading"
        ? "uploading"
        : phase === "failed"
          ? "upload_failed"
          : ingStatus === "FAIL"
            ? "ingest_failed"
            : ingStatus === "RDY "
              ? "ready"
              : ingStatus === "AWAI"
                ? "awaiting"
                : "ingesting"; // HTTP upload done, pipeline still running

  const isErr = view === "upload_failed" || view === "ingest_failed";

  const avatarTone = isErr
    ? "border-ethereal-crimson/50 bg-ethereal-crimson/10 text-ethereal-crimson"
    : view === "ready"
      ? "border-ethereal-sage/50 bg-ethereal-sage/15 text-ethereal-sage"
      : view === "awaiting"
        ? "border-ethereal-gold/50 bg-ethereal-gold/15 text-ethereal-gold"
        : overloaded
          ? "border-ethereal-gold/50 bg-ethereal-gold/10 text-ethereal-gold"
          : view === "ingesting"
            ? "border-ethereal-amethyst/40 bg-ethereal-amethyst/10 text-ethereal-amethyst"
            : "border-ethereal-incense/30 bg-ethereal-marble/80 text-ethereal-graphite";

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
          avatarTone,
        )}
        aria-hidden="true"
      >
        {isErr ? (
          <CircleAlert size={16} strokeWidth={2} />
        ) : view === "ready" ? (
          <CheckCircle2 size={16} strokeWidth={2} />
        ) : view === "awaiting" ? (
          <Sparkles size={16} strokeWidth={2} />
        ) : view === "ingesting" || view === "uploading" ? (
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
          {view === "uploading" && <Caption color="muted">{progress}%</Caption>}
          {view === "ingesting" && (
            <Caption color={overloaded ? "gold" : "muted"}>
              {liveIngestionLabel(t, ingStatus ?? "PEND", live?.ingestion_progress)}
            </Caption>
          )}
          {view === "ingesting" && (live?.ingestion_cost_cents_lifetime ?? 0) > 0 && (
            <Caption color="muted">
              {fmtCents(live?.ingestion_cost_cents_lifetime)}
            </Caption>
          )}
          {view === "awaiting" && (
            <Caption color="muted">
              {t("archive.upload.row_awaiting", "Gotowe — sprawdź i zatwierdź")}
            </Caption>
          )}
          {view === "ready" && (
            <Caption color="muted">
              {t("archive.upload.row_ready", "Zatwierdzone")}
            </Caption>
          )}
          {view === "upload_failed" && (
            <Caption color="crimson">
              {errorMessage ?? t("archive.upload.row_failed", "Błąd wysyłki")}
            </Caption>
          )}
          {view === "ingest_failed" && (
            <Caption color="crimson">
                {t(
                  "archive.upload.row_ingest_failed",
                  "Przetwarzanie nie powiodło się",
                )}
            </Caption>
          )}
        </div>
        {(view === "uploading" || view === "queued") && (
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
            "archive.upload.row_remove_aria",
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
