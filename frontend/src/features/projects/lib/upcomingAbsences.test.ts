/**
 * @file upcomingAbsences.test.ts
 * @description Which reported absences the Overview counts and lists. The
 * figure on the row and the lines in the sheet come from this one function, so
 * every exclusion here is a number the conductor would otherwise click on and
 * not find: a rehearsal already over, a singer who left the project, a
 * sectional that does not call them.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/lib/upcomingAbsences.test
 */

import { describe, expect, it } from "vitest";

import type {
  Attendance,
  AttendanceStatus,
  Participation,
  ParticipationStatus,
  Rehearsal,
  VoiceType,
} from "@/shared/types";
import { collectUpcomingAbsences, countAbsences } from "./upcomingAbsences";

const NOW = Date.parse("2026-10-01T12:00:00Z");

const rehearsal = (
  id: string,
  dateTime: string,
  overrides: Partial<Rehearsal> = {},
): Rehearsal => ({
  id,
  project: "project",
  date_time: dateTime,
  timezone: "Europe/Warsaw",
  is_mandatory: true,
  ...overrides,
});

const participation = (
  id: string,
  name: string,
  voiceType: VoiceType,
  status: ParticipationStatus = "CON",
): Participation => ({
  id,
  artist: `artist-${id}`,
  project: "project",
  status,
  artist_name: name,
  artist_voice_type: voiceType,
});

const attendance = (
  rehearsalId: string,
  participationId: string,
  status: AttendanceStatus,
): Attendance => ({
  id: `${rehearsalId}-${participationId}`,
  rehearsal: rehearsalId,
  participation: participationId,
  status,
});

const tenor = participation("ten", "Jan Tenor", "TEN");
const soprano = participation("sop", "Anna Sopran", "SOP");
const alto = participation("alt", "Ewa Alt", "ALT");
const departed = participation("dec", "Piotr Odszedł", "BAS", "DEC");

describe("collectUpcomingAbsences", () => {
  it("lists only rehearsals still ahead, soonest first", () => {
    const groups = collectUpcomingAbsences({
      rehearsals: [
        rehearsal("later", "2026-10-09T17:00:00Z"),
        rehearsal("past", "2026-09-28T17:00:00Z"),
        rehearsal("sooner", "2026-10-03T17:00:00Z"),
      ],
      attendances: [
        attendance("later", "ten", "EXCUSED"),
        attendance("past", "ten", "ABSENT"),
        attendance("sooner", "sop", "ABSENT"),
      ],
      participations: [tenor, soprano],
      now: NOW,
    });

    expect(groups.map((group) => group.rehearsal.id)).toEqual(["sooner", "later"]);
    expect(countAbsences(groups)).toBe(2);
  });

  it("counts absences and excused absences, never a presence or a lateness", () => {
    const groups = collectUpcomingAbsences({
      rehearsals: [rehearsal("r", "2026-10-03T17:00:00Z")],
      attendances: [
        attendance("r", "ten", "PRESENT"),
        attendance("r", "sop", "LATE"),
        attendance("r", "alt", "EXCUSED"),
      ],
      participations: [tenor, soprano, alto],
      now: NOW,
    });

    expect(countAbsences(groups)).toBe(1);
    expect(groups[0].absences[0].participation.id).toBe("alt");
  });

  it("leaves out a singer who declined the project", () => {
    const groups = collectUpcomingAbsences({
      rehearsals: [rehearsal("r", "2026-10-03T17:00:00Z")],
      attendances: [attendance("r", "dec", "EXCUSED")],
      participations: [departed],
      now: NOW,
    });

    expect(groups).toEqual([]);
  });

  it("leaves out an absence from a sectional that does not call the singer", () => {
    const groups = collectUpcomingAbsences({
      rehearsals: [
        rehearsal("upper", "2026-10-03T17:00:00Z", { called_sections: "SA" }),
      ],
      attendances: [
        attendance("upper", "ten", "EXCUSED"),
        attendance("upper", "alt", "EXCUSED"),
      ],
      participations: [tenor, alto],
      now: NOW,
    });

    expect(groups[0].absences.map((absence) => absence.participation.id)).toEqual([
      "alt",
    ]);
  });

  it("orders one rehearsal's absences high voice to low, then by name", () => {
    const secondSoprano = participation("sop2", "Agata Sopran", "SOP");
    const groups = collectUpcomingAbsences({
      rehearsals: [rehearsal("r", "2026-10-03T17:00:00Z")],
      attendances: [
        attendance("r", "ten", "ABSENT"),
        attendance("r", "sop", "ABSENT"),
        attendance("r", "alt", "ABSENT"),
        attendance("r", "sop2", "ABSENT"),
      ],
      participations: [tenor, soprano, alto, secondSoprano],
      now: NOW,
    });

    expect(groups[0].absences.map((absence) => absence.participation.id)).toEqual([
      "sop2",
      "sop",
      "alt",
      "ten",
    ]);
  });
});
