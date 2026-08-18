/**
 * @file notificationFormat.ts
 * @description Shared rendering of the language-neutral values notifications
 * carry — event moments, voice-line codes and structured field diffs. Every
 * in-app surface that shows one (the bell row, the invitation modal, the
 * conductor's announcement review sheet) resolves them here, so the same stored
 * payload never reads two different ways depending on which component happens to
 * display it — including the sheet where the conductor decides whether to send it.
 * @architecture Enterprise SaaS 2026
 * @module features/notifications/lib
 */

import type { useTranslation } from "react-i18next";

import { collapseVoiceLabels } from "@/shared/lib/voiceLabels";

import type { EventMomentMetadata } from "../types/notifications.dto";

export type TFunc = ReturnType<typeof useTranslation>["t"];

export const firstText = (
  ...values: readonly unknown[]
): string | undefined =>
  values
    .map((value) => (value == null ? "" : String(value).trim()))
    .find(Boolean);

/**
 * Localized label for a VoiceLine CODE (e.g. "B1" → "Bas 1"), rendered in the
 * viewer's current UI language. Falls back to the raw value so a legacy row that
 * still carries a pre-rendered label ("Bass 1") — or an unknown code — never
 * renders blank.
 */
export const voiceLineLabel = (
  t: TFunc,
  code?: string,
  scope: readonly string[] = [],
): string => {
  if (!code) return "";
  const known = scope.filter(Boolean);
  // An empty scope means the arrangement is unknown — a legacy payload written
  // before `voice_scope` existed — so nothing collapses and the index stays.
  if (known.length === 0) return t(`notifications.voiceLines.${code}`, code);
  const dictionary = Array.from(new Set([...known, code])).map((value) => ({
    value,
    label: t(`notifications.voiceLines.${value}`, value),
  }));
  return (
    collapseVoiceLabels(
      dictionary.map((entry) => entry.value),
      dictionary,
      t,
    )[code] ?? t(`notifications.voiceLines.${code}`, code)
  );
};

/**
 * Renders an event moment the way a person says it — "jutro o 19:00", "piątek,
 * 24 lipca o 19:00" — in the viewer's UI language and the event's own timezone.
 * Mirrors the backend `humanize_event_time()` so the bell, the push and the
 * email name the same moment the same way.
 *
 * The ISO timestamp outranks the stored `starts_at_display`, which is frozen at
 * emission time in whatever language was then active. Relative wording is
 * resolved against "now" on every render, so an old row never claims "tomorrow".
 */
export const formatEventMoment = (
  metadata: EventMomentMetadata,
  lang: string,
  t: TFunc,
  ...legacyValues: readonly unknown[]
): string | undefined => {
  const startsAt = firstText(metadata.starts_at);
  const parsed = startsAt?.includes("T") ? new Date(startsAt) : null;

  if (parsed && !Number.isNaN(parsed.getTime())) {
    const locale = lang || "pl";
    const timeZone = firstText(metadata.timezone);
    const render = (options: Intl.DateTimeFormatOptions): string => {
      try {
        return new Intl.DateTimeFormat(
          locale,
          timeZone ? { ...options, timeZone } : options,
        ).format(parsed);
      } catch {
        // An unknown IANA zone must not blank the row — fall back to the viewer's.
        return new Intl.DateTimeFormat(locale, options).format(parsed);
      }
    };
    // The calendar-day comparison has to happen in the event's own timezone;
    // en-CA yields an ISO-shaped YYYY-MM-DD that subtracts cleanly.
    const dayKey = (value: Date): string => {
      try {
        return new Intl.DateTimeFormat("en-CA", timeZone ? { timeZone } : {}).format(value);
      } catch {
        return new Intl.DateTimeFormat("en-CA").format(value);
      }
    };

    const time = render({ hour: "2-digit", minute: "2-digit", hour12: false });
    const eventDay = dayKey(parsed);
    const today = dayKey(new Date());
    const daysAway = Math.round(
      (Date.parse(eventDay) - Date.parse(today)) / 86_400_000,
    );

    if (daysAway === 0) return t("notifications.time.today", { time });
    if (daysAway === 1) return t("notifications.time.tomorrow", { time });

    const sameYear = eventDay.slice(0, 4) === today.slice(0, 4);
    return t("notifications.time.absolute", {
      weekday: render({ weekday: "long" }),
      date: render(
        sameYear
          ? { day: "numeric", month: "long" }
          : { day: "numeric", month: "long", year: "numeric" },
      ),
      time,
    });
  }

  return firstText(metadata.starts_at_display, startsAt, ...legacyValues);
};

/** Localized human label for a structured change field key. */
export const changeLabel = (t: TFunc, fieldKey: string): string =>
  t(`notifications.changes.${fieldKey}`, fieldKey.replace(/_/g, " "));

/**
 * Renders one change entry as a compact localized chip label. Tolerant of loose
 * or legacy metadata shapes — a change persisted before the structured-codes
 * refactor may arrive as a plain string, or as an object without a stable
 * `field` key. We never assume the shape, so a single stale row can't blank the
 * whole surface (the `field.replace` it used to crash on is now guarded).
 */
export const renderChange = (
  t: TFunc,
  change: unknown,
  scope: readonly string[] = [],
): string => {
  if (typeof change === "string") return change;
  if (!change || typeof change !== "object") return "";

  const { field, old, new: next } = change as {
    field?: unknown;
    old?: unknown;
    new?: unknown;
  };
  const fieldKey = typeof field === "string" ? field : "";
  const label = fieldKey ? changeLabel(t, fieldKey) : "";
  // Voice lines and flags are stored language-neutrally (a code, or Python's
  // "True"/"False") — localize the values too, not just the field label.
  const value = (raw: unknown): string => {
    if (raw == null) return "";
    const rawText = String(raw);
    if (fieldKey === "voice_line") return voiceLineLabel(t, rawText, scope);
    if (fieldKey === "gives_pitch") {
      return t(`notifications.changes.boolean.${rawText.toLowerCase()}`, rawText);
    }
    return rawText;
  };
  const from = value(old);
  const to = value(next);

  if (from && to) return label ? `${label}: ${from} → ${to}` : `${from} → ${to}`;
  if (to) return label ? `${label}: ${to}` : to;
  return label;
};

/** Maps a (possibly legacy/loose) `changes` payload to chip labels, dropping any
 *  entry that can't be rendered. Never assumes an array of structured objects. */
export const renderChanges = (
  t: TFunc,
  changes: unknown,
  scope: readonly string[] = [],
): string[] =>
  Array.isArray(changes)
    ? changes.map((change) => renderChange(t, change, scope)).filter(Boolean)
    : [];

/** The naming scope a metadata payload carries. Empty on rows written before
 *  `voice_scope` existed — those keep their divisi index. */
export const voiceScopeOf = (metadata: unknown): string[] => {
  const raw = (metadata as { voice_scope?: unknown } | null)?.voice_scope;
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
};

export const compactMetaLine = (
  ...values: readonly unknown[]
): string | undefined => {
  const parts = values
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
};

/**
 * The minimum a change needs in order to describe itself: what it is about, which
 * lifecycle step it records, and the payload its emitter built. Deliberately
 * narrower than `BriefingItemMetadata` — a line on the conductor's review sheet has
 * no notification identity yet, because nothing has been sent.
 */
export interface DescribableChange {
  subject_type: string;
  kind: string;
  metadata: Record<string, unknown>;
}

/**
 * One briefing/queue item as a single scannable line: what identifies it, then
 * what moved. Each item carries the payload its own emitter built, so this reads
 * the same fields the standalone row would have — a part by its piece and voice,
 * a rehearsal by its moment, a project change by its diff. Shared so the bell and
 * the conductor's review sheet describe the very same change identically.
 */
export const briefingItemSummary = (
  t: TFunc,
  lang: string,
  item: DescribableChange,
): string => {
  const m = item.metadata as EventMomentMetadata & Record<string, unknown>;
  const scope = voiceScopeOf(m);
  const changes = renderChanges(t, m.changes, scope).join("; ");

  if (item.subject_type === "CASTING") {
    const piece = m.piece_title == null ? "" : String(m.piece_title);
    if (item.kind === "REMOVED") {
      return compactMetaLine(piece, t("notifications.inapp.casting_removed")) ?? "";
    }
    const voice = voiceLineLabel(
      t,
      typeof m.voice_line === "string" ? m.voice_line : undefined,
      scope,
    );
    return compactMetaLine(piece, voice, changes) ?? "";
  }

  if (item.subject_type === "REHEARSAL") {
    return (
      compactMetaLine(
        t(
          item.kind === "CREATED"
            ? "notifications.briefing.rehearsal_added"
            : "notifications.briefing.rehearsal_changed",
        ),
        formatEventMoment(m, lang, t),
        changes,
      ) ?? ""
    );
  }

  return changes;
};
