/**
 * @file notificationPreferenceGroups.test.ts
 * @description Unit cover for the preference grouping: domain bucketing, render
 * order, empty-group elision, intra-group order, and graceful fallback for
 * unmapped types.
 * @module settings/constants/notificationPreferenceGroups.test
 */
import { describe, expect, it } from "vitest";

import type { NotificationPreferenceDTO } from "@/features/notifications/types/notifications.dto";
import { groupNotificationPreferences } from "./notificationPreferenceGroups";

const row = (
  notification_type: NotificationPreferenceDTO["notification_type"],
): NotificationPreferenceDTO => ({
  notification_type,
  email_enabled: true,
  push_enabled: true,
});

describe("groupNotificationPreferences", () => {
  it("buckets types into their domain groups in canonical order", () => {
    const result = groupNotificationPreferences([
      row("SYSTEM_ALERT"),
      row("PIECE_CASTING_ASSIGNED"),
      row("REHEARSAL_SCHEDULED"),
      row("MESSAGE_RECEIVED"),
    ]);

    // Order follows NOTIFICATION_GROUP_ORDER regardless of input order.
    // SYSTEM_ALERT now folds into the Communications ("messages") group.
    expect(result.map((g) => g.id)).toEqual([
      "schedule",
      "repertoire",
      "messages",
    ]);
  });

  it("omits groups that have no rows", () => {
    const result = groupNotificationPreferences([row("REHEARSAL_SCHEDULED")]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("schedule");
  });

  it("preserves input order within a group", () => {
    const result = groupNotificationPreferences([
      row("REHEARSAL_CANCELLED"),
      row("PROJECT_INVITATION"),
      row("REHEARSAL_SCHEDULED"),
    ]);
    expect(result[0].preferences.map((p) => p.notification_type)).toEqual([
      "REHEARSAL_CANCELLED",
      "PROJECT_INVITATION",
      "REHEARSAL_SCHEDULED",
    ]);
  });

  it("routes an unmapped type into the communications group without throwing", () => {
    const result = groupNotificationPreferences([
      row("NOTIFICATION_READ_RECEIPT"), // intentionally has no group meta
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("messages");
  });

  it("attaches an icon component to every emitted group", () => {
    const result = groupNotificationPreferences([
      row("REHEARSAL_SCHEDULED"),
      row("MESSAGE_RECEIVED"),
    ]);
    for (const group of result) {
      expect(group.icon).toBeTruthy();
    }
  });
});
