/**
 * @file notificationPreferenceGroups.test.ts
 * @description Unit cover for the ledger assembly: the server's order and
 * membership are honoured verbatim, empty and undeclared groups are dropped
 * rather than rendered as controls over nothing, and every section carries a glyph.
 * @module settings/constants/notificationPreferenceGroups.test
 */
import { describe, expect, it } from "vitest";

import type {
  NotificationGroupId,
  NotificationPreferenceDTO,
  NotificationPreferenceGroupDTO,
  NotificationPreferenceMatrixDTO,
} from "@/features/notifications/types/notifications.dto";
import { groupNotificationPreferences } from "./notificationPreferenceGroups";

const row = (
  notification_type: NotificationPreferenceDTO["notification_type"],
  group: NotificationGroupId,
): NotificationPreferenceDTO => ({
  notification_type,
  group,
  email_enabled: true,
  push_enabled: true,
});

const group = (
  id: NotificationGroupId,
  overrides: Partial<NotificationPreferenceGroupDTO> = {},
): NotificationPreferenceGroupDTO => ({
  id,
  manager_only: id === "team" || id === "safety_net",
  recommended_email: true,
  recommended_push: true,
  ...overrides,
});

const matrix = (
  groups: NotificationPreferenceGroupDTO[],
  preferences: NotificationPreferenceDTO[],
): NotificationPreferenceMatrixDTO => ({ groups, preferences });

describe("groupNotificationPreferences", () => {
  it("follows the server's group order regardless of row order", () => {
    const result = groupNotificationPreferences(
      matrix(
        [group("commitments"), group("messages"), group("materials")],
        [
          row("MATERIAL_UPLOADED", "materials"),
          row("MESSAGE_RECEIVED", "messages"),
          row("REHEARSAL_SCHEDULED", "commitments"),
        ],
      ),
    );

    expect(result.map((g) => g.id)).toEqual([
      "commitments",
      "messages",
      "materials",
    ]);
  });

  it("drops a declared group with no rows behind it", () => {
    const result = groupNotificationPreferences(
      matrix(
        [group("commitments"), group("materials")],
        [row("REHEARSAL_SCHEDULED", "commitments")],
      ),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("commitments");
  });

  it("drops a row whose group the response never declared", () => {
    // It would otherwise render under a control the reader has no way to reach.
    const result = groupNotificationPreferences(
      matrix(
        [group("commitments")],
        [
          row("REHEARSAL_SCHEDULED", "commitments"),
          row("ANNOUNCEMENT_PENDING", "safety_net"),
        ],
      ),
    );
    expect(result).toHaveLength(1);
    expect(result[0].preferences.map((p) => p.notification_type)).toEqual([
      "REHEARSAL_SCHEDULED",
    ]);
  });

  it("preserves row order within a group", () => {
    const result = groupNotificationPreferences(
      matrix(
        [group("commitments")],
        [
          row("REHEARSAL_CANCELLED", "commitments"),
          row("PROJECT_INVITATION", "commitments"),
          row("REHEARSAL_SCHEDULED", "commitments"),
        ],
      ),
    );
    expect(result[0].preferences.map((p) => p.notification_type)).toEqual([
      "REHEARSAL_CANCELLED",
      "PROJECT_INVITATION",
      "REHEARSAL_SCHEDULED",
    ]);
  });

  it("carries the group's contract through to the section", () => {
    // A one-member group is still a group: it carries a recommendation of its own
    // and a glyph, exactly like the four-member ones.
    const result = groupNotificationPreferences(
      matrix(
        [group("safety_net", { recommended_email: true })],
        [row("ANNOUNCEMENT_PENDING", "safety_net")],
      ),
    );
    expect(result[0].manager_only).toBe(true);
    expect(result[0].recommended_email).toBe(true);
    expect(result[0].icon).toBeTruthy();
  });

  it("returns nothing while the matrix is still loading", () => {
    expect(groupNotificationPreferences(undefined)).toEqual([]);
  });
});
