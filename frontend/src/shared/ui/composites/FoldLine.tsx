/**
 * @file FoldLine.tsx
 * @description Work that needs the manager now and then, folded into one line
 * under a list page's tabs ("AI analizuje 2 pliki", "Możliwe duplikaty: 2"):
 * a glyph, the sentence, a chevron, and the rows it stands for under it once
 * opened. The canon's rule for a list header: what is in flight or waiting
 * folds into one line, so the band between the tabs and the toolbar never
 * grows by a section for as long as it lasts.
 *
 * The caller renders it only while there is something to fold, and owns the
 * open state, so a panel that does work while open (a ticking clock) can tell.
 * @module shared/ui/composites/FoldLine
 */

import React, { useId } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Text } from "@/shared/ui/primitives/typography";

interface FoldLineProps {
  /** The section's accessible name. */
  readonly label: string;
  /** The line itself, a sentence with its count. */
  readonly summary: string;
  /** A 16 px glyph before the sentence. */
  readonly icon: React.ReactNode;
  readonly open: boolean;
  readonly onToggle: () => void;
  /** What the line opens; mounted only while open. */
  readonly children: React.ReactNode;
}

export const FoldLine = ({
  label,
  summary,
  icon,
  open,
  onToggle,
  children,
}: FoldLineProps): React.JSX.Element => {
  const contentId = useId();

  return (
    <section aria-label={label}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={onToggle}
        className="group flex min-h-11 items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40"
      >
        <span aria-hidden="true" className="flex shrink-0 items-center">
          {icon}
        </span>
        <Text
          as="span"
          size="sm"
          color="graphite"
          className="tabular-nums transition-colors group-hover:text-ethereal-ink"
        >
          {summary}
        </Text>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn("shrink-0 text-ethereal-graphite transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div id={contentId}>{children}</div>}
    </section>
  );
};
