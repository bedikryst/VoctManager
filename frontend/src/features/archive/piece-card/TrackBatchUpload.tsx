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
 *
 * It sits in the card's tracks section and speaks its language: rows between
 * hairlines, a row's state in its icon and text rather than a tinted box.
 * @module features/archive/piece-card/TrackBatchUpload
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertCircle, Check, Loader2, RotateCcw, UploadCloud, X } from "lucide-react";

import { parseApiError, resolveErrorCopy } from "@/shared/api/errors";
import type { VoiceLineOption } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { PROPERTY_CONTROL_CLASS } from "@/shared/ui/composites/PropertyRow";
import { Button } from "@/shared/ui/primitives/Button";
import { Select } from "@/shared/ui/primitives/Select";
import { Text } from "@/shared/ui/primitives/typography";

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
  // The first files are rows from the first render, so the queue has its
  // height when the card scrolls to it.
  const [entries, setEntries] = useState<BatchEntry[]>(() => buildEntries(files, scope, dictionary));
  const [editionId, setEditionId] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Files dropped while the queue is open join it; the rows already in it —
  // uploaded, failed or hand-picked — are never rebuilt from props.
  const seen = useRef<WeakSet<File>>(new WeakSet(files));
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
      toast.success(t("archive.tracks.batch.toast_success", { count: succeeded }));
    }
    if (failed === 0) onDone();
  };

  const voiceLabel = (code: string): string =>
    slotOptions.find((option) => option.value === code)?.label ?? code;

  return (
    <div className="space-y-2 border-t border-hairline py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text weight="medium">
          {t("archive.tracks.batch.title", { count: pending.length })}
        </Text>
        {editions.length > 1 && (
          <Select
            value={editionId}
            onValueChange={setEditionId}
            disabled={isRunning}
            variant="property"
            className="w-fit max-w-full"
            placeholder={t("archive.tracks.edition_any")}
            clearLabel={t("archive.tracks.edition_any")}
            ariaLabel={t("archive.tracks.edition")}
            options={editions.map((edition) => ({
              value: edition.id,
              label: edition.label,
            }))}
          />
        )}
      </div>

      {unresolved.length > 0 && (
        <Text size="sm" color="muted">
          {t("archive.tracks.batch.unresolved", { count: unresolved.length })}
        </Text>
      )}

      <ul className="border-b border-hairline">
        {entries.map((entry) => {
          const finished = entry.phase === "succeeded";
          return (
            <li
              key={entry.localId}
              className="flex flex-col gap-1 border-t border-hairline py-2 md:flex-row md:items-center md:gap-3"
            >
              <div className="flex min-w-0 flex-1 items-start gap-2">
                {entry.phase === "uploading" && (
                  <Loader2 size={16} className="mt-1 shrink-0 animate-spin text-ethereal-gold" aria-hidden="true" />
                )}
                {finished && (
                  <Check size={16} className="mt-1 shrink-0 text-ethereal-sage" aria-hidden="true" />
                )}
                {entry.phase === "failed" && (
                  <AlertCircle size={16} className="mt-1 shrink-0 text-ethereal-crimson" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <Text className={cn("wrap-anywhere", finished && "text-ethereal-graphite")}>
                    {entry.file.name}
                  </Text>
                  {entry.error && (
                    <Text size="sm" color="crimson">
                      {entry.error}
                    </Text>
                  )}
                  {!entry.voice && entry.resolution.kind === "ambiguous" && (
                    <Text size="sm" color="muted">
                      {t("archive.tracks.batch.ambiguous", {
                        options: entry.resolution.candidates.map(voiceLabel).join(", "),
                      })}
                    </Text>
                  )}
                </div>
              </div>

              {finished ? (
                <Text size="sm" color="muted" className="shrink-0">
                  {voiceLabel(entry.voice)}
                </Text>
              ) : (
                <div className="flex shrink-0 items-center gap-1">
                  <Select
                    value={entry.voice}
                    onValueChange={(value) => patchEntry(entry.localId, { voice: value })}
                    disabled={isRunning}
                    variant="property"
                    // Under the file name on a phone, its text on the name's edge.
                    className={cn(PROPERTY_CONTROL_CLASS, "-ml-2 w-48 md:ml-0")}
                    placeholder={t("archive.tracks.pick")}
                    ariaLabel={t("archive.tracks.batch.voice_for", { name: entry.file.name })}
                    options={slotOptions}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-8 px-2"
                    onClick={() => removeEntry(entry.localId)}
                    disabled={isRunning}
                    aria-label={t("archive.tracks.batch.remove", { name: entry.file.name })}
                  >
                    <X size={16} aria-hidden="true" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-1">
        {pending.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            casing="sentence"
            onClick={() => void run()}
            disabled={!canRun}
            isLoading={isRunning}
            leftIcon={
              isRunning ? undefined : entries.some((e) => e.phase === "failed") ? (
                <RotateCcw size={16} aria-hidden="true" />
              ) : (
                <UploadCloud size={16} aria-hidden="true" />
              )
            }
          >
            {t("archive.tracks.batch.upload", { count: pending.length })}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          casing="sentence"
          onClick={onDone}
          disabled={isRunning}
        >
          {pending.length === 0 ? t("common.actions.close") : t("common.actions.cancel")}
        </Button>
      </div>
    </div>
  );
};
