/**
 * @file attendanceMeta.tsx
 * @description Single source of truth for attendance status presentation, the
 * attendance-rate scale and the vocal-section taxonomy across the Rehearsals
 * (Centrum Obecności) module. Keeps row toggles, roster headers, roll-call
 * cards and the reliability board in lock-step so a status colour — and a rate
 * colour — means the same thing on every surface.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/constants/attendanceMeta
 */

import React from "react";
import { Check, Clock3, FileText, Minus, X } from "lucide-react";
import type { AttendanceStatus, VoiceType } from "@/shared/types";

/** The pseudo-status used wherever a participant has no attendance row yet. */
export type AttendanceCell = AttendanceStatus | "NONE";

export interface AttendanceStatusMeta {
  /**
   * i18n key + Polish fallback. The label names the RECORD, not the person —
   * "Obecność", not "Obecny". A register writes down what happened, and the
   * adjective form put a masculine ending on every singer in a choir that is
   * mostly not. Read by Centrum Obecności and by the hub's Frekwencja matrix.
   */
  labelKey: string;
  fallback: string;
  /** Solid fill — used by the active segment of a toggle / roll-call button. */
  solid: string;
  /** Bare dot fill — the status legend, the heatmap, the composition bar. */
  dot: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const ATTENDANCE_STATUS_META: Record<
  AttendanceCell,
  AttendanceStatusMeta
> = {
  PRESENT: {
    labelKey: "rehearsals.row.status_present",
    fallback: "Obecność",
    solid: "bg-ethereal-sage text-ethereal-alabaster border-ethereal-sage",
    dot: "bg-ethereal-sage",
    Icon: Check,
  },
  LATE: {
    labelKey: "rehearsals.row.status_late",
    fallback: "Spóźnienie",
    solid: "bg-ethereal-gold text-surface-inverse border-ethereal-gold",
    dot: "bg-ethereal-gold",
    Icon: Clock3,
  },
  ABSENT: {
    labelKey: "rehearsals.row.status_absent",
    fallback: "Nieobecność",
    solid:
      "bg-ethereal-crimson text-ethereal-alabaster border-ethereal-crimson",
    dot: "bg-ethereal-crimson",
    Icon: X,
  },
  EXCUSED: {
    labelKey: "rehearsals.row.status_excused",
    fallback: "Usprawiedliwienie",
    solid:
      "bg-ethereal-amethyst text-ethereal-alabaster border-ethereal-amethyst",
    dot: "bg-ethereal-amethyst",
    Icon: FileText,
  },
  NONE: {
    labelKey: "rehearsals.row.status_none",
    fallback: "Bez wpisu",
    solid: "bg-ethereal-graphite text-ethereal-alabaster border-ethereal-graphite",
    dot: "bg-ethereal-ink/15",
    Icon: Minus,
  },
};

/** The four user-selectable statuses, in roll-call tap order. */
export const SELECTABLE_STATUSES: AttendanceStatus[] = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "EXCUSED",
];

/* ── The attendance rate, and the one scale it is read on ────────────────── */

/**
 * Below this the figure turns gold. There is no sage counterpart on purpose:
 * full attendance is the resting case, and painting the expected outcome green
 * on forty rows is what buries the two rows that need a conversation.
 *
 * It lives here, with the rest of the attendance vocabulary, because the hub's
 * Frekwencja matrix reads it too — and that module already imports this one, so
 * the reverse edge would have been an import cycle. One low-attendance line in
 * the product, not one per surface.
 */
export const LOW_ATTENDANCE_RATE = 70;

/**
 * A rate earns a colour only when it is SHORT. This module used to carry two
 * further scales for the one measurement — the board's (sage ≥85, gold ≥60,
 * crimson below) and the inspector's (gold ≥80, crimson <50) — so the same 90%
 * read "settled" on one card and "work pending" on the next, and an ordinary
 * dip wore the panel's alarm colour.
 */
export type AttendanceRateTone = "unknown" | "low" | "normal";

export const attendanceRateTone = (rate: number | null): AttendanceRateTone =>
  rate === null ? "unknown" : rate < LOW_ATTENDANCE_RATE ? "low" : "normal";

/** A figure spends no colour when it is fine; the em-dash case stays muted. */
export const RATE_TONE_TEXT: Record<AttendanceRateTone, string> = {
  unknown: "text-ethereal-graphite/50",
  low: "text-ethereal-gold",
  normal: "text-ethereal-ink",
};

/** `MetricBlock`'s accent axis, for the same rate rendered as a KPI. */
export const RATE_TONE_ACCENT: Record<AttendanceRateTone, "default" | "gold"> = {
  unknown: "default",
  low: "gold",
  normal: "default",
};

/**
 * A bar is entirely colour — it has no ink option — so its resting fill is the
 * warm neutral and gold still marks the shortfall.
 */
export const RATE_TONE_BAR: Record<AttendanceRateTone, string> = {
  unknown: "bg-ethereal-ink/10",
  low: "bg-ethereal-gold",
  normal: "bg-ethereal-incense/50",
};

/* ── Vocal sections ──────────────────────────────────────────────────────
 * Canonical choral ordering (high → low), with mezzo / counter-tenor /
 * baritone slotted into the SATB spine. `OTHER` is the trailing bucket for
 * unknown or unset voice types so nobody silently disappears from a roster.
 */

export const VOICE_SECTION_ORDER: VoiceType[] = [
  "SOP",
  "MEZ",
  "ALT",
  "CT",
  "TEN",
  "BAR",
  "BAS",
];

export const OTHER_SECTION = "OTHER" as const;
export type VoiceSectionKey = VoiceType | typeof OTHER_SECTION;

/** Resolve an artist's voice type to a section bucket key. */
export const voiceSectionOf = (
  voiceType: VoiceType | string | null | undefined,
): VoiceSectionKey => {
  if (!voiceType) return OTHER_SECTION;
  const upper = String(voiceType).toUpperCase();
  return (VOICE_SECTION_ORDER as string[]).includes(upper)
    ? (upper as VoiceType)
    : OTHER_SECTION;
};

/**
 * i18n label key for a section bucket. A section header names a group of
 * people, so it takes the plural — the shared role dictionary
 * (`dashboard.layout.roles.*`) holds one singer's voice type ("Sopran") and
 * reads as a label for the part, not for the dozen women standing under it.
 */
const VOICE_SECTION_LABEL_KEY: Record<VoiceSectionKey, string> = {
  SOP: "rehearsals.voices.sopranos",
  MEZ: "rehearsals.voices.mezzos",
  ALT: "rehearsals.voices.altos",
  CT: "rehearsals.voices.countertenors",
  TEN: "rehearsals.voices.tenors",
  BAR: "rehearsals.voices.baritones",
  BAS: "rehearsals.voices.basses",
  DIR: "rehearsals.voices.other",
  [OTHER_SECTION]: "rehearsals.voices.other",
};

export const voiceSectionLabelKey = (key: VoiceSectionKey): string =>
  VOICE_SECTION_LABEL_KEY[key];
