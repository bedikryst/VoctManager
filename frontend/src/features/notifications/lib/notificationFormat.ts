/**
 * @file notificationFormat.ts
 * @description Shared rendering of the language-neutral values notifications
 * carry — event moments (on a line of their own or inside a sentence), spans,
 * plan starts, quoted text, voice-line codes and structured field diffs. Every
 * in-app surface that shows one (the bell row, the invitation modal, the
 * conductor's announcement review sheet) resolves them here, so the same stored
 * payload never reads two different ways depending on which component happens to
 * display it — including the sheet where the conductor decides whether to send it.
 * @architecture Enterprise SaaS 2026
 * @module features/notifications/lib
 */

import type { useTranslation } from "react-i18next";

import {
  PROJECT_EVENT_KIND,
  PROJECT_STATUS,
  type ProjectStatus,
} from "@/features/projects/constants/projectDomain";
import { getProjectStatusPresentation } from "@/features/projects/lib/projectPresentation";
import { collapseVoiceLabels } from "@/shared/lib/voiceLabels";

import type {
  EventMomentMetadata,
  PlanStartMetadata,
} from "../types/notifications.dto";

export type TFunc = ReturnType<typeof useTranslation>["t"];

export const firstText = (
  ...values: readonly unknown[]
): string | undefined =>
  values
    .map((value) => (value == null ? "" : String(value).trim()))
    .find(Boolean);

/** Text a person wrote (an excuse note, an excerpt), in the reader's own
 *  quotation marks; undefined when blank. */
export const quoted = (t: TFunc, text: unknown): string | undefined => {
  const value = firstText(text);
  return value ? t("notifications.quote", { text: value }) : undefined;
};

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

/** An ISO instant read in the event's own timezone, against a given "now". */
interface ResolvedMoment {
  /** Formats the instant in the viewer's locale and the event's zone. */
  render: (options: Intl.DateTimeFormatOptions) => string;
  /** "18:15", 24-hour in every locale. */
  time: string;
  /** Calendar days from "now" to the event, both counted in the event's zone. */
  daysAway: number;
  /** 0 = Sunday … 6 = Saturday, of the event's own calendar day. */
  weekdayIndex: number;
  sameYear: boolean;
}

/** Parses an ISO timestamp; null for a legacy display string or garbage. */
const parseInstant = (value: unknown): Date | null => {
  const text = firstText(value);
  const parsed = text?.includes("T") ? new Date(text) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

/** Formats in the event's zone; an unknown IANA zone must not blank the row, so
 *  it falls back to the viewer's own. */
const zonedFormat = (
  locale: string,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat => {
  try {
    return new Intl.DateTimeFormat(locale, timeZone ? { ...options, timeZone } : options);
  } catch {
    return new Intl.DateTimeFormat(locale, options);
  }
};

const resolveMoment = (
  isoValue: unknown,
  timeZone: string | undefined,
  lang: string,
  now: Date,
): ResolvedMoment | null => {
  const parsed = parseInstant(isoValue);
  if (!parsed) return null;
  const locale = lang || "pl";
  // The calendar-day comparison has to happen in the event's own timezone;
  // en-CA yields an ISO-shaped YYYY-MM-DD that subtracts cleanly.
  const dayKey = (value: Date): string => zonedFormat("en-CA", timeZone, {}).format(value);
  const eventDay = dayKey(parsed);
  const today = dayKey(now);
  return {
    render: (options) => zonedFormat(locale, timeZone, options).format(parsed),
    time: zonedFormat(locale, timeZone, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(parsed),
    daysAway: Math.round((Date.parse(eventDay) - Date.parse(today)) / 86_400_000),
    // Midnight UTC of the zone's own day, so the viewer's offset cannot shift it.
    weekdayIndex: new Date(`${eventDay}T00:00:00Z`).getUTCDay(),
    sameYear: eventDay.slice(0, 4) === today.slice(0, 4),
  };
};

const dayAndMonth = (moment: ResolvedMoment): string =>
  moment.render(
    moment.sameYear
      ? { day: "numeric", month: "long" }
      : { day: "numeric", month: "long", year: "numeric" },
  );

/**
 * Renders an event moment the way a person says it — "jutro o 19:00", "piątek,
 * 24 lipca o 19:00" — in the viewer's UI language and the event's own timezone.
 * Mirrors the backend `humanize_event_time()` so the bell, the push and the
 * email name the same moment the same way. For a line of its own; inside a
 * sentence use `formatEventPhrase`.
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
  const moment = resolveMoment(
    metadata.starts_at,
    firstText(metadata.timezone),
    lang,
    new Date(),
  );

  if (moment) {
    const { daysAway, time } = moment;
    if (daysAway === 0) return t("notifications.time.today", { time });
    if (daysAway === 1) return t("notifications.time.tomorrow", { time });
    return t("notifications.time.absolute", {
      weekday: moment.render({ weekday: "long" }),
      date: dayAndMonth(moment),
      time,
    });
  }

  return firstText(metadata.starts_at_display, metadata.starts_at, ...legacyValues);
};

/**
 * An event moment as it reads INSIDE a sentence, after a noun: "na próbę jutro
 * o 18:15", "w środę o 18:15", "w środę 14 października o 18:15". A bare weekday
 * only within the coming six days, where it cannot mean two dates; anything
 * further, or already past, carries its date. The preposition inflects with the
 * weekday ("we wtorek", "w środę"), so each locale spells all seven.
 *
 * Recomputed on every render like `formatEventMoment`, and for the same reason.
 * Undefined for a payload without an ISO moment (a legacy row): the sentence then
 * goes without it and the context line carries the stored display instead.
 */
export const formatEventPhrase = (
  metadata: EventMomentMetadata,
  lang: string,
  t: TFunc,
  now: Date = new Date(),
): string | undefined => {
  const moment = resolveMoment(metadata.starts_at, firstText(metadata.timezone), lang, now);
  if (!moment) return undefined;

  const { daysAway, time } = moment;
  if (daysAway === 0) return t("notifications.time.today", { time });
  if (daysAway === 1) return t("notifications.time.tomorrow", { time });
  if (daysAway === -1) return t("notifications.time.yesterday", { time });

  const weekday = t(`notifications.time.on_weekday.${moment.weekdayIndex}`);
  if (daysAway >= 2 && daysAway <= 6) {
    return t("notifications.time.phrase_weekday", { weekday, time });
  }
  return t("notifications.time.phrase_date", {
    weekday,
    date: dayAndMonth(moment),
    time,
  });
};

/** The event's day and month, "7 października", in its own zone; the year only
 *  when it is not this one. Undefined without an ISO moment. */
export const formatEventDate = (
  metadata: EventMomentMetadata,
  lang: string,
  now: Date = new Date(),
): string | undefined => {
  const moment = resolveMoment(metadata.starts_at, firstText(metadata.timezone), lang, now);
  return moment ? dayAndMonth(moment) : undefined;
};

/** The i18next `context` that names an event by its kind. A concert — and a
 *  legacy row stored before the kind existed — reads the base key. */
const EVENT_KIND_CONTEXTS: ReadonlySet<string> = new Set(["MASS", "WEDDING", "OTHER"]);
export const eventKindContext = (kind?: string | null): string | undefined =>
  kind && EVENT_KIND_CONTEXTS.has(kind) ? kind : undefined;

/**
 * The days a run of events covers, "7–18 października", in the event's zone. The
 * year appears only when the run does not start this year. Undefined unless both
 * edges carry an ISO moment.
 */
export const formatEventSpan = (
  metadata: EventMomentMetadata,
  lang: string,
  now: Date = new Date(),
): string | undefined => {
  const start = parseInstant(metadata.starts_at);
  const end = parseInstant(metadata.ends_at);
  const opening = resolveMoment(metadata.starts_at, firstText(metadata.timezone), lang, now);
  if (!start || !end || !opening) return undefined;
  return zonedFormat(
    lang || "pl",
    firstText(metadata.timezone),
    opening.sameYear
      ? { day: "numeric", month: "long" }
      : { day: "numeric", month: "long", year: "numeric" },
  ).formatRange(start, end);
};

/** Localized human label for a structured change field key. */
export const changeLabel = (t: TFunc, fieldKey: string): string =>
  t(`notifications.changes.${fieldKey}`, fieldKey.replace(/_/g, " "));

const STATUS_CODES: ReadonlySet<string> = new Set(Object.values(PROJECT_STATUS));
const EVENT_KIND_CODES: ReadonlySet<string> = new Set(Object.values(PROJECT_EVENT_KIND));

/**
 * A change value stored as a code, named the way the rest of the app names it:
 * a project status as its badge does, an event kind as the details picker does
 * (the chip answers the picker's own question, "which kind is this now?"), a
 * rehearsal length as "2 h 30 min". Mirrors the server's `_change_value`.
 * Anything else, and any code this client does not know, passes through as is.
 */
const changeValue = (
  t: TFunc,
  fieldKey: string,
  raw: string,
  scope: readonly string[],
): string => {
  switch (fieldKey) {
    case "voice_line":
      return voiceLineLabel(t, raw, scope);
    case "gives_pitch":
      return t(`notifications.changes.boolean.${raw.toLowerCase()}`, raw);
    case "status": {
      if (!STATUS_CODES.has(raw)) return raw;
      const { labelKey, fallbackLabel } = getProjectStatusPresentation(raw as ProjectStatus);
      return t(labelKey, fallbackLabel);
    }
    case "event_kind":
      return EVENT_KIND_CODES.has(raw)
        ? t(`projects.details_tab.event_kind.${raw.toLowerCase()}`, raw)
        : raw;
    case "duration": {
      const minutes = Number.parseInt(raw, 10);
      if (!Number.isFinite(minutes)) return raw;
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      if (hours && rest) {
        return t("notifications.changes.duration_value.hours_minutes", { hours, minutes: rest });
      }
      return hours
        ? t("notifications.changes.duration_value.hours", { hours })
        : t("notifications.changes.duration_value.minutes", { minutes: rest });
    }
    default:
      return raw;
  }
};

/** The change field a solo save records; its values are JSON duty lists. */
export const SOLO_CHANGE_FIELD = "solo_assignments";

interface SoloDuty {
  id: string;
  label: string;
  score_reference: string;
  notes: string;
  gives_pitch: boolean;
}

/** One side of a solo change. Unreadable input is no duties, never raw JSON. */
const parseSoloDuties = (raw: unknown): SoloDuty[] => {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (duty): duty is Record<string, unknown> =>
          Boolean(duty) && typeof duty === "object",
      )
      .map((duty) => ({
        id: String(duty.id ?? ""),
        label: typeof duty.label === "string" ? duty.label : "",
        score_reference:
          typeof duty.score_reference === "string" ? duty.score_reference : "",
        notes: typeof duty.notes === "string" ? duty.notes : "",
        gives_pitch: Boolean(duty.gives_pitch),
      }));
  } catch {
    return [];
  }
};

/** A solo as the reader knows it; a legacy one has no name and reads "Solo". */
export const soloDisplay = (
  t: TFunc,
  duty: { label?: string; score_reference?: string },
): string => {
  const label = duty.label?.trim() || t("notifications.changes.solo.unnamed", "Solo");
  const reference = duty.score_reference?.trim();
  return reference ? `${label} (${reference})` : label;
};

/**
 * What moved in the reader's solos, one phrase per passage — the same reading
 * the server's `_solo_change_phrases` gives the email and the push.
 */
export const soloChangePhrases = (
  t: TFunc,
  old: unknown,
  next: unknown,
): string[] => {
  const before = new Map(parseSoloDuties(old).map((duty) => [duty.id, duty]));
  const after = new Map(parseSoloDuties(next).map((duty) => [duty.id, duty]));
  const phrases: string[] = [];
  after.forEach((duty, id) => {
    const previous = before.get(id);
    if (!previous) {
      phrases.push(t("notifications.changes.solo.added", { solo: soloDisplay(t, duty) }));
    } else if (soloDisplay(t, previous) !== soloDisplay(t, duty)) {
      phrases.push(`${soloDisplay(t, previous)} → ${soloDisplay(t, duty)}`);
    } else if (
      previous.notes !== duty.notes ||
      previous.gives_pitch !== duty.gives_pitch
    ) {
      phrases.push(t("notifications.changes.solo.updated", { solo: soloDisplay(t, duty) }));
    }
  });
  before.forEach((duty, id) => {
    if (!after.has(id)) {
      phrases.push(t("notifications.changes.solo.removed", { solo: soloDisplay(t, duty) }));
    }
  });
  return phrases;
};

/** Whether a casting notice is about the reader's solos rather than their part. */
export const isSoloChange = (changes: unknown): boolean =>
  Array.isArray(changes) &&
  changes.some(
    (change) =>
      Boolean(change) &&
      typeof change === "object" &&
      (change as { field?: unknown }).field === SOLO_CHANGE_FIELD,
  );

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
  // Codes, flags (Python's "True"/"False") and minute counts are stored
  // language-neutrally — localize the values too, not just the field label.
  const value = (raw: unknown): string =>
    raw == null ? "" : changeValue(t, fieldKey, String(raw), scope);
  const from = value(old);
  const to = value(next);

  if (from && to) return label ? `${label}: ${from} → ${to}` : `${from} → ${to}`;
  if (to) return label ? `${label}: ${to}` : to;
  return label;
};

/** Maps a (possibly legacy/loose) `changes` payload to chip labels, dropping any
 *  entry that can't be rendered. Never assumes an array of structured objects.
 *  A solo change becomes one chip per passage that moved. */
export const renderChanges = (
  t: TFunc,
  changes: unknown,
  scope: readonly string[] = [],
): string[] =>
  Array.isArray(changes)
    ? changes
        .flatMap((change) => {
          const field =
            change && typeof change === "object"
              ? (change as { field?: unknown }).field
              : undefined;
          if (field !== SOLO_CHANGE_FIELD) return [renderChange(t, change, scope)];
          const { old, new: next } = change as { old?: unknown; new?: unknown };
          const phrases = soloChangePhrases(t, old, next);
          return phrases.length > 0 ? phrases : [changeLabel(t, SOLO_CHANGE_FIELD)];
        })
        .filter(Boolean)
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
 * The plan's start as one line in the push's shape, "Wyjazd — sobota,
 * 10 października o 14:00 · Dworzec Główny"; undefined when the plan opens at
 * the call, which is every one-day concert. The title is never put inside a
 * sentence, because a point's title is whatever the manager typed.
 */
export const formatPlanStart = (
  metadata: PlanStartMetadata & Pick<EventMomentMetadata, "timezone">,
  lang: string,
  t: TFunc,
): string | undefined => {
  if (!parseInstant(metadata.plan_starts_at)) return undefined;
  const when = formatEventMoment(
    { starts_at: metadata.plan_starts_at, timezone: metadata.timezone },
    lang,
    t,
  );
  if (!when) return undefined;
  const title =
    firstText(metadata.plan_start_title) ??
    (metadata.plan_start_window ? changeLabel(t, metadata.plan_start_window) : undefined);
  // A rendered moment is lowercase ("jutro o 14:00"), so on its own it would
  // open the line lowercase.
  const lead = title ? `${title} — ${when}` : when.charAt(0).toUpperCase() + when.slice(1);
  return compactMetaLine(lead, metadata.plan_start_place);
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
    // A solo notice has no line of its own; it is headed "Solos" instead.
    const heading =
      voice || (isSoloChange(m.changes) ? changeLabel(t, SOLO_CHANGE_FIELD) : "");
    return compactMetaLine(piece, heading, changes) ?? "";
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
