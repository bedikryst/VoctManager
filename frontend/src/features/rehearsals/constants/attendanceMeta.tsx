/**
 * @file attendanceMeta.tsx
 * @description Single source of truth for attendance status presentation and
 * vocal-section taxonomy across the Rehearsals (Centrum Obecności) module.
 * Keeps row toggles, roster headers, roll-call cards and the reliability board
 * visually in lock-step so a status colour means the same thing everywhere.
 * @architecture Enterprise SaaS 2026
 * @module features/rehearsals/constants/attendanceMeta
 */

import React from "react";
import { Check, Clock3, FileText, Minus, X } from "lucide-react";
import type { AttendanceStatus, VoiceType } from "@/shared/types";

/** The pseudo-status used wherever a participant has no attendance row yet. */
export type AttendanceCell = AttendanceStatus | "NONE";

export interface AttendanceStatusMeta {
  /** i18n key + Polish fallback. */
  labelKey: string;
  fallback: string;
  /** Ethereal palette token this status maps to (alarm = crimson only). */
  token: "sage" | "gold" | "crimson" | "amethyst" | "graphite";
  /** Solid fill — used by the active segment of a toggle / roll-call button. */
  solid: string;
  /** Soft tinted chip — used by badges and analytics legends. */
  soft: string;
  /** Bare dot fill — used in the reliability heatmap. */
  dot: string;
  /** Foreground text colour. */
  text: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const ATTENDANCE_STATUS_META: Record<
  AttendanceCell,
  AttendanceStatusMeta
> = {
  PRESENT: {
    labelKey: "rehearsals.row.status_present",
    fallback: "Obecny",
    token: "sage",
    solid: "bg-ethereal-sage text-ethereal-alabaster border-ethereal-sage",
    soft: "bg-ethereal-sage/10 text-ethereal-sage border-ethereal-sage/30",
    dot: "bg-ethereal-sage",
    text: "text-ethereal-sage",
    Icon: Check,
  },
  LATE: {
    labelKey: "rehearsals.row.status_late",
    fallback: "Spóźniony",
    token: "gold",
    solid: "bg-ethereal-gold text-ethereal-graphite border-ethereal-gold",
    soft: "bg-ethereal-gold/10 text-ethereal-gold border-ethereal-gold/40",
    dot: "bg-ethereal-gold",
    text: "text-ethereal-gold",
    Icon: Clock3,
  },
  ABSENT: {
    labelKey: "rehearsals.row.status_absent",
    fallback: "Nieobecny",
    token: "crimson",
    solid:
      "bg-ethereal-crimson text-ethereal-alabaster border-ethereal-crimson",
    soft: "bg-ethereal-crimson/10 text-ethereal-crimson border-ethereal-crimson/30",
    dot: "bg-ethereal-crimson",
    text: "text-ethereal-crimson",
    Icon: X,
  },
  EXCUSED: {
    labelKey: "rehearsals.row.status_excused",
    fallback: "Usprawiedliwiony",
    token: "amethyst",
    solid:
      "bg-ethereal-amethyst text-ethereal-alabaster border-ethereal-amethyst",
    soft: "bg-ethereal-amethyst/10 text-ethereal-amethyst border-ethereal-amethyst/30",
    dot: "bg-ethereal-amethyst",
    text: "text-ethereal-amethyst",
    Icon: FileText,
  },
  NONE: {
    labelKey: "rehearsals.row.status_none",
    fallback: "Nieoznaczony",
    token: "graphite",
    soft: "bg-ethereal-ink/4 text-ethereal-graphite/60 border-ethereal-ink/8",
    solid: "bg-ethereal-graphite text-ethereal-alabaster border-ethereal-graphite",
    dot: "bg-ethereal-ink/15",
    text: "text-ethereal-graphite/50",
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

/** i18n label key for a section bucket (reuses the shared role dictionary). */
export const voiceSectionLabelKey = (key: VoiceSectionKey): string =>
  key === OTHER_SECTION
    ? "rehearsals.voices.other"
    : `dashboard.layout.roles.${key}`;
