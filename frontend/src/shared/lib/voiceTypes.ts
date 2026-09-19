/**
 * @file voiceTypes.ts
 * @description What a `VoiceType` says about the person who holds it — the
 * panel's mirror of `SINGING_VOICE_TYPES` and `Artist.role_label` in
 * `roster/models.py`.
 *
 * Two of the eight values name people who do not stand in a section: the
 * conductor and the instrumentalist. Everything that reads the cast as
 * S/A/T/B — the balance rail, vocal range and sight reading on the form, the
 * autocast families — asks `isSingingVoiceType` rather than testing for one
 * of them, so a third non-singing kind is one edit here and none elsewhere.
 *
 * `artistRoleLabel` is the word printed after a name. For a player it is the
 * instrument ("Organy"), which the generic "Instrumentalista" would hide; for
 * everyone else it is the localized voice type. Group HEADINGS keep the
 * generic label — a section of two organists and a trumpeter has no single
 * instrument to be named after.
 * @architecture Enterprise SaaS 2026
 * @module shared/lib/voiceTypes
 */

import type { TFunction } from "i18next";

import type { VoiceType } from "@/shared/types";

const SINGING_VOICE_TYPES: ReadonlySet<VoiceType> = new Set<VoiceType>([
  "SOP",
  "MEZ",
  "ALT",
  "CT",
  "TEN",
  "BAR",
  "BAS",
]);

export const INSTRUMENTALIST_VOICE_TYPE: VoiceType = "INS";

export const isSingingVoiceType = (voiceType: VoiceType | null | undefined): boolean =>
  voiceType != null && SINGING_VOICE_TYPES.has(voiceType);

export const isInstrumentalist = (voiceType: VoiceType | null | undefined): boolean =>
  voiceType === INSTRUMENTALIST_VOICE_TYPE;

/** The role printed after a person's name; see the file header. */
export const artistRoleLabel = (
  t: TFunction,
  voiceType: VoiceType | null | undefined,
  instrument: string | null | undefined,
): string => {
  if (isInstrumentalist(voiceType) && instrument) return instrument;
  if (!voiceType) return "";
  return t(`dashboard.layout.roles.${voiceType}`, voiceType);
};
