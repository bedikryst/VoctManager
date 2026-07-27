/**
 * @file AuthOutcome.tsx
 * @description The end of a threshold journey stated once: a struck medallion,
 * an overline, a headline, one sentence, and whatever the member does next.
 * Four screens reach this shape — password reset sent, password reset done,
 * activation done, activation link dead — and each had hand-rolled its own icon
 * stack, two of them inside a second tinted box nested in the card that already
 * was the surface. The tone lives in the medallion and the overline; the card
 * around it stays the card.
 *
 * There is no alarm tone. A dead invitation is not a failure of anything — it is
 * almost always an account that already exists — and crimson is the panel's
 * alarm, spent on the one thing that is genuinely wrong. A genuine failure with
 * no field to blame is `AuthAlert`, which is a banner, not an outcome.
 * @architecture Enterprise SaaS 2026
 * @module features/auth/components/AuthOutcome
 */

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import type { TypographyProps } from "@/shared/ui/primitives/typography";

type OutcomeTone = "success" | "info";

const MEDALLION: Record<OutcomeTone, string> = {
  success:
    "bg-ethereal-sage/12 text-ethereal-sage border border-ethereal-sage/25",
  info: "bg-ethereal-gold/12 text-ethereal-gold border border-ethereal-gold/30",
};

const EYEBROW_COLOR: Record<OutcomeTone, NonNullable<TypographyProps["color"]>> =
  {
    success: "sage",
    info: "incense-muted",
  };

interface AuthOutcomeProps {
  readonly icon: React.ReactNode;
  readonly tone: OutcomeTone;
  readonly eyebrow: string;
  readonly title: string;
  /** `h2` where the screen already has a headline above it. */
  readonly headingAs?: "h1" | "h2";
  readonly description?: string;
  /** Anything the outcome hands over — a credential to copy, a tuning fork. */
  readonly children?: React.ReactNode;
  /**
   * Where the member goes next. A stack, not a row: two uppercase CTAs side by
   * side at equal width are two slabs shouting the same volume, and the second
   * way forward is almost never the equal of the first. Pass one `fullWidth`
   * button, and let a quieter alternative follow it as a line of type.
   */
  readonly actions?: React.ReactNode;
}

export const AuthOutcome = ({
  icon,
  tone,
  eyebrow,
  title,
  headingAs = "h1",
  description,
  children,
  actions,
}: AuthOutcomeProps): React.JSX.Element => (
  <div className="flex flex-col text-center">
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className={cn(
        "mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-nested",
        MEDALLION[tone],
      )}
      aria-hidden="true"
    >
      {icon}
    </motion.div>

    <Eyebrow color={EYEBROW_COLOR[tone]} as="p" className="mb-2">
      {eyebrow}
    </Eyebrow>
    <Heading as={headingAs} size="2xl" color="default">
      {title}
    </Heading>
    {description && (
      <Text size="sm" color="graphite" className="mx-auto mt-3 max-w-sm leading-7">
        {description}
      </Text>
    )}

    {children}

    {actions && <div className="mt-7 flex flex-col gap-4">{actions}</div>}
  </div>
);
