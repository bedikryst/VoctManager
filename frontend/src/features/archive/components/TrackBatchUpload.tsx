/**
 * @file TrackBatchUpload.tsx
 * @description The queue that appears when several audio files land on a
 * piece at once. Every file arrives with the voice its name declares
 * (`(A1) Title.mp3` → Alt 1, `(mp3) Title.mp3` → Tutti, `(TG) Title.mp3` →
 * Tempo giusto) already picked; the
 * rows the name could not settle — a bare `(S)` on a piece with S1 and S2,
 * or no prefix at all — wait for the user's choice before the batch can go.
 *
 * Uploads run one after another, not in parallel: the endpoint is one
 * multipart POST per track and eight of them at once on a phone is how a
 * batch ends with three "network error" rows and no clue which. Failed rows
 * stay in the queue with a retry; the rest leave as they succeed.
 * @architecture Enterprise SaaS 2026
 * @module features/archive/components/TrackBatchUpload
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertCircle, Check, Loader2, RotateCcw, UploadCloud, X } from "lucide-react";

import { parseApiError, resolveErrorCopy } from "@/shared/api/errors";
import type { VoiceLineOption } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Text } from "@/shared/ui/primitives/typography";

import { useUploadTrack } from "../api/archive.queries";
import {
  parseTrackFilename,
  resolveVoiceFromPrefix,
  type VoiceResolution,
} from "../constants/trackFilenames";
import { trackSlotOptions, uploadTargetForSlot } from "../constants/trackSlots";
import type { EnrichedPiece } from "../types/archive.dto";

type Phase = "queued" | "uploading" | "succeeded" | "failed";

interface BatchEntry {
  readonly localId: string;
  readonly file: File;
  readonly resolution: VoiceResolution;
  readonly voice: string;
  readonly phase: Phase;
  readonly error?: string;
}

interface EditionChoice {
  readonly id: string;
  readonly label: string;
}

interface TrackBatchUploadProps {
  readonly piece: EnrichedPiece;
  readonly files: readonly File[];
  readonly voiceLines: VoiceLineOption[];
  /** Codes the piece already speaks of — divisi plus existing takes. */
  readonly scope: readonly string[];
  readonly editions: readonly EditionChoice[];
  readonly onDone: () => void;
}

let batchSeq = 0;
const newLocalId = (): string => `batch-${Date.now()}-${batchSeq++}`;

const buildEntries = (
  files: readonly File[],
  scope: readonly string[],
  dictionary: ReadonlySet<string>,
): BatchEntry[] =>
  files.map((file) => {
    const { prefix } = parseTrackFilename(file.name);
    const resolution = resolveVoiceFromPrefix(prefix, scope, dictionary);
    return {
      localId: newLocalId(),
      file,
      resolution,
      voice: resolution.kind === "resolved" ? resolution.code : "",
      phase: "queued",
    };
  });

export const TrackBatchUpload = ({
  piece,
  files,
  voiceLines,
  scope,
  editions,
  onDone,
}: TrackBatchUploadProps): React.JSX.Element => {
  const { t } = useTranslation();
  const uploadMutation = useUploadTrack();

  const dictionary = useMemo(
    () => new Set(voiceLines.map((vl) => String(vl.value))),
    [voiceLines],
  );
  const slotOptions = useMemo(() => trackSlotOptions(voiceLines, t), [voiceLines, t]);
  const [entries, setEntries] = useState<BatchEntry[]>([]);
  const [editionId, setEditionId] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Files dropped while the queue is open join it; the rows already in it —
  // uploaded, failed or hand-picked — are never rebuilt from props.
  const seen = useRef<WeakSet<File>>(new WeakSet());
  useEffect(() => {
    const fresh = files.filter((file) => !seen.current.has(file));
    if (fresh.length === 0) return;
    fresh.forEach((file) => seen.current.add(file));
    setEntries((current) => [...current, ...buildEntries(fresh, scope, dictionary)]);
  }, [files, scope, dictionary]);

  const patchEntry = (localId: string, patch: Partial<BatchEntry>) =>
    setEntries((current) =>
      current.map((entry) =>
        entry.localId === localId ? { ...entry, ...patch } : entry,
      ),
    );

  const removeEntry = (localId: string) =>
    setEntries((current) => current.filter((entry) => entry.localId !== localId));

  const pending = entries.filter(
    (entry) => entry.phase === "queued" || entry.phase === "failed",
  );
  const unresolved = pending.filter((entry) => !entry.voice);
  const canRun = pending.length > 0 && unresolved.length === 0 && !isRunning;

  const run = async () => {
    if (!canRun) return;
    setIsRunning(true);
    let failed = 0;
    for (const entry of pending) {
      patchEntry(entry.localId, { phase: "uploading", error: undefined });
      try {
        await uploadMutation.mutateAsync({
          pieceId: piece.id,
          ...uploadTargetForSlot(entry.voice),
          file: entry.file,
          editionId: editionId || null,
        });
        patchEntry(entry.localId, { phase: "succeeded" });
      } catch (error) {
        failed += 1;
        patchEntry(entry.localId, {
          phase: "failed",
          error: resolveErrorCopy(parseApiError(error), t).detail,
        });
      }
    }
    setIsRunning(false);

    const succeeded = pending.length - failed;
    if (succeeded > 0) {
      toast.success(
        t("archive.row_tracks.batch.toast_success", {
          defaultValue: "Dodano {{count}} ścieżek",
          count: succeeded,
        }),
      );
    }
    if (failed === 0) onDone();
  };

  const voiceLabel = (code: string): string =>
    slotOptions.find((option) => option.value === code)?.label ?? code;

  return (
    <div className="flex flex-col gap-2 rounded-nested border border-ethereal-gold/30 bg-ethereal-gold/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text size="sm" weight="semibold">
          {t("archive.row_tracks.batch.title", {
            defaultValue: "{{count}} plików do wgrania",
            count: pending.length,
          })}
        </Text>
        {editions.length > 1 && (
          <Select
            value={editionId}
            onValueChange={setEditionId}
            disabled={isRunning}
            className="md:w-52"
            placeholder={t("archive.row_tracks.edition_any", "Wspólne dla wydań")}
            ariaLabel={t("archive.row_tracks.edition", "Wydanie")}
            options={editions.map((edition) => ({
              value: edition.id,
              label: edition.label,
            }))}
          />
        )}
      </div>

      {unresolved.length > 0 && (
        <Caption color="muted">
          {t("archive.row_tracks.batch.unresolved", {
            defaultValue:
              "{{count}} plików nie ma jednoznacznego głosu w nazwie — wybierz go ręcznie.",
            count: unresolved.length,
          })}
        </Caption>
      )}

      <ul role="list" className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const finished = entry.phase === "succeeded";
          return (
            <li
              key={entry.localId}
              className={cn(
                "flex flex-col gap-1 rounded-control border px-2.5 py-1.5 md:flex-row md:items-center md:gap-3",
                finished
                  ? "border-ethereal-sage/30 bg-ethereal-sage/5"
                  : entry.phase === "failed"
                    ? "border-ethereal-crimson/30 bg-ethereal-crimson/5"
                    : "border-hairline bg-ethereal-alabaster/70",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {entry.phase === "uploading" && (
                  <Loader2 size={13} className="shrink-0 animate-spin text-ethereal-gold" aria-hidden="true" />
                )}
                {finished && (
                  <Check size={13} className="shrink-0 text-ethereal-sage" aria-hidden="true" />
                )}
                {entry.phase === "failed" && (
                  <AlertCircle size={13} className="shrink-0 text-ethereal-crimson" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <Text size="xs" className="truncate" title={entry.file.name}>
                    {entry.file.name}
                  </Text>
                  {entry.error && (
                    <Caption color="crimson" className="block truncate">
                      {entry.error}
                    </Caption>
                  )}
                  {!entry.voice && entry.resolution.kind === "ambiguous" && (
                    <Caption color="muted" className="block">
                      {t("archive.row_tracks.batch.ambiguous", {
                        defaultValue: "W tym utworze: {{options}} — który?",
                        options: entry.resolution.candidates.map(voiceLabel).join(", "),
                      })}
                    </Caption>
                  )}
                </div>
              </div>

              {finished ? (
                <Caption color="muted" className="shrink-0">
                  {voiceLabel(entry.voice)}
                </Caption>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Select
                    value={entry.voice}
                    onValueChange={(value) => patchEntry(entry.localId, { voice: value })}
                    disabled={isRunning}
                    className="w-40"
                    placeholder={t("archive.row_tracks.pick", "Wybierz")}
                    ariaLabel={t("archive.row_tracks.batch.voice_for", {
                      defaultValue: "Głos dla {{name}}",
                      name: entry.file.name,
                    })}
                    options={slotOptions}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEntry(entry.localId)}
                    disabled={isRunning}
                    aria-label={t("archive.row_tracks.batch.remove", {
                      defaultValue: "Pomiń {{name}}",
                      name: entry.file.name,
                    })}
                  >
                    <X size={13} aria-hidden="true" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDone}
          disabled={isRunning}
        >
          {pending.length === 0
            ? t("common.actions.close", "Zamknij")
            : t("common.actions.cancel", "Anuluj")}
        </Button>
        {pending.length > 0 && (
          <Button
            type="button"
            size="sm"
            onClick={() => void run()}
            disabled={!canRun}
            isLoading={isRunning}
            leftIcon={
              isRunning ? undefined : entries.some((e) => e.phase === "failed") ? (
                <RotateCcw size={13} aria-hidden="true" />
              ) : (
                <UploadCloud size={13} aria-hidden="true" />
              )
            }
          >
            {t("archive.row_tracks.batch.upload", {
              defaultValue: "Wgraj ({{count}})",
              count: pending.length,
            })}
          </Button>
        )}
      </div>
    </div>
  );
};
