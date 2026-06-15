/**
 * @file useRehearsalAnalytics.ts
 * @description Derives the conductor's reliability intelligence for one project
 * from data already in cache: a per-singer attendance heatmap, per-section
 * realised attendance, and the rehearsal-over-rehearsal trend. Only graded
 * (already-happened) rehearsals count, and unrecorded slots are treated as
 * "unknown" rather than punished — so data gaps never masquerade as absences.
 * @architecture Enterprise SaaS 2026
 */

import { useMemo } from "react";
import type { Artist, Attendance, Participation, Rehearsal } from "@/shared/types";
import {
  isPast,
  resolveInvited,
  tallyAttendance,
  type AttendanceTally,
} from "../lib/attendanceStats";
import {
  OTHER_SECTION,
  VOICE_SECTION_ORDER,
  voiceSectionOf,
  type AttendanceCell,
  type VoiceSectionKey,
} from "../constants/attendanceMeta";

export interface SingerReliability {
  participation: Participation;
  artist: Artist;
  section: VoiceSectionKey;
  /** Per-graded-rehearsal cell; null = not summoned to that rehearsal. */
  cells: Array<{ rehearsalId: string; status: AttendanceCell | null }>;
  present: number;
  late: number;
  absent: number;
  excused: number;
  none: number;
  /** Graded rehearsals the singer was summoned to. */
  summoned: number;
  /** Summoned slots with a recorded status (summoned − none). */
  known: number;
  /** (present + late) / known, or null when nothing is known yet. */
  attendanceRate: number | null;
  chronicAbsence: boolean;
  chronicLateness: boolean;
  spotless: boolean;
}

export interface SectionReliability {
  key: VoiceSectionKey;
  headcount: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  known: number;
  rate: number | null;
}

export interface TrendPoint {
  rehearsal: Rehearsal;
  tally: AttendanceTally;
}

export interface RehearsalAnalytics {
  gradedRehearsals: Rehearsal[];
  singers: SingerReliability[];
  sections: SectionReliability[];
  trend: TrendPoint[];
  overallRate: number | null;
  hasData: boolean;
}

const CHRONIC_COUNT = 3;
const CHRONIC_RATE = 0.34;
// The proportional trigger only kicks in once the sample is big enough that a
// ratio is meaningful — one miss out of two shouldn't brand a singer.
const CHRONIC_MIN_SAMPLE = 3;

export const useRehearsalAnalytics = (
  projectRehearsals: Rehearsal[],
  projectParticipations: Participation[],
  attendanceIndex: Map<string, Map<string, Attendance>>,
  artistMap: Map<string, Artist>,
): RehearsalAnalytics =>
  useMemo(() => {
    const now = Date.now();
    const gradedRehearsals = projectRehearsals.filter((rehearsal) =>
      isPast(rehearsal.date_time, now),
    );

    // Pre-resolve invited sets so we touch each rehearsal once.
    const invitedByRehearsal = new Map<string, Set<string>>();
    gradedRehearsals.forEach((rehearsal) => {
      const invited = resolveInvited(rehearsal, projectParticipations);
      invitedByRehearsal.set(
        String(rehearsal.id),
        new Set(invited.map((p) => String(p.id))),
      );
    });

    const singers: SingerReliability[] = projectParticipations
      .map((participation) => {
        const artist = artistMap.get(String(participation.artist));
        if (!artist) return null;

        const cells: SingerReliability["cells"] = [];
        let present = 0;
        let late = 0;
        let absent = 0;
        let excused = 0;
        let none = 0;
        let summoned = 0;

        gradedRehearsals.forEach((rehearsal) => {
          const rid = String(rehearsal.id);
          const wasInvited = invitedByRehearsal
            .get(rid)
            ?.has(String(participation.id));
          if (!wasInvited) {
            cells.push({ rehearsalId: rid, status: null });
            return;
          }
          summoned += 1;
          const status = attendanceIndex
            .get(rid)
            ?.get(String(participation.id))?.status;
          const cell: AttendanceCell = status ?? "NONE";
          cells.push({ rehearsalId: rid, status: cell });
          if (cell === "PRESENT") present += 1;
          else if (cell === "LATE") late += 1;
          else if (cell === "ABSENT") absent += 1;
          else if (cell === "EXCUSED") excused += 1;
          else none += 1;
        });

        const known = summoned - none;
        const attendanceRate =
          known > 0 ? Math.round(((present + late) / known) * 100) : null;

        const chronicAbsence =
          absent >= CHRONIC_COUNT ||
          (known >= CHRONIC_MIN_SAMPLE && absent / known > CHRONIC_RATE);
        const chronicLateness =
          late >= CHRONIC_COUNT ||
          (known >= CHRONIC_MIN_SAMPLE && late / known > CHRONIC_RATE);
        // "Spotless" means genuinely reliable attendance — never a no-show or
        // late, and actually present (not merely a string of excused absences).
        const spotless = known >= 2 && present > 0 && absent === 0 && late === 0;

        return {
          participation,
          artist,
          section: voiceSectionOf(artist.voice_type),
          cells,
          present,
          late,
          absent,
          excused,
          none,
          summoned,
          known,
          attendanceRate,
          chronicAbsence,
          chronicLateness,
          spotless,
        } satisfies SingerReliability;
      })
      .filter((entry): entry is SingerReliability => entry !== null)
      .sort((a, b) => {
        // Surface the singers who need a conversation first.
        const aFlag = a.chronicAbsence || a.chronicLateness ? 1 : 0;
        const bFlag = b.chronicAbsence || b.chronicLateness ? 1 : 0;
        if (aFlag !== bFlag) return bFlag - aFlag;
        const aRate = a.attendanceRate ?? 101;
        const bRate = b.attendanceRate ?? 101;
        if (aRate !== bRate) return aRate - bRate;
        return a.artist.last_name.localeCompare(b.artist.last_name);
      });

    // Section roll-up.
    const sectionAccumulator = new Map<VoiceSectionKey, SectionReliability>();
    singers.forEach((singer) => {
      const existing =
        sectionAccumulator.get(singer.section) ??
        ({
          key: singer.section,
          headcount: 0,
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
          known: 0,
          rate: null,
        } satisfies SectionReliability);
      existing.headcount += 1;
      existing.present += singer.present;
      existing.late += singer.late;
      existing.absent += singer.absent;
      existing.excused += singer.excused;
      existing.known += singer.known;
      sectionAccumulator.set(singer.section, existing);
    });

    const sections: SectionReliability[] = [
      ...VOICE_SECTION_ORDER,
      OTHER_SECTION,
    ]
      .map((key) => sectionAccumulator.get(key))
      .filter((entry): entry is SectionReliability => entry !== undefined)
      .map((section) => ({
        ...section,
        rate:
          section.known > 0
            ? Math.round(((section.present + section.late) / section.known) * 100)
            : null,
      }));

    const trend: TrendPoint[] = gradedRehearsals.map((rehearsal) => {
      const invited = resolveInvited(rehearsal, projectParticipations);
      const records = attendanceIndex.get(String(rehearsal.id));
      return {
        rehearsal,
        tally: tallyAttendance(invited, (id) => records?.get(id)),
      };
    });

    let realisedNumerator = 0;
    let realisedDenominator = 0;
    trend.forEach(({ tally }) => {
      realisedNumerator += tally.present + tally.late;
      realisedDenominator += tally.total - tally.none;
    });

    return {
      gradedRehearsals,
      singers,
      sections,
      trend,
      overallRate:
        realisedDenominator > 0
          ? Math.round((realisedNumerator / realisedDenominator) * 100)
          : null,
      hasData: gradedRehearsals.length > 0 && singers.length > 0,
    };
  }, [projectRehearsals, projectParticipations, attendanceIndex, artistMap]);
