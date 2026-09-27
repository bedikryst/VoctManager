/**
 * @file artist.dto.ts
 * @description Data Transfer Objects and Zod schemas for Artist mutations.
 * @architecture Enterprise SaaS 2026
 */

import { z } from "zod";

import type { VocalRangeMidi } from "@/shared/lib/music/pitchNotation";
import {
  rangePitches,
  rangeProblem,
  type RangeProblem,
  type RangeSlot,
} from "@/shared/lib/music/rangeDraft";
import { isInstrumentalist } from "@/shared/lib/voiceTypes";
import type { Artist, VoiceType } from "@/shared/types";

/** A0–C8, the server's bounds for every note of a range. */
const assessedNote = z.number().int().min(21).max(108).nullable();

export interface AssessedRangeValues {
  assessed_tessitura_low: number | null;
  assessed_tessitura_high: number | null;
  assessed_extreme_low: number | null;
  assessed_extreme_high: number | null;
}

export type AssessedField = keyof AssessedRangeValues;

/** The form field, and the server's key, behind each slot of the range. */
export const ASSESSED_FIELD: Readonly<Record<RangeSlot, AssessedField>> = {
  tessituraLow: "assessed_tessitura_low",
  tessituraHigh: "assessed_tessitura_high",
  extremeLow: "assessed_extreme_low",
  extremeHigh: "assessed_extreme_high",
};

export const ASSESSED_FIELDS: readonly AssessedField[] = Object.values(ASSESSED_FIELD);

export const assessedRangeOf = (values: AssessedRangeValues): VocalRangeMidi => ({
  tessituraLow: values.assessed_tessitura_low,
  tessituraHigh: values.assessed_tessitura_high,
  extremeLow: values.assessed_extreme_low,
  extremeHigh: values.assessed_extreme_high,
});

/**
 * The server's rule for the conductor's assessment (`range_shape_error` with
 * `required=False`): all four empty means not assessed yet; once any note is
 * set, the singer's rules apply, tessitura pair required.
 */
export const assessedRangeProblem = (range: VocalRangeMidi): RangeProblem | null =>
  rangePitches(range).length > 0 ? rangeProblem(range) : null;

/** The slot a problem is keyed to, as the server keys its 400: the subject of
 *  the broken rule, or the missing bound of an incomplete pair. */
const problemSlot = (problem: RangeProblem, range: VocalRangeMidi): RangeSlot => {
  switch (problem) {
    case "tessituraOrder":
      return "tessituraLow";
    case "extremeLowOrder":
      return "extremeLow";
    case "extremeHighOrder":
      return "extremeHigh";
    case "incomplete":
      return range.tessituraLow === null ? "tessituraLow" : "tessituraHigh";
  }
};

// 1. Zod Schema defining both validation rules and the shape of the form
export const artistFormSchema = z
  .object({
    first_name: z.string().min(1, "artists.validation.first_name_required"),
    first_name_vocative: z.string().optional(),
    last_name: z.string().min(1, "artists.validation.last_name_required"),
    email: z.string(),
    // The explicit waiver for a member who will not use the app. Ticked by the
    // manager on create; on edit it mirrors whether the member has an address
    // yet, and is never shown there.
    without_email: z.boolean(),
    voice_type: z.string().min(1, "artists.validation.voice_type_required"),
    instrument: z.string().optional(),
    phone_number: z.string().optional(),
    sight_reading_skill: z.string().optional(),
    assessed_tessitura_low: assessedNote,
    assessed_tessitura_high: assessedNote,
    assessed_extreme_low: assessedNote,
    assessed_extreme_high: assessedNote,
    language: z.enum(["pl", "en", "fr"]),
    salutation: z.enum(["F", "M", "N"]),
    is_active: z.boolean(),
  })
  // An address is required unless the waiver is ticked; one that is typed must
  // be valid either way. The server holds the same rule in `ArtistCreateDTO`.
  .refine(
    (values) => {
      const email = values.email.trim();
      if (!email) return values.without_email;
      return z.string().email().safeParse(email).success;
    },
    {
      message: "artists.validation.invalid_email",
      path: ["email"],
    },
  )
  // The server's `validate_instrument` rule, so the form says it before a
  // round trip: a player without an instrument would print as a bare
  // "Instrumentalist" on every sheet.
  .refine(
    (values) =>
      !isInstrumentalist(values.voice_type as VoiceType) ||
      Boolean(values.instrument?.trim()),
    {
      message: "artists.validation.instrument_required",
      path: ["instrument"],
    },
  )
  // The assessment's shape, checked before the round trip; the server's 400
  // is the backstop. The field shows its own copy for the problem, so the
  // message only has to mark the slot.
  .superRefine((values, context) => {
    const range = assessedRangeOf(values);
    const problem = assessedRangeProblem(range);
    if (problem === null) return;
    context.addIssue({
      code: "custom",
      message: problem,
      path: [ASSESSED_FIELD[problemSlot(problem, range)]],
    });
  });

export type ArtistFormValues = z.infer<typeof artistFormSchema>;

/**
 * Smart default for the grammatical form of address, suggested from the voice
 * part (women's voices → feminine, men's → masculine, conductor → neutral).
 * Only a PREFILL — the manager confirms/corrects it; it is never inferred silently.
 */
export const voiceToSalutation = (voice: string): "F" | "M" | "N" => {
  if (["SOP", "MEZ", "ALT"].includes(voice)) return "F";
  if (["TEN", "BAR", "BAS", "CT"].includes(voice)) return "M";
  return "N"; // DIR / conductor / unknown
};

export interface ArtistCreateDTO {
  first_name: string;
  first_name_vocative?: string;
  last_name: string;
  /** Absent only together with `without_email`; the server refuses either alone. */
  email?: string;
  /** Create only: adds the member without an address, so nothing is sent. */
  without_email?: boolean;
  voice_type: string;
  /** Sent only for an instrumentalist; the server refuses it on anyone else. */
  instrument?: string;
  phone_number?: string;
  sight_reading_skill?: number | null;
  /** The conductor's assessment, MIDI numbers; four nulls clear it. */
  assessed_tessitura_low?: number | null;
  assessed_tessitura_high?: number | null;
  assessed_extreme_low?: number | null;
  assessed_extreme_high?: number | null;
  language?: string;
  salutation?: string;
}

/**
 * Editable profile fields only. Platform access is deliberately absent: the
 * server owns `is_active` and moves it exclusively through archive/restore,
 * together with the soft-delete flag and the login gate. Sending it here would
 * be silently dropped.
 */
export type ArtistUpdateDTO = Partial<ArtistCreateDTO>;

/**
 * Why two rows looked like one person, in the server's confidence order: an
 * address or a number is near-certain, a shared name is a question — two people
 * genuinely can be called the same thing.
 */
export type DuplicateSignal = "email" | "phone" | "name";

export interface DuplicateGroup {
  signal: DuplicateSignal;
  /** The normalized value they collided on, so the reason can be shown. */
  key: string;
  artists: Artist[];
}

/** What the merge moved, so the manager is told what it cost. */
export interface ArtistMergeResult {
  artist: Artist;
  merged: {
    participations_moved: number;
    participations_folded: number;
    castings_moved: number;
    castings_dropped: number;
    readiness_moved: number;
    attendances_moved: number;
    attendances_dropped: number;
    threads_moved: number;
    projects_conducted: number;
    statuses_upgraded: number;
    /**
     * Projects where the duplicate's fee stayed on its folded seat: the survivor
     * had a fee of its own, or the project's budget is closed.
     */
    fee_conflicts: string[];
  };
}
