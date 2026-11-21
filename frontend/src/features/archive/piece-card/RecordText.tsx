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

export const RecordTextLabel = ({ id, label, marker, action, prefix }: {
  id: string;
  label: string;
  marker?: ReactNode;
  action?: ReactNode;
  prefix?: ReactNode;
}) => (
  <div className="relative flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2 lg:justify-between">
    <div className="relative flex items-center gap-2">
      <div className="absolute right-full pe-0.5">{marker}</div>
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
