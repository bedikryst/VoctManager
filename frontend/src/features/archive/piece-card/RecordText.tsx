/**
 * @file RecordText.tsx
 * @description Growing text blocks and labels in the card's reading column.
 */

import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/primitives/typography";
import { CommitText } from "./CommitText";

export const READING_TEXT = "font-serif text-xl font-medium leading-relaxed fine-pointer:text-xl";
export const IPA_TEXT = "fine-pointer:text-sm leading-relaxed";

/**
 * A text block's label line, its check at the line's end. The block's review
 * edge is rendered by the caller on the `relative` element that holds the
 * label and the text together, so the edge runs down the whole block.
 */
export const RecordTextLabel = ({ id, label, action, prefix }: {
  id: string;
  label: string;
  action?: ReactNode;
  prefix?: ReactNode;
}) => (
  <div className="flex min-h-11 items-center justify-between gap-x-3 fine-pointer:min-h-9">
    <div className="flex min-w-0 items-center gap-2">
      {prefix}
      <Label as="label" htmlFor={id} size="base" color="graphite">{label}</Label>
    </div>
    {action}
  </div>
);

export const RecordText = ({ className, ...props }: Omit<ComponentProps<typeof CommitText>, "multiline">) => (
  <div className="-mx-2">
    <CommitText {...props} multiline className={cn("leading-relaxed", className)} />
  </div>
);
