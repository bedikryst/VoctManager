import React, { useEffect } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Clock, Edit3, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  attendanceUpsertSchema,
  type AttendanceUpsertDTO,
} from "../types/rehearsals.dto";
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
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { Input } from "@/shared/ui/primitives/Input";

// Extends the DTO schema to allow an "unselected" status state in the UI
// without breaking Zod validation on submit.
const rowFormSchema = attendanceUpsertSchema.extend({
  status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]).optional(),
});

type RowFormValues = z.infer<typeof rowFormSchema>;

interface ArtistRowProps {
  part: Participation;
  artist: Artist;
  rehearsalId: string;
  existingRecord: Attendance | undefined;
}

const STATUS_BUTTONS: Array<{
  key: AttendanceStatus;
  labelKey: string;
  fallback: string;
  activeClass: string;
}> = [
  {
    key: "PRESENT",
    labelKey: "rehearsals.row.status_present",
    fallback: "Obecny",
    activeClass: "bg-ethereal-sage text-ethereal-alabaster shadow-sm",
  },
  {
    key: "LATE",
    labelKey: "rehearsals.row.status_late",
    fallback: "Spóźniony",
    activeClass: "bg-ethereal-gold text-ethereal-alabaster shadow-sm",
  },
  {
    key: "ABSENT",
    labelKey: "rehearsals.row.status_absent",
    fallback: "Nieobecny",
    activeClass: "bg-ethereal-crimson text-ethereal-alabaster shadow-sm",
  },
  {
    key: "EXCUSED",
    labelKey: "rehearsals.row.status_excused",
    fallback: "Zwolniony",
    activeClass: "bg-ethereal-amethyst text-ethereal-alabaster shadow-sm",
  },
];

export const ArtistRow = React.memo(
  ({ part, artist, rehearsalId, existingRecord }: ArtistRowProps) => {
    const { t } = useTranslation();

    const upsertMutation = useUpsertAttendanceRecord();
    const deleteMutation = useDeleteAttendanceRecord();
    const isSyncing = upsertMutation.isPending || deleteMutation.isPending;

    const form = useForm<RowFormValues>({
      resolver: zodResolver(rowFormSchema),
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

    const onSubmit = async (data: RowFormValues) => {
      try {
        if (!data.status) {
          if (existingRecord?.id)
            await deleteMutation.mutateAsync(existingRecord.id);
          return;
        }
        await upsertMutation.mutateAsync({
          id: existingRecord?.id,
          data: data as AttendanceUpsertDTO,
        });
      } catch {
        toast.error(t("rehearsals.toast.save_error_title", "Błąd zapisu"), {
          description: `${t("rehearsals.toast.save_error_desc", "Nie udało się zapisać dla:")} ${artist.last_name}`,
        });
      }
    };

    const handleStatusChange = (targetStatus: AttendanceStatus) => {
      const nextStatus =
        form.getValues("status") === targetStatus ? undefined : targetStatus;
      form.setValue("status", nextStatus, {
        shouldValidate: true,
        shouldDirty: true,
      });
      void form.handleSubmit(onSubmit)();
    };

    const handleBlur = () => {
      if (form.formState.isDirty && form.getValues("status")) {
        void form.handleSubmit(onSubmit)();
      }
    };

    return (
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-6 py-3 bg-ethereal-marble/20 hover:bg-ethereal-marble/50 transition-colors duration-200 border-b border-ethereal-incense/10 group">
        {/* ── Artist identity ── */}
        <div className="flex items-center gap-3 w-full md:w-64 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-ethereal-alabaster border border-ethereal-incense/20 flex items-center justify-center shrink-0">
            <Caption weight="bold">
              {artist.first_name[0]}
              {artist.last_name[0]}
            </Caption>
          </div>
          <div className="flex flex-col min-w-0">
            <Text size="sm" weight="semibold" className="truncate">
              {artist.first_name} {artist.last_name}
            </Text>
            <Caption color="muted" className="truncate">
              {artist.voice_type
                ? t(`dashboard.layout.roles.${artist.voice_type}`)
                : (artist.voice_type_display ?? artist.voice_type)}
            </Caption>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex-1 flex flex-col xl:flex-row items-start xl:items-center gap-3 md:gap-4 w-full justify-end">
          {/* Status toggle strip */}
          <div className="flex items-center p-1 rounded-xl bg-ethereal-alabaster border border-ethereal-incense/15 w-full sm:w-auto shrink-0">
            {STATUS_BUTTONS.map(({ key, labelKey, fallback, activeClass }) => (
              <button
                key={key}
                onClick={() => handleStatusChange(key)}
                disabled={isSyncing}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all duration-200 disabled:opacity-50 ${
                  status === key
                    ? activeClass
                    : "text-ethereal-graphite hover:text-ethereal-ink hover:bg-ethereal-marble"
                }`}
              >
                {t(labelKey, fallback)}
              </button>
            ))}
          </div>

          {/* Minutes + note fields */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 xl:flex-none justify-end">
            <AnimatePresence mode="popLayout">
              {status === "LATE" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: "auto" }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  className="shrink-0"
                >
                  <Input
                    type="number"
                    min="1"
                    variant="glass"
                    placeholder={t(
                      "rehearsals.row.minutes_placeholder",
                      "Min?",
                    )}
                    leftIcon={<Clock />}
                    {...form.register("minutes_late", {
                      setValueAs: (v) =>
                        v === "" || Number.isNaN(Number(v)) ? null : Number(v),
                    })}
                    onBlur={handleBlur}
                    disabled={isSyncing}
                    className="w-28"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative w-full sm:w-56 shrink-0">
              <Input
                type="text"
                variant="ghost"
                placeholder={t(
                  "rehearsals.row.note_placeholder",
                  "Notatka (opcjonalnie)",
                )}
                leftIcon={<Edit3 />}
                rightElement={
                  isSyncing ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : undefined
                }
                {...form.register("excuse_note")}
                onBlur={handleBlur}
                disabled={isSyncing}
              />
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.existingRecord?.status === next.existingRecord?.status &&
    prev.existingRecord?.excuse_note === next.existingRecord?.excuse_note &&
    prev.existingRecord?.minutes_late === next.existingRecord?.minutes_late &&
    prev.rehearsalId === next.rehearsalId,
);

ArtistRow.displayName = "ArtistRow";
