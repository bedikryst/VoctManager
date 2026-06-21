/**
 * @file ArtistRow.tsx
 * @description One singer's attendance control. Two densities share the same
 * autosave form: `compact` for the scanning roster and `rollcall` for the
 * large-tap-target focus mode a conductor uses on a tablet in front of the
 * choir. Status presentation is sourced from the shared attendance meta so the
 * colour of "late" never drifts between surfaces.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/components/ArtistRow
 */

import React, { useEffect } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Clock, Edit3, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import type { AttendanceUpsertDTO } from "../types/rehearsals.dto";
import type {
  Artist,
  Attendance,
  AttendanceStatus,
  Participation,
} from "@/shared/types";
import {
  useDeleteAttendanceRecord,
  useUpsertAttendanceRecord,
} from "../api/rehearsals.queries";
import { cn } from "@/shared/lib/utils";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { Input } from "@/shared/ui/primitives/Input";
import { Avatar } from "@/shared/ui/composites/Avatar";
import {
  ATTENDANCE_STATUS_META,
  SELECTABLE_STATUSES,
} from "../constants/attendanceMeta";

// The form mirrors the upsert DTO but tolerates an "unselected" status while the
// conductor is still deciding; persistence normalises everything on save.
type RowFormValues = Omit<AttendanceUpsertDTO, "status"> & {
  status?: AttendanceStatus;
};

interface ArtistRowProps {
  part: Participation;
  artist: Artist;
  rehearsalId: string;
  existingRecord: Attendance | undefined;
  density?: "compact" | "rollcall";
}

export const ArtistRow = React.memo(
  ({
    part,
    artist,
    rehearsalId,
    existingRecord,
    density = "compact",
  }: ArtistRowProps) => {
    const { t } = useTranslation();

    const voiceLabel = artist.voice_type
      ? t(`dashboard.layout.roles.${artist.voice_type}`)
      : (artist.voice_type_display ?? "");

    const upsertMutation = useUpsertAttendanceRecord();
    const deleteMutation = useDeleteAttendanceRecord();
    const isSyncing = upsertMutation.isPending || deleteMutation.isPending;

    const form = useForm<RowFormValues>({
      defaultValues: {
        rehearsal: rehearsalId,
        participation: part.id,
        status: existingRecord?.status ?? undefined,
        minutes_late: existingRecord?.minutes_late ?? null,
        excuse_note: existingRecord?.excuse_note ?? "",
      },
    });

    const status = form.watch("status");

    useEffect(() => {
      form.reset({
        rehearsal: rehearsalId,
        participation: part.id,
        status: existingRecord?.status ?? undefined,
        minutes_late: existingRecord?.minutes_late ?? null,
        excuse_note: existingRecord?.excuse_note ?? "",
      });
    }, [existingRecord, rehearsalId, part.id, form]);

    // Deterministic autosave: we build the payload from current field values and
    // submit directly instead of routing through form.handleSubmit — the latter
    // silently swallows the write whenever the resolver rejects a hidden field
    // (e.g. a stale minutes_late lingering after the status changed), which is
    // what made a row "stick" on LATE. Fields are normalised to the status so we
    // never send minutes for a non-late status or a note for a present one.
    const showSaveError = () =>
      toast.error(t("rehearsals.toast.save_error_title", "Błąd zapisu"), {
        description: `${t("rehearsals.toast.save_error_desc", "Nie udało się zapisać dla:")} ${artist.last_name}`,
      });

    const persist = async (status: AttendanceStatus | undefined) => {
      if (!status) {
        if (existingRecord?.id) {
          try {
            await deleteMutation.mutateAsync(existingRecord.id);
          } catch {
            showSaveError();
          }
        }
        return;
      }

      const values = form.getValues();
      const payload: AttendanceUpsertDTO = {
        rehearsal: rehearsalId,
        participation: part.id,
        status,
        minutes_late: status === "LATE" ? (values.minutes_late ?? null) : null,
        excuse_note: status === "PRESENT" ? "" : (values.excuse_note ?? ""),
      };

      try {
        await upsertMutation.mutateAsync({ id: existingRecord?.id, data: payload });
      } catch {
        showSaveError();
      }
    };

    const handleStatusChange = (targetStatus: AttendanceStatus) => {
      const next =
        form.getValues("status") === targetStatus ? undefined : targetStatus;
      form.setValue("status", next, { shouldDirty: true });
      void persist(next);
    };

    const handleBlur = () => {
      const status = form.getValues("status");
      if (status) void persist(status);
    };

    const fullName = `${artist.first_name} ${artist.last_name}`;
    const isRollCall = density === "rollcall";

    /* ── Status toggle (shared by both densities) ───────────────────────── */
    const statusToggle = (
      <div
        className={cn(
          "rounded-xl border border-ethereal-incense/15 bg-ethereal-alabaster",
          isRollCall
            ? "grid grid-cols-2 gap-1.5 p-1.5 sm:grid-cols-4"
            : // Compact: the four long PL status words ("USPRAWIEDLIWIONY"…) can't
              // fit one row on phones/tablets, so the toggle wraps (each keeps its
              // full label) rather than forcing the card — and the page — past the
              // viewport. Only at xl, beside the note fields, does it collapse back
              // to a single content-width row.
              "flex w-full flex-wrap gap-1 p-1 xl:w-auto",
        )}
      >
        {SELECTABLE_STATUSES.map((key) => {
          const meta = ATTENDANCE_STATUS_META[key];
          const Icon = meta.Icon;
          const active = status === key;
          return (
            <button
              key={key}
              type="button"
              // Keep focus on any open minutes/note field so switching status
              // doesn't fire a competing blur-save against the same row.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleStatusChange(key)}
              disabled={isSyncing}
              aria-pressed={active}
              className={cn(
                "flex items-center justify-center gap-1.5 font-bold uppercase tracking-widest transition-colors duration-200 disabled:opacity-50",
                isRollCall
                  ? "min-h-12 rounded-lg px-2 py-2 text-[11px]"
                  : "flex-1 rounded-lg px-3 py-1.5 text-[9px] sm:flex-none",
                active
                  ? meta.solid + " shadow-sm"
                  : "text-ethereal-graphite hover:bg-ethereal-marble hover:text-ethereal-ink",
              )}
            >
              <Icon size={isRollCall ? 15 : 12} />
              {t(meta.labelKey, meta.fallback)}
            </button>
          );
        })}
      </div>
    );

    const showMinutes = status === "LATE";
    const showNote =
      status === "ABSENT" || status === "LATE" || status === "EXCUSED";
    const hasExtras = showMinutes || showNote;

    const extraFields = (
      <div
        className={cn(
          "flex items-center gap-2",
          isRollCall ? "w-full" : "w-full justify-end sm:w-auto flex-1 xl:flex-none",
        )}
      >
        <AnimatePresence mode="popLayout">
          {showMinutes && (
            <motion.div
              key="minutes"
              initial={{ opacity: 0, scale: 0.9, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: "auto" }}
              exit={{ opacity: 0, scale: 0.9, width: 0 }}
              className="shrink-0"
            >
              <Input
                type="number"
                min="1"
                variant="glass"
                placeholder={t("rehearsals.row.minutes_placeholder", "min.")}
                leftIcon={<Clock />}
                {...form.register("minutes_late", {
                  setValueAs: (v) =>
                    v === "" || Number.isNaN(Number(v)) ? null : Number(v),
                })}
                onBlur={handleBlur}
                disabled={isSyncing}
                className={isRollCall ? "w-28 !pl-3" : "w-24 !pl-3"}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {showNote && (
          <div
            className={cn(
              "relative",
              isRollCall ? "flex-1" : "min-w-0 flex-1 sm:w-56 sm:flex-none",
            )}
          >
            <Input
              type="text"
              variant="ghost"
              placeholder={t("rehearsals.row.note_placeholder", "Notatka (opcjonalnie)")}
              leftIcon={<Edit3 />}
              rightElement={
                isSyncing ? <Loader2 size={12} className="animate-spin" /> : undefined
              }
              {...form.register("excuse_note")}
              onBlur={handleBlur}
              disabled={isSyncing}
            />
          </div>
        )}
      </div>
    );

    /* ── Roll-call card ─────────────────────────────────────────────────── */
    if (isRollCall) {
      const meta = status ? ATTENDANCE_STATUS_META[status] : ATTENDANCE_STATUS_META.NONE;
      return (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-2xl border bg-ethereal-marble/20 p-4 transition-colors",
            status ? "border-ethereal-ink/8" : "border-ethereal-gold/25 bg-ethereal-gold/[0.03]",
          )}
        >
          <div className="flex items-center gap-3">
            <Avatar src={artist.avatar_thumb_url} name={fullName} size="md" shape="rounded" />
            <div className="min-w-0 flex-1">
              <Text size="md" weight="semibold" truncate className="block">
                {fullName}
              </Text>
              <Caption color="muted" truncate className="block">
                {voiceLabel}
              </Caption>
            </div>
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} aria-hidden="true" />
          </div>
          {statusToggle}
          {hasExtras && extraFields}
        </div>
      );
    }

    /* ── Compact roster row ─────────────────────────────────────────────── */
    return (
      <div className="group flex flex-col items-start justify-between gap-3 border-b border-ethereal-incense/10 bg-ethereal-marble/20 px-5 py-3 transition-colors duration-200 hover:bg-ethereal-marble/50 md:flex-row md:items-center">
        <div className="flex w-full shrink-0 items-center gap-3 md:w-60">
          <Avatar src={artist.avatar_thumb_url} name={fullName} size="sm" shape="rounded" />
          <div className="flex min-w-0 flex-col">
            <Text size="sm" weight="semibold" truncate>
              {fullName}
            </Text>
            <Caption color="muted" truncate>
              {voiceLabel}
            </Caption>
          </div>
        </div>

        <div className="flex w-full flex-1 flex-col items-start justify-end gap-3 md:gap-4 xl:flex-row xl:items-center">
          {statusToggle}
          {hasExtras && extraFields}
        </div>
      </div>
    );
  },
  (prev, next) =>
    // id matters: an optimistic create is reconciled from a temp id to the real
    // one (often with identical status), and the row must re-render to adopt the
    // real id — otherwise the next edit would PATCH a non-existent record.
    prev.existingRecord?.id === next.existingRecord?.id &&
    prev.existingRecord?.status === next.existingRecord?.status &&
    prev.existingRecord?.excuse_note === next.existingRecord?.excuse_note &&
    prev.existingRecord?.minutes_late === next.existingRecord?.minutes_late &&
    prev.rehearsalId === next.rehearsalId &&
    prev.density === next.density,
);

ArtistRow.displayName = "ArtistRow";
