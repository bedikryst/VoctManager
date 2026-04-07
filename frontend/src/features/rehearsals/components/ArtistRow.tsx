/**
 * @file ArtistRow.tsx
 * @description Memoized row component for individual attendance updates.
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Clock, Edit3, Loader2 } from "lucide-react";
import type {
  Artist,
  Attendance,
  AttendanceStatus,
  Participation,
} from "../../../shared/types";
import {
  useDeleteAttendanceRecord,
  useUpsertAttendanceRecord,
} from "../api/rehearsals.queries";

interface ArtistRowProps {
  part: Participation;
  artist: Artist;
  rehearsalId: string;
  existingRecord: Attendance | undefined;
}

export const ArtistRow = React.memo(
  ({ part, artist, rehearsalId, existingRecord }: ArtistRowProps) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<AttendanceStatus | null>(
      existingRecord?.status || null,
    );
    const [minutesLate, setMinutesLate] = useState(
      existingRecord?.minutes_late ? String(existingRecord.minutes_late) : "",
    );
    const [note, setNote] = useState(existingRecord?.excuse_note || "");

    const upsertAttendanceMutation = useUpsertAttendanceRecord();
    const deleteAttendanceMutation = useDeleteAttendanceRecord();
    const isSyncing =
      upsertAttendanceMutation.isPending || deleteAttendanceMutation.isPending;

    useEffect(() => {
      setStatus(existingRecord?.status || null);
      setMinutesLate(
        existingRecord?.minutes_late ? String(existingRecord.minutes_late) : "",
      );
      setNote(existingRecord?.excuse_note || "");
    }, [existingRecord]);

    const saveToServer = async (
      nextStatus: AttendanceStatus | null,
      nextMinutesLate: string,
      nextNote: string,
    ) => {
      try {
        if (!nextStatus) {
          if (existingRecord?.id) {
            await deleteAttendanceMutation.mutateAsync(existingRecord.id);
          }
          return;
        }

        await upsertAttendanceMutation.mutateAsync({
          id: existingRecord?.id,
          data: {
            rehearsal: rehearsalId,
            participation: part.id,
            status: nextStatus,
            minutes_late:
              nextStatus === "LATE" && nextMinutesLate
                ? parseInt(nextMinutesLate, 10)
                : null,
            excuse_note:
              nextStatus === "EXCUSED" ||
              nextStatus === "ABSENT" ||
              nextStatus === "LATE"
                ? nextNote
                : null,
          },
        });
      } catch (error) {
        toast.error(t("rehearsals.toast.save_error_title", "Błąd zapisu"), {
          description: `${t("rehearsals.toast.save_error_desc", "Błąd zapisu dla:")} ${artist.last_name}`,
        });
      }
    };

    const handleStatusToggle = (targetStatus: AttendanceStatus) => {
      const nextStatus = status === targetStatus ? null : targetStatus;
      setStatus(nextStatus);
      void saveToServer(nextStatus, minutesLate, note);
    };

    const handleTextBlur = () => {
      if (status) {
        void saveToServer(status, minutesLate, note);
      }
    };

    return (
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3 bg-white/60 hover:bg-white transition-colors border-b border-stone-100/80 group">
        <div className="flex items-center gap-3 w-full md:w-64 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200/80 flex items-center justify-center text-[10px] font-bold text-stone-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
            {artist.first_name[0]}
            {artist.last_name[0]}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-stone-800 tracking-tight truncate">
              {artist.first_name} {artist.last_name}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
              {artist.voice_type_display || artist.voice_type}
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col xl:flex-row items-start xl:items-center gap-3 md:gap-6 w-full justify-end">
          <div className="flex bg-stone-100/50 p-1 rounded-xl border border-stone-200/60 shadow-sm w-full sm:w-auto flex-shrink-0">
            <button
              onClick={() => handleStatusToggle("PRESENT")}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${status === "PRESENT" ? "bg-emerald-500 text-white shadow-md" : "text-stone-500 hover:text-stone-800 hover:bg-white"}`}
            >
              {t("rehearsals.row.status_present", "Obecny")}
            </button>
            <button
              onClick={() => handleStatusToggle("LATE")}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${status === "LATE" ? "bg-orange-500 text-white shadow-md" : "text-stone-500 hover:text-stone-800 hover:bg-white"}`}
            >
              {t("rehearsals.row.status_late", "Spóźniony")}
            </button>
            <button
              onClick={() => handleStatusToggle("ABSENT")}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${status === "ABSENT" ? "bg-red-500 text-white shadow-md" : "text-stone-500 hover:text-stone-800 hover:bg-white"}`}
            >
              {t("rehearsals.row.status_absent", "Nieobecny")}
            </button>
            <button
              onClick={() => handleStatusToggle("EXCUSED")}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${status === "EXCUSED" ? "bg-purple-500 text-white shadow-md" : "text-stone-500 hover:text-stone-800 hover:bg-white"}`}
            >
              {t("rehearsals.row.status_excused", "Zwolniony")}
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 xl:flex-none justify-end">
            <AnimatePresence mode="popLayout">
              {status === "LATE" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: "auto" }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  className="relative flex-shrink-0"
                >
                  <Clock
                    size={12}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-orange-400"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder={t(
                      "rehearsals.row.minutes_placeholder",
                      "Ile min?",
                    )}
                    value={minutesLate}
                    onChange={(event) => setMinutesLate(event.target.value)}
                    onBlur={handleTextBlur}
                    disabled={isSyncing}
                    className="w-24 text-xs font-bold text-orange-800 py-2 pl-7 pr-2 border border-orange-200/80 rounded-lg outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-orange-50/50 shadow-sm transition-all"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative w-full sm:w-56 flex-shrink-0 flex items-center">
              <Edit3
                size={12}
                className={`absolute left-3 ${status === "EXCUSED" ? "text-purple-400" : status === "LATE" ? "text-orange-400" : status === "ABSENT" ? "text-red-400" : "text-stone-300"}`}
              />
              <input
                type="text"
                placeholder={t(
                  "rehearsals.row.note_placeholder",
                  "Notatka (opcjonalnie)",
                )}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                onBlur={handleTextBlur}
                disabled={isSyncing}
                className={`w-full text-xs font-medium pl-8 pr-8 py-2 rounded-lg outline-none focus:ring-2 transition-all ${
                  status === "EXCUSED"
                    ? "bg-purple-50/50 text-purple-800 border border-purple-200/80 focus:ring-purple-500/20 focus:border-purple-400 placeholder-purple-300"
                    : status === "LATE"
                      ? "bg-orange-50/50 text-orange-800 border border-orange-200/80 focus:ring-orange-500/20 focus:border-orange-400 placeholder-orange-300"
                      : status === "ABSENT"
                        ? "bg-red-50/50 text-red-800 border border-red-200/80 focus:ring-red-500/20 focus:border-red-400 placeholder-red-300"
                        : "bg-transparent hover:bg-stone-50 focus:bg-white text-stone-700 border border-transparent hover:border-stone-200 focus:border-[#002395]/40 focus:ring-[#002395]/20 placeholder-stone-300"
                }`}
              />
              {isSyncing && (
                <Loader2
                  size={12}
                  className="absolute right-3 animate-spin text-stone-400"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.existingRecord?.status === next.existingRecord?.status &&
      prev.existingRecord?.excuse_note === next.existingRecord?.excuse_note &&
      prev.existingRecord?.minutes_late === next.existingRecord?.minutes_late &&
      prev.rehearsalId === next.rehearsalId
    );
  },
);

ArtistRow.displayName = "ArtistRow";
