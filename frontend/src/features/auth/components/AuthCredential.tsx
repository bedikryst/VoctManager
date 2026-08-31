/**
 * @file AuthCredential.tsx
 * @description The one fact a new member has to keep: the address their account
 * is bound to. It is stated twice on the way in — on the welcome rail while the
 * password is being chosen, and on the card that confirms the account exists —
 * and both must read as the same object, so the shape lives here rather than
 * being typed once per screen.
 *
 * `tone` governs the fill AND the separation, because a dark rail already draws
 * its own border: a bordered plate inside it would be a box inside a box, so
 * there the block sits under a hairline instead of in a well of its own.
 *
 * The dark tone's ink is still a ladder rung (`parchment-muted`), deliberately:
 * it belongs to the nave rail's fill, which is `GlassCard variant="dark"` and
 * has not been converted yet. Ink and ground move together or the rail reads
 * worse than it does now — see the dark-mode spec, §3.2 D.
 * @architecture Enterprise SaaS 2026
 * @module features/auth/components/AuthCredential
 */

import React from "react";
import { cn } from "@/shared/lib/utils";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface AuthCredentialProps {
  readonly label: string;
  readonly email: string;
  /** "dark" for the nave rail, "light" for the outcome card. */
  readonly tone?: "light" | "dark";
  /** One quiet sentence under the address — what it is for. */
  readonly hint?: string;
  /** Anything acting on the address, e.g. copy-to-clipboard. */
  readonly action?: React.ReactNode;
  readonly className?: string;
}

export const AuthCredential = ({
  label,
  email,
  tone = "light",
  hint,
  action,
  className,
}: AuthCredentialProps): React.JSX.Element => (
  <div
    className={cn(
      tone === "dark"
        ? "border-t border-line-on-inverse pt-6"
        : "rounded-nested border border-hairline-strong bg-ethereal-marble/70 p-4 text-left shadow-glass-solid",
      className,
    )}
  >
    <Eyebrow
      color={tone === "dark" ? "parchment-muted" : "muted"}
      as="p"
      className="mb-2.5"
    >
      {label}
    </Eyebrow>

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Text size="md" weight="medium" color="gold" className="min-w-0 truncate">
        {email}
      </Text>
      {action && <div className="shrink-0">{action}</div>}
    </div>

    {hint && (
      <Text
        size="xs"
        color={tone === "dark" ? "parchment-muted" : "graphite"}
        className="mt-2.5 leading-6"
      >
        {hint}
      </Text>
    )}
  </div>
);
