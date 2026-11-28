/**
 * @file FormSection.tsx
 * @description One section of an editor's form under a sans sub-heading, on
 * the surface's own ground: no rule beside the heading, no card around the
 * fields. The section is named by its heading, and a section holding a single
 * field can label that field with the same heading (`headingId`) rather than
 * repeat it in a label of its own.
 * @module shared/ui/composites/FormSection
 */

import React, { useId } from "react";

import { Text } from "@/shared/ui/primitives/typography";

export interface FormSectionProps {
  heading: string;
  /** The heading's id, for a lone field labelled by it; generated otherwise. */
  headingId?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormSection = ({
  heading,
  headingId,
  className,
  children,
}: FormSectionProps): React.JSX.Element => {
  const generatedId = useId();
  const id = headingId ?? generatedId;
  return (
    <section aria-labelledby={id} className={className}>
      <Text as="h3" id={id} size="base" weight="semibold" className="mb-3">
        {heading}
      </Text>
      {children}
    </section>
  );
};
