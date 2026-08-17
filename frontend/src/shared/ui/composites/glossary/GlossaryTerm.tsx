/**
 * @file GlossaryTerm.tsx
 * @description The micro-definition mark: wraps a specialist term in the label
 * slot where the reader first meets it and reveals one sentence from the
 * glossary. Renders the term itself as the trigger — a dotted gold underline
 * under words that were already on screen, not a help icon added beside them.
 *
 * It is a Radix Popover rather than the `Tooltip` primitive on purpose. A
 * tooltip opens on hover and focus, and Radix suppresses it on touch, so on a
 * phone — where a chorister meets most of this vocabulary — the definition
 * would be unreachable. A popover opens on tap, click and Enter alike.
 *
 * Mark ONE occurrence per view. A term glossed on every row is the resting
 * default stated in every slot, which is the bug this layer must not become.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/glossary/GlossaryTerm
 */

import React from "react";
import * as RadixPopover from "@radix-ui/react-popover";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Text } from "@/shared/ui/primitives/typography";
import { glossaryDefinitionKey, type GlossaryTermId } from "./glossaryTerms";

export interface GlossaryTermProps {
  /** Which sentence to show; the definition lives in `glossary.<term>`. */
  readonly term: GlossaryTermId;
  /** The term as the surface already writes it — label, casing and all. */
  readonly children: React.ReactNode;
  readonly side?: RadixPopover.PopoverContentProps["side"];
  readonly className?: string;
}

export const GlossaryTerm = ({
  term,
  children,
  side = "bottom",
  className,
}: GlossaryTermProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-help rounded-[2px] text-inherit underline decoration-dotted decoration-ethereal-gold/60 underline-offset-4 outline-none transition-colors",
            "hover:decoration-ethereal-gold focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
            className,
          )}
        >
          {children}
        </button>
      </RadixPopover.Trigger>

      <RadixPopover.Portal>
        <RadixPopover.Content
          side={side}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-popover max-w-[19rem] outline-none",
            "origin-(--radix-popover-content-transform-origin) popover-motion",
          )}
        >
          {/* The definition is prose: it keeps the body voice even when the
              trigger sits in an uppercase label slot. */}
          <GlassCard variant="solid" padding="sm">
            <Text size="sm" color="graphite" className="normal-case">
              {t(glossaryDefinitionKey(term))}
            </Text>
          </GlassCard>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
};
