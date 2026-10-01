/**
 * @file notificationFold.test.ts
 * @description Which bell rows fold into one. A singer's reports about one
 * project — attendance and single-evening absences alike — fold while they stay
 * within half an hour of the newest one, whoever else writes in between; a span
 * stands alone; a thread folds whole.
 * @architecture Enterprise SaaS 2026
 * @module features/notifications/lib/notificationFold.test
 */

import { describe, expect, it } from "vitest";

import type { NotificationDTO } from "../types/notifications.dto";
import { foldNotifications } from "./notificationFold";

const NOW = Date.parse("2026-10-01T18:00:00Z");
const minutesAgo = (minutes: number): string =>
  new Date(NOW - minutes * 60_000).toISOString();

const base = (id: string, minutes: number) => ({
  id,
  level: "INFO" as const,
  is_read: false,
  read_at: null,
  created_at: minutesAgo(minutes),
});

const report = (
  id: string,
  minutes: number,
  artistId: string,
  type: "ATTENDANCE_SUBMITTED" | "ABSENCE_REQUESTED" = "ATTENDANCE_SUBMITTED",
  rehearsalCount?: number,
  projectId = "requiem",
): NotificationDTO => ({
  ...base(id, minutes),
  notification_type: type,
  metadata: {
    project_name: "Requiem",
    project_id: projectId,
    artist_name: "Ada Nowak",
    artist_id: artistId,
    ...(rehearsalCount ? { rehearsal_count: rehearsalCount } : {}),
  },
});

const message = (id: string, minutes: number, threadId: string): NotificationDTO => ({
  ...base(id, minutes),
  notification_type: "MESSAGE_RECEIVED",
  metadata: { thread_id: threadId, title: "Nuty", sender_name: "Ada", message: "", snippet: "" },
});

const shape = (items: NotificationDTO[]): string[][] =>
  foldNotifications(items).map((entry) => entry.members.map((member) => member.id));

describe("foldNotifications", () => {
  it("folds one singer's burst across another singer's report", () => {
    expect(
      shape([report("a3", 0, "ada"), report("b1", 5, "bo"), report("a2", 10, "ada"), report("a1", 29, "ada")]),
    ).toEqual([["a3", "a2", "a1"], ["b1"]]);
  });

  it("starts a new burst past half an hour from the newest report", () => {
    expect(shape([report("a2", 0, "ada"), report("a1", 31, "ada")])).toEqual([["a2"], ["a1"]]);
  });

  it("folds a singer's single-evening absences into their sitting", () => {
    expect(
      shape([
        report("x2", 0, "ada", "ABSENCE_REQUESTED"),
        report("a1", 1, "ada"),
        report("x1", 2, "ada", "ABSENCE_REQUESTED"),
        report("b1", 3, "bo", "ABSENCE_REQUESTED"),
      ]),
    ).toEqual([["x2", "a1", "x1"], ["b1"]]);
  });

  it("keeps a sitting to one project, whose absence list the row opens", () => {
    expect(
      shape([
        report("x2", 0, "ada", "ABSENCE_REQUESTED", undefined, "messiah"),
        report("a1", 1, "ada"),
        report("x1", 2, "ada", "ABSENCE_REQUESTED"),
      ]),
    ).toEqual([["x2"], ["a1", "x1"]]);
  });

  it("keeps an absence span on its own", () => {
    expect(
      shape([
        report("a2", 0, "ada"),
        report("s1", 1, "ada", "ABSENCE_REQUESTED", 4),
        report("a1", 2, "ada"),
      ]),
    ).toEqual([["a2", "a1"], ["s1"]]);
  });

  it("starts a new sitting past half an hour, absences included", () => {
    expect(
      shape([report("x2", 0, "ada", "ABSENCE_REQUESTED"), report("x1", 31, "ada", "ABSENCE_REQUESTED")]),
    ).toEqual([["x2"], ["x1"]]);
  });

  it("holds a whole thread in one row, however far apart", () => {
    expect(
      shape([message("m3", 0, "t1"), message("n1", 2, "t2"), message("m2", 600, "t1"), message("m1", 6000, "t1")]),
    ).toEqual([["m3", "m2", "m1"], ["n1"]]);
  });
});
