/**
 * @file voiceLabels.ts
 * @description Contextual display names for voice-line codes — the panel's
 * mirror of the backend rule in `core/voice_labels.py`.
 *
 * A code stores its divisi index unconditionally (`T1` even where the piece has
 * one tenor line), because the code has to mean the same thing across the whole
 * repertoire. But "Tenor 1" promises a "Tenor 2" somewhere on the page, so the
 * index belongs to the SCOPE, not to the code: within one arrangement, a family
 * holding a single line is named plainly, and only a family that is genuinely
 * divided keeps its number.
 *
 * Most surfaces read the server's `*_display`, which already applies this. Use
 * these helpers where the client composes a label itself — the divisi editor
 * and the casting board, which name lines the manager has not saved yet.
 * @architecture Enterprise SaaS 2026
 * @module shared/lib/voiceLabels
 */

import type { TFunction } from "i18next";

/** Sx/Ax/Tx/Bx plus the untyped Vx a canon divides into. */
const DIVISI_CODE = /^([SATBV])([1-9])$/;

const FAMILY_KEYS: Record<string, { key: string; fallback: string }> = {
  S: { key: "common.voice_family.S", fallback: "Sopran" },
  A: { key: "common.voice_family.A", fallback: "Alt" },
  T: { key: "common.voice_family.T", fallback: "Tenor" },
  B: { key: "common.voice_family.B", fallback: "Bas" },
  V: { key: "common.voice_family.V", fallback: "Głos" },
};

export const voiceFamilyOf = (code: string): string | null => {
  const match = DIVISI_CODE.exec(code.toUpperCase());
  return match ? match[1] : null;
};

/**
 * code → display name across `scope`, given the dictionary of full enum labels
 * (`/api/options/voice-lines/`). Codes outside the dictionary fall back to
 * themselves, so an unknown value renders as itself rather than blank.
 *
 * An EMPTY scope means "the arrangement is unknown", not "this line is alone":
 * nothing collapses, because claiming a piece has no divisi on no evidence is
 * worse than an index the reader can ignore.
 */
export const collapseVoiceLabels = (
  scope: readonly string[],
  dictionary: readonly { value: string; label: string }[],
  t: TFunction,
): Record<string, string> => {
  const enumLabel = new Map(
    dictionary.map((option) => [String(option.value), option.label]),
  );
  const codes = Array.from(new Set(scope.filter(Boolean)));
  const labels: Record<string, string> = {};
  for (const code of codes) {
    labels[code] = enumLabel.get(code) ?? code;
  }

  const families = new Map<string, string[]>();
  for (const code of codes) {
    const family = voiceFamilyOf(code);
    if (!family) continue;
    families.set(family, [...(families.get(family) ?? []), code]);
  }

  for (const [family, members] of families) {
    if (members.length !== 1) continue;
    const entry = FAMILY_KEYS[family];
    if (entry) labels[members[0]] = t(entry.key, entry.fallback);
  }

  return labels;
};

/** One code as read inside `scope`. `scope` need not contain `code`. */
export const voiceLabel = (
  code: string,
  scope: readonly string[],
  dictionary: readonly { value: string; label: string }[],
  t: TFunction,
): string => {
  const known = scope.filter(Boolean);
  const dictionaryLabel =
    dictionary.find((option) => String(option.value) === code)?.label ?? code;
  if (known.length === 0) return dictionaryLabel;
  return collapseVoiceLabels([...known, code], dictionary, t)[code] ?? dictionaryLabel;
};
