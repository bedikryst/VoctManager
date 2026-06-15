/**
 * @file passwordStrength.ts
 * @description Single source of truth for the lightweight, dependency-free
 * password-strength heuristic shared by the auth flow (activation) and the
 * in-panel security settings. Pure scoring + level metadata only — the
 * presentation lives in `PasswordStrengthMeter`.
 * @architecture Enterprise SaaS 2026
 * @module shared/lib/password/passwordStrength
 */

import type { TypographyProps } from "@/shared/ui/primitives/typography";

/**
 * Heuristic 0–4 score. Each satisfied criterion adds a point, capped at 4 so
 * it maps cleanly onto the four-segment meter. Intentionally simple (no zxcvbn
 * dependency): length + character-class diversity is enough to coach a member
 * toward a stronger first password without shipping a 400 kB analyser.
 */
export const scorePassword = (password: string): number => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return Math.min(4, score);
};

export interface PasswordStrengthLevel {
  /** i18n key for the level label. */
  readonly key: string;
  /** Inline fallback (Polish) when the key is missing. */
  readonly fallback: string;
  /** Tailwind background utility for the lit meter segments. */
  readonly bar: string;
  /** Typography colour token for the label. */
  readonly text: NonNullable<TypographyProps["color"]>;
}

/** Ordered weakest → strongest. Index = score − 1. */
export const PASSWORD_STRENGTH_LEVELS: readonly PasswordStrengthLevel[] = [
  { key: "password.strength.weak", fallback: "Słabe", bar: "bg-ethereal-crimson", text: "crimson" },
  { key: "password.strength.fair", fallback: "Przeciętne", bar: "bg-ethereal-incense", text: "incense" },
  { key: "password.strength.good", fallback: "Dobre", bar: "bg-ethereal-gold", text: "gold" },
  { key: "password.strength.strong", fallback: "Mocne", bar: "bg-ethereal-sage", text: "sage" },
];

/** Resolve the level metadata for a given password (null when empty). */
export const resolvePasswordStrength = (
  password: string,
): { score: number; level: PasswordStrengthLevel } | null => {
  if (!password) return null;
  const score = scorePassword(password);
  return { score, level: PASSWORD_STRENGTH_LEVELS[Math.max(0, score - 1)] };
};
