/**
 * @file preferences.test.ts
 * @description Unit cover for the preference divergence + restore helpers: the
 * recommended-baseline resolver, the customized predicate, and the minimal
 * Restore-recommended payload.
 * @module notifications/lib/preferences.test
 */
import { describe, expect, it } from "vitest";

import type { NotificationPreferenceDTO } from "../types/notifications.dto";
import {
  isPreferenceCustomized,
  recommendedChannels,
  restorePayload,
} from "./preferences";

const make = (
  over: Partial<NotificationPreferenceDTO> = {},
): NotificationPreferenceDTO => ({
  notification_type: "REHEARSAL_SCHEDULED",
  email_enabled: true,
  push_enabled: true,
  recommended_email: true,
  recommended_push: true,
  ...over,
});

describe("recommendedChannels", () => {
  it("returns the backend baseline when present", () => {
    expect(
      recommendedChannels(make({ recommended_email: false, recommended_push: true })),
    ).toEqual({ email_enabled: false, push_enabled: true });
  });

  it("falls back to the current value when the baseline is absent", () => {
    expect(
      recommendedChannels(
        make({
          email_enabled: false,
          push_enabled: true,
          recommended_email: undefined,
          recommended_push: undefined,
        }),
      ),
    ).toEqual({ email_enabled: false, push_enabled: true });
  });
});

describe("isPreferenceCustomized", () => {
  it("is false when both channels match the recommendation", () => {
    expect(isPreferenceCustomized(make())).toBe(false);
  });

  it("is true when email diverges from the recommendation", () => {
    expect(
      isPreferenceCustomized(make({ email_enabled: false, recommended_email: true })),
    ).toBe(true);
  });

  it("is true when push diverges from the recommendation", () => {
    expect(
      isPreferenceCustomized(make({ push_enabled: false, recommended_push: true })),
    ).toBe(true);
  });

  it("is false when the baseline is missing (current value is treated as recommended)", () => {
    expect(
      isPreferenceCustomized(
        make({
          email_enabled: false,
          recommended_email: undefined,
          recommended_push: undefined,
        }),
      ),
    ).toBe(false);
  });

  it("ignores a diverging push channel when includePush is false", () => {
    const pref = make({ push_enabled: false, recommended_push: true });
    expect(isPreferenceCustomized(pref, true)).toBe(true);
    expect(isPreferenceCustomized(pref, false)).toBe(false);
  });

  it("still flags a diverging email channel when includePush is false", () => {
    expect(
      isPreferenceCustomized(
        make({ email_enabled: false, recommended_email: true }),
        false,
      ),
    ).toBe(true);
  });
});

describe("restorePayload", () => {
  it("includes only diverging rows, each carrying its recommended state", () => {
    const rows = [
      make({
        notification_type: "REHEARSAL_SCHEDULED",
        email_enabled: false,
        recommended_email: true,
      }),
      make({ notification_type: "MATERIAL_UPLOADED" }), // at recommendation
      make({
        notification_type: "PIECE_CASTING_ASSIGNED",
        push_enabled: false,
        recommended_push: true,
      }),
    ];

    expect(restorePayload(rows)).toEqual([
      { notification_type: "REHEARSAL_SCHEDULED", email_enabled: true, push_enabled: true },
      { notification_type: "PIECE_CASTING_ASSIGNED", email_enabled: true, push_enabled: true },
    ]);
  });

  it("is empty when nothing diverges", () => {
    expect(restorePayload([make(), make({ notification_type: "MATERIAL_UPLOADED" })])).toEqual([]);
  });

  it("leaves the dormant push channel untouched and skips push-only rows when includePush is false", () => {
    const rows = [
      make({
        notification_type: "REHEARSAL_SCHEDULED",
        email_enabled: false,
        recommended_email: true,
        push_enabled: false, // dormant — must be preserved, not reset to recommended
        recommended_push: true,
      }),
      make({
        notification_type: "PIECE_CASTING_ASSIGNED",
        push_enabled: false, // push-only divergence — invisible, so not restorable
        recommended_push: true,
      }),
    ];

    expect(restorePayload(rows, false)).toEqual([
      { notification_type: "REHEARSAL_SCHEDULED", email_enabled: true, push_enabled: false },
    ]);
  });
});
