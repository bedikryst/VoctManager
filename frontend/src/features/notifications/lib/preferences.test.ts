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
  groupChannelPayload,
  groupChannelState,
  isPreferenceCustomized,
  nextGroupChannelValue,
  recommendedChannels,
  restorePayload,
} from "./preferences";

const make = (
  over: Partial<NotificationPreferenceDTO> = {},
): NotificationPreferenceDTO => ({
  notification_type: "REHEARSAL_SCHEDULED",
  group: "commitments",
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

describe("groupChannelState", () => {
  const rows = (...email: boolean[]) =>
    email.map((email_enabled, i) =>
      make({
        notification_type: i === 0 ? "REHEARSAL_SCHEDULED" : "PIECE_CASTING_ASSIGNED",
        email_enabled,
      }),
    );

  it("reads on only when every member is on", () => {
    expect(groupChannelState(rows(true, true), "email_enabled")).toBe("on");
  });

  it("reads off only when every member is off", () => {
    expect(groupChannelState(rows(false, false), "email_enabled")).toBe("off");
  });

  it("reads mixed when the members disagree", () => {
    // The state a reader arrives in after answering per type — displayed, never
    // silently coerced.
    expect(groupChannelState(rows(true, false), "email_enabled")).toBe("mixed");
  });

  it("answers per channel, not per row", () => {
    const members = [
      make({ notification_type: "REHEARSAL_SCHEDULED", email_enabled: false }),
      make({ notification_type: "PIECE_CASTING_ASSIGNED", email_enabled: false }),
    ];
    expect(groupChannelState(members, "email_enabled")).toBe("off");
    expect(groupChannelState(members, "push_enabled")).toBe("on");
  });
});

describe("nextGroupChannelValue", () => {
  it("resolves a mixed control upward", () => {
    // Adding delivery is the safe direction: it never silences something the
    // reader did not ask to lose.
    expect(nextGroupChannelValue("mixed")).toBe(true);
  });

  it("toggles a settled control", () => {
    expect(nextGroupChannelValue("on")).toBe(false);
    expect(nextGroupChannelValue("off")).toBe(true);
  });
});

describe("groupChannelPayload", () => {
  it("writes only the members that differ, preserving the other channel", () => {
    const rows = [
      make({ notification_type: "REHEARSAL_SCHEDULED", email_enabled: false, push_enabled: false }),
      make({ notification_type: "PIECE_CASTING_ASSIGNED", email_enabled: true, push_enabled: true }),
    ];

    expect(groupChannelPayload(rows, "email_enabled", true)).toEqual([
      // Push travels at its stored value: a group decision about e-mail must not
      // quietly move a channel the reader answered separately.
      { notification_type: "REHEARSAL_SCHEDULED", email_enabled: true, push_enabled: false },
    ]);
  });

  it("is empty when the group already holds the target value", () => {
    expect(groupChannelPayload([make()], "email_enabled", true)).toEqual([]);
  });
});
