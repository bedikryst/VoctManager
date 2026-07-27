/**
 * @file AuthOutcome.tsx
 * @description The end of a threshold journey stated once: a struck medallion,
 * an overline, a headline, one sentence, and whatever the member does next.
 * Four screens reach this shape — password reset sent, password reset done,
 * activation done, activation link dead — and each had hand-rolled its own icon
 * stack, two of them inside a second tinted box nested in the card that already
 * was the surface. The tone lives in the medallion and the overline; the card
 * around it stays the card.
 * @architecture Enterprise SaaS 2026
 * @module features/auth/components/AuthOutcome
 */

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import type { TypographyProps } from "@/shared/ui/primitives/typography";

type OutcomeTone = "success" | "info" | "alert";

const MEDALLION: Record<OutcomeTone, string> = {
  success: "bg-ethereal-sage/15 text-ethereal-sage",
  info: "bg-ethereal-gold/15 text-ethereal-gold",
  alert: "bg-ethereal-crimson/10 text-ethereal-crimson",
};

const EYEBROW_COLOR: Record<OutcomeTone, NonNullable<TypographyProps["color"]>> =
  {
    success: "sage",
    info: "incense-muted",
    alert: "crimson",
  };

interface AuthOutcomeProps {
  readonly icon: React.ReactNode;
  readonly tone: OutcomeTone;
  readonly eyebrow: string;
  readonly title: string;
  /** `h2` where the screen already has a headline above it (the Nave rail). */
  readonly headingAs?: "h1" | "h2";
  readonly description?: string;
  /** Anything the outcome hands over — a credential to copy, a tuning fork. */
  readonly children?: React.ReactNode;
  /** Where the member goes next; a row on desktop, stacked on a phone. */
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
  <div className="flex h-full flex-col justify-center text-center">
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

    {/* Two uppercase CTAs at 0.1em tracking do not shrink — `Button` is
        `whitespace-nowrap` — so a fixed row makes the pair's full width the
        outcome's minimum, and in a grid that minimum is paid for by the column
        NEXT to it. Wrapping lets the second action drop to its own line when the
        card is narrow, and keeps the outcome's min-content down to one button. */}
    {actions && (
      <div className="mt-7 flex flex-wrap justify-center gap-3 *:min-w-48 *:flex-1">
        {actions}
      </div>
    )}
  </div>
);
