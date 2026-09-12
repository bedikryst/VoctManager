/**
 * @file useLeadSheetData.ts
 * @description Brain for one evening in a stand-in's hands: the summoned cast,
 * the register, and the same tally the conductor's own inspector reads.
 *
 * A narrower sibling of `useRehearsalsData`, not a second implementation of it.
 * That hook joins six collections to let a manager roam every project; this one
 * is handed ONE evening by the server and joins it to the register. Every piece
 * of arithmetic below is imported from `../lib/attendanceStats`, so the progress
 * a stand-in reads and the progress the conductor reads are the same number.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/hooks
 */

import { useMemo } from "react";

import type { Artist, Attendance, Participation } from "@/shared/types";

import { useAttendanceRegister } from "../api/rehearsals.queries";
import { useLeadSheet } from "../api/leadSheet.queries";
import {
  buildAttendanceIndex,
  EMPTY_TALLY,
  groupByVoice,
  tallyAttendance,
  type AttendanceTally,
  type VoiceGroup,
} from "../lib/attendanceStats";

export const useLeadSheetData = (rehearsalId: string | undefined) => {
  const sheet = useLeadSheet(rehearsalId);
  const register = useAttendanceRegister();

  const cast = useMemo<Participation[]>(
    () => sheet.data?.cast ?? [],
    [sheet.data],
  );

  const artistMap = useMemo(() => {
    const map = new Map<string, Artist>();
    for (const seat of sheet.data?.cast ?? []) {
      map.set(String(seat.artist), seat.artist_detail);
    }
    return map;
  }, [sheet.data]);

  const attendanceMap = useMemo(() => {
    const rows: Attendance[] = register.data ?? [];
    return (
      buildAttendanceIndex(rows).get(String(rehearsalId)) ??
      new Map<string, Attendance>()
    );
  }, [register.data, rehearsalId]);

  const voiceGroups = useMemo<VoiceGroup[]>(
    () => groupByVoice(cast, artistMap),
    [cast, artistMap],
  );

  const stats = useMemo<AttendanceTally>(
    () =>
      cast.length === 0
        ? EMPTY_TALLY
        : tallyAttendance(cast, (id) => attendanceMap.get(id)),
    [cast, attendanceMap],
  );

  return {
    // The sheet decides whether there is a page at all; the register only
    // decides whether the ticks are drawn yet, so a slow one must not hold the
    // choir's names back.
    isLoading: sheet.isLoading,
    isError: sheet.isError,
    leadSheet: sheet.data,
    cast,
    artistMap,
    attendanceMap,
    voiceGroups,
    stats,
  };
};
