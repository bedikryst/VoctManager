/**
 * @file SectionLabel.tsx
 * @description The one block label in the practice cockpit — a gold glyph and an
 * overline naming what sits under it. Every block on the piece page wears it
 * (mixer, references, text, pitch pipe, readiness), which is why the text block
 * is not allowed a header of a different shape: a block that names itself with a
 * button while its neighbours use a label is two voices for one job.
 * @module features/materials/components
 */
import React from "react";

import { Eyebrow } from "@/shared/ui/primitives/typography";

interface SectionLabelProps {
  children: React.ReactNode;
  /** Optional leading glyph; the dark dock's sections carry none. */
  icon?: React.ReactNode;
  /** `dark` is the dock and the in-score panels floating over a page. */
  tone?: "light" | "dark";
}

export const SectionLabel = ({
  children,
  icon,
  tone = "light",
}: SectionLabelProps): React.JSX.Element => (
  <div className="mb-2.5 flex items-center gap-2">
    {icon && (
      <span className="text-ethereal-gold" aria-hidden="true">
        {icon}
      </span>
    )}
    <Eyebrow as="p" color={tone === "dark" ? "ink-on-inverse-muted" : "muted"}>
      {children}
    </Eyebrow>
  </div>
);
